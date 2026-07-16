import { pool } from './pool.js';

// Called at /session/start - creates a session row, returns its id. 
export async function insertSession(userId, taskType, sessionToken) {
  const { rows } = await pool.query(
    `INSERT INTO sessions (user_id, task_type, session_token)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, taskType, sessionToken]
  );
  return rows[0].id;
}

// Called at /generate - creates an attempt row, returns its id.
export async function insertAttempt(sessionId, difficulty) {
  const { rows } = await pool.query(
    `INSERT INTO attempts (session_id, difficulty)
     VALUES ($1, $2)
     RETURNING id`,
    [sessionId, difficulty]
  );
  return rows[0].id;
}
// Called at /tap - creates an attempt item row.
export async function insertAttemptItem(attemptId, itemIndex, isCorrect, itemValue) {
  await pool.query(
    `INSERT INTO attempt_items (attempt_id, item_index, is_correct, item_value)
    VALUES ($1, $2, $3, $4)`,
    [attemptId, itemIndex, isCorrect, itemValue]
  );
}

// Called at /generate - verifies the session exists and in-progress, returns its id.
export async function getSessionByToken(sessionToken) {
  const { rows } = await pool.query(
    `SELECT id
    FROM sessions
    WHERE session_token = $1 AND ended_at IS NULL`,
    [sessionToken]
  );
  return rows[0] ?? null;
}

// Called at /complete - retrieves all attempt items for a given attempt.
export async function getAttemptItems(attemptId) {
  const { rows } = await pool.query(
    `SELECT item_index, is_correct, item_value
     FROM attempt_items
     WHERE attempt_id = $1
     ORDER BY item_index`,
    [attemptId]
  );
  return rows;
}

// Called at /complete - fills in the attempt score upon completion.
export async function updateAttemptScore(attemptId, score) {
  await pool.query(
    `UPDATE attempts
    SET score = $1
    WHERE id = $2`,
    [score, attemptId]
  );
}

// Called at /generate and /complete - counts the number of completed attempts for a given session.
export async function countCompletedAttempts(sessionId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM attempts
     WHERE session_id = $1 AND score IS NOT NULL`,
    [sessionId]
  );
  return rows[0].n;
}

// Called at /session/end - sets ended_at for the session and computes the accuracy.
export async function closeSession(sessionId) {
  const { rows } = await pool.query(
    `UPDATE sessions
     SET ended_at = NOW(),
         accuracy = (
           SELECT AVG(score)
           FROM attempts
           WHERE session_id = $1 AND score IS NOT NULL
         )
     WHERE id = $1
     RETURNING accuracy`,
    [sessionId]
  );
  return rows[0]?.accuracy ?? null;
}