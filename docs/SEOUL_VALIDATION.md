# Seoul integration validation

This increment replaces the new-adventure theme with Seoul and completes the fixed illustrative collection. Browser recordings and screenshots are cloud Chromium evidence, **not official Pleos emulator evidence**. Native unit tests validate policy/state logic, not real vehicle services.

## Scope and release boundary

The eight-site island contains four seeded illustrations and four explicitly confirmed demo adventures. Saved older locations remain in an honest legacy archive. The integration adds robust save recovery, typed navigation service boundaries, native lifecycle/restriction coverage, transient chime focus, local license reading, short-display layout fixes and competition preparation.

Production vehicle entertainment remains disabled by the unvalidated-platform gate. No simulated PARKED state, route-completion-as-arrival, licensed POI claim or cabin integration was introduced. Official runtime validation requires a cloud worker with usable KVM and the documented supported GPU; see [feasibility](EMULATOR_FEASIBILITY.md). No official AVD, device install/launch, logcat, instrumentation, speaker validation or native runtime screenshot was produced.

## Checks

- Current web unit tests: **88 passed**.
- The journey refinement passed focused browser flow, context-return, destination persistence and three-viewport layout/contrast/reading-order checks. Current-source checks and APK asset reports are in [journey refinement evidence](../artifacts/roamy-seoul/checks/journey-refinement/).
- **50 production browser E2E cases** are included in [main CI](https://github.com/spark33/hmg-little-world/actions/workflows/cloud-validation.yml?query=branch%3Amain). The integration baseline separately passed all 44 prior cases in [clean CI run 43704719736](https://github.com/spark33/hmg-little-world/actions/runs/43704719736). Its initial contended local run and two successful reruns remain in the saved logs; no product behavior was weakened.
- Native JVM tests: **41 per flavor**, 82 executions.
- Attribution generator: **9 tests passed**; strict generated-material check passed for 13 emitted web packages and six native OSS groups.
- Release staging and media tooling: **23 tests passed** (11 staging, 12 media verification), including unauthorized signer, stale assets, overwrite protection, missing raw files, tampering and read-only evidence preservation.
- Android packaging and APK policy/asset verification passed for both debug flavors and the unsigned vehicle release.

The [design review](DESIGN_VALIDATION.md) distinguishes baseline videos from the current-source journey refinement. It links inspected screenshots, actual UI videos, decoded-frame checks and remaining limitations. The [product journey review](PRODUCT_JOURNEYS.md) evaluates the complete loop against the proposal and identifies missing real-use capabilities.

The native checks produced 41 passing unit tests in each flavor (82 executions), zero failures/errors and zero lint errors. Four warnings remain in each lint variant: the documented target API baseline, dependency freshness, fixed landscape orientation and JavaScript enablement needed by the bundled application. These are not Pleos review approval. The unsigned release is an inspection artifact; debug APK signatures are development signatures.

The verifier compares the entire APK web asset inventory and bytes against the production build and checks manifest policy. Signed release staging additionally requires an authorized signer. No owner release key was supplied, so no competition release APK has been staged or represented as runnable.

## Interpretation and remaining limits

- SwiftShader draw-call measurements show a specific geometry-batching reduction; they do not establish a head-unit frame-time budget. [Recorded diagnostic](../artifacts/roamy-seoul/performance.json).
- Browser safety fixtures validate the web reaction to restricted/unknown inputs; they do not prove actual vehicle gear or restriction callback behavior.
- Silent videos validate visual sequences and interaction timing; they do not prove cabin audio routing or output-stop latency under stalled JavaScript.
- Local saves, backups and clipboard exports remain plaintext. Sensitive personal data needs reviewed encrypted storage before production use.
- Live navigation stays unavailable until an authorized accurate Seoul destination source and actual NaviHelper runtime behavior are validated.
- Competition materials remain unsigned drafts. Eligibility, rights, private contact/consent/signatures, final source cut and actual submission are owner actions. See [competition requirements](COMPETITION_COMPLIANCE.md).

The [roadmap](ROADMAP.md) defines the acceptance criteria for these remaining gates.
