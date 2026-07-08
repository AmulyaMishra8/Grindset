// A shared "how open is the interviewer's mouth right now" signal (0..1) for
// real lip-sync. Driven by the ACTUAL TTS audio when we can analyse it (the
// ElevenLabs <audio> element via Web Audio), or a gentle simulated flap for the
// browser SpeechSynthesis voice (which exposes no audio stream). The Avatar
// reads getVoiceLevel() each animation frame.

let level = 0;

export function getVoiceLevel(): number {
  return level;
}
function setLevel(n: number): void {
  level = n < 0 ? 0 : n > 1 ? 1 : n;
}
export function resetVoiceLevel(): void {
  setLevel(0);
}

// One shared AudioContext (browsers cap how many you can create).
let ctx: AudioContext | null = null;
function audioContext(): AudioContext | null {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = ctx ?? new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Route an <audio> element through an analyser so the mouth tracks its real
 * loudness. Returns a disposer; call it when playback ends. Returns null if Web
 * Audio isn't available (caller should fall back to simulateMouth), in which
 * case the element still plays normally.
 */
export function analyseAudioElement(el: HTMLAudioElement): (() => void) | null {
  const context = audioContext();
  if (!context) return null;
  try {
    // Rerouting through Web Audio means the element now plays via the graph, so
    // we must connect through to the speakers.
    const src = context.createMediaElementSource(el);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    analyser.connect(context.destination);

    const buf = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      setLevel(rms * 3.2); // speech RMS is small — scale into a visible range
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      setLevel(0);
      try { src.disconnect(); analyser.disconnect(); } catch { /* already gone */ }
    };
  } catch {
    return null;
  }
}

/**
 * Simulated mouth movement for the browser voice (no analysable stream). Two
 * overlapping sines give a natural-ish flap. Returns a disposer.
 */
export function simulateMouth(): () => void {
  let raf = 0;
  const start = performance.now();
  const tick = () => {
    const t = (performance.now() - start) / 1000;
    const v = 0.35 + 0.4 * Math.abs(Math.sin(t * 9) * 0.7 + Math.sin(t * 5.3) * 0.3);
    setLevel(v);
    raf = requestAnimationFrame(tick);
  };
  tick();
  return () => {
    cancelAnimationFrame(raf);
    setLevel(0);
  };
}
