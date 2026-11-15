package ai.littleworld

/** Validate the complete request before any SDK route call; active searches cannot be replaced. */
internal fun canSubmitNavigation(
    destination: Destination,
    safety: SafetyState,
    status: NavigationStatus,
    foreground: Boolean,
    serviceAvailable: Boolean
): Boolean {
    val latitude = destination.latitude ?: return false
    val longitude = destination.longitude ?: return false
    return foreground && serviceAvailable && safety == SafetyState.PARKED && !destination.sample &&
        status in setOf(NavigationStatus.READY, NavigationStatus.ERROR, NavigationStatus.ROUTE_READY) &&
        latitude.isFinite() && longitude.isFinite() && latitude in -90.0..90.0 && longitude in -180.0..180.0
}
