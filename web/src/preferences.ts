import type { StorageLike } from "./domain";

export const PREFERENCES_KEY = "roamy:preferences:v1";
export interface Preferences {
  night: boolean;
  muted: boolean;
  reducedMotion: boolean;
}
export function loadPreferences(
  storage: StorageLike,
  prefersReducedMotion: boolean,
): Preferences {
  const defaults = {
    night: false,
    muted: false,
    reducedMotion: prefersReducedMotion,
  };
  try {
    const raw = JSON.parse(storage.getItem(PREFERENCES_KEY) || "null");
    if (!raw || raw.version !== 1) return defaults;
    return {
      night: typeof raw.night === "boolean" ? raw.night : defaults.night,
      muted: typeof raw.muted === "boolean" ? raw.muted : defaults.muted,
      reducedMotion:
        typeof raw.reducedMotion === "boolean"
          ? raw.reducedMotion
          : defaults.reducedMotion,
    };
  } catch {
    return defaults;
  }
}
export function savePreferences(
  storage: StorageLike,
  preferences: Preferences,
): boolean {
  try {
    storage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ version: 1, ...preferences }),
    );
    return true;
  } catch {
    return false;
  }
}
