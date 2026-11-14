let context: AudioContext | undefined;
export function unlockSound() {
  try {
    context ??= new AudioContext();
    void context.resume();
  } catch {
    /* Audio is optional. */
  }
}
export function flourish() {
  if (!context) return;
  const now = context.currentTime;
  [523.25, 659.25, 783.99, 1046.5, 987.77, 1318.51].forEach((freq, i) => {
    const osc = context!.createOscillator();
    const gain = context!.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + i * 0.15);
    gain.gain.linearRampToValueAtTime(0.075, now + i * 0.15 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 1.1);
    osc.connect(gain).connect(context!.destination);
    osc.start(now + i * 0.15);
    osc.stop(now + i * 0.15 + 1.2);
  });
}
export function suspendSound() {
  void context?.suspend();
}
