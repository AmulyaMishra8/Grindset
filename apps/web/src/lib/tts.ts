// Provider-agnostic text-to-speech. Primary path is the server's ElevenLabs
// voice (POST /api/interview/speak → MP3); if that isn't configured, errors, or
// runs out of credits, we fall back to the browser's built-in SpeechSynthesis
// (free, no key, works offline). Same speak() handle either way.

import { API_URL, readCookie } from "../api/client";

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

// The browser SpeechSynthesis path — the free fallback.
function speakBrowser(text: string, opts: SpeakOptions = {}): void {
  if (!ttsSupported()) {
    opts.onStart?.();
    opts.onEnd?.();
    return;
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
}

// Once the server tells us TTS isn't configured (400), stop trying it and go
// straight to the browser voice for the rest of the session.
let serverTtsDisabled = false;

type SpeakState = { cancelled: boolean; audio: HTMLAudioElement | null };

// Try the ElevenLabs server voice. Resolves true if it handled playback (or the
// user cancelled first), false to fall back to the browser voice.
async function speakViaServer(text: string, opts: SpeakOptions, state: SpeakState): Promise<boolean> {
  try {
    const csrf = readCookie("csrf_token");
    const res = await fetch(`${API_URL}/api/interview/speak`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
      body: JSON.stringify({ text }),
    });

    if (res.status === 400) { serverTtsDisabled = true; return false; } // not configured
    if (!res.ok) return false; // transient (401/429/5xx) — use the browser voice this turn
    if (state.cancelled) return true;

    const blob = await res.blob();
    if (state.cancelled) return true;

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    state.audio = audio;
    audio.onplay = () => opts.onStart?.();
    audio.onended = () => { opts.onEnd?.(); URL.revokeObjectURL(url); };
    audio.onerror = () => { opts.onError?.(); opts.onEnd?.(); URL.revokeObjectURL(url); };
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

/**
 * Speak `text` — ElevenLabs server voice if available, browser voice otherwise.
 * The "[Medium] " difficulty tag is stripped before it's read aloud (server and
 * browser both strip it). Returns a handle to cancel playback.
 */
export function speak(text: string, opts: SpeakOptions = {}): SpeakHandle {
  cancelSpeech(); // never overlap with a browser utterance already in flight
  const state: SpeakState = { cancelled: false, audio: null };

  if (serverTtsDisabled) {
    speakBrowser(text, opts);
  } else {
    speakViaServer(text, opts, state).then((handled) => {
      if (!handled && !state.cancelled) speakBrowser(text, opts);
    });
  }

  return {
    cancel: () => {
      state.cancelled = true;
      if (state.audio) { state.audio.pause(); state.audio.src = ""; state.audio = null; }
      cancelSpeech();
    },
  };
}

export function cancelSpeech(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}
