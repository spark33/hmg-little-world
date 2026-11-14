package ai.littleworld
import org.junit.Assert.*
import org.junit.Test
import org.json.JSONObject
class BridgeTest {
    @Test fun validatesRequests() {
        assertNotNull(BridgeValidation.parse("""{"v":1,"id":"test-1","type":"navigate","destinationId":"chicago"}"""))
        val invalid=listOf("garbage", "{}", """{"v":2,"id":"x","type":"capabilities"}""", """{"v":"1","id":"x","type":"capabilities"}""", """{"v":1,"id":"x","type":"execute"}""", """{"v":1,"id":"x","type":"navigate","destinationId":"file:///etc/passwd"}""", """{"v":1,"id":"x","type":"capabilities","script":"evil"}""")
        invalid.forEach { assertNull(it,BridgeValidation.parse(it)) }
        assertNull(BridgeValidation.parse("x".repeat(2049)))
    }
    @Test fun demoCapabilityFallback() {
        val adapter=DemoVehicleAdapter()
        assertEquals(SafetyState.UNKNOWN,adapter.safety.value)
        assertNull(adapter.location.value)
        assertFalse(adapter.navigationAvailable())
        assertFalse(adapter.requestNavigation(Destination("chicago")))
        assertFalse(adapter.applyTemporaryLighting(true))
        assertFalse(adapter.applyTemporaryLighting(false))
        assertFalse(adapter.lightingCapability().supported)
        adapter.restoreLighting();adapter.close()
    }
    @Test fun typedBridgeDoesNotInventNavigation() {
        val bridge=PleosBridge(DemoVehicleAdapter())
        val reply=JSONObject(bridge.reply("""{"v":1,"id":"test","type":"navigate","destinationId":"chicago"}"""))
        assertEquals("test",reply.getString("id"));assertFalse(reply.getBoolean("available"))
        assertFalse(JSONObject(bridge.reply("""{"v":1,"id":"cap","type":"capabilities"}""")).getBoolean("lighting"))
    }
    @Test fun drivingRestrictionsFailClosed() {
        assertFalse(canInteract(SafetyState.UNKNOWN,false))
        assertFalse(canInteract(SafetyState.DRIVING,false))
        assertFalse(canInteract(SafetyState.DRIVING,true))
        assertTrue(canInteract(SafetyState.PARKED,false))
        assertTrue(canInteract(SafetyState.UNKNOWN,true))
    }
}
