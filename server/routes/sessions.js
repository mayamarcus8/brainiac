import { Router } from 'express';
import { getAuth } from '@clerk/express';
import { syncUser } from '../middleware/syncUser.js';
import { insertSession } from '../db/attempts.js';
import { insertGuestUser, getGuestByToken } from '../db/users.js';

const router = Router();

// Optional-auth: uses the authenticated user if present, else treats as guest.
// TODO: syncUser becomes resolve-only once the registration handler owns claim/insert.
router.post('/session/start', syncUser, async (req, res) => {
  const { taskType } = req.body;
  const clerkId = getAuth(req).userId ?? null;

  let userId;    // Internal id for the session row.
  let guestToken;    // Only set for guests, echoed back to the client.

  if (clerkId) {
    // Authenticated user.
    userId = req.dbUser.id;
  } else {
    // Anonymous - Reuse a valid guest token, otherwise mint a new guest.
    const existingToken = req.get('X-Guest-Id');
    const guest = existingToken ? await getGuestByToken(existingToken) : null;

    if (guest) {
      userId = guest.id;
      guestToken = guest.guest_token;
    } else {
      const created = await insertGuestUser();
      userId = created.id;
      guestToken = created.guest_token;
    }
  }

  const sessionId = await insertSession(userId, taskType);

  // Tell the client the guest token so it can send it back on the NEXT start
  // (and eventually as X-Guest-Id at registration). No-op for signed-in users.
  res.json({ sessionId, guestToken: guestToken ?? null });
});