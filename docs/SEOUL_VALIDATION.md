# Seoul integration validation

This increment replaces the new-adventure theme with Seoul and completes the fixed illustrative collection. Browser recordings and screenshots are cloud Chromium evidence, **not official Pleos emulator evidence**. Native unit tests validate policy/state logic, not real vehicle services.

## Scope and release boundary

The eight-site island contains four seeded illustrations and four explicitly confirmed demo adventures. Saved older locations remain in an honest legacy archive. The integration adds robust save recovery, typed navigation service boundaries, native lifecycle/restriction coverage, transient chime focus, local license reading, short-display layout fixes and competition preparation.

Production vehicle entertainment remains disabled by the unvalidated-platform gate. No simulated PARKED state, route-completion-as-arrival, licensed POI claim or cabin integration was introduced. Official runtime validation requires a cloud worker with usable KVM and the documented supported GPU; see [feasibility](EMULATOR_FEASIBILITY.md). No official AVD, device install/launch, logcat, instrumentation, speaker validation or native runtime screenshot was produced.

## Checks

Final test results, exact artifact integrity reports and browser evidence are recorded under [the Seoul artifact directory](../artifacts/roamy-seoul/). The integration PR links its cloud CI run as an additional independent build/regression record. See the [design review](DESIGN_VALIDATION.md) for screenshots, actual UI videos, inspection notes and remaining visual limitations.

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
