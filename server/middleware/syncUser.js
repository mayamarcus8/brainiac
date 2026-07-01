import { getAuth, clerkClient } from '@clerk/express';
import { pool } from '../db/pool.js';

export async function syncUser(req, res, next) {
  const { userId } = getAuth(req);

  try {
    const existing = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

    // User exists in db
    if (existing.rows.length > 0) {
      req.dbUser = existing.rows[0];
      return next();
    }

    // Insert user into db
    const clerkUser = await clerkClient.users.getUser(userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;

    const inserted = await pool.query(
      'INSERT INTO users (id, email) VALUES ($1, $2) RETURNING *',
      [userId, email]
    );

    req.dbUser = inserted.rows[0];
    next();
  } catch (err) {
    console.error('syncUser error:', err);
    res.status(500).json({ error: 'Failed to sync user' });
  }
}