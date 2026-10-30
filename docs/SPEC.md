# brAIniac — Project Spec & Architecture

*Adaptive cognitive training app. Status: Phase 2 — the full Memory Span task loop is built and verified end to end.*

---

## 1. What brAIniac is

An adaptive cognitive training web app. Four cognitive tasks, each measuring a distinct domain, with server-authoritative game logic, adaptive difficulty, a cognitive-profile radar chart, AI-generated recommendations, and a rewards/streak system.

**The four tasks and the domains they map to** (the spread is deliberate — it's what makes the radar chart multidimensional rather than measuring the same thing four times):

- **Memory Span** → working memory
- **Pattern Recognition** → fluid reasoning / visual-spatial
- **Verbal Fluency** → verbal / language
- **Processing Speed** → attention / psychomotor speed

## 2. Tech stack

- **Frontend:** React (Vite, dev port 5173), Clerk for auth, Recharts (radar chart, later).
- **Backend:** Node.js / Express (port 3001), PostgreSQL via `pg`.
- **AI:** Claude API (Verbal Fluency word validation and recommendations; between-session calibration only if it beats the formula baseline — later phases).
- **Deploy:** Vercel (frontend), Railway (backend). Not done yet (Phase 6).
- Dev on Windows; Claude Code in VS Code for file generation.
- API is versioned: all routes under `/api/v1`. (Currently a convention demonstrated, not exercised — single client. No v2 machinery.)

---

## 3. Core architectural principles (locked in)

1. **Server authority.** All game logic — generation, scoring, difficulty — lives server-side. The client only records raw actions (taps, words) and reports them. The client never computes or sends a score, and never sends difficulty.

2. **Streaming, not batching.** Each raw action is sent as it happens (`/tap`, `/word`), so the client holds no in-progress game state. The server accumulates the response stream (in the DB) and scores at completion.

3. **Three-level data model:**
   ```
   session   = one sitting (fixed attempt count, tuned per task)
     attempt   = one scored round
       attempt_items = sub-responses within a round (Memory Span taps, Verbal Fluency words only)
   ```

4. **The attempt-vs-attempt_item rule.** An **attempt** is the smallest thing assigned a 0–100 score. An **attempt_item** is a sub-response that only feeds into the attempt's score. It's determined by *scoring granularity, decided at design time per task* — NOT by inspecting the payload at runtime. Memory Span & Verbal Fluency have items; Pattern Recognition & Processing Speed don't (their single action IS the scored unit).

5. **Explicit routes / scorers per task, shared plumbing extracted.** Four tasks are genuinely divergent (different generators, scorers, payloads), so no generic dispatch route or generic scorer. Shared orchestration (session lifecycle, token resolution) is factored out; divergent logic stays per-task. Same principle applied client-side.

6. **Identity/token pattern (applied at three levels):** internal `SERIAL` id for joins (never exposed to client) + an unguessable token as the client-facing handle.
   - users: internal `id` + `clerk_id` (registered) / `guest_token` (guests)
   - sessions: internal `id` + `session_token`
   - attempts: internal `attemptId` + `attemptToken` (in-memory store key)

7. **Possession-proof auth downstream.** Identity is resolved *once* at `/session/start`. Every downstream route (`/generate`, `/tap`, `/complete`, `/session/end`) is gated purely by possession of a valid unguessable token — no per-request identity re-resolution on the hot path.

---

## 4. Database schema (current)

Seven tables. All `user_id` foreign keys are **INTEGER** (referencing `users.id SERIAL`) — this was fixed from an earlier `TEXT` version during the id-split.

```sql
CREATE TABLE users (
  id           SERIAL PRIMARY KEY,   -- internal id, everything FKs to this
  clerk_id     TEXT UNIQUE,          -- Clerk id; NULL for guests
  email        TEXT UNIQUE,          -- NULL for guests
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  guest_token  TEXT UNIQUE           -- unguessable handle; guests only, NULL once claimed
);

CREATE TABLE sessions (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL, -- unguessable; sent to client, possession = ownership proof
  task_type     TEXT NOT NULL,
  accuracy      NUMERIC(5,2),         -- avg of completed attempt scores; set at /session/end
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  ended_at      TIMESTAMPTZ           -- NULL = in progress; set at close
);

CREATE TABLE attempts (
  id            SERIAL PRIMARY KEY,
  session_id    INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  difficulty    INTEGER DEFAULT 1,    -- 1–10; set server-side at /generate
  score         NUMERIC(5,2),         -- NULLABLE: NULL = in progress; numeric = completed
  response_time INTEGER,              -- ms
  attempted_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE attempt_items (
  id            SERIAL PRIMARY KEY,
  attempt_id    INTEGER REFERENCES attempts(id) ON DELETE CASCADE,
  item_index    INTEGER NOT NULL,     -- position (server-assigned)
  is_correct    BOOLEAN NOT NULL,
  item_value    TEXT,                 -- WHAT the item was: tapped item id / produced word
  responded_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE profiles (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  task_type  TEXT NOT NULL,
  score      NUMERIC(5,2) DEFAULT 50,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, task_type)          -- one row per task type per user
);

CREATE TABLE user_stats (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_active    TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE badges (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL,
  earned_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_type)
);
```

**Key schema decisions:**
- Two-state attempt model: `score IS NULL` = in progress; numeric = completed. **No status column** — because stale attempts are *deleted*, never kept, so "abandoned" is never a stored state. Deleting keeps every DB row valid, so reads never need a status filter.
- `sequence_length` was dropped (derivable from difficulty: `3 + difficulty`).
- `item_value` was added so an item knows its own identity (needed for Verbal Fluency validation write-back; also used by Memory Span).
- `ON DELETE CASCADE` throughout: deleting a user/session/attempt auto-deletes its children. This is how stale-attempt cleanup and guest cleanup avoid manual child deletion.

**Note:** editing the schema *file* does not change the live DB. After schema edits, drop & recreate (`DROP SCHEMA public CASCADE; CREATE SCHEMA public;` then re-run the schema) — dev DB has no data worth preserving, and `CREATE TABLE IF NOT EXISTS` will *skip* outdated existing tables, so a plain re-run is a no-op.

---

## 5. Session & attempt lifecycle

**Fixed attempt count per task** (tuned so each session ≈ 3–4 min), in `services/tasks/attemptCounts.js`:
```
memory_span: 10,  pattern_recognition: 20,  verbal_fluency: 3,  processing_speed: 25
```

- A session is "complete" when the **target number of *completed* attempts** is reached.
- Stale attempts are *deleted*, so they don't count — a discarded attempt #6 means the user still does the full target ("as if it never existed"). This falls out of delete-stale automatically.
- `/generate` **enforces** the target: counts completed attempts, returns 409 if already at target. Uses `>=` (fail-safe: blocks even if somehow over).
- Between attempts, client shows "Next" → `/generate`. After the last, "Finish" → `/session/end`. The button label comes from server-reported `isLastAttempt`.
- If "Finish" never fires but all attempts completed, the (future) sweep closes the session.

**Flow:**
```
/session/start → session row + session_token
/generate      → attempt row (score NULL) + answer parked in store + attemptToken
/tap  (×N)     → each tap scored vs answer key → written to attempt_items
/complete      → read items → score → write attempts.score → free store entry
/session/end   → average completed attempts → sessions.accuracy + ended_at
```

`getSessionByToken` requires `ended_at IS NULL` — so a closed session's token no longer resolves (can't add attempts to a finished session; double-`/session/end` is correctly rejected).

---

## 6. Auth & guest model

**syncUser** (middleware): guest-tolerant. No Clerk id → `next()` without `req.dbUser` (lets the route handle guests). With a Clerk id, resolves by `clerk_id` FIRST (branch 1), then claim-guest-by-token (branch 2), then insert fresh (branch 3). Resolving by clerk_id first is what makes an authenticated user resolve to their real row regardless of any stale guest token the browser holds (closes the multi-device hole). Becomes resolve-only once the registration handler owns claim/insert (Phase 4/5).

**/session/start:** optional-auth (runs syncUser explicitly on the route). Authenticated → `userId = req.dbUser.id`. Anonymous → reuse a valid `guest_token` (via `getGuestByToken`, guarded by `clerk_id IS NULL`) or mint a new guest. Returns `{ sessionToken, guestToken }`. Client stores guestToken in localStorage, resends as `X-Guest-Id`.

**Guest philosophy: raw play is universal; the profile needs identity.**
- Guests generate `sessions`/`attempts`/`attempt_items` only. NOT `profiles`/`user_stats`/`badges` — those need persistent identity and are longitudinal (a "streak" for an ephemeral guest is incoherent). Enforced behaviorally (no schema change).
- Guest identity = unguessable `guest_token`, stable across multiple session-starts (client resends; reused if valid, else mint).

**Frontend→backend auth: Clerk bearer tokens** (not cookies), because frontend/backend are cross-origin (5173/3001 in dev; different domains in prod). Client attaches `Authorization: Bearer <token>` via Clerk's `getToken()` (returns null when signed out → guest flow). Dev: Vite proxy forwards `/api` → `localhost:3001` (dev-only; prod needs env-based base URL or Vercel rewrites).

---

## 7. Difficulty (two timescales)

- **In-session** (`difficultyEngine.js`): pure deterministic functions `(currentDifficulty, recentResults) → nextDifficulty`. No AI, no network, runs synchronously between attempts. **Currently a STUB** returning `currentDifficulty` unchanged (so difficulty is fixed per session in Phase 2), with the real signature already in place so implementing it is a body-swap. `/generate` already calls it (reads last completed attempt's difficulty + recent scores, server-side — client never sends difficulty).
- **Between-session** (Phase 4/5): sets next session's *starting* difficulty per task. Runs in the nightly cron. No latency pressure. Same mechanism can set per-user Verbal Fluency baselines.
  - **Input is a compact summary, not raw history.** Per task, computed in SQL: long-term level, recent trend, last session's start/end difficulty. Raw attempt history grows without bound; the summary stays small and holds both the long view and the recent one (so one bad session doesn't override a stable long-term level).
  - **Formula first.** A deterministic rule over that summary is the baseline: consistent, explainable, testable.
  - **LLM only if it earns it.** Considered only if evaluation against the formula shows it calibrates better. If added: structured output (`{ task, startDifficulty, reason }`), server clamps the change (±2 from last start), and falls back to the formula on invalid output or API failure.
- **The engine reacts; the nightly job calibrates.** No AI on the live path (would wreck latency, esp. Processing Speed).

---

## 8. Staleness (idle-based; sweep is Phase 5)

- **Measured from last *activity*, not start** — so active users are never killed mid-attempt.
- Attempt: 10 min of inactivity (each `/tap`/`/word` renews `lastActivityAt` via `getAttempt`'s side effect). Session: 45–60 min of inactivity.
- Stale = genuine inactivity, never slowness.
- Sweep *deletes* stale attempts (cascade removes their attempt_items) and *closes or discards* stale sessions. It must read the store **directly** (`peekAttempt`-style), NOT via `getAttempt` — because `getAttempt` refreshes the timer it's trying to check.
- "Continue session" (resume) flow: if resumed while an attempt is still live (in store), return to it; else start a fresh attempt. Fixed target still applies. Build with the client.

---

## 9. Task-specific notes

**Memory Span** (BUILT & WORKING):
- Real items (emoji placeholders now, images later), not letters. Item pool in `services/tasks/memorySpan.js`.
- Generate: sequence (ordered, = answer) + palette (sequence + 4 distractors, shuffled) + timing.
- Recall = tap-to-build with distractors. User hits **Submit** (allows over-recall). Server counts taps (`tapCount` in store, incremented before any await) → assigns `item_index`. Client sends only `itemId`.
- **Scoring: OPEN CHANGE PENDING.** Current scorer is `correctCount / sequenceLength` — this DOESN'T penalize over-tapping (4/4 correct + 1 extra tap still scores 100). Decided to fix so score reflects tap count. Recommended: denominator = `max(sequenceLength, items.length)` (precision-style), so over-tap 4-correct-of-5-taps = 80. Not yet implemented.
- **Also unresolved:** one-off answers — missing just one item (e.g. the first) shifts every later tap out of position, so the current scorer gives 0; it should earn a decent partial score.

**Verbal Fluency** (designed, not built):
- Attempt = one 60s category round; item = one word; `/word` streams, timer expiry → `/complete`.
- Dedup at `/word` via in-memory `seenWords` Set in the attempt context; duplicate → `is_correct=false` + "duplicate" ack to client.
- Word stored in `item_value`. `is_correct` provisional during typing ("not a duplicate"), finalized at `/complete` ("counted").
- Validation batched at `/complete`: ONE AI call for the whole word list (never per-word mid-session). Read candidates and write-back BOTH filter `is_correct = true` (canonical, non-duplicate instances) — the `AND is_correct = true` is load-bearing for precision, not just defensive.
- Validation safeguards: the user's words go into the prompt strictly as data (so text typed as instructions can't change the scoring), and the model's output is checked against the words actually submitted — any missing or invented word is rejected, never written back.
- Baseline/normalization: start difficulty-scaled (expected words/sec × time limit); layer per-user self-calibrating baseline later via the between-session calibration job.

**Pattern Recognition** (NEXT TO BUILD): single odd-one-out choice = one attempt, no items. Answer must be stripped from client payload (unlike Memory Span, where the sequence must be shown). Trigger = the choice itself.

**Processing Speed** (not built): one target tap = one attempt (correctness + reaction time), no items, no study phase.

---

## 10. File structure

```
server/
  index.js                     mounts /api/v1 → routes/index.js (app.listen LAST)
  routes/
    index.js                   mounts /session + /tasks/* (task routes have NO path prefix — the mount adds it)
    sessions.js                /start, /end
    memorySpan.js              /generate, /tap, /complete   (BUILT)
    patternRecognition.js      (todo)
    verbalFluency.js           (todo)
    processingSpeed.js         (todo)
  services/
    attemptStore.js            in-memory Map: registerAttempt / getAttempt / endAttempt
    difficultyEngine.js        nextDifficulty() — STUB with real signature
    tasks/
      memorySpan.js            ITEMS pool + generateMemorySpan + scoreMemorySpan
      shuffle.js               shared Fisher–Yates
      attemptCounts.js         ATTEMPTS_PER_SESSION map
      (no barrel index.js — routes import each task file directly)
  db/
    pool.js                    pg pool (dotenv.config() must be called HERE, not only index.js)
    attempts.js                session/attempt/attempt_items queries
    users.js                   insertGuestUser, getGuestByToken
  middleware/
    syncUser.js                guest-tolerant, clerk_id-first
    requireAuthApi.js          JSON 401 for protected routes

client/src/
  main.jsx                     ClerkProvider + StrictMode
  App.jsx                      renders MemorySpanRunner (no router yet)
  hooks/
    useApi.js                  shared POST wrapper (attaches Bearer + X-Guest-Id)
    useSession.js              startSession / endSession (task-agnostic)
    useMemorySpan.js           generate / startRecall / sendTap / complete / reset + phases
  pages/
    MemorySpanRunner.jsx       calls both hooks, wires begin/next, assembles resultMessage
  components/
    SessionShell.jsx           shared chrome (start/progress/result/next-finish); DUMB renderer, slots via children + resultMessage
  tasks/
    MemorySpan.jsx             pure play UI (study animation + palette tapping); only presentation state
```

**Client architecture split:** hooks own state + network; runner orchestrates (assembles hooks, decides flow); SessionShell renders (dumb, shared, task-agnostic via `children` + `resultMessage` slots); task component is pure play UI. "Shared logic" lives in shared *hooks*, not in the dumb shell. TaskRunner was split into per-task runners (Rules of Hooks forbid dynamically calling a task-specific hook) + shared SessionShell.

---

## 11. Status

**DONE & VERIFIED:**
- Full Memory Span loop working end to end, authenticated AND guest: start → generate → tap (scored server-side) → complete → session close with recorded accuracy → reset to start.
- Schema rebuilt with id-split, tokens, item_value, INTEGER FKs, nullable score.
- syncUser guest-tolerant + clerk_id-first. Bearer-token auth. Vite proxy.
- Difficulty engine stubbed & wired into /generate. Target enforcement + progress reporting.

**IMMEDIATE NEXT:**
- Memory Span scoring fix (penalize over-tapping — `max(sequenceLength, items.length)` denominator).
- Build Pattern Recognition (most different from Memory Span — tests reusability of shared pieces, surfaces real duplication for the attemptHandler extraction).

**DEFERRED (decided, not built):**
- `attemptHandler` extraction — revisit after task #2, when real duplication is visible (the batch-submit version was obsoleted by streaming; the reusable seam is now at /generate + /complete).
- Verbal Fluency & Processing Speed tasks.
- Staleness sweep (idle-TTL, Phase 5) + `peekAttempt`.
- Resume / "continue session" flow (server session-status read + client resume-vs-fresh).
- Difficulty engine body (after all four tasks are built): rolling window — >80% over last 3 → up, <50% → down.
- Registration-time sync handler (webhook or post-register endpoint): claim guest row in place, backfill profiles/user_stats/badges from the guest's existing sessions. Phase 4/5.
- Guest cleanup cron (delete cold `clerk_id IS NULL` users with no recent sessions; cascade cleans the tree).
- Redis for attemptStore (only if horizontally scaled; single-instance Map is fine — dev "tap error" was just server auto-restart wiping the Map mid-attempt, not a bug).
- Between-session calibration + nightly cron (Phase 4/5): formula first; LLM only if it measurably beats it.
- Cognitive profile radar chart (Recharts), AI recommendations (Phase 4).
- Rewards/streaks/badges (Phase 5).
- UI/visual design (Phase 6) — deliberately bare markup for now.
- Deployment: Vercel + Railway, CORS, env-based API base URL (Phase 6).
- sessionId authz on /generate — RESOLVED via session-token possession.

**KNOWN EDGE CASES (accepted / low-severity):**
- Accidental signed-out play: discard those sessions (protects profile integrity); "ask the user" as later refinement; silent re-auth of expired sessions as the real fix for the common sub-case.
- Multi-device guest with stale token from a different lineage: registration claim resolves by clerk_id so it's mostly closed; residual split-identity tail is low-severity, Phase 4/5.
