import { describe, it, expect } from "vitest";
import { activityAllowed, initialSafety, resumablePanel } from "./activity";
describe("parked activity lifecycle", () => {
  it("recovers an early native preview snapshot while invalid snapshots fail closed", () => {
    expect(initialSafety({ state: "unknown", preview: true }, true)).toEqual({
      state: "unknown",
      preview: true,
    });
    for (const snapshot of [
      undefined,
      null,
      { state: "parked", preview: "true" },
    ])
      expect(activityAllowed(initialSafety(snapshot, true), true, true)).toBe(
        false,
      );
  });
  it("never exposes a driving or unknown vehicle world, including after foregrounding", () => {
    for (const state of ["driving", "unknown"] as const)
      for (const visible of [true, false])
        expect(activityAllowed({ state, preview: false }, visible, true)).toBe(
          false,
        );
    expect(
      activityAllowed({ state: "driving", preview: true }, true, true),
    ).toBe(false);
  });
  it("stops a parked world on lost focus or visibility", () => {
    const safety = { state: "parked", preview: false } as const;
    expect(activityAllowed(safety, true, true)).toBe(true);
    expect(activityAllowed(safety, false, true)).toBe(false);
    expect(activityAllowed(safety, true, false)).toBe(false);
  });
  it("offers only non-committing browsing contexts for deliberate continuation", () => {
    for (const panel of [
      "journey",
      "arrival",
      "destinations",
      "settings",
      null,
    ])
      expect(resumablePanel(panel)).toBe(null);
    for (const panel of ["album", "browse", "memory"])
      expect(resumablePanel(panel)).toBe(panel);
  });
});
