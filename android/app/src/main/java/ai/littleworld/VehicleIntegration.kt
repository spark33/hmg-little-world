package ai.littleworld
import kotlinx.coroutines.flow.StateFlow

enum class SafetyState { PARKED, DRIVING, UNKNOWN }
data class VehicleLocation(val latitude: Double, val longitude: Double)
data class Destination(val id: String, val latitude: Double? = null, val longitude: Double? = null, val name: String = "Sample destination", val address: String = "", val poiId: String = "", val sample: Boolean = true)
data class LightingCapability(val supported: Boolean, val authorized: Boolean, val canRestore: Boolean)
interface VehicleIntegration {
    val safety: StateFlow<SafetyState>
    val location: StateFlow<VehicleLocation?>
    fun navigationAvailable(): Boolean
    fun requestNavigation(destination: Destination): Boolean
    fun lightingCapability(): LightingCapability
    fun applyTemporaryLighting(deliberateUserAction: Boolean): Boolean
    fun restoreLighting()
    fun close()
}
fun canInteract(safety: SafetyState, nonVehiclePreview: Boolean): Boolean = safety == SafetyState.PARKED || (nonVehiclePreview && safety == SafetyState.UNKNOWN)
