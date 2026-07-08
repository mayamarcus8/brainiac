import { getAuth, clerkClient } from '@clerk/express';
import { pool } from '../db/pool.js';

export async function syncUser(req, res, next) {
  const { userId: clerkId } = getAuth(req);

  // Guest-tolerant: anonymous request, route handles path
  if (!clerkId) return next();

  try {
    // User is already registered in the database.
    const existing = await pool.query(
        'SELECT * FROM users WHERE clerk_id = $1',
        [clerkId]
    );
    if (existing.rows.length > 0) {
      req.dbUser = existing.rows[0];
      return next();
    }

    const clerkUser = await clerkClient.users.getUser(userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;

    // Claim an unclaimed guest row if the client supplied one.
    const guestToken = req.get('X-Guest-Id');
    if (guestToken) {
      const claimed = await pool.query(
        'UPDATE users SET clerk_id = $1, email = $2, guest_token = NULL WHERE guest_token = $3 AND clerk_id IS NULL RETURNING *',
        [clerkId, email, guestToken]
      );
      if (claimed.rows.length > 0) {
        req.dbUser = claimed.rows[0];
        return next();
      }
    }

    // No guest row claimed, create a new user row.
    const inserted = await pool.query(
      'INSERT INTO users (clerk_id, email) VALUES ($1, $2) RETURNING *',
      [clerkId, email]
    );
    req.dbUser = inserted.rows[0];
    next();
  } catch (err) {
    console.error('syncUser error:', err);
    res.status(500).json({ error: 'Failed to sync user' });
  }
}