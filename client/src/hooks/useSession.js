import { useState, useCallback } from 'react';
import { useApi } from './useApi.js';

export function useSession(taskType) {
  const api = useApi();
  const [sessionToken, setSessionToken] = useState(null);
  const [error, setError] = useState(null);

  const startSession = useCallback(async () => {
    try {
      const { sessionToken, guestToken } = await api('/session/start', { taskType });
      if (guestToken) localStorage.setItem('guestToken', guestToken);
      setSessionToken(sessionToken);
      return sessionToken;
    } catch (e) { setError(e.message); }
  }, [api, taskType]);

  const endSession = useCallback(async () => {
    try {
      const { accuracy } = await api('/session/end', { sessionToken });
      setSessionToken(null);
      return accuracy;
    } catch (e) { setError(e.message); }
  }, [api, sessionToken]);

  return { sessionToken, startSession, endSession, error };
}