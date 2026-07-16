// In-memory store for in-flight attempts.
// Keyed by attemptToken (a UUID minted at /generate).
// NOTE: This is a single-instance portfolio app. We can
// swap for Redis if we scale horizontally later.
const attempts = new Map();

// Called at /generate - store the attempt's server-side context.
export function registerAttempt(token, context) {
  attempts.set(token, { ...context, createdAt: Date.now(), lastActivityAt: Date.now() });
}

// Called at /tap, /word and /complete - read the context back and refresh activity.
// Returns undefined if the token is unknown (expired/invalid/already cleaned up).
export function getAttempt(token) {
    const attempt = attempts.get(token);
    if (attempt) attempt.lastActivityAt = Date.now();
    return attempt;
}

// Called at /complete (after scoring) - the attempt is done, free the memory.
export function endAttempt(token) {
  attempts.delete(token);
}