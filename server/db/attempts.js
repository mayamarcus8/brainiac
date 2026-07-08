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

// Called at /generate - verifies the session exists.
export async function getSessionByToken(sessionToken) {
  const { rows } = await pool.query(
    `SELECT id FROM sessions WHERE session_token = $1`,
    [sessionToken]
  );
  return rows[0] ?? null;
}