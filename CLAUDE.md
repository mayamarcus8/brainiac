# CLAUDE.md

brAIniac is an adaptive cognitive training web app: four tasks (Memory Span, Pattern Recognition, Verbal Fluency, Processing Speed) feeding a per-domain cognitive profile. Full architecture, schema, lifecycle and status: **`docs/SPEC.md`** — read the relevant section before changing a subsystem.

## Stack
- `client/` — React 19 + Vite (port 5173), Clerk (`@clerk/react`). Vite proxies `/api` → `localhost:3001` in dev.
- `server/` — Node + Express 5 (port 3001), ES modules, PostgreSQL via `pg`, Clerk (`@clerk/express`).
- Schema: `server/db/schema.sql`. All routes are under `/api/v1`.

## Commands
- Server: `cd server && npm run dev` (node --watch)
- Client: `cd client && npm run dev` · lint: `npm run lint` (oxlint)
- Schema changes: drop & recreate the dev schema, then re-run `schema.sql` (`CREATE TABLE IF NOT EXISTS` silently skips outdated tables).
- No test runner yet.

## Non-negotiable principles
1. **Server authority.** Generation, scoring and difficulty live on the server. The client sends raw actions only — never a score, never a difficulty.
2. **Streaming, not batching.** Each action (`/tap`, `/word`) is sent as it happens; the client holds no in-progress game state.
3. **Data model:** `sessions → attempts → attempt_items`. An attempt is the smallest scored unit (0–100); items exist only where the task design says so (Memory Span, Verbal Fluency).
4. **Internal id + unguessable token** at every level (users, sessions, attempts). Never expose internal SERIAL ids to the client.
5. **Identity is resolved once** at `/session/start`; downstream routes are gated by token possession.
6. **No AI on the live path.** The in-session difficulty engine is pure and synchronous; LLM calls happen off the hot path (Verbal Fluency validation at `/complete`). Between-session calibration is formula-first; don't introduce an LLM there without an evaluation showing it beats the formula.

## Conventions
- Explicit routes and scorers per task; extract shared plumbing only once duplication is real (build the second task first).
- Named exports. No barrel `index.js` for tasks — import task files directly.
- Task route files have no path prefix; `routes/index.js` mounts them.
- Before adding a column, check it isn't derivable from existing data (e.g. sequence length from difficulty).
- Stale attempts are deleted, not flagged — there is no status column.
- `dotenv.config()` lives in `db/pool.js` (ES module import hoisting).
- Client split: hooks own state + network, runners orchestrate, `SessionShell` is a dumb shared renderer, task components are pure play UI.

## Working with me
- Explain *why* behind design choices; propose, don't silently decide on architecture.
- Keep changes small and reviewable; flag anything that contradicts `docs/SPEC.md`.
- Update `docs/SPEC.md` (status / deferred items) when a decision changes.
