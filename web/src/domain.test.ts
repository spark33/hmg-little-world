import { describe, it, expect } from "vitest";
import {
  canInteract,
  collect,
  collectibleIds,
  catalog,
  nextExperience,
  updateMemory,
  destinationsFor,
  initialState,
  localVisitDate,
  loadWorld,
  readWorld,
  isVisitDate,
  recommend,
  saveWorld,
  STORAGE_KEY,
  type DemoDestinationId,
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
  it("remembers the chosen illustrative destination with a confirmed keepsake", () => {
    const s = storage();
    const w = collect(
      initialState(),
      "mangwon",
      "2026-11-15",
      "Our demo picnic",
      "weekend",
    );
    expect(w.collected.mangwon).toMatchObject({
      provenance: "confirmed-demo",
      demoDestinationId: "weekend",
    });
    expect(saveWorld(s, w)).toBe(true);
    expect(loadWorld(s).collected.mangwon.demoDestinationId).toBe("weekend");
    expect(
      updateMemory(w, "mangwon", "An edited note").collected.mangwon
        .demoDestinationId,
    ).toBe("weekend");
  });
  it("never rewrites the first choice when replaying a collected adventure", () => {
    const w = collect(
      initialState(),
      "mangwon",
      "2026-11-15",
      "First note",
      "nearby",
    );
    expect(collect(w, "mangwon", "2026-11-16", "Second note", "weekend")).toBe(
      w,
    );
    expect(w.collected.mangwon.demoDestinationId).toBe("nearby");
  });
  it("accepts older collection callers without a choice and rejects untrusted choices", () => {
    const original = initialState();
    const older = collect(original, "mangwon", "2026-11-15");
    expect(older.collected.mangwon).not.toHaveProperty("demoDestinationId");
    expect(collect(older, "mangwon", "2026-11-16", "Replay", "nearby")).toBe(
      older,
    );
    for (const choice of [
      null,
      1,
      {},
      ["nearby"],
      "",
      "actual-poi",
      "https://example.com/place",
    ]) {
      expect(
        collect(
          original,
          "mangwon",
          "2026-11-15",
          undefined,
          choice as DemoDestinationId,
        ),
      ).toBe(original);
    }
  });
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
    expect(collect(initialState(), "mangwon", "2026-02-30")).toEqual(
      initialState(),
    );
  });
  it("distinguishes missing, corrupt, unavailable, and future saves without writing", () => {
    const s = storage();
    expect(readWorld(s).status).toBe("empty");
    for (const [raw, status] of [
      ["{", "corrupt"],
      ['{"version":1,"collected":[]}', "corrupt"],
      ['{"version":3,"collected":{"future":{}}}', "unsupported"],
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
      '{"version":1,"collected":{"mangwon":{"visitDate":"2026-02-31"}}}';
    s.setItem(STORAGE_KEY, raw);
    expect(readWorld(s)).toMatchObject({
      state: initialState(),
      status: "corrupt",
    });
    expect(s.getItem(STORAGE_KEY)).toBe(raw);
  });
  it("bounds memories consistently before and after reload", () => {
    const s = storage();
    const state = collect(
      initialState(),
      "mangwon",
      "2026-11-16",
      "x".repeat(600),
    );
    expect(state.collected.mangwon.memory).toHaveLength(500);
    saveWorld(s, state);
    expect(readWorld(s)).toMatchObject({ state, status: "ready" });
  });
  it("starts with four illustrative memories and no Mangwon", () => {
    const w = initialState();
    expect(Object.keys(w.collected)).toHaveLength(4);
    expect(w.collected.mangwon).toBeUndefined();
  });
  it("round trips a confirmed collectible", () => {
    const s = storage();
    const w = collect(
      initialState(),
      "mangwon",
      "2026-11-14",
      "A delicious debate",
    );
    expect(saveWorld(s, w)).toBe(true);
    expect(loadWorld(s)).toEqual(w);
  });
  it("prevents duplicates and preserves original visit", () => {
    const w = collect(initialState(), "mangwon", "2026-11-14");
    expect(collect(w, "mangwon", "2026-11-15")).toBe(w);
  });
  it("does not collect unknown ids", () =>
    expect(collect(initialState(), "arbitrary", "2026-11-14")).toEqual(
      initialState(),
    ));
  it("resets and persists the initial world", () => {
    const s = storage();
    saveWorld(s, collect(initialState(), "mangwon", "2026-11-14"));
    saveWorld(s, initialState());
    expect(loadWorld(s).collected.mangwon).toBeUndefined();
  });
  it("recovers from corrupt or hostile storage", () => {
    const s = storage();
    for (const value of [
      "{",
      "null",
      '{"version":2}',
      '{"version":1,"collected":{"mangwon":{"visitDate":2},"evil":{}}}',
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
  it("deterministically recommends Mangwon after Gwangjang", () =>
    expect(recommend("gwangjang", initialState())?.id).toBe("mangwon"));
  it("recommends Gyeongbokgung after Mangwon", () =>
    expect(
      recommend("mangwon", collect(initialState(), "mangwon", "2026-11-14"))
        ?.id,
    ).toBe("gyeongbokgung"));
  it("does not recommend collected memories", () =>
    expect(
      recommend("gwangjang", collect(initialState(), "mangwon", "2026-11-14")),
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

describe("complete keepsake progression", () => {
  it("collects every advertised new keepsake exactly once and retains its provenance", () => {
    let state = initialState();
    for (const id of collectibleIds) {
      const before = state;
      state = collect(state, id, "2026-11-15", `${id} note`);
      expect(state).not.toBe(before);
      expect(state.collected[id]).toMatchObject({
        visitDate: "2026-11-15",
        provenance: "confirmed-demo",
        memory: `${id} note`,
      });
      expect(collect(state, id, "2026-11-16", "duplicate")).toBe(state);
    }
    expect(Object.keys(state.collected)).toHaveLength(catalog.length);
    expect(nextExperience(state)).toBeUndefined();
    expect(state.collected.gwangjang.provenance).toBe("illustration");
  });
  it("finds each remaining adventure deterministically", () => {
    let state = initialState();
    for (const id of [
      "mangwon",
      "gyeongbokgung",
      "bukhansan",
      "seoul-museum",
    ]) {
      expect(nextExperience(state)?.id).toBe(id);
      state = collect(state, id, "2026-11-15");
    }
  });
  it("offers only clearly illustrative destinations for playable keepsakes", () => {
    for (const id of collectibleIds) {
      const options = destinationsFor(id);
      expect(options).toHaveLength(3);
      expect(
        options.every((option) => /sample|illustrative/i.test(option.location)),
      ).toBe(true);
    }
    expect(destinationsFor("not-a-keepsake")).toEqual([]);
  });
  it("edits collected notes without changing visit date or illustration provenance", () => {
    const initial = initialState();
    const edited = updateMemory(
      initial,
      "gwangjang",
      "  Our own market picnic  ",
    );
    expect(edited.collected.gwangjang).toEqual({
      ...initial.collected.gwangjang,
      memory: "Our own market picnic",
    });
    expect(initial.collected.gwangjang.memory).not.toBe(
      edited.collected.gwangjang.memory,
    );
    expect(updateMemory(initial, "gyeongbokgung", "not collected")).toBe(
      initial,
    );
    expect(updateMemory(initial, "arbitrary", "untrusted")).toBe(initial);
    expect(
      updateMemory(initial, "gwangjang", "x".repeat(700)).collected.gwangjang
        .memory,
    ).toHaveLength(500);
  });
});

describe("Seoul theme and legacy archive", () => {
  it("starts with Seoul illustrations and never silently relabels legacy Chicago data", () => {
    const s = storage();
    s.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        collected: {
          detroit: {
            visitDate: "2026-06-14",
            memory: "Original Detroit illustration",
          },
          chicago: {
            visitDate: "2026-08-01",
            memory: "Our original Chicago confirmation",
          },
        },
      }),
    );
    const migrated = readWorld(s);
    expect(migrated.status).toBe("ready");
    expect(migrated.migrated).toBe(true);
    expect(migrated.state.collected.chicago).toEqual({
      visitDate: "2026-08-01",
      memory: "Our original Chicago confirmation",
      provenance: "confirmed-demo",
    });
    expect(migrated.state.collected.detroit.provenance).toBe("illustration");
    expect(migrated.state.collected.mangwon).toBeUndefined();
    expect(
      catalog.filter((item) => migrated.state.collected[item.id]),
    ).toHaveLength(4);
    expect(collectibleIds.some((id) => migrated.state.collected[id])).toBe(
      false,
    );
    expect(saveWorld(s, migrated.state)).toBe(true);
    expect(loadWorld(s).collected.chicago.memory).toBe(
      "Our original Chicago confirmation",
    );
  });
});

describe("local confirmation dates", () => {
  it("uses local calendar components, including month and day padding", () => {
    expect(localVisitDate(new Date(2026, 0, 2, 0, 15))).toBe("2026-01-02");
    expect(localVisitDate(new Date(2026, 10, 16, 0, 30))).toBe("2026-11-16");
  });
});
