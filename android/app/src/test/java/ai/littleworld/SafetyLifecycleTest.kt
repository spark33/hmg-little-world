package ai.littleworld

import org.junit.Assert.*
import org.junit.Test

class SafetyLifecycleTest {
    @Test fun productionUnrestrictedObservationsDoNotBypassTheRuntimeGate() {
        val gate = StationarySafetyGate()
        val epoch = gate.foreground()
        gate.observe(epoch, restricted = false, receivedAtMs = 1_000)
        assertEquals(SafetyState.UNKNOWN, gate.state(1_001))
        gate.observe(epoch, restricted = true, receivedAtMs = 1_100)
        assertEquals(SafetyState.DRIVING, gate.state(1_100))
    }

    @Test fun startupAndDisconnectedSourcesFailClosed() {
        val gate = StationarySafetyGate(platformValidated = true)
        assertEquals(SafetyState.UNKNOWN, gate.state(0))
        val epoch = gate.foreground()
        assertEquals(SafetyState.UNKNOWN, gate.state(1))
        gate.observe(epoch, false, 1)
        assertEquals(SafetyState.PARKED, gate.state(1))
        gate.unavailable(epoch)
        assertEquals(SafetyState.UNKNOWN, gate.state(2))
    }

    @Test fun freshnessIsBoundedAndClockReversalDoesNotExtendAuthorization() {
        val gate = StationarySafetyGate(platformValidated = true, maxObservationAgeMs = 100)
        val epoch = gate.foreground()
        gate.observe(epoch, false, 1_000)
        assertEquals(SafetyState.PARKED, gate.state(1_100))
        assertEquals(SafetyState.UNKNOWN, gate.state(1_101))
        assertEquals(SafetyState.UNKNOWN, gate.state(999))
    }

    @Test fun backgroundAndReconnectRequireANewObservation() {
        val gate = StationarySafetyGate(platformValidated = true)
        val first = gate.foreground()
        gate.observe(first, false, 1)
        gate.background()
        assertEquals(SafetyState.UNKNOWN, gate.state(2))
        val next = gate.foreground()
        assertNotEquals(first, next)
        gate.observe(first, false, 3) // An old Binder callback cannot unlock a new foreground.
        assertEquals(SafetyState.UNKNOWN, gate.state(3))
        gate.observe(next, false, 4)
        gate.unavailable(first) // An old disconnect cannot corrupt the current subscription.
        assertEquals(SafetyState.PARKED, gate.state(4))
    }

    @Test fun closeIsTerminalEvenWhenTheServiceRepliesLate() {
        val gate = StationarySafetyGate(platformValidated = true)
        val epoch = gate.foreground()
        gate.close()
        gate.observe(epoch, false, 1)
        val afterClose = gate.foreground()
        gate.observe(afterClose, false, 2)
        assertEquals(SafetyState.UNKNOWN, gate.state(2))
    }

    @Test fun negativeObservationTimesAreRejected() {
        val gate = StationarySafetyGate(platformValidated = true)
        val epoch = gate.foreground()
        gate.observe(epoch, false, -1)
        assertEquals(SafetyState.UNKNOWN, gate.state(1))
    }

    @Test fun rendererMustBeReadyBeforeAnyContentIsShown() {
        val policy = NativePresentationPolicy()
        policy.foreground()
        policy.focusChanged(true)
        assertFalse(policy.allowed(SafetyState.PARKED, false))
        policy.pageReady()
        assertTrue(policy.allowed(SafetyState.PARKED, false))
        assertFalse(policy.allowed(SafetyState.UNKNOWN, false))
        assertFalse(policy.allowed(SafetyState.DRIVING, false))
        assertFalse(policy.allowed(SafetyState.DRIVING, true))
        policy.pageLoading()
        assertFalse(policy.allowed(SafetyState.PARKED, false))
        policy.pageReady()
        assertTrue(policy.allowed(SafetyState.PARKED, false))
    }

    @Test fun nativeBackgroundGateCannotBeOverriddenByAStaleWebPage() {
        val policy = NativePresentationPolicy()
        policy.foreground()
        policy.focusChanged(true)
        policy.pageReady()
        assertTrue(policy.allowed(SafetyState.UNKNOWN, true))
        policy.background()
        policy.pageReady()
        assertFalse(policy.allowed(SafetyState.PARKED, false))
        policy.foreground()
        policy.focusChanged(true)
        assertFalse(policy.allowed(SafetyState.UNKNOWN, false))
    }

    @Test fun rendererFailureIsStickyAndDestroyIsTerminal() {
        val policy = NativePresentationPolicy()
        policy.foreground()
        policy.focusChanged(true)
        policy.pageReady()
        policy.contentFailed()
        policy.pageReady()
        policy.foreground()
        policy.focusChanged(true)
        assertFalse(policy.allowed(SafetyState.PARKED, false))
        val destroyed = NativePresentationPolicy()
        destroyed.pageReady()
        destroyed.foreground()
        destroyed.focusChanged(true)
        destroyed.destroy()
        destroyed.pageReady()
        destroyed.foreground()
        destroyed.focusChanged(true)
        assertFalse(destroyed.allowed(SafetyState.UNKNOWN, true))
    }

    @Test fun failingOptionalServicesDoNotPreventIndependentCleanup() {
        val released = mutableListOf<String>()
        cleanupSafely(
            { released += "observer"; throw IllegalStateException("service already gone") },
            { released += "listener"; throw NoClassDefFoundError("optional API unavailable") },
            { released += "webview" }
        )
        assertEquals(listOf("observer", "listener", "webview"), released)
    }
    @Test fun overlaysAndScreenOffCoverTheWorldIndependentlyOfVehicleState() {
        val policy = NativePresentationPolicy()
        policy.pageReady()
        policy.foreground()
        assertFalse(policy.allowed(SafetyState.PARKED, false))
        policy.focusChanged(true)
        assertTrue(policy.allowed(SafetyState.PARKED, false))
        policy.focusChanged(false)
        assertFalse(policy.allowed(SafetyState.PARKED, false))
        policy.focusChanged(true)
        policy.displayChanged(false)
        assertFalse(policy.allowed(SafetyState.PARKED, false))
        policy.displayChanged(true)
        assertTrue(policy.allowed(SafetyState.PARKED, false))
        assertFalse(policy.allowed(SafetyState.UNKNOWN, false))
        policy.destroy()
        policy.focusChanged(true)
        policy.displayChanged(true)
        assertFalse(policy.allowed(SafetyState.PARKED, false))
    }

}
