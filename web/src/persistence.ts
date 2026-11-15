/** Local-only world storage. Reads and migrations never write to storage. */
export const STORAGE_KEY = "little-world:v1";
export const RECOVERY_KEY = "little-world:recovery:v1";
export const PRESERVED_KEY = "little-world:preserved:v1";
export const MAX_BACKUP_BYTES = 64 * 1024;
export const MAX_MEMORY_LENGTH = 500;

export interface MemoryRecord {
  visitDate: string;
  memory?: string;
  provenance: "illustration" | "confirmed-demo";
}
export interface WorldState {
  version: 2;
  collected: Record<string, MemoryRecord>;
}
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}
export interface PersistenceConfig {
  knownIds: readonly string[];
  initialState: () => WorldState;
  /** Includes archived seed IDs when the current demonstration changes theme. */
  illustrationIds?: readonly string[];
}
export type SaveStatus =
  "ready" | "empty" | "unavailable" | "corrupt" | "unsupported";
export type ParsedWorld =
  | { status: "ready"; state: WorldState; migrated: boolean }
  | { status: "corrupt" | "unsupported"; reason: string };

export function isVisitDate(date: unknown): date is string {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    date.startsWith("0000")
  )
    return false;
  const time = Date.parse(`${date}T00:00:00Z`);
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date
  );
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function fields(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function bounded(text: string) {
  return (
    text.length <= MAX_BACKUP_BYTES &&
    new TextEncoder().encode(text).byteLength <= MAX_BACKUP_BYTES
  );
}
function invalid(
  reason = "This backup does not contain a valid ROAMY world.",
): ParsedWorld {
  return { status: "corrupt", reason };
}
function parseValue(value: unknown, config: PersistenceConfig): ParsedWorld {
  if (!object(value)) return invalid();
  if (typeof value.version === "number" && value.version > 2) {
    return {
      status: "unsupported",
      reason: "This world was saved by a newer version of ROAMY.",
    };
  }
  if (
    !fields(value, ["version", "collected"]) ||
    (value.version !== 1 && value.version !== 2) ||
    !object(value.collected)
  )
    return invalid();
  const entries = Object.entries(value.collected);
  if (entries.length > config.knownIds.length)
    return invalid("The backup contains too many memories.");
  const defaults = config.initialState();
  const collected: Record<string, MemoryRecord> = Object.fromEntries(
    Object.entries(defaults.collected).map(([id, record]) => [
      id,
      { ...record },
    ]),
  );
  const legacy = value.version === 1;
  for (const [id, record] of entries) {
    if (
      !config.knownIds.includes(id) ||
      ["__proto__", "prototype", "constructor"].includes(id)
    )
      return invalid("The backup contains an unknown keepsake.");
    if (
      !object(record) ||
      !fields(
        record,
        legacy
          ? ["visitDate", "memory"]
          : ["visitDate", "memory", "provenance"],
      ) ||
      !isVisitDate(record.visitDate)
    )
      return invalid("A memory has an invalid date or format.");
    if (
      record.memory !== undefined &&
      (typeof record.memory !== "string" ||
        record.memory.length > MAX_MEMORY_LENGTH)
    )
      return invalid(
        `Memory text must be at most ${MAX_MEMORY_LENGTH} characters.`,
      );
    const provenance =
      defaults.collected[id]?.provenance === "illustration" ||
      config.illustrationIds?.includes(id)
        ? "illustration"
        : "confirmed-demo";
    if (!legacy && record.provenance !== provenance)
      return invalid("A memory has invalid provenance.");
    collected[id] = {
      visitDate: record.visitDate,
      ...(record.memory === undefined ? {} : { memory: record.memory }),
      provenance,
    };
  }
  return {
    status: "ready",
    state: { version: 2, collected },
    migrated: legacy,
  };
}

/** Parse raw v1/v2 saves without losing edited seeded memories or accepting unknown IDs. */
export function parseWorld(
  text: string,
  config: PersistenceConfig,
): ParsedWorld {
  if (!bounded(text)) return invalid("The backup exceeds the 64 KiB limit.");
  try {
    return parseValue(JSON.parse(text), config);
  } catch {
    return invalid();
  }
}

export function readRecovery(
  storage: StorageLike,
  config: PersistenceConfig,
): WorldState | undefined {
  try {
    const raw = storage.getItem(RECOVERY_KEY);
    if (!raw) return;
    const parsed = parseWorld(raw, config);
    return parsed.status === "ready" ? parsed.state : undefined;
  } catch {
    return;
  }
}

export function readPreservedSave(storage: StorageLike): string | null {
  try {
    return storage.getItem(PRESERVED_KEY) || null;
  } catch {
    return null;
  }
}

export function readWorld(
  storage: StorageLike,
  config: PersistenceConfig,
): {
  state: WorldState;
  status: SaveStatus;
  migrated: boolean;
  recoveryAvailable: boolean;
} {
  const fallback = config.initialState();
  let text: string | null;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return {
      state: fallback,
      status: "unavailable",
      migrated: false,
      recoveryAvailable: false,
    };
  }
  const recoveryAvailable = readRecovery(storage, config) !== undefined;
  if (text === null)
    return {
      state: fallback,
      status: "empty",
      migrated: false,
      recoveryAvailable,
    };
  const parsed = parseWorld(text, config);
  return parsed.status === "ready"
    ? { ...parsed, recoveryAvailable }
    : {
        state: fallback,
        status: parsed.status,
        migrated: false,
        recoveryAvailable,
      };
}

/**
 * Write only validated state. A prior valid save is copied before replacement.
 * Protected saves require deliberate reset/import and are preserved separately.
 * A backup failure aborts the write, leaving the current save intact.
 */
export function saveWorld(
  storage: StorageLike,
  state: WorldState,
  config: PersistenceConfig,
  options: { replaceProtected?: boolean } = {},
): boolean {
  try {
    const next = parseWorld(JSON.stringify(state), config);
    if (next.status !== "ready" || next.migrated) return false;
    const text = JSON.stringify(next.state);
    const previous = storage.getItem(STORAGE_KEY);
    if (previous === text) return true;
    if (previous !== null) {
      const parsed = parseWorld(previous, config);
      const protectedSave = parsed.status !== "ready";
      if (protectedSave && !options.replaceProtected) return false;
      const backupKey = protectedSave ? PRESERVED_KEY : RECOVERY_KEY;
      if (storage.getItem(backupKey) !== previous)
        storage.setItem(backupKey, previous);
    }
    storage.setItem(STORAGE_KEY, text);
    return true;
  } catch {
    return false;
  }
}

export function exportBackup(
  state: WorldState,
  config: PersistenceConfig,
): string {
  const parsed = parseWorld(JSON.stringify(state), config);
  if (parsed.status !== "ready" || parsed.migrated)
    throw new Error("Only a valid current world can be exported.");
  const text = JSON.stringify(
    { format: "roamy-world-backup", version: 1, world: parsed.state },
    null,
    2,
  );
  if (!bounded(text)) throw new Error("The backup exceeds the 64 KiB limit.");
  return text;
}

/** Accept exported backups and original raw saves for deliberate recovery. */
export function parseBackup(
  text: string,
  config: PersistenceConfig,
): ParsedWorld {
  if (!bounded(text)) return invalid("The backup exceeds the 64 KiB limit.");
  try {
    const value: unknown = JSON.parse(text);
    if (object(value) && value.format === "roamy-world-backup") {
      if (typeof value.version === "number" && value.version > 1)
        return {
          status: "unsupported",
          reason: "This backup uses a newer export format.",
        };
      if (value.version !== 1 || !fields(value, ["format", "version", "world"]))
        return invalid();
      return parseValue(value.world, config);
    }
    return parseValue(value, config);
  } catch {
    return invalid();
  }
}

export function clearRecoveryData(storage: StorageLike): boolean {
  try {
    for (const key of [RECOVERY_KEY, PRESERVED_KEY]) {
      if (storage.removeItem) storage.removeItem(key);
      else storage.setItem(key, "");
    }
    return true;
  } catch {
    return false;
  }
}
