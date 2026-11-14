# Verification record

Date: 2026-11-14. Workspace: Linux x86_64, Node 24.22.1, workspace-local Temurin JDK 17, Gradle 8.10.2, Android SDK 35/build-tools 35.0.0, Chromium with software WebGL.

## Completed

- Milestone 1: created Gradle/Kotlin application and strict TypeScript Vite/React app; built a basic R3F scene; configured local WebViewAssetLoader hosting, a versioned origin-restricted bridge, and automatic asset sync. SDK/JDK initially absent; installed in the workspace. SDK manager required a writable Android user home; Java tooling required the environment proxy and system CA trust store. No TLS checks were disabled.
- Milestone 2: original procedural town with detailed pizza shop, café, lighthouse, blossom tree, foliage, lake/sailboat, curved road/car, benches, fences, plants and tiny residents. Browser visual inspection caught and corrected a shadow-plane artifact and submerged water. Added bounded orbit/pan/zoom, selection ring, camera easing, night palette, glowing windows, and WebGL initialization error UI.
- Milestone 3: versioned persistent state, duplicate prevention, empty plot, seven-second choreography, distinct roof/sign/awning/table/plant beats, arriving residents, original synthesized six-note flourish, completion message, and reset.
- Milestone 4: Detroit memory → Chicago preview → three clearly labeled sample destinations → adapter request/fallback → simulated arrival → explicit confirmation. “Not yet” never adds a building. Local reload restores Chicago; reset removes it. Recommendations follow Detroit → Chicago → New York deterministically.
- Milestone 5: compiled the vehicle flavor against the official Pleos NaviHelper 3.0.5 and transitive SDK artifacts; separate real and demo adapters; permission checks, SDK connection/failure handling, listener cleanup. No sample venue ever starts real navigation. Parked state is UNKNOWN; the vehicle UI is intentionally locked. Native and JS gates block driving and lifecycle interruptions.
- APK signatures verified with `apksigner`; every bundled web asset was byte-compared with the production `web/dist` output.
- Both debug APK flavors built successfully, including automatically bundled production web assets. Android lint completed with zero errors; remaining warnings concern the intentionally pinned target SDK/dependency version, fixed automotive landscape orientation, deliberate JavaScript enablement, and modern backup-rule recommendations.
- 17 TypeScript unit tests passed: persistence, corruption/disabled storage, reset, duplicates, recommendations, bridge reply/safety validation, and fail-closed driving rules.
- Four native JUnit tests passed in each flavor (8 executions): strict bridge parsing/allowlist/size, typed replies, unavailable capabilities, unknown location, lighting no-op, and driving restrictions.
- Five production-bundle browser end-to-end checks passed after the vehicle display pass (1.7 minutes). They exercise complete flow, explicit consent and cancellation, timed reveal, saved result/reload/reset, safety removal of the Canvas, collection interruption, landscape touch controls, and direct 3D building selection. A separate production rendering check passed for evening mode, no console/CSP errors, and the disabled-WebGL fallback. Final logs are delivered in `artifacts/`.

## Vehicle display iteration

Removed the large marketing/story overlays, increased UI type and contrast, moved sound and evening mode into settings, added a whole-world camera reset, and fitted the camera to the available canvas. Main buttons are at least 56 logical pixels tall. Panels reserve their own screen area; the island reframes beside them. Layout/touch checks now cover 960×480, 1024×600, 1280×720, and 1920×720 at 2× device pixel ratio, including the 1.25 renderer DPR cap. The scene still renders ambient motion continuously; decorative shadow updates run at 15 Hz. This reduces rendering work but is not a measured head-unit frame-rate claim.

The larger view is a camera/layout change. The POC island itself remains fixed, with Chicago filling the reserved plot. Time-based growth and automatic terrain expansion are not implemented.

## Unverified / blocked

**No Android or Pleos emulator runtime test completed.** The environment had no preinstalled emulator, system image, attached device, or `/dev/kvm`. After installing emulator tools, `emulator -accel-check` reported:

```
accel:
3
KVM requires a CPU that supports vmx or svm
```

The official Pleos v2.1.0 x86_64 API 34 system-image manifest was reachable. Its image archive is 4,087,751,964 bytes. A download was started and stopped after the acceleration failure was confirmed. APK compilation and native JVM tests succeeded; this does **not** verify an Android WebView graphics context, touch behavior on Pleos, SDK service binding, real route guidance, native lifecycle on-device, or GPU frame rate.

No live navigation request was sent. No reliable parked-state provider, FusedLocation grant, Vehicle Control grant, cabin-lighting API, or physical vehicle was available. Real adapter route code compiles against official SDK signatures but remains runtime-unverified and unreachable from illustrative destinations. Navigation errors currently disable availability for that adapter lifetime; production integration should surface asynchronous route status and recovery in a dedicated navigation UI.

The renderer caps DPR at 1.25 and updates decorative shadows at no more than 15 Hz, uses low-poly geometry and instanced flowers, and avoids postprocessing. The detailed procedural buildings still have multiple mesh draw calls. A stable frame rate on a Pleos GPU is **not established**; profile and batch repeated details before release. Software Chromium timing is evidence of correctness, not automotive GPU performance.

Audio was exercised by code/browser flow but not subjectively verified on cabin speakers. Local storage can be cleared by uninstalling or clearing WebView data. Failed/disabled storage is reported in the UI; the world then lasts for the session only. No cloud sync is implemented.

## Required device validation

1. Install both APKs on the official Pleos 2.1.0 API 34 AVD with hardware acceleration. Use preview only as a non-vehicle test environment. Confirm bundled assets load with network disabled; verify there are no remote requests.
2. Exercise the full flow with touch, both orientations/display sizes used by the target head unit, reload/process death, and reset. Review all collection beats and sound timing.
3. Profile GPU frame time, draw calls, memory, thermal behavior and pause/resume. Reduce DPR/batch meshes if needed; target sustained smooth rendering on actual hardware.
4. Confirm vehicle flavor stays behind its native safety cover without a parked provider. Integrate only an officially documented, authorized, reliably observed parked signal, including stale/disconnected/error behavior. Verify UNKNOWN and DRIVING interrupt content independently of JavaScript.
5. With approved NaviHelper permissions and real verified destinations, test initialization, route submission, asynchronous completion/errors, Navi screen ownership and lifecycle cleanup. Sample destinations must stay non-navigable.
6. Reconfirm target SDK and market category requirements. Arrange Pleos review and release signing separately. Lighting remains unsupported until an approved, capability-checked, deliberately requested, restorable integration exists.
