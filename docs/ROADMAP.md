# ROAMY roadmap — Seoul edition

This is the current implementation plan after the cloud-readiness PR was merged. The original repository audit is preserved in Git history at `0c3eb4f`; historical artifacts directly under `artifacts/` describe that earlier proof of concept. The user redirected the product from the New York/US discovery theme to **Seoul**. Existing saved records remain truthful legacy data.

## Implemented features

| Area | Implemented behavior |
| --- | --- |
| Seoul collection | Four seeded illustrations: Gwangjang Market, Namsan, Seokchon Lake, Seongsu. Four complete new demo keepsakes: Mangwon Market, Gyeongbokgung, Bukhansan, Seoul museum. |
| Gameplay | Category browsing, matching recommendations, destination choice, simulated journey, explicit confirmation/cancellation, all-four completion, duplicate-free replay, editable notes and local calendar visit dates. |
| Original world | Dedicated Seoul-inspired market, tower, blossom, café, hanok/palace, hiking and museum assets; eight deterministic reserved sites; direct selection, bounded camera, day/evening and seven-second reveals. No downloaded 3D assets. |
| Accessibility and layout | Vector keepsake illustrations, named controls, keyboard panel focus/Escape return, large touch targets, readable secondary text, short-display scrolling, visible narrow preview/storage warnings and reduced motion. |
| Persistence | Version 1→2 migration, unchanged storage key, explicit illustration/confirmed-demo provenance, current/legacy archive separation, bounded validated backups/imports, prior-save recovery, protected future/corrupt data, deliberate reset/replacement/deletion and transient-read recovery. |
| Android shell | Local-only hardened WebView, native cover before service/renderer initialization, current-frame bridge checks, renderer-loss failure cover, lifecycle cleanup and version 0.2.0 packaging. |
| Restriction integration | Official CarUxRestrictions observer, monotonic observation freshness, foreground/subscription generations, disconnect/error invalidation and tested fail-closed policy. Production authorization remains deliberately disabled until official runtime validation. |
| Navigation foundation | Official NaviHelper service lifecycle, validated native destination registry, strict versioned bridge, typed capabilities/status/retry/cancel, permission/state guards and no sample routes or invented arrival. |
| Audio | Deliberate transient native game focus immediately before chime playback; silent priming, actual-grant checks, stale-reply/oscillator cleanup, screen/lifecycle loss and bounded focus leases. No automatic resume or fabricated grant. |
| Attribution | In-app local license reader with loading/retry and keyboard support; production-bundle dependency inventory. Full generated notices and inventory checks accompany this increment. |
| Competition readiness | Source-linked requirement matrix and unsigned official-template application draft for a solo General/startup entry. Owner signatures, eligibility/IP review and submission remain required. |
| Release/build | Both debug flavors, unsigned vehicle release, optional secure environment signing, game category, automotive-only vehicle requirement, backup/device-transfer exclusions, APK integrity checks, cloud CI and repeatable host/image preflight. |

## Partial features, mocks and missing capabilities

| Feature | Precise remaining limitation |
| --- | --- |
| Official Pleos validation | Current worker has no usable KVM/nested CPU flags or exposed GPU. No official AVD boot, connected ADB device, on-device install/launch, native screenshot/logcat, instrumentation or head-unit profiling is claimed. |
| Vehicle gameplay | Production `StationarySafetyGate(platformValidated=false)` keeps unrestricted observations UNKNOWN. A documented API and passing unit tests do not establish safe runtime authorization. No fake PARKED state or override exists. |
| Real discovery/navigation | All user-facing journeys, destinations, distances and confirmations are labeled demo/illustrative. The production native POI registry is empty until an accurate authorized source is reviewed. No live POI search, GPS-based arrival or real visit detection is advertised. |
| Sensitive data protection | Browser saves and exported backups are plaintext with explicit warnings. Approved encrypted native persistence is required before handling sensitive personal/vehicle information. Automatic backup exclusions and sandboxing do not provide encryption. |
| Vehicle controls | Location remains unavailable, lighting capability/restoration is unsupported and no cabin controls are exposed. Voice features are absent. Do not add APIs/permissions without a supported, authorized use case. |
| Release | No owner release certificate, published privacy/support materials, country/age-rating decisions, provider approval or Pleos review outcome has been supplied. Unsigned/debug APKs are development artifacts. |

Seeded experiences and user-confirmed demonstrations are distinct. Old Detroit/Chicago dates, places and notes remain in an explicitly labeled archive; they never become Seoul visits. No time, distance or driving activity automatically awards a keepsake. The island stays fixed; confirming a memory fills a reserved plot.

## Visual/UX and performance limits

Cloud browser checks exercise 960×480, 1024×600, 1280×720, 1920×720 and narrow fallback layouts. They cover focus, scrolling, text contrast for selected guidance, touch targets, recovery controls and overlap fixes. They do not certify physical head-unit density, all assistive technologies, every localization or automotive touch behavior.

Repeated road markings and shop roof ribs are batched. Software GL interception measured complete-scene shadow-frame draw calls decreasing from 1,205 to 984 and ordinary-frame calls from 615 to 505. This is a rendering-work reduction, **not** a Pleos frame-rate claim. Contended SwiftShader timings are slow and are not an acceptable head-unit performance budget. The original scene still has detailed individual meshes and continuous ambient rendering outside reduced-motion mode; final optimization must follow measured official-runtime bottlenecks.

## Milestones and explicit acceptance criteria

### P0 — Reliable cloud development and state handling

Implementation complete; final combined checks are recorded with the integration PR. Acceptance: unit/build/browser/native/lint checks pass; delayed replies cannot reopen dismissed flows; confirmed saves survive interruption; failed reads/writes never silently replace the previous world; corrupt/future data stays recoverable. Production UNKNOWN/restricted states remain covered.

### P1 — Seoul gameplay and demonstration quality

Implementation complete for the fixed eight-site illustrative game. Acceptance: all four new Seoul keepsakes have reachable, cancelable, persistent flows; categories and recommendations select the correct experience; completion/replay/editing work; legacy data remains original; system/user reduced motion suppresses nonessential movement; keyboard/touch/short-display checks pass; screenshots show the current Seoul product and are labeled browser evidence.

### P1 — Official vehicle restriction/runtime gate

**Blocked by cloud hardware and mandatory device validation.** Provision a cloud worker with usable `/dev/kvm`, nested CPU virtualization and a supported GPU/driver. Use the official published Pleos 2.1.0 API 34 image, cold boot and 4 GB AVD allocation; no CRN is required for this version.

Acceptance: verify ADB connection and install/launch; startup UNKNOWN covered; actual platform restrictions lock immediately; a fresh authoritative allowed stationary condition is verified for the target category/display before production authorization is enabled. Missing permission, stale data, disconnect, background, delayed callbacks, process death and renderer failure remain locked. Stall JavaScript and independently prove the native cover works. Capture official screenshots and filtered non-sensitive logcat. No generic emulator or fabricated PARKED fixture substitutes for this gate.

### P2 — Persistence and truthful navigation

Persistence and the navigation contract are implemented; **live destination configuration and actual SDK behavior remain open**. Acceptance: current/legacy backups round-trip, unknown/oversized/malformed/future imports are rejected or preserved appropriately, replacement is explicit and recovery/deletion is deliberate. Only reviewed native-owned destinations reach NaviHelper; denied/unavailable/timeout/disconnect/retry/cancel outcomes are actionable; a submitted/search-finished route never means arrival. Configure an authorized accurate Seoul POI source, then test real service binding/permissions/callback order on official Pleos.

### P2 — Memory and outing journeys beyond the demo

The fixed keepsake game does not yet provide a repeat-visit journal or saved outing plans. [Product journey review](PRODUCT_JOURNEYS.md) separates the working loop from those missing product capabilities.

Acceptance: user-confirmed demos and examples remain visibly distinct; the chosen illustrative destination survives confirmation/reload/backup; Back retains collection/category context and recommendations state their curated reason. Next, individual memory correction/undo and draft protection must preserve other records and never block safety covering. A later visit journal must retain multiple dated user-recorded visits per place without duplicating buildings; saved plans must survive restart while remaining distinct from completed visits. Real-place discovery must expose accurate authorized data and a useful explanation. No GPS verification or personalization claim follows from a manual record or static suggestion.

### P3 — Performance, privacy and release gate

Build/signing preparation and cloud validation are implemented; **release acceptance remains open**. Acceptance: official runtime matrix passes, measured head-unit frame-time/draw-call/memory/long-session budgets are agreed and met, audio-focus/suspend/speaker behavior is verified, sensitive data is protected with approved encryption if handled, a valid owner-signed non-debuggable APK passes integrity checks, and accurate privacy/support/country/age-rating/permission materials pass Pleos review. Do not invent credentials, support contacts, legal ratings, certification or performance results.

## Next actions in priority order

1. Complete integrated cloud regression checks, screenshots/videos, bundled license verification and APK integrity for this Seoul increment; review the feature PR. The mandatory initial contest form needs owner review/signing/submission by 2026-11-15 23:59 KST; optional release evidence must remain truthful.
2. Improve the real-use memory loop: individual correction/draft protection, separate repeat-visit entries and deliberate saved outing plans, with the acceptance criteria above. These product tasks can progress independently of emulator infrastructure.
3. Provision the cloud KVM/GPU environment and execute the official runtime acceptance matrix before enabling vehicle entertainment.
4. Supply/review a licensed accurate Seoul destination provider, validate native navigation on Pleos, and implement approved encrypted storage before advertising sensitive personal memories.
5. Profile real hardware, resolve measured bottlenecks and perform accessibility/touch/localization review on the target display.
6. Provide secure release signing and reviewed market materials; publish only after explicit approval and successful platform review.

Detailed evidence and implementation boundaries: [emulator feasibility](EMULATOR_FEASIBILITY.md), [native safety](VEHICLE_SAFETY.md), [navigation](NAVIGATION.md), [release/signing/privacy](RELEASE.md). Browser or JVM evidence must never be described as official Pleos validation.
