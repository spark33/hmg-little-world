import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseSafety, requestNavigation } from "./bridge";

describe("native navigation request lifecycle", () => {
  let messages: { id: string; destinationId: string }[];
  let bridge: NonNullable<Window["NativeBridge"]>;
  beforeEach(() => {
    vi.useFakeTimers();
    messages = [];
    bridge = {
      onmessage: null,
      postMessage: (raw) => messages.push(JSON.parse(raw)),
    };
    vi.stubGlobal("window", { NativeBridge: bridge, setTimeout });
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  function reply(id: string, available = true) {
    bridge.onmessage?.({
      data: JSON.stringify({ v: 1, id, available }),
    } as MessageEvent);
  }
  it("correlates concurrent out-of-order responses", async () => {
    const first = requestNavigation("nearby");
    const second = requestNavigation("weekend");
    reply(messages[1].id, false);
    reply(messages[0].id);
    expect(await first).toMatchObject({ id: messages[0].id, available: true });
    expect(await second).toMatchObject({
      id: messages[1].id,
      available: false,
    });
    expect(bridge.onmessage).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("ignores malformed and uncorrelated messages until timeout", async () => {
    const result = requestNavigation("chicago");
    bridge.onmessage?.({ data: "{" } as MessageEvent);
    reply("unrelated");
    bridge.onmessage?.({
      data: JSON.stringify({ v: 2, id: messages[0].id }),
    } as MessageEvent);
    vi.advanceTimersByTime(1800);
    expect(await result).toMatchObject({ available: false });
    expect(bridge.onmessage).toBeNull();
  });
  it("cancels only the interrupted request and releases its timer", async () => {
    const controller = new AbortController();
    const first = requestNavigation("nearby", controller.signal);
    const second = requestNavigation("chicago");
    controller.abort();
    expect(await first).toMatchObject({ available: false });
    reply(messages[0].id); // A late reply cannot resolve another request.
    reply(messages[1].id);
    expect(await second).toMatchObject({ available: true });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not send an already canceled request", async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await requestNavigation("nearby", controller.signal)).toMatchObject({
      available: false,
    });
    expect(messages).toHaveLength(0);
  });
  it("recovers a throwing transport without leaking handlers", async () => {
    bridge.postMessage = () => {
      throw Error("service disconnected");
    };
    expect(await requestNavigation("nearby")).toMatchObject({
      available: false,
    });
    expect(bridge.onmessage).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("falls back when the native bridge is unavailable", async () => {
    vi.stubGlobal("window", {});
    expect(await requestNavigation("nearby")).toMatchObject({
      available: false,
    });
  });
  it("rejects coerced safety states", () => {
    expect(parseSafety({ state: ["parked"], preview: false })).toBeUndefined();
  });
});
