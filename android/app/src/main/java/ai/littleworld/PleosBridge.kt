package ai.littleworld
import org.json.JSONObject

object BridgeValidation {
    fun parse(raw: String): JSONObject? = try {
        require(raw.length <= 2048)
        val o = JSONObject(raw)
        require(o.opt("v") is Int && o.getInt("v") == 1 && o.opt("id") is String && o.getString("id").matches(Regex("[a-zA-Z0-9-]{1,64}")))
        require(o.opt("type") is String && o.getString("type") in setOf("capabilities", "navigate"))
        require(o.keys().asSequence().all { it in setOf("v", "id", "type", "destinationId") })
        if (o.getString("type") == "navigate") require(o.opt("destinationId") is String && o.getString("destinationId") in setOf("nearby", "weekend", "chicago"))
        o
    } catch (_: Exception) { null }
}
class PleosBridge(private val vehicle: VehicleIntegration) {
    // Demo destinations only; the adapter never launches actual guidance to illustrative venues.
    fun reply(raw: String): String {
        val request = BridgeValidation.parse(raw) ?: return "{\"v\":1,\"error\":\"invalid-message\"}"
        val o = JSONObject().put("v",1).put("id",request.getString("id"))
        return when(request.getString("type")) {
            "capabilities" -> o.put("navigation",vehicle.navigationAvailable()).put("lighting",vehicle.lightingCapability().let { it.supported && it.authorized && it.canRestore }).toString()
            else -> o.put("available",vehicle.requestNavigation(Destination(request.getString("destinationId")))).put("reason","sample-destination-no-live-navigation").toString()
        }
    }
}
