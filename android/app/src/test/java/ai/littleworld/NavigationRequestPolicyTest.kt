package ai.littleworld

import org.junit.Assert.*
import org.junit.Test

class NavigationRequestPolicyTest {
    private val destination = Destination("vetted", latitude = 37.5, longitude = 127.0, sample = false)
    private fun allowed(
        request: Destination = destination,
        safety: SafetyState = SafetyState.PARKED,
        status: NavigationStatus = NavigationStatus.READY,
        foreground: Boolean = true,
        available: Boolean = true
    ) = canSubmitNavigation(request, safety, status, foreground, available)

    @Test fun acceptsAnExplicitValidRequestOnlyWhenStationaryAndReady() {
        assertTrue(allowed())
        assertTrue(allowed(status = NavigationStatus.ERROR))
        assertTrue(allowed(status = NavigationStatus.ROUTE_READY))
    }

    @Test fun activeSearchAndPendingCancellationCannotBeReplaced() {
        for (status in listOf(NavigationStatus.SUBMITTED, NavigationStatus.ROUTING, NavigationStatus.CANCEL_REQUESTED))
            assertFalse(status.name, allowed(status = status))
    }

    @Test fun unavailableDeniedDisconnectedAndClosedSessionsCannotSubmit() {
        for (status in listOf(NavigationStatus.UNAVAILABLE, NavigationStatus.DISCONNECTED, NavigationStatus.DENIED, NavigationStatus.CLOSED))
            assertFalse(status.name, allowed(status = status))
        assertFalse(allowed(available = false))
    }

    @Test fun unknownDrivingAndBackgroundNeverSubmit() {
        assertFalse(allowed(safety = SafetyState.UNKNOWN))
        assertFalse(allowed(safety = SafetyState.DRIVING))
        assertFalse(allowed(foreground = false))
    }

    @Test fun samplesAndMissingOrNonFiniteCoordinatesAreRejectedBeforeSdkCalls() {
        for (request in listOf(destination.copy(sample = true), destination.copy(latitude = null),
                destination.copy(longitude = null), destination.copy(latitude = Double.NaN),
                destination.copy(longitude = Double.POSITIVE_INFINITY), destination.copy(latitude = 90.1),
                destination.copy(latitude = -90.1), destination.copy(longitude = 180.1), destination.copy(longitude = -180.1)))
            assertFalse(request.toString(), allowed(request = request))
    }
}
