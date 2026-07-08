# Grindset Gateway — AI Interview Feature: Architecture Document

---

## Overview

This document outlines the planned architecture for the **AI Interview** section to be added inside the existing **Problems / Discuss** page of Grindset Gateway. The feature will simulate real-world technical and HR interviews using voice input, an AI interviewer agent, and a talking AI avatar — all powered by a free or credit-limited stack.

---

## Where It Lives in the App

On the `/problems` page, alongside the existing **Problem** and **Discuss** tabs, a new tab will be added:

```
[ Problems ]  [ Discuss ]  [ 🎙️ AI Interview ]   ← NEW
```

---

## Interview Modes (4 Personas)

Similar to how **Ethan Wong** is a named AI persona in your app, the AI Interview section introduces a new agent called **"The Interviewer"** with 4 distinct modes the user selects before starting:

| Mode | Persona Name | Focus |
|---|---|---|
| 1 | **Alex Chen** | Data Structures & Algorithms (DSA) |
| 2 | **Priya Sharma** | System Design |
| 3 | **Marcus Reid** | Business Insight / Business Analyst |
| 4 | **Jordan Lee** | HR / Behavioral Interview |

Each persona has its own system prompt, question bank context, and conversational style baked in.

---

## Full Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  USER (Browser)                         │
│                                                         │
│   ┌──────────────────────────────────────────────┐      │
│   │         AI Interview UI Tab                  │      │
│   │                                              │      │
│   │  1. Select Mode  (DSA / SysDesign / BA / HR) │      │
│   │  2. AI Avatar displayed (talking head)       │      │
│   │  3. Mic button → Voice Input                 │      │
│   │  4. Live transcript shown on screen          │      │
│   └──────────────────────────────────────────────┘      │
└────────────────────────┬────────────────────────────────┘
                         │
              (1) Voice Captured via
                  Web Speech API / ElevenLabs STT
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                 STT Layer                               │
│                                                         │
│   ElevenLabs Scribe (preferred, free tier)              │
│   OR Whisper via Groq API (free tier fallback)          │
│                                                         │
│   → Converts audio to TEXT                             │
└────────────────────────┬────────────────────────────────┘
                         │
                  TEXT passed to
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│            AI Interviewer Agent (Backend)               │
│                                                         │
│   Model: Claude Sonnet 4.6 (via Anthropic API)          │
│                                                         │
│   Context Included in Every Call:                       │
│   ├── System Prompt (mode-specific persona)             │
│   ├── Role description + expected question types        │
│   ├── Full conversation history (multi-turn)            │
│   ├── Current question number / interview stage         │
│   └── User's previous answers (for follow-ups)         │
│                                                         │
│   Outputs: Next question OR feedback + follow-up        │
└────────────────────────┬────────────────────────────────┘
                         │
              AI response TEXT sent to
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   TTS Layer                             │
│                                                         │
│   ElevenLabs TTS (free tier: 10,000 credits/month)     │
│   → Converts AI text response to speech audio          │
│   → Audio streamed back to browser                     │
└────────────────────────┬────────────────────────────────┘
                         │
              Audio played through
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              AI Avatar (Browser)                        │
│                                                         │
│   Talking head lip-synced to TTS audio                 │
│   Options: D-ID (free tier) or HeyGen (free tier)      │
│   OR: CSS/JS animated avatar (fully free, no limits)   │
└─────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Data Flow

**Step 1 — User selects interview mode**
The user picks one of the 4 personas. The frontend loads the appropriate system prompt and persona context for the interviewer agent.

**Step 2 — AI Avatar speaks the opening question**
The first question is pre-generated (or fetched on load) and immediately converted to audio via ElevenLabs TTS, played through the avatar. No user input is needed yet.

**Step 3 — User speaks their answer**
The user clicks the mic button. Audio is captured in the browser using the `MediaRecorder` API and streamed to the backend.

**Step 4 — STT converts audio to text**
The backend sends the audio to ElevenLabs Scribe (STT) or the Groq-hosted Whisper API. The resulting transcript is stored in the conversation history.

**Step 5 — Text goes to the AI Interviewer**
The full conversation history + the user's new answer is sent to the Claude API with the persona system prompt. Claude generates the next question or a follow-up probe.

**Step 6 — TTS converts AI response to audio**
The AI's text response is sent to ElevenLabs TTS. The audio clip is returned and played through the avatar in the browser.

**Step 7 — Loop continues**
Steps 3–6 repeat until the interview ends (either after N questions or the user clicks "End Interview").

**Step 8 — Post-interview feedback**
At the end, the full conversation is passed back to Claude with a feedback prompt, generating a structured score and improvement tips.

---

## STT Recommendation (Free Options)

| Option | Free Tier | Latency | Best For |
|---|---|---|---|
| **ElevenLabs Scribe** (preferred) | Included in 10K credits/month | Low | Native pairing with ElevenLabs TTS |
| **Groq + Whisper Large v3** | Very generous free tier (rate-limited) | Near real-time | Best free accuracy fallback |
| **Deepgram Nova-3** | $200 free credits on signup (one-time) | ~200–400ms streaming | Best streaming latency |
| **Web Speech API** (browser native) | Completely free, no API needed | Real-time | Zero-cost fallback, lower accuracy |
| **AssemblyAI** | 100 free hours on signup | ~300ms | Good for testing |

**Recommendation:** Use **ElevenLabs Scribe** as the primary STT since you're already on their platform for TTS — it's the cleanest single-vendor integration and uses the same credit pool. Use **Groq Whisper** as a free daily fallback when ElevenLabs credits run low.

---

## TTS — ElevenLabs Free Tier Details

ElevenLabs' free plan gives **10,000 credits per month**.

| What 10K credits translates to | Approximate amount |
|---|---|
| TTS audio (Multilingual v2 model) | ~10 minutes of speech |
| TTS audio (Flash model) | ~20 minutes of speech |
| Conversational AI agent time | ~15 minutes |

**Important limitations on the free tier:**
- No commercial usage rights (attribution required)
- Max 2,500 characters per generation request
- No voice cloning
- Audio must attribute ElevenLabs in public content

**Per request in your app:** Each AI interviewer response will be roughly 50–150 words (~300–900 characters). At that rate, 10,000 credits covers around **11–33 individual responses per month** on the free tier — enough for testing, but tight for real daily usage.

**Recommendation for scaling free usage:**
- Use ElevenLabs Flash model (uses ~0.5 credits/character) instead of Multilingual v2
- Cache repeated phrases (intro questions, transitions) as pre-generated audio so they don't re-consume credits
- Offer **3 free mock interviews per day per user** (credit-gated at the app level), and implement a daily credit counter in your backend

---

## Alternative if ElevenLabs Credits Run Out: Retell AI

**Retell AI** is a voice agent platform offering:
- **$10 in free credits** for all new accounts (one-time)
- Full platform access with no monthly fee
- Pay-as-you-go after free credits: ~$0.07–$0.15/min for voice infrastructure + LLM
- ~67–90 minutes of voice interaction on the $10 free credit

Retell bundles STT + LLM + TTS into a single pipeline per-minute charge, which simplifies billing but makes it harder to control individual components. It's a good **plug-and-play fallback** if ElevenLabs credits are exhausted and you want a simpler integration.

---

## AI Avatar Options (Free)

| Option | Free Tier | Talking Head | Integration |
|---|---|---|---|
| **D-ID** | Free tier to test (limited exports) | ✅ Yes, photo-to-talking-avatar | REST API |
| **HeyGen** | 3 videos/month, up to 3 min each | ✅ Yes, 500+ stock avatars | Web-based |
| **Duix.HeyGem** | Fully free, open-source, self-hosted | ✅ Yes | Local / self-host |
| **CSS/JS Animated Avatar** | Completely free, no limits | ✅ Simulated lip-sync via audio events | Custom code |

**Recommended approach for production:**
Use a **custom CSS/JS animated avatar** — a simple 2D character that animates (mouth open/close, idle bounce) in sync with the TTS audio playing. This is **100% free**, has no rate limits, and is fast to implement. Libraries like `lottie-web` can play character animations triggered by audio playback events.

For a more polished look during early demos, use **D-ID** or **HeyGen** on their free tiers and swap to the custom avatar when limits are hit.

---

## Daily Free Usage Budget (Per User)

To offer a sustainable free experience, enforce these limits at the app level:

| Resource | Daily Limit (Free User) | How Enforced |
|---|---|---|
| Mock interviews | 3 per day | Session counter in localStorage + backend |
| Questions per interview | 8–10 questions | Interview session state |
| ElevenLabs TTS | ~3 min of audio/day/user | Backend credit tracker |
| STT calls | Unlimited (use Groq Whisper fallback) | N/A |
| AI Interviewer (Claude API) | ~10 API calls/interview | Conversation turn counter |

---

## Backend Architecture (Summary)

```
Frontend (React/Next.js)
  └── POST /api/interview/start        → Creates session, loads persona prompt
  └── POST /api/interview/transcribe   → Sends audio blob → STT → returns text
  └── POST /api/interview/respond      → Sends transcript + history → Claude → returns text
  └── POST /api/interview/speak        → Sends text → ElevenLabs TTS → returns audio URL
  └── POST /api/interview/end          → Sends full history → Claude → returns feedback report
```

All session state (conversation history, question count, credits used) is stored server-side per user session.

---

## System Prompt Structure (Per Mode)

Each persona has a system prompt following this pattern:

```
You are [Persona Name], a [role] interviewer at a top tech company.
Your job is to conduct a realistic [mode] interview.

Interview style:
- Ask one question at a time
- Wait for the candidate's full answer before responding
- Ask natural follow-up questions based on their answer
- Keep a professional but friendly tone
- After [N] questions, give a brief transition to the next topic

Context you have:
- Role being interviewed for: [extracted from user profile or selected role]
- Interview stage: [round number / question number]
- Previous Q&A: [injected conversation history]

Do NOT reveal you are an AI unless directly asked.
Start by introducing yourself and asking the first question.
```

---

## Tech Stack Summary

| Layer | Technology | Cost |
|---|---|---|
| Frontend | React / Next.js | Free |
| Voice Capture | Browser `MediaRecorder` API | Free |
| STT | ElevenLabs Scribe → Groq Whisper fallback | Free tier |
| AI Interviewer | Claude Sonnet 4.6 (Anthropic API) | Pay per token |
| TTS | ElevenLabs (Flash model) | 10K credits/month free |
| Avatar | CSS/JS animated character or D-ID free tier | Free |
| Backend | Node.js / Express or existing backend | Free (existing) |
| Session State | Redis or in-memory (per session) | Free |

---

## Phased Rollout Plan

**Phase 1 — MVP (2–3 weeks)**
- Single interview mode (DSA only)
- Text-only fallback (no avatar, no TTS) — just AI chat interface
- Groq Whisper for STT (free)
- Claude for AI responses
- Basic conversation loop (no feedback at end)

**Phase 2 — Voice + Avatar (2 weeks)**
- Add ElevenLabs TTS + STT
- Add CSS/JS animated avatar
- All 4 interview modes
- Per-user daily credit limits

**Phase 3 — Polish (1–2 weeks)**
- Post-interview feedback report
- Score + areas for improvement
- Interview history saved to user profile
- Shareable interview summary

---

## Open Questions / Decisions Needed

1. **User accounts** — Are users logged in? Daily limits require identifying users server-side.
2. **Claude API key** — Confirm the Anthropic API key is server-side only (never exposed to browser).
3. **ElevenLabs key** — Same: keep server-side, proxy all TTS/STT calls through your backend.
4. **Avatar style** — Decide between custom CSS avatar (free, always-on) vs D-ID/HeyGen (better quality, limited free tier).
5. **Question bank** — Does the interviewer generate questions dynamically (Claude) or pull from a pre-seeded question bank? Dynamic is simpler to build; a hybrid (seeded bank + Claude elaboration) is more consistent.
6. **Retell as fallback** — Decide upfront whether to integrate Retell as a credit exhaustion fallback or keep STT/TTS separate.
