# Parked-car UX verification — 2026-11-15

final result: passed

This is a browser visual/interaction result, not Pleos runtime certification.

## Source and comparison

Selected visual direction: option 2, full-window keepsake shelf. Source visual truth: `/Users/spark3/.codex/generated_images/01a1df78-38e5-7c71-8fb8-45e3ffe1bb93/exec-f0098a9a-29f2-47e3-89f9-6210c7956a10.png` (1672×941). Comparison viewport: 1200×675 CSS pixels, screenshots at 1 capture pixel per CSS pixel. Normalize source to 1200×675 for comparison. Implementation screenshots: `artifacts/parked-ux/01-world.png` through `08-night-settings.png`, especially `02-collection.png` and `03-explore.png`. Source uses illustrative placeholder ordering; implementation uses actual persisted memory ordering.

Full-view comparison: preserved warm ivory/forest-green palette, original world, centered identity, large Back affordance, full-width four-item collection and prominent miniature artwork. User-authorized changes after selecting the image: global branding, shorter copy, whole-card navigation with chevrons rather than nested CTAs, new discoveries separated from revisits. All are intentional functional refinements to the selected layout.

Focused comparison: inspected headers, card labels and dates, card focus states, three destination options, confirmation controls and settings at 1200×675 and 960×480. Also inspected original miniature world and day/night settings. Larger 24px primary UI text and 64–76px controls are retained; CSS pixels require native density verification. Original source serif headings and simple sans-serif controls remain; generated cutout artwork shares the original palette and supports dark backgrounds. Text wraps without horizontal clipping on the accepted captures. Meaningful card links have one tap target; saving/replacing data still requires explicit controls.

## Iterations and resolved findings

- P1: narrow sidebar required excessive scrolling. Replaced with full-window task screens, paged shelves (4/2/1 items), and dedicated settings sections.
- P2: inherited sticky action covered memory text. Removed sidebar sticky positioning.
- P2: selected destination label overflowed in 960×480. Corrected flex direction; final cards and footer fit, with no internal/outer vertical overflow.
- P2: short settings had 4px of overflow. Removed redundant subtitle at short heights; all comfort controls fit.
- P2: camera stopped resizing before reaching its target zoom. Transition now waits for target, position and zoom completion.
- P2: duplicate card CTA labels. Removed them from collection/Explore and made recommendations a single clickable card.

## Interaction evidence and limits

Browser interactions exercised collection paging, persistent notes and chosen stop, all four collection journeys, cancellation, day/night settings, short-screen choices, and an isolated browser lifecycle fixture. Synthetic DRIVING and unknown vehicle states removed all canvas and controls. An unconfirmed arrival did not become a memory or resume automatically. Confirmed progress survived an interrupted reveal without replay. A note draft returned only after deliberate continuation and was not silently saved. No browser console errors were observed during the inspected flows.

Web unit tests: 92 passing. Native policy/JVM tests: 42 per flavor, both debug builds and lint passed before the final presentation-only refinements; final packaging rerun recorded by the build output. Automated Playwright regressions were migrated to the new navigation and are discoverable; the full suite was not executed here because standalone browser launch is blocked by the host. Physical reach, glare, touch density, GPU smoothness, actual calls/audio routing and official Pleos runtime behavior remain unverified. Production platform validation remains false and the native vehicle safety cover remains effective.

## Follow-up polish

P3: verify native font substitution, head-unit density and real seating reach. No remaining known P0/P1/P2 visual blocker on the accepted screenshots.
