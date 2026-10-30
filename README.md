# brAIniac

An adaptive cognitive training web app. Short task sessions measure four distinct cognitive domains, adapt difficulty to the user, and build a multi-dimensional cognitive profile over time.

| Task | Domain | Status |
|---|---|---|
| Memory Span | Working memory | ✅ Built, end to end |
| Pattern Recognition | Fluid reasoning / visual-spatial | Next |
| Verbal Fluency | Verbal / language | Designed |
| Processing Speed | Attention / psychomotor speed | Planned |

**Status:** work in progress. The full Memory Span loop works end to end for both signed-in and guest users: session start → generate → streamed taps scored server-side → attempt completion → session close with recorded accuracy.

## Architecture highlights
- **Server-authoritative game logic.** Generation, scoring and difficulty all run on the server; the client only reports raw actions. A client can't send itself a score.
- **Streaming actions.** Each tap/word is sent as it happens, so the client holds no in-progress game state.
- **Three-level data model:** `sessions → attempts → attempt_items`, where an attempt is the smallest scored unit.
- **Token-based ownership.** Internal ids never leave the server; clients hold unguessable tokens, and identity is resolved once per session.
- **Guest play.** Guests can play immediately with a stable anonymous identity; longitudinal data (profile, streaks) requires an account.
- Versioned REST API under `/api/v1`.

Full design document: [`docs/SPEC.md`](docs/SPEC.md).

## AI in brAIniac
**How it's built.** Developed with Claude Code. The design spec ([`docs/SPEC.md`](docs/SPEC.md)) and [`CLAUDE.md`](CLAUDE.md) give the agent the project's architecture and principles as context; every change is reviewed before it's committed.

**In the product (planned).** Guiding rule: *the engine reacts, the nightly job calibrates* — no AI on the live path, and an LLM only where it beats a simpler tool.
- **In-session difficulty:** a fast, deterministic engine adjusts difficulty between attempts (rolling window over recent scores). No network calls, so no latency during play.
- **Verbal Fluency validation:** one batched LLM call at the end of each round checks whether the user's words fit the category — a language judgment a fixed word list can't cover. The user's words are treated strictly as data, and the model's output is checked against the words actually submitted.
- **Between-session calibration:** a nightly job sets each task's starting difficulty from a compact summary of the user's history (long-term level + recent trend). A deterministic formula is the baseline; an LLM is added only if it measurably calibrates better.
- **Recommendations:** personalized suggestions based on the cognitive profile.

## Tech stack
React 19 + Vite · Node.js + Express 5 · PostgreSQL · Clerk auth · Claude API (planned) · Recharts (planned)

## Running locally
Requires Node.js and PostgreSQL.

```bash
# database
createdb brainiac
psql brainiac -f server/db/schema.sql

# server  (port 3001)
cd server
cp .env.example .env   # set DATABASE_URL and the Clerk keys
npm install
npm run dev

# client  (port 5173, proxies /api to the server)
cd client
cp .env.example .env   # set VITE_CLERK_PUBLISHABLE_KEY
npm install
npm run dev
```

## Roadmap
1. Memory Span scoring refinement (penalize over-tapping, partial credit for one-off answers)
2. Pattern Recognition, then shared attempt-handling extraction
3. Verbal Fluency and Processing Speed
4. Adaptive difficulty engine
5. Cognitive profile radar chart, AI calibration and recommendations
6. Streaks and badges
7. UI design and deployment (Vercel + Railway)
