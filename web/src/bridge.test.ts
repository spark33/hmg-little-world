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

describe("typed navigation capabilities", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  it("uses correlated typed capabilities and status queries", async () => {
    const { requestCapabilities, requestNavigationStatus, parseReply } =
      await import("./bridge");
    const messages: { id: string; type: string }[] = [];
    const bridge: NonNullable<Window["NativeBridge"]> = {
      onmessage: null,
      postMessage: (raw) => messages.push(JSON.parse(raw)),
    };
    vi.stubGlobal("window", { NativeBridge: bridge, setTimeout });
    const capabilities = requestCapabilities();
    bridge.onmessage?.({
      data: JSON.stringify({
        v: 1,
        id: messages[0].id,
        navigation: false,
        navigationStatus: "denied",
        verifiedDestinationCount: 0,
      }),
    } as MessageEvent);
    expect(await capabilities).toMatchObject({
      navigationStatus: "denied",
      navigation: false,
    });
    const status = requestNavigationStatus();
    bridge.onmessage?.({
      data: JSON.stringify({
        v: 1,
        id: messages[1].id,
        navigationStatus: "submitted",
        destinationId: "approved-test-id",
      }),
    } as MessageEvent);
    expect(await status).toMatchObject({ navigationStatus: "submitted" });
    expect(messages.map((m) => m.type)).toEqual([
      "capabilities",
      "navigation-status",
    ]);
    for (const patch of [
      { navigationStatus: "arrived" },
      { canRetry: "yes" },
      { verifiedDestinationCount: -1 },
      { verifiedDestinationCount: 1000 },
      { destinationId: "https://example.com" },
      { reason: "x".repeat(161) },
    ])
      expect(parseReply({ v: 1, id: "test", ...patch })).toBeUndefined();
  });
  it("distinguishes a timeout, cancellation and disconnected transport", async () => {
    const { requestNavigationStatus } = await import("./bridge");
    vi.useFakeTimers();
    const bridge: NonNullable<Window["NativeBridge"]> = {
      onmessage: null,
      postMessage: () => {},
    };
    vi.stubGlobal("window", { NativeBridge: bridge, setTimeout });
    const timeout = requestNavigationStatus();
    vi.advanceTimersByTime(1800);
    expect(await timeout).toMatchObject({
      navigationStatus: "timeout",
      canRetry: true,
    });
    const controller = new AbortController();
    const cancelled = requestNavigationStatus(controller.signal);
    controller.abort();
    expect(await cancelled).toMatchObject({ navigationStatus: "cancelled" });
    bridge.postMessage = () => {
      throw Error();
    };
    expect(await requestNavigationStatus()).toMatchObject({
      navigationStatus: "error",
      reason: "navigation-transport-error",
    });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("bounds concurrent pending messages and never sends coordinate-like IDs", async () => {
    const { requestNavigationStatus } = await import("./bridge");
    vi.useFakeTimers();
    let sent = 0;
    const bridge: NonNullable<Window["NativeBridge"]> = {
      onmessage: null,
      postMessage: () => {
        sent++;
      },
    };
    vi.stubGlobal("window", { NativeBridge: bridge, setTimeout });
    expect(await requestNavigation("geo:37.4,127.0")).toMatchObject({
      reason: "invalid-destination-id",
    });
    const requests = Array.from({ length: 16 }, () =>
      requestNavigationStatus(),
    );
    expect(await requestNavigationStatus()).toMatchObject({
      reason: "too-many-navigation-requests",
    });
    expect(sent).toBe(16);
    vi.advanceTimersByTime(1800);
    await Promise.all(requests);
    expect(bridge.onmessage).toBeNull();
  });
});

describe("native audio focus bridge", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  it("validates actual focus grants and keeps audio replies correlated with navigation", async () => {
    const {
      requestAudioFocus,
      releaseAudioFocus,
      requestNavigationStatus,
      parseReply,
    } = await import("./bridge");
    const messages: { id: string; type: string }[] = [];
    const bridge: NonNullable<Window["NativeBridge"]> = {
      onmessage: null,
      postMessage: (raw) => messages.push(JSON.parse(raw)),
    };
    vi.stubGlobal("window", { NativeBridge: bridge, setTimeout });
    const audio = requestAudioFocus();
    const navigation = requestNavigationStatus();
    bridge.onmessage?.({
      data: JSON.stringify({
        v: 1,
        id: messages[1].id,
        navigationStatus: "disconnected",
      }),
    } as MessageEvent);
    bridge.onmessage?.({
      data: JSON.stringify({ v: 1, id: messages[0].id, audioFocus: false }),
    } as MessageEvent);
    expect(await audio).toMatchObject({ audioFocus: false });
    expect(await navigation).toMatchObject({
      navigationStatus: "disconnected",
    });
    const release = releaseAudioFocus();
    bridge.onmessage?.({
      data: JSON.stringify({ v: 1, id: messages[2].id, audioFocus: false }),
    } as MessageEvent);
    await release;
    expect(messages.map((message) => message.type)).toEqual([
      "audio-request",
      "navigation-status",
      "audio-release",
    ]);
    expect(parseReply({ v: 1, id: "x", audioFocus: "true" })).toBeUndefined();
    expect(bridge.onmessage).toBeNull();
  });
  it("never fabricates a focus grant when the bridge is missing or times out", async () => {
    const { requestAudioFocus } = await import("./bridge");
    vi.stubGlobal("window", {});
    expect(await requestAudioFocus()).toMatchObject({ audioFocus: false });
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      NativeBridge: { onmessage: null, postMessage: () => {} },
      setTimeout,
    });
    const result = requestAudioFocus();
    vi.advanceTimersByTime(1800);
    expect(await result).toMatchObject({
      audioFocus: false,
      navigationStatus: "timeout",
    });
  });
});
