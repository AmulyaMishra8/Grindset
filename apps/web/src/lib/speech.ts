// Speech-to-text capture. Two paths, picked by browser capability:
//   1. Web Speech API (Chrome/Edge/Brave) — live partial captions, zero upload,
//      zero cost. Preferred when available.
//   2. MediaRecorder → Groq Whisper (everyone else, incl. Firefox/Safari) —
//      record a clip, upload to /api/interview/stt for transcription.
// A typed-text box in the UI is the always-available ultimate fallback.

/* eslint-disable @typescript-eslint/no-explicit-any */

export function speechRecognitionSupported(): boolean {
  return typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
}

export interface DictationHandlers {
  onPartial?: (text: string) => void;     // interim, still-being-spoken text
  onFinal?: (text: string) => void;       // the settled final transcript (user stopped)
  onFatalError?: (err: string) => void;   // Web Speech unusable here (e.g. Brave blocks it)
  onEnd?: () => void;                      // recognition fully stopped
}

export interface Dictation {
  start: () => void;
  stop: () => void;
}

// Errors that mean the Web Speech API can't work in this browser/context at all
// — most notably "network" in Brave, which ships the API but blocks Google's
// speech backend. When we see one, we bail to the MediaRecorder→Whisper path.
const FATAL_ERRORS = new Set([
  "network",
  "not-allowed",
  "service-not-allowed",
  "audio-capture",
  "language-not-supported",
]);

// Live dictation via the Web Speech API. Returns null if the API is absent.
// While the user wants to listen we auto-restart on benign ends (the API stops
// itself after a pause / "no-speech" window), so a single click keeps listening
// until the user explicitly stops.
export function createDictation(handlers: DictationHandlers): Dictation | null {
  const Ctor: any =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.continuous = true;

  let finalText = "";
  let active = false; // the user intends to keep listening
  let fatal = false;  // a fatal error fired — stop and let the caller fall back

  rec.onresult = (e: any) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const chunk = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += chunk + " ";
      else interim += chunk;
    }
    handlers.onPartial?.((finalText + interim).trim());
  };

  rec.onerror = (e: any) => {
    const err = e?.error ?? "error";
    if (FATAL_ERRORS.has(err)) {
      fatal = true;
      active = false;
      handlers.onFatalError?.(err);
    }
    // Benign errors ("no-speech", "aborted") are handled by onend's restart.
  };

  rec.onend = () => {
    if (active && !fatal) {
      // The browser auto-stopped on a pause — keep listening.
      try { rec.start(); return; } catch { /* fall through to finalize */ }
    }
    if (!fatal) handlers.onFinal?.(finalText.trim());
    handlers.onEnd?.();
  };

  return {
    start: () => {
      active = true;
      fatal = false;
      finalText = "";
      try { rec.start(); } catch { /* already started */ }
    },
    stop: () => {
      active = false;
      try { rec.stop(); } catch { /* already stopped */ }
    },
  };
}

// MediaRecorder-based clip capture for the Whisper fallback path.
export class AudioRecorder {
  private media: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Let the browser choose a supported container (webm/opus on Chrome, mp4 on Safari).
    const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
    this.media = mime ? new MediaRecorder(this.stream, { mimeType: mime }) : new MediaRecorder(this.stream);
    this.chunks = [];
    this.media.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
    this.media.start();
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.media) return resolve(new Blob());
      this.media.onstop = () => {
        const type = this.media?.mimeType || "audio/webm";
        const blob = new Blob(this.chunks, { type });
        this.stream?.getTracks().forEach((t) => t.stop());
        resolve(blob);
      };
      this.media.stop();
    });
  }
}
