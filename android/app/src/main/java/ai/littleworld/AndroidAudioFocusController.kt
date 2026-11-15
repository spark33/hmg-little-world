package ai.littleworld

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import android.os.PowerManager

/** A short optional game chime never owns focus across app/safety lifecycle boundaries. */
internal class AndroidAudioFocusController(
    context: Context,
    allowed: () -> Boolean,
    private val onChanged: (granted: Boolean) -> Unit,
    private val handler: Handler = Handler(Looper.getMainLooper())
) : AudioFocusIntegration {
    private val port = AndroidAudioFocusPort(context, handler)
    private val power = try { context.applicationContext.getSystemService(PowerManager::class.java) }
        catch (_: Exception) { null }
        catch (_: LinkageError) { null }
    private val leaseExpired: Runnable = Runnable { session.releaseAudioFocus() }
    private val session: AudioFocusSession = AudioFocusSession(port, {
        try { allowed() && power?.isInteractive == true }
        catch (_: Exception) { false }
        catch (_: LinkageError) { false }
    }) {
        handler.removeCallbacks(leaseExpired)
        onChanged(false)
    }

    override fun requestAudioFocus(): Boolean {
        val granted = session.requestAudioFocus()
        handler.removeCallbacks(leaseExpired)
        if (granted) handler.postDelayed(leaseExpired, MAX_CHIME_FOCUS_MS)
        return granted
    }

    override fun releaseAudioFocus() {
        handler.removeCallbacks(leaseExpired)
        session.releaseAudioFocus()
    }

    override fun close() {
        handler.removeCallbacks(leaseExpired)
        session.close()
    }

    private companion object {
        // Current reveal chime finishes within 6 s of the explicit confirmation.
        const val MAX_CHIME_FOCUS_MS = 8_000L
    }
}

private class AndroidAudioFocusPort(context: Context, private val handler: Handler) : AudioFocusPort {
    private val manager = try { context.applicationContext.getSystemService(AudioManager::class.java) }
        catch (_: Exception) { null }
        catch (_: LinkageError) { null }
    private val requests = mutableMapOf<Long, AudioFocusRequest>()

    override fun request(token: Long, onChange: (AudioFocusChange) -> Unit): AudioFocusDecision {
        val audioManager = manager ?: return AudioFocusDecision.DENIED
        val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            .setAudioAttributes(AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_GAME)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build())
            .setAcceptsDelayedFocusGain(false)
            .setWillPauseWhenDucked(true)
            .setOnAudioFocusChangeListener({ change ->
                onChange(if (change == AudioManager.AUDIOFOCUS_GAIN) AudioFocusChange.GAIN else AudioFocusChange.LOSS)
            }, handler)
            .build()
        requests[token] = request
        val result = audioManager.requestAudioFocus(request)
        // A synchronous lifecycle/loss callback can abandon before requestAudioFocus returns.
        if (!requests.containsKey(token)) {
            audioManager.abandonAudioFocusRequest(request)
            return AudioFocusDecision.DENIED
        }
        return when (result) {
            AudioManager.AUDIOFOCUS_REQUEST_GRANTED -> AudioFocusDecision.GRANTED
            AudioManager.AUDIOFOCUS_REQUEST_DELAYED -> AudioFocusDecision.DELAYED
            else -> AudioFocusDecision.DENIED
        }
    }

    override fun abandon(token: Long) {
        val request = requests.remove(token) ?: return
        manager?.abandonAudioFocusRequest(request)
    }
}
