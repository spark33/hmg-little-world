import { describe, expect, it } from "vitest";
import {
  assetForSelection,
  COLLECTIBLE_ASSET_IDS,
  WORLD_LAYOUT,
  worldProgress,
} from "./world-layout";

describe("fixed island keepsake layout", () => {
  it("reserves one nonoverlapping site for every collectible inside the existing island", () => {
    for (const id of COLLECTIBLE_ASSET_IDS) {
      const {
        position: [x, , z],
        footprint: [width, depth],
      } = WORLD_LAYOUT[id];
      for (const dx of [-width / 2, width / 2])
        for (const dz of [-depth / 2, depth / 2])
          expect(Math.hypot(x + dx, z + dz)).toBeLessThan(7.82);
      for (const [otherId, site] of Object.entries(WORLD_LAYOUT)) {
        if (otherId === id) continue;
        const separatedX =
          Math.abs(x - site.position[0]) >= (width + site.footprint[0]) / 2;
        const separatedZ =
          Math.abs(z - site.position[2]) >= (depth + site.footprint[1]) / 2;
        expect(separatedX || separatedZ, `${id} overlaps ${otherId}`).toBe(
          true,
        );
      }
    }
  });
  it("focuses every memory and reserved plot without accepting unknown scene IDs", () => {
    for (const id of Object.keys(WORLD_LAYOUT))
      expect(assetForSelection(id)).toBe(id);
    for (const id of COLLECTIBLE_ASSET_IDS)
      expect(assetForSelection(`plot:${id}`)).toBe(id);
    expect(assetForSelection("plot")).toBe("chicago");
    expect(assetForSelection("unknown")).toBeUndefined();
    expect(assetForSelection("__proto__")).toBeUndefined();
  });
  it("renders confirmed additions once and animates only the current known collectible", () => {
    const progress = worldProgress({
      collectedIds: ["chicago", "chicago", "museum", "unknown"],
      collecting: true,
      collectingId: "museum",
    });
    expect([...progress.collected]).toEqual(["chicago", "museum"]);
    expect(progress.collectingId).toBe("museum");
    expect(
      worldProgress({ collecting: false, collectingId: "museum" }).collectingId,
    ).toBeNull();
    expect(
      worldProgress({ collecting: true, collectingId: "unknown" }).collectingId,
    ).toBeNull();
  });
  it("preserves the legacy Chicago-only props while the app adopts the full catalog", () => {
    const progress = worldProgress({ collected: true, collecting: true });
    expect(progress.collected.has("chicago")).toBe(true);
    expect(progress.collected.size).toBe(5);
    expect(progress.collectingId).toBe("chicago");
  });
});
