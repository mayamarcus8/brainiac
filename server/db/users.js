import { randomUUID } from 'crypto';
import { pool } from '../db/pool.js';

// Creates a new guest user row with a fresh unguessable token.
// Returns BOTH the internal id (for FKs) and the token (to hand to the client).
export async function insertGuestUser() {
  const token = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO users (clerk_id, email, guest_token)
     VALUES (NULL, NULL, $1)
     RETURNING id, guest_token`,
    [token]
  );
  return rows[0]; // { id, guest_token }
}

// Confirms a given internal id exists AND is still an unclaimed guest. Returns the row (with id) or null.
// Guards against a stale/forged guest id (e.g. one already claimed, or swept).
export async function getGuestByToken(token) {
  const { rows } = await pool.query(
    `SELECT id, guest_token FROM users
     WHERE guest_token = $1 AND clerk_id IS NULL`,
    [token]
  );
  return rows[0] ?? null;
}