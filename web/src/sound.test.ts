import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SoundSession } from "./sound";
class Oscillator {
  type = "sine";
  frequency = { value: 0 };
  onended: (() => void) | null = null;
  connect = vi.fn((gain: Gain) => gain);
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}
class Gain {
  gain = {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
  connect = vi.fn();
  disconnect = vi.fn();
}
class Context {
  state: AudioContextState = "suspended";
  currentTime = 0;
  destination = {};
  oscillators: Oscillator[] = [];
  gains: Gain[] = [];
  resume = vi.fn(async () => {
    this.state = "running";
  });
  suspend = vi.fn(async () => {
    this.state = "suspended";
  });
  createOscillator = vi.fn(() => {
    const node = new Oscillator();
    this.oscillators.push(node);
    return node;
  });
  createGain = vi.fn(() => {
    const node = new Gain();
    this.gains.push(node);
    return node;
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function setup(native = true) {
  let visible = true;
  const context = new Context();
  const requestFocus = vi.fn((_signal: AbortSignal) =>
    Promise.resolve({ audioFocus: true }),
  );
  const releaseFocus = vi.fn(async () => {});
  const createContext = vi.fn(() => context as unknown as AudioContext);
  const session = new SoundSession({
    isNative: () => native,
    isVisible: () => visible,
    createContext,
    requestFocus,
    releaseFocus,
  });
  return {
    session,
    context,
    createContext,
    requestFocus,
    releaseFocus,
    setVisible: (value: boolean) => {
      visible = value;
    },
  };
}
async function flush() {
  for (let index = 0; index < 8; index++) await Promise.resolve();
}

describe("explicit, interruptible sound", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it("silent native unlocks prime a context without requesting focus or resuming playback", async () => {
    const test = setup();
    test.session.unlock();
    await flush();
    expect(test.createContext).toHaveBeenCalledTimes(1);
    expect(test.requestFocus).not.toHaveBeenCalled();
    expect(test.context.resume).not.toHaveBeenCalled();
    expect(test.context.createOscillator).not.toHaveBeenCalled();
    expect(test.context.state).toBe("suspended");
    vi.advanceTimersByTime(5000);
    test.session.flourish();
    expect(test.requestFocus).not.toHaveBeenCalled();
  });
  it("native flourish waits for an actual grant before resuming and playing", async () => {
    const test = setup();
    const focus = deferred<{ audioFocus: boolean }>();
    test.requestFocus.mockReturnValue(focus.promise);
    test.session.unlock();
    test.session.flourish();
    await flush();
    expect(test.requestFocus).toHaveBeenCalledTimes(1);
    expect(test.context.resume).not.toHaveBeenCalled();
    focus.resolve({ audioFocus: true });
    await flush();
    expect(test.context.resume).toHaveBeenCalledTimes(1);
    expect(test.context.oscillators).toHaveLength(6);
    expect(
      test.context.oscillators.every(
        (node) => node.start.mock.calls.length === 1,
      ),
    ).toBe(true);
    test.session.suspend();
  });
  it("denied or unavailable native focus never resumes or schedules sound", async () => {
    const test = setup();
    test.requestFocus.mockResolvedValue({ audioFocus: false });
    test.session.unlock();
    test.session.flourish();
    await flush();
    expect(test.context.resume).not.toHaveBeenCalled();
    expect(test.context.oscillators).toHaveLength(0);
    expect(test.releaseFocus).toHaveBeenCalledTimes(1);
    test.session.flourish();
    expect(test.requestFocus).toHaveBeenCalledTimes(1);
  });
  it("mute aborts a pending focus request and ignores its late grant", async () => {
    const test = setup();
    const focus = deferred<{ audioFocus: boolean }>();
    test.requestFocus.mockReturnValue(focus.promise);
    test.session.unlock();
    test.session.flourish();
    const signal = test.requestFocus.mock.calls[0][0];
    test.session.suspend();
    expect(signal.aborted).toBe(true);
    focus.resolve({ audioFocus: true });
    await flush();
    expect(test.context.resume).not.toHaveBeenCalled();
    expect(test.context.oscillators).toHaveLength(0);
    expect(test.releaseFocus).toHaveBeenCalledTimes(1);
  });
  it("a late AudioContext resume cannot undo a mute", async () => {
    const test = setup();
    const resume = deferred<void>();
    test.context.resume.mockImplementation(() =>
      resume.promise.then(() => {
        test.context.state = "running";
      }),
    );
    test.session.unlock();
    test.session.flourish();
    await flush();
    expect(test.context.resume).toHaveBeenCalledTimes(1);
    test.session.suspend();
    resume.resolve();
    await flush();
    expect(test.context.state).toBe("suspended");
    expect(test.context.oscillators).toHaveLength(0);
    expect(test.releaseFocus).toHaveBeenCalledTimes(1);
  });
  it("mute stops every scheduled oscillator so old notes cannot replay", async () => {
    const test = setup();
    test.session.unlock();
    test.session.flourish();
    await flush();
    test.session.suspend();
    for (const node of test.context.oscillators) {
      expect(node.stop).toHaveBeenCalledTimes(2);
      expect(node.disconnect).toHaveBeenCalledTimes(1);
      expect(node.onended).toBeNull();
    }
    for (const gain of test.context.gains) {
      expect(gain.gain.cancelScheduledValues).toHaveBeenCalledWith(0);
      expect(gain.disconnect).toHaveBeenCalledTimes(1);
    }
    test.session.flourish();
    await flush();
    expect(test.context.oscillators).toHaveLength(6);
    expect(test.requestFocus).toHaveBeenCalledTimes(1);
  });
  it("focus loss stops playback without echoing releases or automatically reacquiring", async () => {
    const test = setup();
    test.session.unlock();
    test.session.flourish();
    await flush();
    test.session.focusLost();
    test.session.flourish();
    await flush();
    expect(test.releaseFocus).not.toHaveBeenCalled();
    expect(test.requestFocus).toHaveBeenCalledTimes(1);
    expect(
      test.context.oscillators.every(
        (node) => node.stop.mock.calls.length === 2,
      ),
    ).toBe(true);
    test.session.unlock();
    test.session.flourish();
    await flush();
    expect(test.requestFocus).toHaveBeenCalledTimes(2);
    test.session.suspend();
  });
  it("backgrounding invalidates old intent and visibility alone never resumes audio", async () => {
    const test = setup();
    test.session.unlock();
    test.setVisible(false);
    test.session.suspend();
    test.setVisible(true);
    test.session.flourish();
    await flush();
    expect(test.requestFocus).not.toHaveBeenCalled();
    expect(test.context.resume).not.toHaveBeenCalled();
  });
  it("releases after the last note and bounds focus when ended callbacks are missing", async () => {
    const test = setup();
    test.session.unlock();
    test.session.flourish();
    await flush();
    for (const node of test.context.oscillators) node.onended?.();
    expect(test.releaseFocus).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    test.session.unlock();
    test.session.flourish();
    await flush();
    vi.advanceTimersByTime(3000);
    expect(test.releaseFocus).toHaveBeenCalledTimes(2);
    expect(test.context.state).toBe("suspended");
  });
  it("supports browser preview without native focus and preserves the delayed reveal intent", async () => {
    const test = setup(false);
    test.session.unlock();
    await flush();
    vi.advanceTimersByTime(3600);
    test.session.flourish();
    await flush();
    expect(test.requestFocus).not.toHaveBeenCalled();
    expect(test.context.oscillators).toHaveLength(6);
    test.session.suspend();
    expect(test.releaseFocus).not.toHaveBeenCalled();
  });
  it("the public sound API stops sources on focus loss, visibility loss, and unsafe vehicle events", async () => {
    vi.resetModules();
    const context = new Context();
    const documentTarget = new EventTarget();
    const windowTarget = new EventTarget();
    Object.defineProperty(documentTarget, "hidden", {
      value: false,
      configurable: true,
    });
    vi.stubGlobal("document", documentTarget);
    vi.stubGlobal("window", windowTarget);
    vi.stubGlobal("AudioContext", function () {
      return context;
    });
    const sound = await import("./sound");
    const focus = (granted: boolean) => {
      const event = new Event("roamy-audio-focus");
      Object.defineProperty(event, "detail", { value: { granted } });
      windowTarget.dispatchEvent(event);
    };
    sound.unlockSound();
    sound.flourish();
    await flush();
    expect(context.oscillators).toHaveLength(6);
    focus(false);
    focus(true);
    sound.flourish();
    await flush();
    expect(context.state).toBe("suspended");
    expect(context.oscillators).toHaveLength(6);
    sound.unlockSound();
    await flush();
    Object.defineProperty(documentTarget, "hidden", {
      value: true,
      configurable: true,
    });
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(documentTarget, "hidden", {
      value: false,
      configurable: true,
    });
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    sound.flourish();
    await flush();
    expect(context.oscillators).toHaveLength(6);
    sound.unlockSound();
    sound.flourish();
    await flush();
    const safety = new Event("vehicle-safety");
    Object.defineProperty(safety, "detail", {
      value: { state: "driving", preview: true },
    });
    windowTarget.dispatchEvent(safety);
    expect(context.state).toBe("suspended");
    expect(context.oscillators.every((node) => node.onended === null)).toBe(
      true,
    );
  });
});
