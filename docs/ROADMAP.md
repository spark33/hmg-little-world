# ROAMY implementation roadmap

Audit baseline: commit `4879837`, reviewed 2026-11-15 (Asia/Seoul). This is a source audit of the complete tracked web, Android, domain, test, build, documentation, and evidence inventory. Existing artifacts describe an earlier run; they are not fresh runtime evidence. At baseline, ROAMY was branded LITTLE WORLD throughout the product. This roadmap describes the target, not a claim of completeness; the final section records this branch's completed increment.

## Emulator feasibility

See [EMULATOR_FEASIBILITY.md](EMULATOR_FEASIBILITY.md). The official Pleos 2.1.0 API 34 x86_64 image is available from the official published manifest without authentication. CRN is not required for this version. This cloud container has no `/dev/kvm`, no exposed CPU `vmx`/`svm`, and no GPU device. It cannot currently provide the documented accelerated Pleos validation environment. No Pleos boot, ADB connection, runtime APK validation, or head-unit performance result is claimed. Browser software rendering and native JVM tests are separate evidence.

Minimum infrastructure action: provide a cloud development worker with usable nested virtualization/KVM and a supported exposed GPU. No local workstation is required. Credentials or a CRN will not fix the current host limitations.

## Implemented features

| Area | Source-backed behavior |
| --- | --- |
| Miniature world | `web/src/World.tsx`: original procedural island, Detroit shop, café, lighthouse, blossom tree, road, car, water, residents, plants; day/evening palette; bounded camera and direct selection. |
| Collection | `App.tsx`, `domain.ts`: four seeded illustrative memories; Chicago confirmation and seven-second reveal; duplicate prevention; reload/reset; album as a 2D selection alternative. |
| Discovery | Deterministic Detroit → Chicago → New York recommendations; three labeled sample deep-dish destinations; explicit simulated journey and confirmation; cancellation leaves collection unchanged. |
| Local application | Bundled geometry/audio and restrictive production CSP; no runtime server/account; WebGL error boundary; storage failure message. |
| Android shell | Two flavors, minSdk 28, targetSdk 34, compileSdk 35, Gradle 8.10.2; automatic web build/bundle; origin-restricted main-frame WebMessage bridge; WebViewAssetLoader; external requests/navigation blocked. |
| Safety | Vehicle UNKNOWN/DRIVING locked by an opaque native cover plus web Canvas removal; pause/resume signals, audio suspension, animation interruption, resource cleanup. Preview explicitly separate. |
| Navigation | Vehicle flavor compiles against official NaviHelper 3.0.5; initialization, permission check, listener cleanup, coordinate validation; sample destinations rejected. |
| Existing checks | 17 web unit tests, five browser E2E tests, four native unit tests in each flavor, rendering script, Android lint/build scripts. Fresh results are recorded separately. |

## Partial features and mocked integrations

| Feature | Actual limitation |
| --- | --- |
| Gameplay progression | Only Chicago can be added. New York, mountain, and museum are catalog previews; recommendations from nature/culture have no playable action. Island and reserved plot are fixed. No automatic terrain expansion. |
| Vehicle entertainment | No trusted parked-state provider. `PleosVehicleAdapter.safety` always UNKNOWN; vehicle entertainment is unusable by design until safely integrated and validated. |
| Navigation | All UI destinations are fictitious and contain sample distances; no real POI search, location, route progress, cancellation, retry, or arrival integration. Success boolean means submission only. SDK errors permanently clear adapter availability. |
| Location/lighting | Location flow always null. Lighting capabilities always unavailable and restoration is a no-op. No lighting controls are exposed. |
| Persistence | v1 localStorage stores only Chicago in addition to seeded memories. Date validation checks shape only; initial load eagerly rewrites storage; save happens in a React effect. No migration/export/recovery or persistent preferences. Uninstall/clear-data loses the world. |
| Bridge | One mutable `onmessage` callback; no concurrent requests or cancellation; synchronous transport failure is not recovered. Delayed results may reopen a dismissed panel after safety/visibility changes. |
| Lifecycle | Source-level restrictions and JVM policy tests exist, but no Android instrumentation tests or fresh Pleos lifecycle/render-process-death validation. |

Mocked travel, venue availability, visit dates, memories, and distances must remain explicitly labeled. User confirmation records a demo keepsake, not proof of a real visit. PARKED, route completion, and permissions must never be fabricated.

## Visual and UX deficiencies

- ROAMY identity is absent from launcher labels, title, native safety screen, town sign, and web header. Keep package/storage identity stable when renaming to preserve upgrades.
- Discovery becomes a dead end after Chicago. Other categories show recommendations without a working next step.
- Panel is a scrolling complementary region with no focus transfer/return or Escape handling. Reset is immediate and destructive. Non-primary and sticky actions need short-display overlap checks.
- Fine print and secondary labels are small/low contrast. Emoji appearance depends on host fonts. Narrow layout hides the development preview badge and the collection button's text, weakening mode disclosure and accessible naming.
- Reduced-motion CSS covers only some transitions; 3D ambient motion, camera easing and reveal continue. Day/night and mute preferences reset on reload.
- A large number of detailed meshes render continuously. DPR/shadow caps exist, but draw calls, memory, GPU time, long sessions and thermal behavior are unmeasured on Pleos.
- Storage feedback is hidden in the normal vehicle footer and only inspectable in settings. Corrupt/unsupported saves silently reset; unavailable storage can make a completed animation look durable.

## Android / Pleos compatibility risks

- Official docs now expose Vehicle State as ready to use and Vehicle 2.3.2. The old README conflates unavailable Vehicle Control with state access. Investigate documented state/capability/error/listener APIs and the platform entertainment restriction contract; do not infer parked from a parking brake or zero speed alone.
- Service binding, Navi permission grants, SDK callbacks, WebView WebGL/CSP/audio, native lifecycle, launcher presentation and automotive category eligibility remain runtime-unverified.
- Background/foreground and service disconnect must invalidate any previous permission to interact. Native cover must work while JavaScript is stalled. A stale/disconnected source must become UNKNOWN.
- Android target/market requirements, release signing, privacy/backup policy and automotive manifest requirements need current review. Debug APKs in `artifacts/` are historical development builds, not release candidates.
- No CI workflows are present at baseline. Android SDK/JDK/browser installation and writable cache paths must be reproducible in cloud-only environments.

## Prioritized milestones and acceptance criteria

### P0 — Reproducible evidence and lifecycle reliability (unblocked)

1. Publish host/image/CRN evidence and this roadmap. Build and test both native flavors in cloud; record fresh logs separately from historical artifacts.
2. Cancel bridge requests when panel/lifecycle/safety changes; correlate concurrent replies; recover unavailable/throwing transports. Late replies must never resurrect a journey.
3. Persist confirmed collections synchronously before reveal. Validate actual calendar dates; preserve existing v1 data; surface failed storage with an accessible visible warning and retry. Do not overwrite unreadable/future-version saves at startup.

Acceptance: baseline and added unit/E2E tests pass against the production bundle; both APKs and native tests/lint pass or their exact blockers are documented; safety interruption plus delayed native reply restores the world with no panel, animation or audio. UNKNOWN/DRIVING and native cover behavior remain fail-closed. Saved collection survives interruption/reload and duplicate confirmation; impossible dates are rejected.

### P1 — ROAMY identity and demonstration quality (unblocked)

Apply ROAMY naming consistently while preserving package IDs and save compatibility; persist preferences; add safe reset confirmation, focus handling, accessible control names, persistent mode disclosure and reduced-motion behavior.

Acceptance: launch/header/safety/title/sign all say ROAMY; existing saves load unchanged; keyboard/touch and 960×480 through 1920×720 checks pass; reduced-motion setting suppresses nonessential animation; current screenshots accompany the PR and are labeled browser evidence.

### P1 — Trusted vehicle safety and official runtime validation (infrastructure dependency)

Research and implement only official, authorized state/UX restrictions with explicit freshness/disconnect handling and testable policy. Keep the vehicle world locked until this path is verified. On the upgraded cloud worker, install the manifest-provided image, cold boot the 4 GB API 34 AVD, verify `adb devices`, install/launch the vehicle APK and use the official Virtual Console.

Acceptance: startup UNKNOWN locked; trusted allowed stationary condition unlocks; driving, missing permission, stale signal, disconnect, background, rotation/recreation and stalled JS lock immediately. Reconnection requires fresh state. Save/process-death recovery passes. Capture Pleos screenshots, filtered logcat and device/image identity without sensitive identifiers. Measure rendering/memory and exercise navigation errors/lifecycle. No generic Android substitute and no fake PARKED state.

### P2 — Complete gameplay progression (unblocked for clearly labeled preview)

Generalize typed collectibles, recommendations and journey/confirmation state; implement New York, mountain and museum keepsakes with dedicated original assets and deterministic plots; category browsing, replayable discoveries, completion states and memory editing. Separate seeded illustrations from user-added records. Define growth rules before terrain expansion.

Acceptance: every advertised collectible has a reachable, cancelable and persistent collect flow; every recommendation opens its corresponding experience; repeated visits do not duplicate assets; a full catalog survives reload/migration/reset; interrupted reveals keep confirmed records; unknown IDs never enter saves. No real visit/arrival claims from simulated travel.

### P2 — Production navigation and persistence

Add verified POI/destination source with provenance, explicit permission/capability UI and typed asynchronous navigation states/recovery. Keep sample routing rejected. Add versioned migrations and local export/import recovery with size/schema limits and deliberate confirmation; privacy controls and tested data-retention behavior.

Acceptance: only verified destinations reach native navigation; denied/unavailable/timeout/disconnect paths are actionable; route submission is never labeled arrival; user confirmation is required for a memory. Migration preserves valid v1 records, corrupt data is recoverable, future versions are not overwritten, and storage loss is clearly explained.

### P3 — Release and performance gate

Automate cloud unit/production-browser/build/native lint checks and attach evidence; optimize measured rendering bottlenecks; review contrast/touch/accessibility, market eligibility, offline behavior, release signing and submission checklist.

Acceptance: official Pleos runtime matrix completed with screenshots/logcat, zero fatal exceptions, verified native cover under JS failure, stable measured frame-time/memory budget agreed for target hardware, signed release APK and reproducible build, all checks green. Unsupported lighting/voice/location features stay absent or explicitly unavailable. Any introduced vehicle control requires approved permissions, deliberate user intent, capability checks and verified restoration.

## Delivery policy

Use small feature-branch commits and reviewed pull requests. Each PR lists exact checks, screenshot provenance, unmet acceptance criteria and remaining runtime limitations. Do not describe this proof of concept as feature-complete or Pleos-validated until the runtime and release gates pass.

## First implementation increment

The audit tables above retain the baseline to make the gaps reviewable. This branch addresses these items:

- P0: correlated/cancelable bridge requests, transport error fallback, actual string validation for safety events, and regression coverage for delayed replies after safety, backgrounding and panel dismissal.
- P0: synchronous confirmed saves, real calendar validation, bounded memories, preservation of corrupt/future saves, visible failed-save feedback/retry, and deliberate reset confirmation.
- P1: ROAMY header/title/native launcher/safety/sign identity with stable package IDs and legacy save key; persistent day/evening, mute and motion preferences; system reduced-motion default, demand-rendered static world and instant confirmed keepsakes; panel keyboard focus/Escape return; narrow-screen preview disclosure and collection accessible name.
- P3 foundation: a cloud CI workflow for production-browser E2E, unit tests, both APKs, native tests/lint and downloadable evidence. CI configuration is not itself proof of a successful hosted run.

Gameplay expansion, live navigation, trusted parked integration, Pleos runtime and release certification remain open. See [CLOUD_VALIDATION.md](CLOUD_VALIDATION.md) for measured checks and limitations.
