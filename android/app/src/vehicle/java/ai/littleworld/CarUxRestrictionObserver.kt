package ai.littleworld

import android.car.Car
import android.car.drivingstate.CarUxRestrictionsManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper

/** Uses the AAOS restriction service explicitly required by the Pleos driving restriction guide.
 * Observations are read again in the foreground; cached unrestricted values never survive stop.
 * This observer does not itself authorize the entertainment UI.
 */
internal class CarUxRestrictionObserver(
    private val context: Context,
    private val handler: Handler = Handler(Looper.getMainLooper()),
    private val observation: (token: Long, restricted: Boolean?) -> Unit
) {
    private var car: Car? = null
    private var manager: CarUxRestrictionsManager? = null
    private var token = 0L
    private var subscription = 0L
    private var active = false
    private var closed = false
    private val refresh = object : Runnable {
        override fun run() {
            if (!active || closed) return
            readCurrent()
            if (active && !closed) handler.postDelayed(this, 1_000L)
        }
    }

    fun start(epoch: Long) {
        stop()
        if (closed) return
        token = epoch
        active = true
        observation(epoch, null)
        if (Build.VERSION.SDK_INT < 29 ||
            !context.packageManager.hasSystemFeature(PackageManager.FEATURE_AUTOMOTIVE)) return
        try {
            val created = Car.createCar(context.applicationContext, handler, Car.CAR_WAIT_TIMEOUT_DO_NOT_WAIT) { service, ready ->
                handler.post {
                    if (!active || closed || token != epoch) return@post
                    if (!ready) {
                        detachManager()
                        observation(epoch, null)
                    } else {
                        try {
                            car = service
                            detachManager()
                            val currentSubscription = subscription
                            manager = service.getCarManager(Car.CAR_UX_RESTRICTION_SERVICE) as? CarUxRestrictionsManager
                            manager?.registerListener { restrictions ->
                                handler.post {
                                    if (active && !closed && token == epoch && subscription == currentSubscription) {
                                        try {
                                            observation(epoch, restrictions?.isRequiresDistractionOptimization)
                                        } catch (_: Exception) {
                                            detachManager()
                                            observation(epoch, null)
                                        } catch (_: LinkageError) {
                                            detachManager()
                                            observation(epoch, null)
                                        }
                                    }
                                }
                            }
                            readCurrent()
                        } catch (_: Exception) {
                            detachManager()
                            observation(epoch, null)
                        } catch (_: LinkageError) {
                            detachManager()
                            observation(epoch, null)
                        }
                    }
                }
            }
            if (active && !closed && token == epoch) car = created
            else created?.disconnect()
            handler.postDelayed(refresh, 1_000L)
        } catch (_: Exception) {
            observation(epoch, null)
        } catch (_: LinkageError) {
            // Optional AAOS APIs may be absent or incompatible on an unsupported device.
            observation(epoch, null)
        }
    }

    private fun readCurrent() {
        if (!active || closed) return
        val service = car
        val restrictions = manager
        if (service == null || restrictions == null) {
            observation(token, null)
            return
        }
        try {
            if (!service.isConnected) {
                detachManager()
                observation(token, null)
            } else observation(token, restrictions.currentCarUxRestrictions?.isRequiresDistractionOptimization)
        } catch (_: Exception) {
            detachManager()
            observation(token, null)
        } catch (_: LinkageError) {
            detachManager()
            observation(token, null)
        }
    }

    private fun detachManager() {
        ++subscription
        val previous = manager
        manager = null
        cleanupSafely({ previous?.unregisterListener() })
    }

    fun stop() {
        active = false
        ++token
        handler.removeCallbacks(refresh)
        detachManager()
        val previous = car
        car = null
        cleanupSafely({ previous?.disconnect() })
    }

    fun close() { stop(); closed = true }
}
