package ai.littleworld

import org.junit.Assert.*
import org.junit.Test

class AudioFocusSessionTest {
    private class Port : AudioFocusPort {
        var decision = AudioFocusDecision.GRANTED
        var requests = 0
        var throwOnRequest = false
        var throwOnAbandon = false
        var duringRequest: ((AudioFocusChange) -> Unit) -> Unit = {}
        val callbacks = mutableMapOf<Long, (AudioFocusChange) -> Unit>()
        val abandoned = mutableListOf<Long>()
        override fun request(token: Long, onChange: (AudioFocusChange) -> Unit): AudioFocusDecision {
            ++requests
            callbacks[token] = onChange
            if (throwOnRequest) throw IllegalStateException("service unavailable")
            duringRequest(onChange)
            return decision
        }
        override fun abandon(token: Long) {
            abandoned += token
            if (throwOnAbandon) throw IllegalStateException("service gone")
        }
    }

    @Test fun creatingAControllerDoesNotRequestOrInventFocus() {
        val port = Port()
        var lost = 0
        AudioFocusSession(port, { true }, { ++lost })
        assertEquals(0, port.requests)
        assertEquals(0, lost)
    }

    @Test fun onlyTheCurrentExplicitGrantedRequestCanAuthorizeSound() {
        val port = Port()
        val session = AudioFocusSession(port, { true }, {})
        assertTrue(session.requestAudioFocus())
        assertTrue(session.requestAudioFocus())
        assertEquals(1, port.requests)
        session.releaseAudioFocus()
        assertEquals(1, port.abandoned.size)
    }

    @Test fun deniedAndDelayedRequestsNeverGrantOnALaterGainCallback() {
        for (decision in listOf(AudioFocusDecision.DENIED, AudioFocusDecision.DELAYED)) {
            val port = Port().apply { this.decision = decision }
            var lost = 0
            val session = AudioFocusSession(port, { true }, { ++lost })
            assertFalse(session.requestAudioFocus())
            port.callbacks.values.single()(AudioFocusChange.GAIN)
            assertEquals(1, port.abandoned.size)
            assertEquals(1, lost)
            port.decision = AudioFocusDecision.GRANTED
            assertTrue(session.requestAudioFocus()) // A new explicit interaction is required.
            assertEquals(2, port.requests)
        }
    }

    @Test fun lossAbandonsAndAQueuedGainDoesNotAutomaticallyResume() {
        val port = Port()
        var lost = 0
        val session = AudioFocusSession(port, { true }, { ++lost })
        assertTrue(session.requestAudioFocus())
        val previous = port.callbacks.values.single()
        previous(AudioFocusChange.LOSS)
        previous(AudioFocusChange.GAIN)
        assertEquals(1, lost)
        assertEquals(1, port.abandoned.size)
        assertTrue(session.requestAudioFocus())
        assertEquals(2, port.requests)
    }

    @Test fun staleLossFromAnAbandonedSessionCannotCancelANewGrant() {
        val port = Port()
        var lost = 0
        val session = AudioFocusSession(port, { true }, { ++lost })
        assertTrue(session.requestAudioFocus())
        val previous = port.callbacks.values.single()
        session.releaseAudioFocus()
        assertTrue(session.requestAudioFocus())
        previous(AudioFocusChange.LOSS)
        assertEquals(1, lost)
        assertEquals(1, port.abandoned.size)
        assertTrue(session.requestAudioFocus())
        assertEquals(2, port.requests)
    }

    @Test fun unsafeBackgroundOrUnavailablePresentationDoesNotRequestFocus() {
        val port = Port()
        var allowed = false
        var lost = 0
        val session = AudioFocusSession(port, { allowed }, { ++lost })
        assertFalse(session.requestAudioFocus())
        assertEquals(0, port.requests)
        allowed = true
        assertTrue(session.requestAudioFocus())
        allowed = false
        assertFalse(session.requestAudioFocus())
        assertEquals(1, port.requests)
        assertEquals(1, port.abandoned.size)
        assertEquals(1, lost)
    }

    @Test fun lifecycleLossDuringRequestCannotBeResurrectedByItsReturnValue() {
        val port = Port().apply { duringRequest = { it(AudioFocusChange.LOSS) } }
        var lost = 0
        val session = AudioFocusSession(port, { true }, { ++lost })
        assertFalse(session.requestAudioFocus())
        assertEquals(1, lost)
        assertTrue(port.abandoned.isNotEmpty())
    }

    @Test fun lifecycleConditionMustStillHoldWhenTheOsRequestReturns() {
        var allowed = true
        val port = Port().apply { duringRequest = { allowed = false } }
        val session = AudioFocusSession(port, { allowed }, {})
        assertFalse(session.requestAudioFocus())
        assertEquals(1, port.abandoned.size)
    }

    @Test fun closeIsTerminalAndRepeatedReleaseDoesNotSpamLossEvents() {
        val port = Port()
        var lost = 0
        val session = AudioFocusSession(port, { true }, { ++lost })
        assertTrue(session.requestAudioFocus())
        val callback = port.callbacks.values.single()
        session.close()
        session.releaseAudioFocus()
        session.close()
        callback(AudioFocusChange.GAIN)
        callback(AudioFocusChange.LOSS)
        assertFalse(session.requestAudioFocus())
        assertEquals(1, port.requests)
        assertEquals(1, port.abandoned.size)
        assertEquals(1, lost)
    }

    @Test fun unavailableOsServicesFailClosedAndCleanupContinues() {
        val port = Port().apply { throwOnRequest = true; throwOnAbandon = true }
        var lost = 0
        val session = AudioFocusSession(port, { true }, { ++lost })
        assertFalse(session.requestAudioFocus())
        assertEquals(1, lost)
        assertEquals(1, port.abandoned.size)
        session.close()
    }
}
