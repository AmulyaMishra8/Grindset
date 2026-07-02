import { useRef, useState } from "react";
import { interviewApi } from "../../api/interview";
import { createDictation, AudioRecorder, type Dictation } from "../../lib/speech";

// Self-contained mic control with graceful degradation:
//   • Web Speech API live dictation (Chrome/Edge) — streams partials, no upload.
//   • If Web Speech is unusable here (Brave blocks it; Firefox/Safari lack it),
//     transparently fall back to recording a clip → Groq Whisper.
// The choice is remembered after the first attempt so we don't re-trip Brave's
// broken dictation on every turn. A typed-text box is the ultimate fallback.

type MicStatus = "idle" | "listening" | "transcribing";

// Module-level memo: null = untested, true = dictation works, false = use Whisper.
let dictationUsable: boolean | null = null;

interface MicButtonProps {
  disabled?: boolean;
  onPartial?: (text: string) => void; // live, still-being-spoken text
  onResult: (text: string) => void;   // settled transcript
  onStatus?: (status: MicStatus) => void;
}

export default function MicButton({ disabled, onPartial, onResult, onStatus }: MicButtonProps) {
  const [status, setStatus] = useState<MicStatus>("idle");
  const dictationRef = useRef<Dictation | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const modeRef = useRef<"dictation" | "record" | null>(null);

  const setBoth = (s: MicStatus) => { setStatus(s); onStatus?.(s); };

  // ── Whisper fallback path: record a clip, transcribe on stop ──
  const startRecording = async () => {
    modeRef.current = "record";
    try {
      const rec = new AudioRecorder();
      await rec.start();
      recorderRef.current = rec;
      setBoth("listening");
    } catch {
      modeRef.current = null;
      setBoth("idle");
    }
  };

  // ── Web Speech dictation path ──
  const startDictation = () => {
    const d = createDictation({
      onPartial: (t) => { dictationUsable = true; onPartial?.(t); },
      onFinal: (t) => { if (t) onResult(t); },
      onFatalError: () => {
        // Brave/etc. — Web Speech can't work. Remember and fall back this turn.
        dictationUsable = false;
        dictationRef.current = null;
        void startRecording();
      },
      onEnd: () => { if (modeRef.current === "dictation") setBoth("idle"); },
    });
    if (!d) { void startRecording(); return; } // API absent → record
    dictationRef.current = d;
    modeRef.current = "dictation";
    d.start();
    setBoth("listening");
  };

  const startListening = () => {
    if (dictationUsable === false) void startRecording();
    else startDictation();
  };

  const stopListening = async () => {
    if (modeRef.current === "dictation") {
      dictationRef.current?.stop(); // onFinal/onEnd flip back to idle
      return;
    }
    // recording mode
    const rec = recorderRef.current;
    recorderRef.current = null;
    modeRef.current = null;
    if (!rec) return setBoth("idle");
    setBoth("transcribing");
    try {
      const blob = await rec.stop();
      const text = blob.size > 0 ? await interviewApi.transcribe(blob) : "";
      if (text) onResult(text);
    } catch {
      /* swallow — user can type instead */
    } finally {
      setBoth("idle");
    }
  };

  const toggle = () => {
    if (disabled || status === "transcribing") return;
    if (status === "listening") void stopListening();
    else startListening();
  };

  const label =
    status === "listening" ? "Stop" :
    status === "transcribing" ? "…" :
    "Speak";

  return (
    <button
      type="button"
      className={`iv-mic iv-mic-${status}`}
      onClick={toggle}
      disabled={disabled || status === "transcribing"}
      title="Click to talk, click again to stop"
    >
      <span className="iv-mic-dot" />
      {label}
    </button>
  );
}
