import { nativeHost, releaseAudioFocus, requestAudioFocus } from "./bridge";

const IDLE_INTENT_MS = 5000;
const MAX_FLOURISH_MS = 3000;
type FocusReply = { audioFocus?: boolean };
type SoundDependencies = {
  isNative: () => boolean;
  isVisible: () => boolean;
  createContext: () => AudioContext;
  requestFocus: (signal: AbortSignal) => Promise<FocusReply>;
  releaseFocus: () => Promise<unknown> | void;
};
type SoundNode = { oscillator: OscillatorNode; gain: GainNode };

/** Optional sound with explicit intent, native focus authority, and bounded audible work. */
export class SoundSession {
  private context: AudioContext | undefined;
  private generation = 0;
  private wanted = false;
  private ready = false;
  private startingFlourish = false;
  private hasNativeFocus = false;
  private focusRequested = false;
  private pendingFocus: AbortController | undefined;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private burstTimer: ReturnType<typeof setTimeout> | undefined;
  private nodes = new Set<SoundNode>();

  constructor(private readonly dependencies: SoundDependencies) {}

  /** Prime a user gesture without taking native focus for a silent selection/settings tap. */
  unlock(): void {
    if (!this.dependencies.isVisible()) return;
    if (this.wanted && (this.startingFlourish || this.nodes.size > 0)) return;
    this.wanted = true;
    const generation = ++this.generation;
    try {
      if (!this.context || this.context.state === "closed")
        this.context = this.dependencies.createContext();
      if (this.dependencies.isNative()) {
        this.ready = false;
        this.suspendContext();
      } else {
        void this.resumeContext(generation).catch(() => {
          if (generation === this.generation) this.suspend();
        });
      }
      clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => this.suspend(), IDLE_INTENT_MS);
    } catch {
      this.suspend();
    }
  }

  flourish(): void {
    if (
      !this.wanted ||
      !this.context ||
      !this.dependencies.isVisible() ||
      this.startingFlourish ||
      this.nodes.size > 0
    )
      return;
    this.startingFlourish = true;
    clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
    void this.beginFlourish(this.generation);
  }

  private async beginFlourish(generation: number): Promise<void> {
    try {
      if (this.dependencies.isNative()) {
        const controller = new AbortController();
        this.pendingFocus = controller;
        this.focusRequested = true;
        const reply = await this.dependencies.requestFocus(controller.signal);
        if (controller.signal.aborted || !this.isCurrent(generation)) return;
        this.pendingFocus = undefined;
        if (reply.audioFocus !== true) {
          this.suspend();
          return;
        }
        this.hasNativeFocus = true;
      }
      if (!this.isCurrent(generation)) return;
      // Also bounds a browser resume that never completes; native has its own focus lease.
      this.burstTimer = setTimeout(() => this.suspend(), MAX_FLOURISH_MS);
      await this.resumeContext(generation);
      if (
        !this.isCurrent(generation) ||
        !this.ready ||
        !this.context ||
        (this.dependencies.isNative() && !this.hasNativeFocus)
      )
        return;
      this.scheduleNotes(this.context);
    } catch {
      if (generation === this.generation) this.suspend();
    } finally {
      if (generation === this.generation) this.startingFlourish = false;
    }
  }

  private isCurrent(generation: number): boolean {
    return (
      generation === this.generation &&
      this.wanted &&
      this.dependencies.isVisible()
    );
  }

  private async resumeContext(generation: number): Promise<void> {
    if (!this.context) return;
    if (this.dependencies.isNative() && !this.hasNativeFocus) return;
    if (this.context.state !== "running") await this.context.resume();
    if (
      !this.isCurrent(generation) ||
      (this.dependencies.isNative() && !this.hasNativeFocus)
    ) {
      // A late resume must not undo mute, background, or focus loss.
      if (
        !this.wanted ||
        !this.dependencies.isVisible() ||
        (this.dependencies.isNative() && !this.hasNativeFocus)
      )
        this.suspendContext();
      return;
    }
    this.ready = this.context.state === "running";
  }

  private scheduleNotes(context: AudioContext): void {
    const now = context.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 987.77, 1318.51].forEach(
      (frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const node = { oscillator, gain };
        this.nodes.add(node);
        oscillator.onended = () => {
          this.nodes.delete(node);
          this.disconnect(node);
          if (this.nodes.size === 0) this.suspend();
        };
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, now + index * 0.15);
        gain.gain.linearRampToValueAtTime(0.075, now + index * 0.15 + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.15 + 1.1);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(now + index * 0.15);
        oscillator.stop(now + index * 0.15 + 1.2);
      },
    );
  }

  /** Stop scheduled sources: suspending alone would leave old notes queued for later. */
  suspend(releaseNativeFocus = true): void {
    this.wanted = false;
    this.ready = false;
    this.startingFlourish = false;
    this.generation++;
    this.pendingFocus?.abort();
    this.pendingFocus = undefined;
    clearTimeout(this.idleTimer);
    clearTimeout(this.burstTimer);
    this.idleTimer = undefined;
    this.burstTimer = undefined;
    for (const node of this.nodes) {
      node.oscillator.onended = null;
      try {
        node.oscillator.stop();
      } catch {
        /* Already stopped or not started. */
      }
      this.disconnect(node);
    }
    this.nodes.clear();
    this.suspendContext();
    const hadFocusRequest = this.focusRequested || this.hasNativeFocus;
    this.hasNativeFocus = false;
    this.focusRequested = false;
    if (releaseNativeFocus && hadFocusRequest) {
      try {
        void Promise.resolve(this.dependencies.releaseFocus()).catch(() => {});
      } catch {
        /* Native lifecycle abandons independently too. */
      }
    }
  }

  focusLost(): void {
    // The native authority already abandoned focus; avoid an endless release-event echo.
    this.suspend(false);
  }

  private suspendContext(): void {
    try {
      void this.context?.suspend().catch(() => {});
    } catch {
      /* Audio is optional. */
    }
  }

  private disconnect({ oscillator, gain }: SoundNode): void {
    try {
      gain.gain.cancelScheduledValues(0);
    } catch {
      /* Best-effort cleanup. */
    }
    try {
      oscillator.disconnect();
    } catch {
      /* Already disconnected. */
    }
    try {
      gain.disconnect();
    } catch {
      /* Already disconnected. */
    }
  }
}

let session: SoundSession | undefined;
function soundSession(): SoundSession {
  if (!session) {
    session = new SoundSession({
      isNative: () => nativeHost,
      isVisible: () => !document.hidden,
      createContext: () => new AudioContext(),
      requestFocus: requestAudioFocus,
      releaseFocus: releaseAudioFocus,
    });
    const current = session;
    window.addEventListener("roamy-audio-focus", (event) => {
      if ((event as CustomEvent).detail?.granted === false) current.focusLost();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) current.suspend();
    });
    window.addEventListener("vehicle-safety", (event) => {
      const detail = (event as CustomEvent).detail;
      if (
        detail?.state !== "parked" &&
        !(detail?.state === "unknown" && detail?.preview === true)
      )
        current.suspend();
    });
  }
  return session;
}

export function unlockSound(): void {
  soundSession().unlock();
}
export function flourish(): void {
  soundSession().flourish();
}
export function suspendSound(): void {
  soundSession().suspend();
}
