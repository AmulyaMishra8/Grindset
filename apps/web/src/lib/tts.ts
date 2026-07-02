// Provider-agnostic text-to-speech. Tonight's default is the browser's built-in
// SpeechSynthesis (free, no key, works offline). The shape here (speak() returning
// a handle with onboundary/onend) is deliberately provider-neutral so an Azure /
// ElevenLabs adapter can drop in later behind the same interface.

export interface SpeakHandle {
  cancel: () => void;
}

export interface SpeakOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Voice list loads asynchronously in some browsers; cache the best match once.
let preferredVoice: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (preferredVoice) return preferredVoice;
  if (!ttsSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  // Prefer a natural-sounding English male voice (Ethan), then any en-* voice.
  const byName = (re: RegExp) => voices.find((v) => re.test(v.name));
  preferredVoice =
    byName(/Google US English/i) ||
    byName(/Microsoft (Guy|Davis|Andrew|Aria)/i) ||
    byName(/Daniel|Alex|Ethan/i) ||
    voices.find((v) => v.lang.toLowerCase().startsWith("en")) ||
    voices[0] ||
    null;
  return preferredVoice;
}

// Warm up the voice list (call once on mount).
export function primeVoices(): void {
  if (!ttsSupported()) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    preferredVoice = null;
    pickVoice();
  };
}

/**
 * Speak `text`. Strips the "[Medium] " difficulty tag the interviewer prefixes
 * onto questions so it isn't read aloud. Returns a handle to cancel playback.
 */
export function speak(text: string, opts: SpeakOptions = {}): SpeakHandle {
  if (!ttsSupported()) {
    opts.onStart?.();
    opts.onEnd?.();
    return { cancel: () => {} };
  }

  const synth = window.speechSynthesis;
  synth.cancel(); // never overlap utterances

  const spoken = text.replace(/\[(Easy|Medium|Hard)\]\s*/gi, "");
  const u = new SpeechSynthesisUtterance(spoken);
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.rate = 1.0;
  u.pitch = 1.0;

  u.onstart = () => opts.onStart?.();
  u.onend = () => opts.onEnd?.();
  u.onerror = () => {
    opts.onError?.();
    opts.onEnd?.();
  };

  synth.speak(u);
  return { cancel: () => synth.cancel() };
}

export function cancelSpeech(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}
