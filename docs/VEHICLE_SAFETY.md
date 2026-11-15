# Vehicle safety and Android lifecycle

Reviewed against official Pleos and Android documentation on 2026-11-15. This is an implementation and validation record, not a claim of Pleos runtime certification.

## Authoritative restriction source

The official [Driving Restriction Development Guide](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-developer-guide/driving-restriction-development-guide) requires apps to consume AAOS `CarUxRestrictions` through `CarUxRestrictionsManager`, register for changes, and apply the platform's restrictions. ROAMY now wires that observer in the vehicle flavor. The Android SDK's supplied optional `android.car` library provides the compile-time API; no copied framework jar or invented SDK coordinate is bundled.

[Android's restriction contract](https://developer.android.com/reference/android/car/drivingstate/CarUxRestrictions) describes permission to display non-distraction-optimized activities separately from physical gear state. ROAMY does not infer permission from speed, a parking brake, navigation events, GPS, elapsed time or remote Fleet API data. UX-restricted observations conservatively lock the world. The existing internal `DRIVING` value represents this restricted presentation condition; it is not a claim that a particular gear or physical speed was read.

The [Pleos regional policy](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-planning-guide/driving-restiction-policy) explains why apps must follow platform restrictions rather than hard-code regional speed/gear rules. ROAMY remains a stationary entertainment app and does not declare distraction optimization or add an in-app override.

## Production lock and freshness

**The vehicle world remains locked.** `PleosVehicleAdapter` constructs `StationarySafetyGate(platformValidated = false)`. An unrestricted observation therefore remains `UNKNOWN`; no production observer can emit `PARKED` in this build. Enabling stationary entertainment requires a reviewed change after the official Pleos runtime matrix below has passed. There is no preference, debug bridge command, hidden gesture or speed-based fallback that bypasses this gate.

The observer checks the automotive feature, uses the nonblocking car-service lifecycle API on API 29+, registers the restriction listener, and queries current restrictions again every second while foregrounded. API 28, unavailable optional classes, missing service, permission failures and exceptions stay `UNKNOWN`. The application attaches a monotonic receipt time to each successful platform read; it does not invent a platform vehicle-signal timestamp. The policy rejects observations older than three seconds, future/invalid times and callbacks from prior foreground generations. This bounds the application's cached authorization; it does not prove the underlying physical vehicle signal is fresh.

Backgrounding immediately invalidates the policy, removes refresh callbacks/listeners and disconnects the service. Re-entry requires a fresh service subscription/read. Reconnection replaces the listener generation so an old subscription cannot restore authorization. Close is terminal. A documented API and passing unit tests do not prove vendor service delivery, permissions or restriction freshness; production remains locked for that reason.

## Independent native presentation gate

`MainActivity` creates its opaque native cover before optional services or WebView. Content is shown only when the activity is foregrounded, the fixed bundled entry page has finished loading, the renderer is healthy, and the safety policy permits interaction. Browser development preview is a separate flavor; `DRIVING` still blocks it.

The origin-restricted main-frame bridge additionally checks the current WebView instance and native presentation gate. Late callbacks from destroyed frames cannot invoke navigation. External navigation/network requests remain blocked. The web safety event is a second gate; native visibility does not depend on JavaScript responding.

Pause hides native content before suspending WebView and stopping adapter work. Resume reacquires fresh adapter observations before reevaluating presentation. A main-frame load failure or renderer process loss leaves a persistent native failure cover; the affected WebView is detached and destroyed instead of reused. Reopening the app is required to create a healthy renderer. Renderer failure cannot uncover content even if a late page-finished callback arrives.

Independent cleanup steps continue if an optional service has already failed. Listener removal, service release and WebView destruction are attempted without allowing one unavailable resource to prevent the rest. No sensitive vehicle coordinates, service exception details, credentials or project identifiers are logged.

## Navigation lifecycle

The official NaviHelper adapter now implements the optional typed navigation-session interface. Foreground sessions own connection generations; background/close invalidates callbacks and releases resources. Permission changes are rechecked. Route errors retain the service connection and expose a retryable error instead of permanently declaring every future route unavailable. Explicit retry reacquires the service. Official `cancelRoute()` submits cancellation; only its callback returns the session to ready.

Route search completion is never treated as guidance completion, physical arrival or a confirmed memory. Sample requests are rejected before SDK calls, verified-destination policy remains the navigation module's responsibility, and routing/cancellation still require trusted stationary authorization. The [official NaviHelper destination guide](https://document.pleos.ai/en/docs/pleos-only/connect-sdk-pleos/NaviHelper/destinations) documents route submission/cancellation; actual Pleos service behavior is still unverified.

## Deliberate audio focus

The native audio controller uses `AudioManager` with an API-28-compatible `AudioFocusRequest`, `USAGE_GAME`, sonification content and transient focus. It follows the [Pleos audio-focus guide](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-developer-guide/audio-focus-development-guide/audio-focus-development): actual playback must first obtain the operating system's grant. The app does not invent a grant, enumerate other apps' focus holders, override the platform interaction matrix or request focus merely because it resumed. Delayed grants are disabled. Ducking is configured to pause this optional chime; loss invalidates the session rather than automatically resuming it later.

The bridge's `audio-request` action is used only for a current deliberate playback intent. Silent Web Audio priming on selection/enable-sound does not own focus. `audio-release` and native lifecycle cleanup abandon focus. Safety lock, backgrounding, screen-off, renderer failure and teardown release any session; the request additionally requires an interactive display and the native presentation policy to remain allowed when the OS returns. A native eight-second lease bounds focus retention even if web cleanup fails. A bounded `roamy-audio-focus` event containing only `{granted:false}` tells web audio to stop scheduled nodes and suspend; later gain callbacks cannot restart it.

The [Pleos suspend guide](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-developer-guide/audio-focus-development-guide/suspend-mode-audio-focus) requires regular audio to stop and abandon focus on suspend without automatic focus recovery on resume. The code handles Android pause, display-off and focus-loss paths; the target vehicle's suspend-entry delivery/order still requires official device verification. No audio or head-unit routing result is claimed from JVM tests.

Ten additional fake-port JVM tests cover OS denial/delayed grants, loss followed by gain, stale prior-session callbacks, unsafe/background conditions, lifecycle changes during a request, terminal close, failed OS calls and independent abandon failures. These are policy tests; real Android/AAOS audio focus, WebView audio routing, calls/emergency preemption and speaker behavior remain in the runtime matrix.

The audio increment built both APKs, passed **41 JVM tests per flavor (82 executions)** with the typed audio-bridge tests included, and completed lint with zero errors and the same four existing warnings per flavor. No instrumentation or official vehicle audio test was possible on this worker.

## Checks and remaining runtime matrix

New JVM tests cover production non-unlocking, startup/disconnect, bounded freshness/clock reversal, stale foreground callbacks, reconnect, terminal close, native page readiness, background restrictions, sticky renderer failure and independent cleanup failures. These tests exercise policy without fabricating a vehicle signal. Tests that explicitly construct a validated policy are isolated unit models; the production constructor is hard-coded to false.

Fresh cloud verification for this workstream built both debug APKs, passed **26 JVM tests per flavor (52 executions)** including the navigation protocol dependencies, and completed both lint tasks with **zero errors and four existing warnings per flavor** (`OldTargetApi`, `GradleDependency`, `DiscouragedApi`, `SetJavaScriptEnabled`). The five added navigation-request policy tests reject overlapping searches/pending cancellation, unsafe/background/unavailable sessions, samples and invalid coordinates before an SDK call. The adapter keeps a newly accepted request at `SUBMITTED` until an actual SDK completion callback; it does not invent an in-progress callback.

The official emulator is still blocked by absent nested KVM and GPU exposure in this cloud worker. **No Android instrumentation, renderer-death injection or official Pleos runtime test has run.** The following remain mandatory on the official image:

1. Verify startup UNKNOWN and restricted states remain covered; test actual platform restrictions and regional behavior through the official Virtual Console.
2. Confirm that a freshly read authorized stationary condition is the correct entertainment permission for the target display/category. Validate transition latency and service signal freshness before enabling the production gate.
3. Test missing/changed permissions, disconnect/reconnect, delayed callbacks, background/foreground, suspend/resume, process death and activity recreation.
4. Stall JavaScript and independently change vehicle restrictions; verify the native cover still hides the world. Kill the WebView renderer and verify no crash loop, unsafe uncovering or reuse of the dead WebView.
5. Exercise verified navigation submission, asynchronous failures, explicit retry/cancellation and listener teardown without conflating any callback with arrival.
6. Verify deliberate native audio-focus requests, actual grants/denial, game/WebView routing, calls/emergency preemption, screen-off and vehicle suspend/resume ordering, and speaker behavior. Confirm every loss stops pending/current notes and neither resume nor a late gain restarts them. Vehicle audio remains unreachable while this production world is locked; the implemented focus path remains runtime-unverified.
7. Verify backup/privacy behavior and any native encrypted persistence integration. A WebView application sandbox or disabled backup is not app-level encryption; freeform memory text can contain personal information.

No source-only test can replace those device checks. Lighting, voice and location features remain unsupported until their platform APIs, permissions, deliberate interaction and recovery behavior are implemented and verified.
