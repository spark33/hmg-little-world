package ai.littleworld

/** A short-lived platform UX observation, never an inference from speed or parking brake.
 * Production passes platformValidated=false until the official Pleos runtime matrix passes.
 */
class StationarySafetyGate(
    private val platformValidated: Boolean = false,
    private val maxObservationAgeMs: Long = 3_000L
) {
    private data class Observation(val restricted: Boolean, val receivedAtMs: Long)
    private var observation: Observation? = null
    private var foreground = false
    private var closed = false
    private var epoch = 0L

    fun foreground(): Long {
        if (closed) return epoch
        foreground = true
        observation = null
        return ++epoch
    }

    fun background() {
        foreground = false
        observation = null
        ++epoch
    }

    fun observe(token: Long, restricted: Boolean, receivedAtMs: Long) {
        if (!closed && foreground && token == epoch && receivedAtMs >= 0)
            observation = Observation(restricted, receivedAtMs)
    }

    fun unavailable(token: Long) {
        if (token == epoch) observation = null
    }

    fun state(nowMs: Long): SafetyState {
        val current = observation ?: return SafetyState.UNKNOWN
        if (closed || !foreground || nowMs < current.receivedAtMs ||
            nowMs - current.receivedAtMs > maxObservationAgeMs) return SafetyState.UNKNOWN
        if (current.restricted) return SafetyState.DRIVING
        return if (platformValidated) SafetyState.PARKED else SafetyState.UNKNOWN
    }

    fun close() {
        closed = true
        background()
    }
}
