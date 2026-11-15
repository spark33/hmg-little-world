package ai.littleworld

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

/** In-memory ports only: no Android audio focus grant is fabricated or requested. */
class AudioBridgeTest {
    private class FocusPort : AudioFocusIntegration {
        var granted = false
        var requests = 0
        var releases = 0
        override fun requestAudioFocus(): Boolean { requests++; return granted }
        override fun releaseAudioFocus() { releases++ }
        override fun close() {}
    }
    private fun command(type: String) = """{"v":1,"id":"audio-test","type":"$type"}"""

    @Test fun focusRequestsMirrorTheActualPortDecisionAndDrivingNeverInvokesIt() {
        val adapter = DemoVehicleAdapter()
        val focus = FocusPort()
        val bridge = PleosBridge(adapter, audioFocus = focus)
        adapter.safety.value = SafetyState.DRIVING
        focus.granted = true
        val blocked = JSONObject(bridge.reply(command("audio-request")))
        assertFalse(blocked.getBoolean("audioFocus"))
        assertFalse(blocked.getBoolean("available"))
        assertEquals(0, focus.requests)
        adapter.safety.value = SafetyState.PARKED // Unit port fixture only; not a vehicle signal provider.
        focus.granted = false
        assertFalse(JSONObject(bridge.reply(command("audio-request"))).getBoolean("audioFocus"))
        focus.granted = true
        assertTrue(JSONObject(bridge.reply(command("audio-request"))).getBoolean("audioFocus"))
        assertEquals(2, focus.requests)
    }
    @Test fun releasingFocusRemainsIdempotentAndAvailableForCleanupWhileDriving() {
        val adapter = DemoVehicleAdapter()
        adapter.safety.value = SafetyState.DRIVING
        val focus = FocusPort()
        val bridge = PleosBridge(adapter, audioFocus = focus)
        repeat(2) {
            val reply = JSONObject(bridge.reply(command("audio-release")))
            assertFalse(reply.getBoolean("audioFocus"))
            assertEquals("audio-test", reply.getString("id"))
        }
        assertEquals(2, focus.releases)
        assertEquals(0, focus.requests)
        assertFalse(JSONObject(PleosBridge(adapter).reply(command("audio-request"))).getBoolean("audioFocus"))
    }
    @Test fun audioActionsHaveNoArbitraryNativeArguments() {
        assertNotNull(BridgeValidation.parse(command("audio-request")))
        assertNotNull(BridgeValidation.parse(command("audio-release")))
        assertNull(BridgeValidation.parse("""{"v":1,"id":"x","type":"audio-request","destinationId":"chicago"}"""))
        assertNull(BridgeValidation.parse("""{"v":1,"id":"x","type":"audio-request","duration":99999}"""))
    }
}
