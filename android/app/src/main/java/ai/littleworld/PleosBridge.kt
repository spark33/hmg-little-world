package ai.littleworld

import org.json.JSONObject

object BridgeValidation {
    private val actions = setOf("capabilities", "navigate", "navigation-status", "navigation-retry", "navigation-cancel")

    fun parse(raw: String, verifiedIds: Set<String> = ProductionDestinations.ids): JSONObject? = try {
        require(raw.length <= 2048)
        val o = JSONObject(raw)
        require(o.opt("v") is Int && o.getInt("v") == 1)
        require(o.opt("id") is String && o.getString("id").matches(Regex("[a-zA-Z0-9-]{1,64}")))
        require(o.opt("type") is String && o.getString("type") in actions)
        val navigating = o.getString("type") == "navigate"
        val fields = if (navigating) setOf("v", "id", "type", "destinationId") else setOf("v", "id", "type")
        require(o.keys().asSequence().all { it in fields })
        if (navigating) require(o.opt("destinationId") is String &&
            o.getString("destinationId") in SAMPLE_DESTINATION_IDS + verifiedIds)
        o
    } catch (_: Exception) { null }
}

class PleosBridge(
    private val vehicle: VehicleIntegration,
    private val destinations: DestinationRegistry = ProductionDestinations
) {
    fun reply(raw: String): String {
        val request = BridgeValidation.parse(raw, destinations.ids)
            ?: return "{\"v\":1,\"error\":\"invalid-message\"}"
        val output = JSONObject().put("v", 1).put("id", request.getString("id"))
        val provider = vehicle as? NavigationSessionProvider
        return try {
            when (request.getString("type")) {
                "capabilities" -> output
                    .put("navigation", vehicle.navigationAvailable() && vehicle.safety.value == SafetyState.PARKED && destinations.ids.isNotEmpty())
                    .put("lighting", vehicle.lightingCapability().let { it.supported && it.authorized && it.canRestore })
                    .put("verifiedDestinationCount", destinations.ids.size)
                "navigate" -> {
                    val id = request.getString("destinationId")
                    // Sample destinations never reach the adapter, even if an adapter is defective.
                    if (id in SAMPLE_DESTINATION_IDS) return output.put("available", false)
                        .put("navigationStatus", "unavailable")
                        .put("reason", "sample-destination-no-live-navigation").toString()
                    val destination = destinations.find(id)
                    if (destination == null || vehicle.safety.value != SafetyState.PARKED)
                        return output.put("available", false).put("navigationStatus", "unavailable")
                            .put("reason", "trusted-parked-signal-required").toString()
                    val submitted = vehicle.requestNavigation(destination.asDestination())
                    output.put("available", submitted)
                    if (!submitted) return refused(output, provider?.navigationSnapshot(), "route-submission-not-accepted")
                    if (provider == null) return output.put("navigationStatus", "submitted")
                        .put("reason", "route-submission-accepted").toString()
                }
                "navigation-retry" -> output.put("available", provider?.retryNavigationConnection() ?: false)
                "navigation-cancel" -> {
                    if (vehicle.safety.value != SafetyState.PARKED) return output.put("available", false)
                        .put("navigationStatus", "unavailable").put("reason", "trusted-parked-signal-required").toString()
                    val accepted = provider?.cancelNavigation() ?: false
                    output.put("available", accepted)
                    if (!accepted) return refused(output, provider?.navigationSnapshot(), "route-cancellation-not-accepted")
                }
            }
            appendSnapshot(output, provider?.navigationSnapshot())
        } catch (_: Exception) {
            output.put("available", false).put("navigationStatus", "error")
                .put("reason", "navigation-service-error").put("canRetry", true).toString()
        }
    }

    /** A refused command must not borrow a previous route's successful state. */
    private fun refused(output: JSONObject, snapshot: NavigationSnapshot?, reason: String): String {
        val failureStates = setOf(NavigationStatus.UNAVAILABLE, NavigationStatus.DISCONNECTED,
            NavigationStatus.DENIED, NavigationStatus.ERROR, NavigationStatus.CLOSED)
        if (snapshot != null && snapshot.status in failureStates) return appendSnapshot(output, snapshot)
        return output.put("navigationStatus", "unavailable").put("reason", reason).put("canRetry", false).toString()
    }

    private fun appendSnapshot(output: JSONObject, snapshot: NavigationSnapshot?): String {
        val state = snapshot ?: NavigationSnapshot(NavigationStatus.UNAVAILABLE, "navigation-service-unavailable")
        output.put("navigationStatus", state.status.name.lowercase().replace('_', '-'))
            .put("reason", state.reason.take(160)).put("canRetry", state.canRetry)
        state.destinationId?.let { output.put("destinationId", it) }
        if (state.status == NavigationStatus.READY) {
            if (vehicle.safety.value != SafetyState.PARKED) output
                .put("navigationStatus", "unavailable").put("reason", "trusted-parked-signal-required")
            else if (destinations.ids.isEmpty()) output
                .put("navigationStatus", "unavailable").put("reason", "verified-destinations-unconfigured")
        }
        return output.toString()
    }
}
