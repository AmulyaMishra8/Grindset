# Grindset

**LeetCode taught you to write code. Grindset trains you to lead AI.**

Interviews changed. Increasingly you are handed an AI assistant and a brief full of holes, and you are judged on how you lead them — not on whether you can produce the function from memory. Grindset is a practice ground for exactly that loop: an AI product manager to interrogate, an AI junior developer to delegate to, and a senior-engineer reviewer who grades the conversation, not just the diff.

---

## The idea

Every problem arrives the way real work does: as a message from a PM, with a deadline, a vague requirement, and one trap buried in the wording.

> *"hey — quick one for the calendar team. we need to `mergeMeetings(intervals)` so the day view stops showing duplicate blocks. just merge the overlapping ones and hand back a clean list."*

Take that at face value and your junior will merge `[1,4]` and `[4,5]` into `[1,5]`, and you will ship code that quietly deletes someone's meeting. Ask the PM what "overlapping" actually means first, and you won't.

The whole product is built around that gap. **Requirements clarification and delegation quality are weighted double** in the score, because they are the part the round is really testing.

---

## What is in it

| | |
|---|---|
| **Practice mode** | The junior already has full context and asks sharp questions back. Coaching, no verdict. |
| **Test mode** | The junior starts with nothing. Decompose the task, brief it from scratch, take the hiring verdict. |
| **AI interviews** | Live voice rounds with four interviewers — data structures, system design, business case, behavioural — closing on a scored feedback card. |
| **Discuss** | Compare notes with other candidates: what they asked the PM, how they briefed the junior, where the trap was. |

### The submit pipeline

Hitting **Submit** runs a three-stage pipeline, streamed to the client over SSE:

1. **Generate** — an LLM reads your solution and writes targeted test cases against it
2. **Run** — every case is executed in a sandbox
3. **Review** — a senior-engineer model grades the code *and* the conversation that produced it

You get back a pass rate, a complexity estimate, per-dimension scores, and a written review of what you missed and why it would matter in production.

---

## Design

The interface has one rule: **red only ever marks a miss.**

A failing test, a problem you submitted and never got passing, a field you filled in wrong, a score under par, a "needs work" verdict. Anything that is *right* gets no colour at all — which is why there is no green anywhere in the app. A clean run is simply quiet, and every red mark is something to go fix.

Difficulty is ordinal, so it reads as a filled meter rather than a traffic-light — legible at a glance across a grid, and unaffected by colour blindness.

The palette comes from the wordmark: graphite ink, bone type, and one red dot.

---

## Architecture

A pnpm + Turborepo monorepo. Four Node services behind one gateway, with a React SPA.

```
                    ┌──────────────────────┐
   browser ───────► │  api-gateway  :4000  │  serves the SPA, proxies everything
                    └──────────┬───────────┘
                               │
       ┌───────────────────────┼────────────────────────┐
       │                       │                        │
┌──────▼───────┐      ┌────────▼────────┐      ┌────────▼────────┐
│ auth  :4003  │      │  judge  :4002   │      │  user   :4001   │
│              │      │                 │      │                 │
│ JWT, MFA,    │      │ problems, PM +  │      │ profiles        │
│ OAuth,       │      │ junior chat,    │      │                 │
│ discuss,     │      │ sandbox, review │      │                 │
│ interviews   │      │                 │      │                 │
└──────────────┘      └─────────────────┘      └─────────────────┘
```

Everything is served from **one origin** — the gateway hands out the built SPA and proxies `/auth`, `/api/judge`, `/api/discuss`, `/api/interview` and friends to the services over localhost. That keeps auth cookies first-party, which is what makes login work in Brave, Safari and private windows.

| Layer | Stack |
|---|---|
| Web | React 18, TypeScript, Vite, React Router, Monaco, react-hook-form + Zod |
| Services | Node, Express, TypeScript |
| Data | PostgreSQL via Prisma, Redis for sessions |
| Models | Groq (chat, review, Whisper STT), Mistral, ElevenLabs (interviewer voice) |
| Auth | JWT access/refresh in httpOnly cookies, CSRF double-submit, TOTP MFA, Google OAuth |
| Deploy | Render — a single consolidated service |

---

## Running it locally

**Prerequisites:** Node 20+, pnpm 9, PostgreSQL, Redis.

```bash
pnpm install
```

Configure the auth service. There is a documented template to copy:

```bash
cp apps/auth-service/.env.example apps/auth-service/.env
```

Then, in that file:

- point `DATABASE_URL` and `REDIS_URL` at your local instances
- **set `PORT=4003`.** The template ships with `4000`, which collides with the gateway. The gateway expects auth on `4003`.
- generate the JWT signing keys: `pnpm --filter @grindset/auth-service keys`
- add at least one `GROQ_KEY` if you want the PM, the junior, or the interviews to answer

Set up the database and seed the problems:

```bash
pnpm --filter @grindset/auth-service db:migrate
pnpm --filter @grindset/judge-service db:push
pnpm --filter @grindset/judge-service db:seed
```

Start everything:

```bash
pnpm dev
```

The SPA comes up on Vite's port; the gateway on `:4000`.

### Useful commands

```bash
pnpm build          # build every app
pnpm typecheck      # typecheck every app
pnpm lint
```

---

## Configuration

The auth service validates its environment on boot, so a missing variable fails loudly rather than at 2am. `apps/auth-service/.env.example` is the authoritative list; the essentials:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL |
| `REDIS_URL` | Sessions and rate limiting |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | Token signing (`pnpm --filter @grindset/auth-service keys`) |
| `ENCRYPTION_KEY` | Encrypts TOTP secrets at rest |
| `FIRST_GROQ_KEY` (+ `SECOND_`, `THIRD_`) | The PM, the junior, the reviewer, the interviewers, Whisper |
| `MISTRAL_KEY` | Secondary model |
| `ELEVENLABS_API_KEY` | Interviewer voice; falls back to the browser's speech synthesis |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Social login |
| `INTERVIEW_DAILY_LIMIT` | Interviews per user per UTC day. `0` means unlimited. |

Never commit a real `.env`.

---

## Deploying

`render.yaml` defines a single Render web service. The gateway binds Render's `$PORT`, serves `apps/web/dist`, and spawns auth, judge and user as sibling processes on `4003`, `4002` and `4001` (see `scripts/start-all.js`). One service, one origin, one thing to keep warm.

Do not set a `PORT` variable on that service — Render assigns it, and a manual value that collides with an internal port is rejected at boot.

---

## Repository layout

```
apps/
  web/            React SPA
  api-gateway/    Serves the SPA, proxies to the services
  auth-service/   Auth, MFA, OAuth, discuss, AI interviews
  judge-service/  Problems, PM + junior chat, sandbox, review pipeline
  user-service/   Profiles
packages/
  auth-shared/    Zod schemas shared by the API and the React forms,
                  so validation rules cannot drift apart
  db/             Prisma client shared with judge-service
  shared-types/
  shared-utils/
docs/
  AI_INTERVIEW.md
```

---

## Status

Actively built. Expect rough edges.

## License

Not currently licensed for reuse.
