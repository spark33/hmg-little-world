import { describe, expect, it } from "vitest";
import { initialState } from "./domain";
import { collectionGroups, curatedReason } from "./journeys";

describe("collection journeys", () => {
  it("keeps confirmed chapters newest first, examples separate, and legacy outside Seoul groups", () => {
    const world = initialState();
    world.collected.mangwon = {
      visitDate: "2026-01-01",
      provenance: "confirmed-demo",
    };
    world.collected.bukhansan = {
      visitDate: "2026-02-01",
      provenance: "confirmed-demo",
    };
    world.collected.chicago = {
      visitDate: "2027-01-01",
      provenance: "confirmed-demo",
      memory: "Original Chicago",
    };
    const groups = collectionGroups(world);
    expect(groups.confirmed.map((x) => x.id)).toEqual(["bukhansan", "mangwon"]);
    expect(groups.illustrations).toHaveLength(4);
    expect(world.collected.chicago.memory).toBe("Original Chicago");
  });
  it("describes a curated pairing without inferring a real visit from an illustration", () => {
    expect(curatedReason("gwangjang")).toContain("market-food chapter");
    expect(curatedReason("gwangjang")).toContain("Curated demo inspiration");
    expect(curatedReason("gwangjang")).not.toContain("you explored");
  });
});
