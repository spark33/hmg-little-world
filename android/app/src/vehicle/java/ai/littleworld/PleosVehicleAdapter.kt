package ai.littleworld

import android.content.Context
import android.content.pm.PackageManager
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import ai.pleos.playground.navi.helper.NaviHelper
import ai.pleos.playground.navi.helper.listener.NaviHelperEventListener
import ai.pleos.playground.navi.data.RouteInfo
import ai.pleos.playground.navi.constants.NaviErrorCode
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Service availability does not authorize stationary entertainment or establish arrival.
 * The official UX observer is wired, but unrestricted observations remain UNKNOWN until the
 * Pleos runtime safety matrix has been validated. There is no application setting to bypass it.
 */
class PleosVehicleAdapter(private val context: Context) : VehicleIntegration, NavigationSessionProvider {
    private val mutableSafety = MutableStateFlow(SafetyState.UNKNOWN)
    override val safety: StateFlow<SafetyState> = mutableSafety.asStateFlow()
    override val location: StateFlow<VehicleLocation?> = MutableStateFlow<VehicleLocation?>(null).asStateFlow()
    private val gate = StationarySafetyGate(platformValidated = false)
    private val handler = Handler(Looper.getMainLooper())
    private val session = NavigationSession()
    private var foreground = false
    private var closed = false
    private var connected = false
    private var connectionEpoch = 0L
    private var lastPermission = false
    private var helper: NaviHelper? = null
    private var listener: NaviHelperEventListener? = null
    private val restrictionObserver = CarUxRestrictionObserver(context, handler) { epoch, restricted ->
        if (closed || !foreground) return@CarUxRestrictionObserver
        if (restricted == null) gate.unavailable(epoch)
        else gate.observe(epoch, restricted, SystemClock.elapsedRealtime())
        publishSafety()
    }

    private fun permissionGranted() = context.checkSelfPermission("pleos.car.permission.NAVI_ROUTE_SEARCH") == PackageManager.PERMISSION_GRANTED
    private fun publishSafety() { mutableSafety.value = gate.state(SystemClock.elapsedRealtime()) }

    override fun onForeground() {
        if (closed || foreground) return
        foreground = true
        val epoch = gate.foreground()
        mutableSafety.value = SafetyState.UNKNOWN
        try { restrictionObserver.start(epoch) }
        catch (_: Exception) { gate.unavailable(epoch) }
        catch (_: LinkageError) { gate.unavailable(epoch) }
        connectNavigation()
    }

    override fun onBackground() {
        foreground = false
        gate.background()
        mutableSafety.value = SafetyState.UNKNOWN
        cleanupSafely({ restrictionObserver.stop() }, { disconnectNavigation() })
    }

    private fun connectNavigation() {
        if (closed || !foreground || helper != null) return
        val epoch = ++connectionEpoch
        session.disconnected()
        try {
            val navi = NaviHelper(context.applicationContext)
            helper = navi
            val events = object : NaviHelperEventListener {
                override fun onError(errorCode: NaviErrorCode) {
                    handler.post {
                        if (acceptsCallback(epoch)) session.failed("route-error-${errorCode.name.lowercase()}")
                    }
                }
                override fun onRoutingCompleted() {
                    handler.post { if (acceptsCallback(epoch)) session.routeReady() }
                }
                override fun onRouteCancelled() {
                    handler.post {
                        if (acceptsCallback(epoch)) session.connected(permissionGranted())
                    }
                }
            }
            listener = events
            navi.initialize(onConnected = {
                handler.post {
                    if (acceptsCallback(epoch)) {
                        try {
                            navi.addListener(events)
                            connected = true
                            lastPermission = permissionGranted()
                            session.connected(lastPermission)
                        } catch (_: Exception) {
                            connected = false
                            session.failed("navigation-listener-unavailable")
                        }
                    }
                }
            }, onFailed = {
                handler.post {
                    if (acceptsCallback(epoch)) {
                        connected = false
                        session.failed("navigation-service-unavailable")
                    }
                }
            })
        } catch (_: Exception) {
            connected = false
            session.failed("navigation-initialization-unavailable")
        } catch (_: LinkageError) {
            connected = false
            session.failed("navigation-sdk-incompatible")
        }
    }

    private fun acceptsCallback(epoch: Long) = !closed && foreground && connectionEpoch == epoch

    private fun disconnectNavigation() {
        ++connectionEpoch
        connected = false
        val previous = helper
        val events = listener
        helper = null
        listener = null
        cleanupSafely(
            { if (events != null) previous?.removeListener(events) },
            { previous?.release() }
        )
        session.disconnected()
    }

    override fun navigationAvailable() = !closed && foreground && connected && permissionGranted()

    override fun navigationSnapshot(): NavigationSnapshot {
        if (closed) return session.snapshot
        if (connected) {
            val granted = permissionGranted()
            if (granted != lastPermission) {
                lastPermission = granted
                session.connected(granted)
            }
        }
        return session.snapshot
    }

    override fun retryNavigationConnection(): Boolean {
        if (closed || !foreground) return false
        disconnectNavigation()
        connectNavigation()
        return helper != null
    }

    override fun requestNavigation(destination: Destination): Boolean {
        val latitude = destination.latitude ?: return false
        val longitude = destination.longitude ?: return false
        publishSafety()
        if (!canSubmitNavigation(destination, safety.value, navigationSnapshot().status,
                foreground, navigationAvailable())) return false
        val navi = helper ?: return false
        return try {
            navi.requestRoute(RouteInfo(latitude = latitude, longitude = longitude,
                displayLatitude = null, displayLongitude = null, poiName = destination.name,
                poiId = destination.poiId, poiSubId = "0", address = destination.address))
            session.submitted(destination.id)
            true // Request accepted only; neither a completed search nor arrival is asserted.
        } catch (_: Exception) {
            session.failed("route-submission-failed")
            false
        }
    }

    override fun cancelNavigation(): Boolean {
        publishSafety()
        if (!navigationAvailable() || safety.value != SafetyState.PARKED ||
            session.snapshot.status !in setOf(NavigationStatus.SUBMITTED, NavigationStatus.ROUTING, NavigationStatus.ROUTE_READY)) return false
        val navi = helper ?: return false
        return try {
            navi.cancelRoute()
            session.cancelRequested()
            true // Callback is required before claiming cancellation completed.
        } catch (_: Exception) {
            session.failed("route-cancellation-failed")
            false
        }
    }

    override fun lightingCapability() = LightingCapability(false, false, false)
    override fun applyTemporaryLighting(deliberateUserAction: Boolean) = false
    override fun restoreLighting() {}
    override fun close() {
        if (closed) return
        closed = true
        foreground = false
        gate.close()
        mutableSafety.value = SafetyState.UNKNOWN
        cleanupSafely({ restrictionObserver.close() }, { disconnectNavigation() })
        session.close()
    }
}
