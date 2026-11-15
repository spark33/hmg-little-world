package ai.littleworld

import kotlinx.coroutines.flow.MutableStateFlow
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class NavigationTest {
    private class Adapter(state: SafetyState = SafetyState.UNKNOWN): VehicleIntegration {
        override val safety = MutableStateFlow(state)
        override val location = MutableStateFlow<VehicleLocation?>(null)
        var routeCalls = 0
        var acceptRoutes = true
        var routed: Destination? = null
        override fun navigationAvailable() = true
        override fun requestNavigation(destination: Destination): Boolean { routeCalls++; routed = destination; return acceptRoutes }
        override fun lightingCapability() = LightingCapability(false, false, false)
        override fun applyTemporaryLighting(deliberateUserAction: Boolean) = false
        override fun restoreLighting() {}
        override fun close() {}
    }
    private fun fixture() = VerifiedDestination("approved-test-id", 37.0, 127.0, "Seoul test-only illustration", "Fixture address, not a real venue", "fixture-poi", "https://example.com/fixture", "2024-02-29")
    private fun route(id: String) = """{"v":1,"id":"test","type":"navigate","destinationId":"$id"}"""
    private class ProviderAdapter(val base: Adapter): VehicleIntegration by base, NavigationSessionProvider {
        var cancellations = 0
        var acceptCancellation = true
        var reportedStatus = NavigationStatus.SUBMITTED
        override fun navigationSnapshot() = NavigationSnapshot(reportedStatus, "previous-route-state", "approved-test-id")
        override fun retryNavigationConnection() = false
        override fun cancelNavigation(): Boolean { cancellations++; return acceptCancellation }
    }

    @Test fun samplesNeverReachAnyAdapter() {
        val adapter = Adapter(SafetyState.PARKED)
        val bridge = PleosBridge(adapter)
        SAMPLE_DESTINATION_IDS.forEach { id ->
            val reply = JSONObject(bridge.reply(route(id)))
            assertFalse(reply.getBoolean("available"))
            assertEquals("sample-destination-no-live-navigation", reply.getString("reason"))
        }
        assertEquals(0, adapter.routeCalls)
        assertTrue(ProductionDestinations.ids.isEmpty())
    }
    @Test fun vettedRegistryOwnsDestinationFieldsAndRequiresParked() {
        val adapter = Adapter()
        val registry = DestinationRegistry(listOf(fixture()))
        val bridge = PleosBridge(adapter, registry)
        assertFalse(JSONObject(bridge.reply(route("approved-test-id"))).getBoolean("available"))
        assertEquals(0, adapter.routeCalls)
        adapter.safety.value = SafetyState.DRIVING
        assertFalse(JSONObject(bridge.reply(route("approved-test-id"))).getBoolean("available"))
        adapter.safety.value = SafetyState.PARKED // Test fixture only; production never fabricates this state.
        val reply = JSONObject(bridge.reply(route("approved-test-id")))
        assertTrue(reply.getBoolean("available"))
        assertEquals("submitted", reply.getString("navigationStatus"))
        assertEquals(1, adapter.routeCalls)
        assertEquals(37.0, adapter.routed!!.latitude!!, 0.0)
        assertFalse(adapter.routed!!.sample)
        assertNull(BridgeValidation.parse(route("approved-test-id")))
    }
    @Test fun registryRejectsBadProvenanceCoordinatesDatesDuplicatesAndSampleIds() {
        val valid = fixture()
        val invalid = listOf(valid.copy(latitude = Double.NaN), valid.copy(longitude = 181.0),
            valid.copy(sourceUrl = "http://example.com"), valid.copy(verifiedOn = "2026-02-30"),
            valid.copy(id = "chicago"), valid.copy(poiId = ""), valid.copy(sourceUrl = "https://user:secret@example.com/"))
        invalid.forEach { assertFalse(it.isValid()) }
        try { DestinationRegistry(listOf(valid, valid)); fail("duplicate registry ID") } catch (_: IllegalArgumentException) {}
    }
    @Test fun provenanceUrlsAcceptSeoulPathsAndRejectWhitespaceCredentialsAndFragments() {
        assertTrue(fixture().copy(sourceUrl = "https://example.com/seoul/sights").isValid())
        assertTrue(fixture().copy(sourceUrl = "https://example.com:443/seoul?category=sights").isValid())
        for (url in listOf("https://example.com/a b", "https://example.com/a\tb", "https://example.com/a\u00a0b",
            "https://user:password@example.com/seoul", "https:///seoul", "https://example.com/seoul#part",
            "https://example.com:0/seoul", "https://example.com:444/seoul"))
            assertFalse(url, fixture().copy(sourceUrl = url).isValid())
    }
    @Test fun strictProtocolDoesNotAcceptArbitraryNativeRequestsOrCoordinateFields() {
        for (action in listOf("capabilities", "navigation-status", "navigation-retry", "navigation-cancel")) {
            assertNotNull(BridgeValidation.parse("""{"v":1,"id":"test","type":"$action"}"""))
            assertNull(BridgeValidation.parse("""{"v":1,"id":"test","type":"$action","destinationId":"chicago"}"""))
        }
        assertNull(BridgeValidation.parse("""{"v":1,"id":"test","type":"navigate","destinationId":"chicago","latitude":37}"""))
        assertNull(BridgeValidation.parse(route("unregistered-id")))
    }
    @Test fun sessionNeverInventsArrivalOrResurrectsAfterClose() {
        val session = NavigationSession()
        session.routeReady()
        assertEquals(NavigationStatus.DISCONNECTED, session.snapshot.status)
        session.connected(false)
        assertEquals(NavigationStatus.DENIED, session.snapshot.status)
        session.submitted("approved-test-id")
        assertEquals(NavigationStatus.DENIED, session.snapshot.status)
        session.connected(true)
        session.submitted("approved-test-id")
        session.routing()
        session.routeReady()
        assertEquals(NavigationStatus.ROUTE_READY, session.snapshot.status)
        assertEquals("route-search-complete-not-arrival", session.snapshot.reason)
        session.cancelRequested()
        assertEquals(NavigationStatus.CANCEL_REQUESTED, session.snapshot.status)
        session.close()
        session.connected(true); session.routeReady(); session.failed("late-error"); session.disconnected()
        assertEquals(NavigationStatus.CLOSED, session.snapshot.status)
        assertNull(session.snapshot.destinationId)
    }
    @Test fun capabilitiesNeverAdvertiseAnUnconfiguredDestinationProvider() {
        val reply = JSONObject(PleosBridge(Adapter(SafetyState.PARKED)).reply("""{"v":1,"id":"cap","type":"capabilities"}"""))
        assertFalse(reply.getBoolean("navigation"))
        assertEquals(0, reply.getInt("verifiedDestinationCount"))
    }
    @Test fun cancellationMutationsAlsoRequireTrustedParkedState() {
        val adapter = ProviderAdapter(Adapter())
        val bridge = PleosBridge(adapter)
        val request = """{"v":1,"id":"cancel","type":"navigation-cancel"}"""
        assertFalse(JSONObject(bridge.reply(request)).getBoolean("available"))
        assertEquals("unavailable", JSONObject(bridge.reply(request)).getString("navigationStatus"))
        adapter.base.safety.value = SafetyState.DRIVING
        assertFalse(JSONObject(bridge.reply(request)).getBoolean("available"))
        assertEquals(0, adapter.cancellations)
        adapter.base.safety.value = SafetyState.PARKED
        assertTrue(JSONObject(bridge.reply(request)).getBoolean("available"))
        assertEquals(1, adapter.cancellations)
    }
    @Test fun refusedCommandsDoNotClaimThePreviousRouteWasNewlySubmittedOrCancelled() {
        val adapter = ProviderAdapter(Adapter(SafetyState.PARKED))
        val bridge = PleosBridge(adapter, DestinationRegistry(listOf(fixture())))
        adapter.base.acceptRoutes = false
        val submission = JSONObject(bridge.reply(route("approved-test-id")))
        assertFalse(submission.getBoolean("available"))
        assertEquals("unavailable", submission.getString("navigationStatus"))
        assertEquals("route-submission-not-accepted", submission.getString("reason"))
        adapter.reportedStatus = NavigationStatus.CANCEL_REQUESTED
        adapter.acceptCancellation = false
        val cancellation = JSONObject(bridge.reply("""{"v":1,"id":"cancel","type":"navigation-cancel"}"""))
        assertFalse(cancellation.getBoolean("available"))
        assertEquals("unavailable", cancellation.getString("navigationStatus"))
        assertEquals("route-cancellation-not-accepted", cancellation.getString("reason"))
    }
}
