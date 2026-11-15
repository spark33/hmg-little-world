# Product journey review

Reviewed against the repository's original promise, **“Drive the real world. Build your own,”** and the current [application narrative](submission/ROAMY_APPLICATION_DRAFT.md). No separate earlier user-authored proposal document was found in the repository; the prepared application describes the current product and its intended development, rather than independently proving product fit.

The intended loop is **remember an outing → find a related next experience → choose a destination → deliberately record a memory → revisit it in the world**. A miniature collection supports that loop. A functioning demonstration of the loop is not yet a useful real-world visit journal or a proven reason to return.

## Journey and proposal fit

| Journey | Working foundation | Product gap / acceptance criterion |
| --- | --- | --- |
| Understand the world | Original Seoul sites, tappable buildings, collection book, stationary safety boundaries. | Seeded illustrations must never appear to be the user's visits or accomplishments. Counts, list sections and details must agree about provenance. |
| Check places remembered | Local collection entries have a place/theme, date, note and provenance; legacy locations retain their identity. | Confirmed demo memories should appear before seeded examples. A collection of eight types is not a chronological record of every visit. A future visit journal needs dated entries independent of a keepsake's collected flag. |
| Select and revisit a memory | Buildings and collection entries open the same memory details, with note editing. | Back must return to the collection/category the user came from. Saving a note must make the updated text easy to verify, not leave it above the viewport. |
| Understand a recommendation | Each seeded theme links to a related new Seoul experience; completed targets are excluded. | Name the proposed experience and explain that it is a **curated** chapter. Do not imply personalization, proximity, opening hours, availability or a visit the user never made. The rationale must be understandable before acting. |
| Choose an outing | Explicitly illustrative destination choices and a dedicated unavailable-navigation state. | Preserve the chosen demo destination with the confirmed memory so the choice has an observable result. A real plan needs an authorized accurate place, useful decision information and a deliberately saved plan; these are not provided by sample distances. |
| Travel and record | No route/search callback implies arrival. Confirmation and cancellation are deliberate; saving precedes the reveal. | Real route handoff requires reviewed native-owned destinations and official service validation. Keep the entertainment UI restricted during driving. Never award a memory merely for travel time or route completion. |
| Return to the world | Four new flows, persistent collection, seven-second reveal, reduced motion, completion and duplicate-free replay. | A replay demonstrates an existing chapter; it does not create a second visit. Repeat-visit history and content beyond the fixed collection remain missing. |
| Keep or recover memories | Bounded versioned backup, preview/cancel/replace, prior-save recovery and deliberate deletion. | Preserve destination provenance with the rest of the memory. Plaintext exports need clear disclosure; production sensitive data needs reviewed encryption/key management. |

## Focused journey refinement

The integrated baseline's [screenshots and videos](DESIGN_VALIDATION.md) exposed three semantic issues in addition to visual findings: seeded examples led the collection, returning from details lost list context, and destination choice disappeared when a memory was saved. A targeted refinement addresses these issues, makes curated recommendation copy explicit and improves note-save verification. Its tests and current-source screenshots/video are recorded separately from the unchanged baseline captures.

These are usability and data-contract improvements. They do not turn a sample destination into a real venue, add visit verification, make the recommendations adaptive or enable the vehicle safety gate.

## Next features that support the proposal

1. **Memory correction and draft protection.** Offer per-memory removal with deliberate confirmation/undo rather than requiring a whole-world reset. Preserve an unsaved note draft or ask before a user-initiated discard; safety/lifecycle restrictions must still cover the world immediately without a blocking dialog. Acceptance: cancel keeps data, removing one confirmed item leaves all other records intact, and accidental navigation cannot silently lose an edited note.
2. **A user-recorded visit journal.** Separate visit entries from collected keepsake types. Support a deliberate place/date/note and repeat visits, with inspectable provenance and cancellation. A self-reported visit must be labeled as such; useful recollection does not require automatic GPS tracking. Never claim that route completion proves an experience occurred. Acceptance: two visits to one place retain both dates/notes without duplicating the world building; edits/backups/recovery preserve both; no sensitive production data is stored without the agreed protection.
3. **Saved outing plans.** Let people save, compare, reopen and cancel a planned destination without prematurely recording a visit. Acceptance: the chosen place survives restart, remains distinct from a visited memory, has accurate source/availability limitations, and can be deliberately handed to validated navigation while stationary.
4. **Useful, explainable real-place discovery.** Start with a small reviewed Seoul dataset/provider and clear categories, distance provenance, access/availability limitations and a reason for each suggestion. Acceptance: users can explain why a suggestion appears and change category without a misleading personalization claim. No invented distance, popularity or opening-time data.
5. **A real return-use test.** Observe consenting users checking an old memory, choosing a new plan, recording/revisiting it and returning another day. Measure task completion, misunderstandings and reasons to return before inventing retention or market-demand claims. This is a product hypothesis, not a result established by automated tests.

Official Pleos runtime/safety validation remains a prerequisite for vehicle use. It is separate from whether the collection and planning journeys make sense. See the [implementation roadmap](ROADMAP.md) for platform and release gates.
