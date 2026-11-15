import { describe, it, expect } from "vitest";
import {
  canInteract,
  collect,
  initialState,
  loadWorld,
  readWorld,
  isVisitDate,
  recommend,
  saveWorld,
  STORAGE_KEY,
} from "./domain";
import { parseReply, parseSafety } from "./bridge";
const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
  };
};
describe("persistent world", () => {
  it("checks real calendar dates including leap years", () => {
    expect(isVisitDate("2024-02-29")).toBe(true);
    for (const date of [
      "2026-02-29",
      "2026-04-31",
      "2026-13-01",
      "2026-00-10",
      "26-01-01",
      null,
    ])
      expect(isVisitDate(date)).toBe(false);
    expect(collect(initialState(), "chicago", "2026-02-30")).toEqual(
      initialState(),
    );
  });
  it("distinguishes missing, corrupt, unavailable, and future saves without writing", () => {
    const s = storage();
    expect(readWorld(s).status).toBe("empty");
    for (const [raw, status] of [
      ["{", "corrupt"],
      ['{"version":1,"collected":[]}', "corrupt"],
      ['{"version":2,"collected":{"future":{}}}', "unsupported"],
    ]) {
      s.setItem(STORAGE_KEY, raw);
      expect(readWorld(s).status).toBe(status);
      expect(s.getItem(STORAGE_KEY)).toBe(raw);
    }
    expect(
      readWorld({
        ...s,
        getItem: () => {
          throw Error();
        },
      }).status,
    ).toBe("unavailable");
  });
  it("preserves a damaged record for recovery instead of accepting an impossible date", () => {
    const s = storage();
    const raw =
      '{"version":1,"collected":{"chicago":{"visitDate":"2026-02-31"}}}';
    s.setItem(STORAGE_KEY, raw);
    expect(readWorld(s)).toEqual({ state: initialState(), status: "corrupt" });
    expect(s.getItem(STORAGE_KEY)).toBe(raw);
  });
  it("bounds memories consistently before and after reload", () => {
    const s = storage();
    const state = collect(
      initialState(),
      "chicago",
      "2026-11-16",
      "x".repeat(600),
    );
    expect(state.collected.chicago.memory).toHaveLength(500);
    saveWorld(s, state);
    expect(readWorld(s)).toEqual({ state, status: "ready" });
  });
  it("starts with four illustrative memories and no Chicago", () => {
    const w = initialState();
    expect(Object.keys(w.collected)).toHaveLength(4);
    expect(w.collected.chicago).toBeUndefined();
  });
  it("round trips a confirmed collectible", () => {
    const s = storage();
    const w = collect(
      initialState(),
      "chicago",
      "2026-11-14",
      "A delicious debate",
    );
    expect(saveWorld(s, w)).toBe(true);
    expect(loadWorld(s)).toEqual(w);
  });
  it("prevents duplicates and preserves original visit", () => {
    const w = collect(initialState(), "chicago", "2026-11-14");
    expect(collect(w, "chicago", "2026-11-15")).toBe(w);
  });
  it("does not collect unknown ids", () =>
    expect(collect(initialState(), "arbitrary", "2026-11-14")).toEqual(
      initialState(),
    ));
  it("resets and persists the initial world", () => {
    const s = storage();
    saveWorld(s, collect(initialState(), "chicago", "2026-11-14"));
    saveWorld(s, initialState());
    expect(loadWorld(s).collected.chicago).toBeUndefined();
  });
  it("recovers from corrupt or hostile storage", () => {
    const s = storage();
    for (const value of [
      "{",
      "null",
      '{"version":2}',
      '{"version":1,"collected":{"chicago":{"visitDate":2},"evil":{}}}',
    ]) {
      s.setItem(STORAGE_KEY, value);
      expect(loadWorld(s)).toEqual(initialState());
    }
  });
  it("handles disabled storage", () => {
    const s = {
      getItem: () => {
        throw Error();
      },
      setItem: () => {
        throw Error();
      },
    };
    expect(loadWorld(s)).toEqual(initialState());
    expect(saveWorld(s, initialState())).toBe(false);
  });
});
describe("recommendations", () => {
  it("deterministically recommends Chicago after Detroit", () =>
    expect(recommend("detroit", initialState())?.id).toBe("chicago"));
  it("recommends New York after Chicago", () =>
    expect(
      recommend("chicago", collect(initialState(), "chicago", "2026-11-14"))
        ?.id,
    ).toBe("new-york"));
  it("does not recommend collected memories", () =>
    expect(
      recommend("detroit", collect(initialState(), "chicago", "2026-11-14")),
    ).toBeUndefined());
});
describe("bridge validation", () => {
  it("accepts a typed fallback", () =>
    expect(parseReply({ v: 1, id: "test-1", available: false })).toBeTruthy());
  it("rejects invalid versions, ids, capabilities", () => {
    for (const value of [
      null,
      { v: 2, id: "x" },
      { v: 1, id: "x", lighting: "true" },
      { v: 1, id: "<script>" },
      { v: 1, id: "x", available: 1 },
    ])
      expect(parseReply(value)).toBeUndefined();
  });
  it("validates safety events", () => {
    expect(parseSafety({ state: "parked", preview: false })).toBeTruthy();
    expect(parseSafety({ state: "fast", preview: true })).toBeUndefined();
    expect(parseSafety({ state: "parked", preview: "true" })).toBeUndefined();
  });
});
describe("driving restrictions", () => {
  it("blocks unknown vehicle state", () =>
    expect(canInteract({ state: "unknown", preview: false })).toBe(false));
  it("blocks driving even in development preview", () =>
    expect(canInteract({ state: "driving", preview: true })).toBe(false));
  it("allows a trusted parked signal", () =>
    expect(canInteract({ state: "parked", preview: false })).toBe(true));
  it("allows explicitly identified non-vehicle preview", () =>
    expect(canInteract({ state: "unknown", preview: true })).toBe(true));
});
