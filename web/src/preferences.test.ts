import { describe, it, expect } from "vitest";
import { loadPreferences, savePreferences } from "./preferences";

describe("ROAMY preferences", () => {
  it("defaults to the system reduced-motion preference and survives disabled storage", () => {
    const storage = {
      getItem: () => {
        throw Error();
      },
      setItem: () => {
        throw Error();
      },
    };
    expect(loadPreferences(storage, true)).toEqual({
      night: false,
      muted: false,
      reducedMotion: true,
    });
    expect(
      savePreferences(storage, {
        night: true,
        muted: true,
        reducedMotion: true,
      }),
    ).toBe(false);
  });
  it("round trips preferences separately from the world", () => {
    const data = new Map();
    const storage = {
      getItem: (key: string) => data.get(key),
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    };
    const preferences = { night: true, muted: true, reducedMotion: false };
    expect(savePreferences(storage, preferences)).toBe(true);
    expect(loadPreferences(storage, true)).toEqual(preferences);
    expect(data.has("little-world:v1")).toBe(false);
  });
  it("validates version and individual boolean fields", () => {
    const storage = {
      getItem: () => '{"version":1,"night":"yes","muted":true}',
      setItem: () => {},
    };
    expect(loadPreferences(storage, true)).toEqual({
      night: false,
      muted: true,
      reducedMotion: true,
    });
    expect(
      loadPreferences(
        { ...storage, getItem: () => '{"version":2,"night":true}' },
        false,
      ).night,
    ).toBe(false);
  });
});
