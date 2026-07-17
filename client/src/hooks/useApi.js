import { useCallback } from 'react';
import { useAuth } from '@clerk/react';

const API = '/api/v1';

export function useApi() {
  const { getToken } = useAuth();

  // POST helper - attaches Clerk bearer (if signed in) + guest token (if any).
  return useCallback(async (path, body) => {
    const token = await getToken();    // null when signed out
    const guestToken = localStorage.getItem('guestToken');

    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(guestToken ? { 'X-Guest-Id': guestToken } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error ?? 'Request failed'), { status: res.status });
    return data;
  }, [getToken]);
}