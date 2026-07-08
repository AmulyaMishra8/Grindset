import { useEffect, useRef, useState } from "react";
import { interviewApi, type RoleMeta, type Quota, type Turn, type Scorecard as ScorecardData } from "../api/interview";
import { ApiError } from "../api/client";
import { speak, cancelSpeech, primeVoices, ttsSupported } from "../lib/tts";
import RolePicker from "../components/interview/RolePicker";
import Avatar from "../components/interview/Avatar";
import MicButton from "../components/interview/MicButton";
import TranscriptPanel from "../components/interview/TranscriptPanel";
import Scorecard from "../components/interview/Scorecard";
import "./Interview.css";

type Phase = "picking" | "live" | "grading" | "results";

export default function InterviewPage() {
  // ── role selection ──
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [roles, setRoles] = useState<RoleMeta[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  // ── live interview ──
  const [phase, setPhase] = useState<Phase>("picking");
  const [persona, setPersona] = useState<RoleMeta | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [caption, setCaption] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [atCap, setAtCap] = useState(false);

  // ── results ──
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
  const [durationS, setDurationS] = useState(0);
  const [persisted, setPersisted] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    primeVoices();
    interviewApi.getRoles()
      .then((r) => {
        setConfigured(r.configured);
        setRoles(r.roles);
        setQuota(r.quota);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load interview roles"))
      .finally(() => setLoading(false));
    return () => cancelSpeech();
  }, []);

  const sayAloud = (text: string, role?: string) => {
    // speak() uses the ElevenLabs server voice (per-persona) and falls back to
    // the browser voice, so we don't gate on ttsSupported() anymore.
    speak(text, {
      role,
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
    });
  };

  const pick = async (roleId: string) => {
    setStarting(roleId);
    setError(null);
    try {
      const r = await interviewApi.startSession(roleId);
      sessionIdRef.current = r.sessionId;
      setPersona(r.persona);
      setQuota(r.quota);
      setTurns([{ role: "assistant", content: r.opening.text }]);
      setAtCap(false);
      setPhase("live");
      sayAloud(r.opening.text, r.persona.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not start the interview");
    } finally {
      setStarting(null);
    }
  };

  const sendAnswer = async (text: string) => {
    const answer = text.trim();
    const sessionId = sessionIdRef.current;
    if (!answer || !sessionId || thinking) return;

    cancelSpeech();
    setSpeaking(false);
    setCaption(null);
    setDraft("");
    setTurns((prev) => [...prev, { role: "user", content: answer }]);
    setThinking(true);
    try {
      const r = await interviewApi.sendMessage(sessionId, answer);
      setTurns((prev) => [...prev, { role: "assistant", content: r.reply.text }]);
      setAtCap(r.atCap);
      sayAloud(r.reply.text, persona?.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The interviewer didn't respond — try again");
    } finally {
      setThinking(false);
    }
  };

  const endInterview = async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    cancelSpeech();
    setSpeaking(false);
    setPhase("grading");
    setError(null);
    try {
      const r = await interviewApi.endInterview(sessionId);
      setScorecard(r.scorecard);
      setDurationS(r.durationS);
      setPersisted(r.persisted);
      setPhase("results");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't grade the interview");
      setPhase("live"); // let them retry / keep talking
    }
  };

  const restart = () => {
    sessionIdRef.current = null;
    setPersona(null);
    setTurns([]);
    setDraft("");
    setCaption(null);
    setScorecard(null);
    setAtCap(false);
    setPhase("picking");
    setError(null);
    // refresh remaining budget
    interviewApi.getRoles().then((r) => setQuota(r.quota)).catch(() => {});
  };

  // ── render ──
  if (loading) {
    return <div className="iv-page"><div className="iv-loading">Loading…</div></div>;
  }

  if (!configured) {
    return (
      <div className="iv-page">
        <div className="iv-notice">
          <h1 className="iv-h1">AI Interview</h1>
          <p>This feature isn’t configured on the server yet (no Groq API key). Add one and reload.</p>
        </div>
      </div>
    );
  }

  if (phase === "picking") {
    return (
      <div className="iv-page">
        {error && <div className="iv-error">{error}</div>}
        <RolePicker roles={roles} quota={quota} starting={starting} onPick={pick} />
      </div>
    );
  }

  if (phase === "results" && scorecard) {
    return (
      <div className="iv-page">
        <Scorecard
          data={scorecard}
          roleLabel={persona?.label ?? "Interview"}
          durationS={durationS}
          persisted={persisted}
          onRestart={restart}
        />
      </div>
    );
  }

  // live or grading
  const composerDisabled = thinking || phase === "grading";
  return (
    <div className="iv-page iv-live">
      <aside className="iv-stage">
        <Avatar
          name={persona?.interviewer ?? "Interviewer"}
          accent={persona?.accent ?? "#6366f1"}
          variant={persona?.id}
          speaking={speaking}
          listening={listening}
          thinking={thinking}
        />
        <div className="iv-stage-meta">
          <span className="iv-stage-role" style={{ color: persona?.accent }}>{persona?.interviewer}</span>
          <span className="iv-stage-hint">{persona?.label} round</span>
          {!ttsSupported() && <span className="iv-stage-hint">Voice output not supported in this browser</span>}
        </div>
        <button
          className="iv-btn-end"
          onClick={endInterview}
          disabled={phase === "grading"}
        >
          {phase === "grading" ? "Grading…" : "End & get feedback"}
        </button>
        {atCap && phase === "live" && (
          <p className="iv-cap-note">You’ve reached the end of the interview — end it now to see your feedback.</p>
        )}
      </aside>

      <main className="iv-conversation">
        {error && <div className="iv-error">{error}</div>}
        <TranscriptPanel turns={turns} interviewer={persona?.interviewer ?? "Interviewer"} pendingUser={caption} thinking={thinking} />

        <div className="iv-composer">
          <textarea
            className="iv-answer"
            placeholder={listening ? "Listening…" : "Speak, or type your answer…"}
            value={caption ?? draft}
            disabled={composerDisabled}
            onChange={(e) => { setCaption(null); setDraft(e.target.value); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendAnswer(draft);
              }
            }}
            rows={2}
          />
          <div className="iv-composer-actions">
            <MicButton
              disabled={composerDisabled}
              onPartial={(t) => setCaption(t)}
              onResult={(t) => { setCaption(null); void sendAnswer(t); }}
              onStatus={(s) => {
                setListening(s === "listening");
                if (s === "listening") { cancelSpeech(); setSpeaking(false); }
              }}
            />
            <button
              className="iv-btn-send"
              disabled={composerDisabled || !draft.trim()}
              onClick={() => void sendAnswer(draft)}
            >
              Send
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
