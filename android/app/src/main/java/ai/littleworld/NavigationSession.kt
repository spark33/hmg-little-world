package ai.littleworld

/** Route lifecycle only. Neither route search completion nor destination changes prove arrival. */
enum class NavigationStatus {
    UNAVAILABLE, DISCONNECTED, DENIED, READY, SUBMITTED, ROUTING, ROUTE_READY,
    CANCEL_REQUESTED, ERROR, CLOSED
}

data class NavigationSnapshot(
    val status: NavigationStatus,
    val reason: String,
    val destinationId: String? = null,
    val canRetry: Boolean = false
)

/** Optional adapter extension: existing preview adapters safely remain unavailable. */
interface NavigationSessionProvider {
    fun navigationSnapshot(): NavigationSnapshot
    fun retryNavigationConnection(): Boolean
    fun cancelNavigation(): Boolean
}

/** SDK-independent state policy, called only after the adapter validates its callback generation. */
class NavigationSession {
    var snapshot = NavigationSnapshot(NavigationStatus.DISCONNECTED, "navigation-service-disconnected", canRetry = true)
        private set

    fun connected(permissionGranted: Boolean) {
        if (snapshot.status == NavigationStatus.CLOSED) return
        snapshot = if (permissionGranted) NavigationSnapshot(NavigationStatus.READY, "navigation-ready")
        else NavigationSnapshot(NavigationStatus.DENIED, "navigation-permission-denied")
    }

    fun disconnected() {
        if (snapshot.status == NavigationStatus.CLOSED) return
        snapshot = NavigationSnapshot(NavigationStatus.DISCONNECTED, "navigation-service-disconnected", canRetry = true)
    }

    fun submitted(destinationId: String) {
        if (snapshot.status != NavigationStatus.READY && snapshot.status != NavigationStatus.ERROR &&
            snapshot.status != NavigationStatus.ROUTE_READY) return
        snapshot = NavigationSnapshot(NavigationStatus.SUBMITTED, "route-submission-accepted", destinationId)
    }

    fun routing() {
        if (snapshot.status != NavigationStatus.SUBMITTED) return
        snapshot = snapshot.copy(status = NavigationStatus.ROUTING, reason = "route-search-in-progress")
    }

    fun routeReady() {
        if (snapshot.status != NavigationStatus.SUBMITTED && snapshot.status != NavigationStatus.ROUTING) return
        snapshot = snapshot.copy(status = NavigationStatus.ROUTE_READY, reason = "route-search-complete-not-arrival")
    }

    fun cancelRequested() {
        if (snapshot.status !in setOf(NavigationStatus.SUBMITTED, NavigationStatus.ROUTING, NavigationStatus.ROUTE_READY)) return
        snapshot = snapshot.copy(status = NavigationStatus.CANCEL_REQUESTED, reason = "route-cancellation-requested")
    }

    fun failed(reason: String) {
        if (snapshot.status == NavigationStatus.CLOSED) return
        snapshot = NavigationSnapshot(NavigationStatus.ERROR, reason.take(160), snapshot.destinationId, canRetry = true)
    }

    fun close() {
        snapshot = NavigationSnapshot(NavigationStatus.CLOSED, "navigation-session-closed")
    }
}
