# AI Interview — Architecture & Build Plan

A voice-driven mock-interview feature. The user picks a role, an AI **Interviewer**
(persona "Ethan Wong") asks questions out loud through an avatar, the user answers
by speaking, and the interviewer reacts in real time and scores them at the end.

This sits next to **Problems** and **Discuss** as a third top-level section.

---

## 1. Where it fits in the current app

```
TopBar nav:   Problems  |  Discuss  |  AI Interview   <-- new
Route:        /interview
```

- **Frontend:** new `InterviewPage` + components, route `/interview`, plus a nav item
  in `apps/web/src/components/TopBar.tsx` (same pattern we just used for Discuss).
- **Backend:** new interview endpoints. Two realistic homes (pick one — see §10):
  - **Option A (recommended for speed):** add an `interview` module to
    **auth-service** — it already has Prisma/Supabase, the `User` table, Redis, and
    the `requireAuth` middleware. Mirrors how we just shipped Discuss. Only missing
    piece is the Groq key, which is one env var.
  - **Option B (cleaner separation):** a new **`interview-service`** child process in
    `scripts/start-all.js`, proxied by the gateway under `/api/interview`. Better
    long-term boundary (voice + LLM concerns isolated), slightly more wiring.

The existing Groq integration lives in **judge-service**
(`chat.controller.ts`, model `llama-3.3-70b-versatile`, key in `FIRST_GROQ_KEY`).
We reuse the same Groq account/keys for the Interviewer LLM **and** for speech-to-text
(Groq also hosts Whisper — see §5).

---

## 2. The four interviewer roles

Each role is just a different **system prompt + question bank + scoring rubric** fed to
the same LLM. One `Interviewer` engine, four personas:

| Role | Focus | Sample behaviour |
|------|-------|------------------|
| **DSA** | Data structures & algorithms | Poses a coding problem, asks for approach → complexity → edge cases. Probes "why this data structure?" |
| **System Design** | Architecture & scale | "Design X." Drills into trade-offs, bottlenecks, DB choice, caching, failure modes. |
| **Business / BA** | Product & business analytics | Case-style: metrics, prioritisation, "how would you measure success?", SQL/funnel reasoning. |
| **HR / Behavioural** | Soft skills & fit | STAR-method questions, follow-ups on conflict, leadership, motivation. |

Each persona is a `.ts` config: `{ id, label, systemPrompt, openingQuestion, rubric }`.

### Question difficulty — exactly three levels

Every question is tagged with **one of three difficulties only**:

```ts
type Difficulty = "Easy" | "Medium" | "Hard";
```

- **No compound/hybrid labels** ("medium-hard", "easy-medium", etc.) — pick the single
  closest bucket.
- This matches the existing **Problems** page difficulty system
  (`apps/web/src/pages/ProblemsPage.tsx`), so badges, colors, and filters are reusable.
- The interviewer's system prompt is instructed to label each question it asks as exactly
  `Easy`, `Medium`, or `Hard`, and the end-of-interview scorecard reports performance
  per difficulty using the same three buckets.

---

## 3. End-to-end flow

```
                                ┌──────────────────────────────────────────┐
                                │              BROWSER (web)                 │
                                │                                            │
  1. Pick role ───────────────► │  InterviewPage                             │
                                │   • Avatar (lip-syncs to TTS audio)        │
                                │   • Mic button + live transcript           │
                                │   • Conversation panel                     │
                                └───────────┬───────────────▲────────────────┘
                                            │               │
                  (audio blob or live text) │               │ (text + audio to play)
                                            ▼               │
                                ┌──────────────────────────────────────────┐
                                │        BACKEND (interview module)          │
                                │                                            │
  2. STT      audio ──────────► │  POST /api/interview/stt                   │
                                │     → Groq Whisper → text                  │
                                │                                            │
  3. Turn     text  ──────────► │  POST /api/interview/message               │
                                │     • load session (Redis)                 │
                                │     • append user turn                     │
                                │     • call Groq LLM w/ persona + history   │
                                │     • append interviewer turn              │
                                │     ◄── interviewer reply (text)           │
                                │                                            │
  4. TTS      reply ──────────► │  POST /api/interview/tts                   │
                                │     → ElevenLabs / fallback → audio        │
                                │                                            │
  5. End      ────────────────► │  POST /api/interview/end                   │
                                │     • LLM grades transcript vs rubric      │
                                │     • persist session + scorecard (DB)     │
                                └──────────────────────────────────────────┘
```

**Turn loop:** STT → message (LLM) → TTS → avatar speaks → user speaks → repeat.

---

## 4. Conversation context (your point #4)

The interviewer needs memory of the role and the whole conversation. Handled by a
**session object in Redis** (we already run Redis), keyed by `sessionId`:

```jsonc
{
  "sessionId": "uuid",
  "userId": "…",
  "role": "dsa",
  "startedAt": 1719360000,
  "turns": [
    { "role": "system",      "content": "<persona system prompt>" },
    { "role": "assistant",   "content": "Let's start. Given an array…" },
    { "role": "user",        "content": "I'd use a hash map because…" },
    { "role": "assistant",   "content": "Good — what's the space cost?" }
  ]
}
```

- Every `/message` call sends the **full `turns` array** to Groq (it's stateless), so
  the LLM always has complete context — role, prior questions, and the candidate's
  answers.
- Redis key `interview:session:<id>` with a TTL (e.g. 2h) so abandoned sessions expire.
- To control token cost on long interviews: keep the system prompt + last ~20 turns,
  and summarise older turns into a single "context so far" message.
- On `/end`, the final transcript is persisted to the DB for history + the scorecard.

---

## 5. Speech-to-Text (STT) — your point #3

**Recommendation: Groq Whisper (primary) + browser Web Speech API (zero-cost fallback).**

| Option | Cost | Notes |
|--------|------|-------|
| **Groq `whisper-large-v3-turbo`** ✅ | **Free tier, very generous** | Same Groq account/keys you already have. Extremely fast, high accuracy. Send the recorded audio blob, get text. **Best fit** — no new vendor. |
| **Browser Web Speech API** ✅ | **$0 forever** | Built into Chrome/Edge (`SpeechRecognition`). No API key, live partial transcripts. Downsides: Chrome-centric, quality below Whisper, needs internet. Great as a free fallback / live caption. |
| OpenAI Whisper API | Paid (~$0.006/min) | Same model, not free. |
| Deepgram / AssemblyAI | ~$200 / limited free credit | Good, but another vendor + credit clock. |
| Self-hosted `faster-whisper` | Free (your compute) | Only if you have a GPU/box; overkill for now. |

**Verdict:** Use **Groq Whisper** for the real transcript (accuracy matters for grading),
and optionally Web Speech API for the live "I can see my words as I talk" caption.
ElevenLabs *does* have STT (Scribe) but its free allowance is small — keep ElevenLabs
for TTS where its quality actually matters.

---

## 6. Text-to-Speech (TTS) + ElevenLabs free credits — your points #5 & #7

### ElevenLabs free tier (what you actually get)
- **10,000 credits / month**, where **1 credit ≈ 1 character** of text.
- That's roughly **~10 minutes of generated speech per month, total** (not per day).
- 3 custom voices, commercial use **not** allowed on the free plan, attribution required.

**Reality check:** a single interview question is ~300–600 characters. 10k credits ≈
**~20–30 spoken questions per *month***. That is far too little for a daily-interview
product. ElevenLabs free is great for a **demo / the polished voice in screenshots**,
not for real daily traffic.

### Retell AI (the alternative you mentioned)
Retell is a **full voice-agent orchestrator** — it bundles STT + LLM + TTS + turn-taking
/ interruption handling behind one realtime websocket, so you don't wire the loop yourself.
- **Free trial credits only** (~$10, roughly **~60–90 minutes** of conversation), then
  **~$0.07–0.13 per minute** all-in.
- Fantastic for a fast, high-quality prototype and it solves barge-in/interruptions for
  free. But it's **not free-forever**, and it abstracts away the pipeline you're trying
  to build/learn.

### Recommended TTS strategy: tiered, so "free" actually scales
Make TTS a swappable provider with a daily-quota gate (§9):

1. **Default / free-forever:** **Microsoft Azure Neural TTS** — **500,000 chars/month
   free** (~8–9 hours of speech), genuinely good neural voices. *Or* **Google Cloud TTS**
   — ~1M WaveNet chars/month free. Either dwarfs ElevenLabs' free tier.
2. **Premium voice (optional):** **ElevenLabs** for a small daily allowance of "nice
   voice" interviews, then fall back to Azure when the ElevenLabs budget is spent.
3. **Last-resort fallback:** **browser `SpeechSynthesis`** API — robotic but $0 and
   needs no network.

> TL;DR: **ElevenLabs free = ~10 min/month total — too small for daily use.**
> Use **Azure or Google free neural TTS** as the real engine (hours/month free), and keep
> ElevenLabs as an optional premium voice within a daily cap. Use **Retell only if** you'd
> rather buy a turnkey realtime pipeline (~60 free min, then paid).

---

## 7. AI Avatar (free) — your point #5

You want a face that "speaks" the question. Two tiers:

### Recommended (free-forever, real-time): 3D avatar + lip-sync
- **Ready Player Me** — free customizable 3D avatars (GLB), commercial-friendly.
- **TalkingHead** (`met4citizen/TalkingHead`, MIT) — open-source JS library that renders
  a Ready Player Me avatar in the browser (three.js) and **lip-syncs it to TTS audio** in
  real time. Pair it with the Azure/ElevenLabs audio from §6.
- This is **$0, runs client-side, real-time, no per-minute cost.** Best fit for your goals.

### Alternative (talking-head *video*, credit-limited)
- **D-ID** / **HeyGen** — photoreal talking-head video from a photo. **Free trial credits
  only** (a few minutes), then paid, and there's render latency. Looks impressive but burns
  credits per second of video — wrong economics for a daily-free product.
- **SadTalker** (open source) — generate a talking face from one image, self-hosted/free,
  but needs a GPU and isn't real-time.

**Verdict:** **Ready Player Me + TalkingHead** for a free, real-time, lip-synced avatar.
Treat D-ID/HeyGen as a "wow demo" only.

---

## 8. The Interviewer LLM

- Reuse **Groq** (`llama-3.3-70b-versatile`) — same setup as `judge-service`'s
  `chat.controller.ts`, same `FIRST/SECOND/THIRD_GROQ_KEY` rotation.
- Each role = a system prompt that defines persona "Ethan Wong", the interview style,
  difficulty, and instructions to: ask one question at a time, give brief reactions,
  adapt follow-ups to the answer, and never reveal the rubric.
- On `/end`, a separate grading prompt scores the transcript against the role's rubric
  and returns structured feedback (strengths, gaps, score per dimension).

---

## 9. "Free up to N credits per day" — quota design (your point #6)

A per-user **daily budget** enforced in Redis, independent of any vendor:

```
Key:  interview:quota:<userId>:<YYYY-MM-DD>   (TTL 24h)
Limit examples:
  • 2 interviews / day, OR
  • 15 minutes of total interview time / day, OR
  • 30 LLM turns / day
```

- Check-and-increment on `/session` (and/or per `/message` minute) before doing paid work.
- When the **ElevenLabs** monthly budget is exhausted → auto-switch TTS to **Azure/Google**
  (still within their large free tiers) → finally browser `SpeechSynthesis`.
- STT stays on **Groq Whisper** (free) the whole time.
- Track usage counters in Redis so you never silently exceed a vendor's free allotment.

This keeps the **whole experience free for the user**, while you stay inside every
provider's free tier by degrading voice quality gracefully instead of charging.

---

## 10. Proposed API surface

```
POST /api/interview/session     { role }                 → { sessionId, opening: {text} }
POST /api/interview/stt         (audio blob)             → { text }            (Groq Whisper)
POST /api/interview/message     { sessionId, text }      → { reply: {text} }   (Groq LLM)
POST /api/interview/tts         { sessionId, text }      → audio/mpeg          (Azure/11L)
POST /api/interview/end         { sessionId }            → { scorecard, transcript }
GET  /api/interview/history                              → [past sessions]     (optional)
```

- Reads/writes require `requireAuth` (we know the user → quota + history).
- Gateway: add `"/api/interview"` to the auth/interview proxy `pathFilter`
  (same one-line change we did for `/api/discuss`).

---

## 11. Data model (persisted on `/end`)

```prisma
model InterviewSession {
  id         String   @id @default(cuid())
  userId     String
  role       String                 // dsa | system_design | business | hr
  transcript Json                    // full turns array
  scorecard  Json                    // { overall, dimensions[], strengths, gaps }
  durationS  Int
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
}
```

Live session state stays in **Redis**; only the finished interview lands in the DB
(Supabase if we build into auth-service, per §1).

---

## 12. Frontend components

```
apps/web/src/pages/InterviewPage.tsx      // role picker → live interview → results
apps/web/src/components/interview/
  ├─ RolePicker.tsx        // the 4 cards (DSA / System Design / Business / HR)
  ├─ Avatar.tsx            // Ready Player Me + TalkingHead, lip-syncs to audio
  ├─ MicButton.tsx         // record → blob → /stt ; or Web Speech live caption
  ├─ TranscriptPanel.tsx   // running conversation
  └─ Scorecard.tsx         // end-of-interview feedback
apps/web/src/lib/
  ├─ recorder.ts           // MediaRecorder wrapper
  └─ tts.ts                // provider-agnostic speak(text) with fallback chain
```

State machine per turn: `idle → listening → transcribing → thinking → speaking → idle`.

---

## 13. Recommended free stack (summary)

| Layer | Pick | Why |
|-------|------|-----|
| **STT** | **Groq Whisper (`whisper-large-v3-turbo`)** | Free, fast, already have the key |
| **LLM (Interviewer)** | **Groq `llama-3.3-70b-versatile`** | Reuse existing integration |
| **TTS** | **Azure Neural (500k chars/mo free)**, ElevenLabs as optional premium | Hours/mo free vs ElevenLabs' ~10 min/mo |
| **Avatar** | **Ready Player Me + TalkingHead (MIT)** | Free, real-time, client-side lip-sync |
| **Session memory** | **Redis** (have it) | Full conversation context per turn |
| **Quota** | **Redis daily counter** | Keeps users free, you inside free tiers |
| **Turnkey alt** | **Retell AI** (~60 free min, then paid) | Only if you'd rather not build the loop |

---

## 14. Suggested build phases

1. **Skeleton:** `/interview` route, nav item, `RolePicker`, 4 persona prompts.
2. **Text loop:** `/session` + `/message` with Groq + Redis session. Type answers, read
   replies. (Proves the interviewer brain before touching audio.)
3. **Voice in:** `MediaRecorder` → `/stt` (Groq Whisper) → feed text into the loop.
4. **Voice out:** `tts.ts` with Azure default → play audio. Add `SpeechSynthesis` fallback.
5. **Avatar:** drop in TalkingHead, drive lip-sync from the TTS audio.
6. **Scoring + history:** `/end` grading, `InterviewSession` table, results screen.
7. **Quotas + provider fallback:** Redis daily limits, ElevenLabs→Azure degradation.

---

## 15. Decisions to make before building

- [ ] **Backend home:** extend **auth-service** (fast, like Discuss) vs new
      **interview-service** (cleaner). _Recommendation: auth-service to start._
- [ ] **TTS default provider:** Azure vs Google free tier (both fine; Azure voices are
      slightly nicer, Google's free char budget is larger).
- [ ] **Daily quota unit:** interviews/day vs minutes/day vs turns/day.
- [ ] **Use Retell?** Only if you want a turnkey realtime pipeline for the demo and accept
      it's paid after the trial.
```
