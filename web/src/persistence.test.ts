import { describe, expect, it } from "vitest";
import {
  clearRecoveryData,
  exportBackup,
  isVisitDate,
  MAX_BACKUP_BYTES,
  parseBackup,
  parseWorld,
  PRESERVED_KEY,
  readPreservedSave,
  readRecovery,
  readWorld,
  RECOVERY_KEY,
  saveWorld,
  STORAGE_KEY,
  type PersistenceConfig,
  type StorageLike,
  type WorldState,
} from "./persistence";

const initialState = (): WorldState => ({
  version: 2,
  collected: {
    detroit: {
      visitDate: "2026-06-14",
      memory: "An illustrative beginning",
      provenance: "illustration",
    },
  },
});
const config: PersistenceConfig = {
  knownIds: ["detroit", "chicago", "new-york", "mountain", "museum"],
  initialState,
};
const fullState = (): WorldState => ({
  version: 2,
  collected: {
    ...initialState().collected,
    ...Object.fromEntries(
      config.knownIds
        .slice(1)
        .map((id) => [
          id,
          {
            visitDate: "2026-11-15",
            memory: `Demo ${id}`,
            provenance: "confirmed-demo" as const,
          },
        ]),
    ),
  },
});
function memoryStorage() {
  const values = new Map<string, string>();
  const writes: string[] = [];
  return {
    values,
    writes,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      writes.push(key);
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

describe("versioned world persistence", () => {
  it("migrates a complete v1 world without writing and preserves edited seed text", () => {
    const storage = memoryStorage();
    const collected = Object.fromEntries(
      Object.entries(fullState().collected).map(
        ([id, { provenance: _, ...record }]) => [id, record],
      ),
    );
    collected.detroit.memory = "An edited illustration";
    storage.values.set(STORAGE_KEY, JSON.stringify({ version: 1, collected }));
    const loaded = readWorld(storage, config);
    expect(loaded).toMatchObject({ status: "ready", migrated: true });
    expect(Object.keys(loaded.state.collected)).toHaveLength(5);
    expect(loaded.state.collected.detroit).toMatchObject({
      memory: "An edited illustration",
      provenance: "illustration",
    });
    expect(loaded.state.collected.museum.provenance).toBe("confirmed-demo");
    expect(storage.writes).toEqual([]);
  });
  it("round trips the full catalog and keeps one prior valid recovery copy", () => {
    const storage = memoryStorage();
    expect(saveWorld(storage, initialState(), config)).toBe(true);
    expect(saveWorld(storage, fullState(), config)).toBe(true);
    expect(readWorld(storage, config)).toMatchObject({
      status: "ready",
      migrated: false,
      state: fullState(),
      recoveryAvailable: true,
    });
    expect(readRecovery(storage, config)).toEqual(initialState());
    expect(storage.writes).toEqual([STORAGE_KEY, RECOVERY_KEY, STORAGE_KEY]);
  });
  it("does not replace a useful recovery snapshot when saving an unchanged world", () => {
    const storage = memoryStorage();
    saveWorld(storage, initialState(), config);
    saveWorld(storage, fullState(), config);
    const writes = storage.writes.length;
    expect(saveWorld(storage, fullState(), config)).toBe(true);
    expect(storage.writes).toHaveLength(writes);
    expect(readRecovery(storage, config)).toEqual(initialState());
  });
  it("protects corrupt and future primary saves until explicit replacement", () => {
    for (const text of ["{", '{"version":3,"collected":{"future":{}}}']) {
      const storage = memoryStorage();
      storage.values.set(STORAGE_KEY, text);
      expect(saveWorld(storage, fullState(), config)).toBe(false);
      expect(storage.getItem(STORAGE_KEY)).toBe(text);
      expect(storage.writes).toEqual([]);
      expect(
        saveWorld(storage, fullState(), config, { replaceProtected: true }),
      ).toBe(true);
      expect(readPreservedSave(storage)).toBe(text);
      expect(readWorld(storage, config).state).toEqual(fullState());
    }
  });
  it("does not overwrite the current world when its backup fails", () => {
    const storage = memoryStorage();
    const raw = JSON.stringify(initialState());
    storage.values.set(STORAGE_KEY, raw);
    const failing = {
      ...storage,
      setItem: (key: string, value: string) => {
        if (key === RECOVERY_KEY)
          throw new DOMException("Quota", "QuotaExceededError");
        storage.setItem(key, value);
      },
    };
    expect(saveWorld(failing, fullState(), config)).toBe(false);
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it("keeps an intact recovery copy if the new primary write fails", () => {
    const storage = memoryStorage();
    const raw = JSON.stringify(initialState());
    storage.values.set(STORAGE_KEY, raw);
    const failing = {
      ...storage,
      setItem: (key: string, value: string) => {
        if (key === STORAGE_KEY) throw Error("Storage disabled");
        storage.setItem(key, value);
      },
    };
    expect(saveWorld(failing, fullState(), config)).toBe(false);
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(readRecovery(storage, config)).toEqual(initialState());
  });
  it("reports unavailable storage without writing", () => {
    const storage: StorageLike = {
      getItem: () => {
        throw Error();
      },
      setItem: () => {
        throw Error();
      },
    };
    expect(readWorld(storage, config)).toMatchObject({
      state: initialState(),
      status: "unavailable",
      recoveryAvailable: false,
    });
    expect(saveWorld(storage, fullState(), config)).toBe(false);
    expect(readRecovery(storage, config)).toBeUndefined();
  });
  it("retains untouched corrupt storage while providing its known initial state", () => {
    const storage = memoryStorage();
    storage.values.set(
      STORAGE_KEY,
      '{"version":2,"collected":{"chicago":{"visitDate":"2026-02-31","provenance":"confirmed-demo"}}}',
    );
    expect(readWorld(storage, config)).toMatchObject({
      status: "corrupt",
      state: initialState(),
    });
    expect(storage.writes).toHaveLength(0);
  });
});

describe("bounded backup import and privacy controls", () => {
  it("exports and imports a self-contained current world including provenance", () => {
    const text = exportBackup(fullState(), config);
    expect(JSON.parse(text).format).toBe("roamy-world-backup");
    expect(parseBackup(text, config)).toEqual({
      status: "ready",
      state: fullState(),
      migrated: false,
    });
  });
  it("accepts raw legacy saves for deliberate recovery", () => {
    expect(
      parseBackup(
        '{"version":1,"collected":{"chicago":{"visitDate":"2026-11-15","memory":"A demo"}}}',
        config,
      ),
    ).toMatchObject({ status: "ready", migrated: true, state: { version: 2 } });
  });
  it("rejects malformed, unknown, oversized and incorrectly typed records", () => {
    const record = { visitDate: "2026-11-15", provenance: "confirmed-demo" };
    const invalid = [
      "{",
      "null",
      "[]",
      JSON.stringify({ version: 2, collected: [] }),
      JSON.stringify({ version: 2, collected: { evil: record } }),
      JSON.stringify({
        version: 2,
        collected: { chicago: { ...record, memory: "x".repeat(501) } },
      }),
      JSON.stringify({
        version: 2,
        collected: { chicago: { ...record, memory: 2 } },
      }),
      JSON.stringify({
        version: 2,
        collected: { chicago: { ...record, extra: "future-data" } },
      }),
      JSON.stringify({
        version: 2,
        collected: { chicago: { ...record, provenance: "illustration" } },
      }),
      JSON.stringify({ version: 2, collected: { detroit: record } }),
      JSON.stringify({ version: 2, collected: {}, surprise: true }),
      " ".repeat(MAX_BACKUP_BYTES + 1),
      '"' + "🍕".repeat(MAX_BACKUP_BYTES / 4) + '"',
    ];
    for (const text of invalid)
      expect(parseBackup(text, config).status, text.slice(0, 100)).toBe(
        "corrupt",
      );
  });
  it("rejects prototype keys and unsupported export versions", () => {
    expect(
      parseWorld(
        '{"version":2,"collected":{"__proto__":{"visitDate":"2026-11-15","provenance":"confirmed-demo"}}}',
        config,
      ).status,
    ).toBe("corrupt");
    expect(
      parseBackup(
        '{"format":"roamy-world-backup","version":2,"world":{}}',
        config,
      ).status,
    ).toBe("unsupported");
    expect(
      parseBackup(
        '{"format":"roamy-world-backup","version":1,"world":{"version":3}}',
        config,
      ).status,
    ).toBe("unsupported");
  });
  it("refuses to export invalid in-memory state", () => {
    expect(() =>
      exportBackup(
        { ...fullState(), version: 1 } as unknown as WorldState,
        config,
      ),
    ).toThrow();
  });
  it("validates actual dates including year and leap-day bounds", () => {
    expect(isVisitDate("2024-02-29")).toBe(true);
    for (const date of [
      "0000-01-01",
      "2026-02-29",
      "2026-04-31",
      "2026-00-01",
      "2026-01-00",
      "2026-13-01",
      ["2026-01-01"],
    ])
      expect(isVisitDate(date)).toBe(false);
  });
  it("explicitly clears both recovery copies without removing the active world", () => {
    const storage = memoryStorage();
    storage.values.set(STORAGE_KEY, JSON.stringify(fullState()));
    storage.values.set(RECOVERY_KEY, JSON.stringify(initialState()));
    storage.values.set(PRESERVED_KEY, "private malformed data");
    expect(clearRecoveryData(storage)).toBe(true);
    expect(readRecovery(storage, config)).toBeUndefined();
    expect(readPreservedSave(storage)).toBeNull();
    expect(readWorld(storage, config).state).toEqual(fullState());
  });
  it("erases raw text even when removeItem is unavailable", () => {
    const storage = memoryStorage();
    storage.values.set(PRESERVED_KEY, "private malformed data");
    expect(
      clearRecoveryData({ getItem: storage.getItem, setItem: storage.setItem }),
    ).toBe(true);
    expect(storage.getItem(PRESERVED_KEY)).toBe("");
  });
});
