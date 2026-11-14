package ai.littleworld
import kotlinx.coroutines.flow.MutableStateFlow

/** No signal is fabricated. UNKNOWN stays locked in the vehicle flavor. */
class DemoVehicleAdapter : VehicleIntegration {
    override val safety = MutableStateFlow(SafetyState.UNKNOWN)
    override val location = MutableStateFlow<VehicleLocation?>(null)
    override fun navigationAvailable() = false
    override fun requestNavigation(destination: Destination) = false
    override fun lightingCapability() = LightingCapability(false, false, false)
    override fun applyTemporaryLighting(deliberateUserAction: Boolean) = false
    override fun restoreLighting() {}
    override fun close() {}
}
