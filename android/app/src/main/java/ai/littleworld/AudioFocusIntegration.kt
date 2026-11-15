package ai.littleworld

/** Audio focus is requested only in response to deliberate web sound interaction. */
interface AudioFocusIntegration {
    fun requestAudioFocus(): Boolean
    fun releaseAudioFocus()
    fun close()
}

internal enum class AudioFocusDecision { GRANTED, DENIED, DELAYED }
internal enum class AudioFocusChange { GAIN, LOSS }

/** SDK-free port makes OS denial, delayed/stale callbacks and lifecycle loss testable. */
internal interface AudioFocusPort {
    fun request(token: Long, onChange: (AudioFocusChange) -> Unit): AudioFocusDecision
    fun abandon(token: Long)
}

/** A gain callback never resumes audio. Only the return value of a current explicit request can. */
internal class AudioFocusSession(
    private val port: AudioFocusPort,
    private val allowed: () -> Boolean,
    private val onLost: () -> Unit
) : AudioFocusIntegration {
    private var generation = 0L
    private var token: Long? = null
    private var granted = false
    private var closed = false

    override fun requestAudioFocus(): Boolean {
        if (closed || !allowed()) {
            releaseAudioFocus()
            return false
        }
        if (granted) return true
        val current = ++generation
        token = current
        val decision = try {
            port.request(current) { change ->
                if (!closed && token == current && generation == current && change == AudioFocusChange.LOSS)
                    releaseAudioFocus()
            }
        } catch (_: Exception) {
            AudioFocusDecision.DENIED
        } catch (_: LinkageError) {
            AudioFocusDecision.DENIED
        }
        if (decision != AudioFocusDecision.GRANTED || closed || token != current ||
            generation != current || !allowed()) {
            if (token == current) releaseAudioFocus()
            else cleanupSafely({ port.abandon(current) })
            return false
        }
        granted = true
        return true
    }

    override fun releaseAudioFocus() {
        val previous = token
        val hadSession = previous != null || granted
        ++generation
        token = null
        granted = false
        if (previous != null) cleanupSafely({ port.abandon(previous) })
        if (hadSession) onLost()
    }

    override fun close() {
        closed = true
        releaseAudioFocus()
    }
}
