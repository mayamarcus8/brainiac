import { pool } from './pool.js';

// Called at /session/start - creates a session row, returns its id. 
export async function insertSession(userId, taskType) {
  const { rows } = await pool.query(
    `INSERT INTO sessions (user_id, task_type)
     VALUES ($1, $2)
     RETURNING id`,
    [userId, taskType]
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

// Called at /generate - verifies the session exists and belongs to the user.
export async function sessionBelongsTo(sessionId, userId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM sessions WHERE id = $1 AND user_id = $2`,
    [sessionId, userId]
  );
  return rows.length > 0;
}