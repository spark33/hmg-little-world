package ai.littleworld

import android.content.Context
import android.content.pm.PackageManager
import ai.pleos.playground.navi.helper.NaviHelper
import ai.pleos.playground.navi.helper.listener.NaviHelperEventListener
import ai.pleos.playground.navi.data.RouteInfo
import ai.pleos.playground.navi.constants.NaviErrorCode
import kotlinx.coroutines.flow.MutableStateFlow

/** Compiled against official NaviHelper 3.0.5. Requires Pleos service and approved permission.
 * Route events are NOT a trusted gear/park signal. Safety remains UNKNOWN, so the vehicle UI is locked.
 * Sample venues are rejected before touching the navigation service.
 */
class PleosVehicleAdapter(private val context: Context): VehicleIntegration {
    override val safety = MutableStateFlow(SafetyState.UNKNOWN)
    override val location = MutableStateFlow<VehicleLocation?>(null)
    private var connected = false
    private var helper: NaviHelper? = null
    private val listener = object: NaviHelperEventListener {
        override fun onError(errorCode: NaviErrorCode) { connected = false }
        override fun onRoutingCompleted() { /* Route search completion is not an arrival or parked signal. */ }
    }
    init {
        try {
            helper = NaviHelper(context.applicationContext).also { navi ->
                navi.initialize(onConnected = { connected = true; navi.addListener(listener) }, onFailed = { connected = false })
            }
        } catch (_: Exception) { connected = false }
    }
    override fun navigationAvailable() = connected && context.checkSelfPermission("pleos.car.permission.NAVI_ROUTE_SEARCH") == PackageManager.PERMISSION_GRANTED
    override fun requestNavigation(destination: Destination): Boolean {
        val latitude = destination.latitude ?: return false
        val longitude = destination.longitude ?: return false
        if (destination.sample || !navigationAvailable() || safety.value != SafetyState.PARKED || !latitude.isFinite() || !longitude.isFinite() || latitude !in -90.0..90.0 || longitude !in -180.0..180.0) return false
        return try {
            helper?.requestRoute(RouteInfo(latitude=latitude, longitude=longitude, displayLatitude=null, displayLongitude=null, poiName=destination.name, poiId=destination.poiId, poiSubId="0", address=destination.address))
            true // Submission only; completion is reported by the SDK listener, not claimed as arrival.
        } catch (_: Exception) { false }
    }
    override fun lightingCapability() = LightingCapability(false,false,false)
    override fun applyTemporaryLighting(deliberateUserAction: Boolean) = false
    override fun restoreLighting() {}
    override fun close() { connected=false; helper?.removeListener(listener); helper?.release(); helper=null }
}
