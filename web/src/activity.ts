import { canInteract, type Safety } from "./domain";
import { parseSafety } from "./bridge";
/** Native startup snapshots are validated exactly like live safety events. */
export function initialSafety(snapshot: unknown, native: boolean): Safety {
  return parseSafety(snapshot) ?? { state: "unknown", preview: !native };
}
export type ActivityEvent =
  "hidden" | "blur" | "pagehide" | "visible" | "focus";
export function activityAllowed(
  safety: Safety,
  visible: boolean,
  focused: boolean,
) {
  return canInteract(safety) && visible && focused;
}
/** Only reading/browsing can be resumed. A pending route, arrival, reset or import is never replayed. */
export function resumablePanel(
  panel: string | null,
): "album" | "browse" | "memory" | null {
  return panel === "album" || panel === "browse" || panel === "memory"
    ? panel
    : null;
}
