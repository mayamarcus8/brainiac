import { getAuth } from '@clerk/express';

export function requireAuthApi(req, res, next) {
  const { isAuthenticated } = getAuth(req);

  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  next();
}