# Sound intent and vehicle audio focus

Sound is optional. A ROAMY keepsake chime must not interrupt the vehicle's audio merely because the user opens a memory or enables sound.

## Playback behavior

- `unlockSound()` records deliberate user intent and primes Web Audio. Native priming keeps the context suspended and sends no focus request. Browser preview can resume its context following its user gesture.
- `flourish()` is the only path that requests actual native audio focus, immediately before an audible chime. It resumes the native Web Audio context only after the current correlated reply explicitly grants focus.
- Missing bridge, focus denial, timeout, transport error, stale reply, backgrounding or muted/cancelled intent results in silence. A dismissed focus request cannot later resume sound.
- Focus loss stops playback and invalidates intent. A later gain event, foreground transition or visibility restoration never resumes sound automatically. Another deliberate interaction is required.
- Suspending sound stops and disconnects every tracked oscillator and clears gain automation. Suspending an `AudioContext` alone would leave scheduled notes queued for a future resume; ROAMY removes those sources instead.
- The chime releases focus as soon as its last oscillator ends. A three-second web playback watchdog bounds a stuck resume/ended callback. The native controller independently limits its focus lease to eight seconds and abandons on lifecycle, safety and display interruptions.
- Silent priming intent expires after five seconds. This accommodates the reveal's deliberate 3.6-second chime delay without acquiring native focus during the silent interval.

## Native contract

Strict bridge actions `audio-request` and `audio-release` have no arbitrary arguments. Replies contain `audioFocus: boolean`; a route/navigation success flag cannot substitute for that explicit grant. Requests remain correlated, bounded and abortable alongside other bridge requests.

`PleosBridge` accepts an optional `AudioFocusIntegration` port. Native requests additionally require the flavor's permitted safety state. The Android controller independently checks foreground/presentation eligibility and display interactivity. Release remains idempotent for cleanup. The controller requests transient focus for game audio, does not accept delayed grants, and invalidates on loss instead of automatically resuming.

The native activity publishes `roamy-audio-focus` with `granted: false` on loss. Web code treats this as a stop instruction and does not echo another release request indefinitely. Native lifecycle abandonment is independent of the JavaScript event being processed, so a stalled WebView cannot retain focus indefinitely.

Abandoning Android focus is not proof that an already scheduled Web Audio source has become physically silent. Before enabling vehicle entertainment, stall the renderer and change safety state while a chime is active; measure actual output-stop latency. If platform behavior cannot stop it promptly, use native-owned playback with a native stop path. The current production vehicle gate remains disabled, so this unverified path cannot emit vehicle entertainment audio.

## Evidence and remaining gate

Web unit tests use in-memory AudioContext/node/focus ports to exercise silent priming, actual-grant gating, denial, late grants and resumes after mute, oscillator cleanup, focus loss, visibility/safety events, last-note release, watchdog cleanup and delayed browser-preview playback. Native bridge tests use fake ports to verify the decision is mirrored faithfully, driving never invokes focus acquisition and releases remain available for cleanup. These tests do not fabricate real OS grants or play through vehicle speakers.

The integrated native controller has separate policy tests and must be included in both-flavor build/lint checks. Official Pleos runtime validation is still required for Android/WebView audio behavior, AAOS audio-focus interaction with navigation/media/calls, interruptions, volume routing and cabin-speaker output. No source/JVM/browser result establishes those outcomes while the official emulator remains unavailable.
