import { describe, expect, it } from "vitest";
import { describeNavigation } from "./navigation";
import type { Reply } from "./bridge";
const reply = (patch: Partial<Reply>): Reply => ({
  v: 1,
  id: "nav-test",
  ...patch,
});

describe("honest navigation presentation", () => {
  it("labels route submission and search completion without claiming arrival", () => {
    for (const status of ["submitted", "routing", "route-ready"] as const) {
      const view = describeNavigation(reply({ navigationStatus: status }));
      expect(view.canCancel).toBe(true);
      expect(view.title).not.toMatch(/arrived|arrival|visited/i);
      expect(view.detail).toMatch(/does not confirm|No visit/);
    }
  });
  it("never claims cancellation is confirmed merely because it was requested", () => {
    const view = describeNavigation(
      reply({ navigationStatus: "cancel-requested" }),
    );
    expect(view.title).toBe("Cancellation requested");
    expect(view.canCancel).toBe(false);
    expect(view.detail).toContain("No cancellation or arrival is assumed");
  });
  it("gives actionable denied, timeout, provider and safety messages", () => {
    expect(
      describeNavigation(reply({ navigationStatus: "denied", canRetry: true }))
        .canRetry,
    ).toBe(false);
    expect(
      describeNavigation(reply({ navigationStatus: "timeout", canRetry: true }))
        .canRetry,
    ).toBe(true);
    expect(
      describeNavigation(
        reply({ reason: "verified-destinations-unconfigured" }),
      ).detail,
    ).toContain("No approved destination provider");
    expect(
      describeNavigation(reply({ reason: "trusted-parked-signal-required" }))
        .title,
    ).toContain("safety verification");
    expect(describeNavigation(null).title).toBe("Live navigation unavailable");
  });
});
