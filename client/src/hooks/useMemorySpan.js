import { useState, useCallback } from 'react';
import { useApi } from './useApi.js';

// Memory Span's task phases.
export const Phase = {
  IDLE: 'idle',
  GENERATING: 'generating',
  STUDYING: 'studying',    // sequence playing
  RECALLING: 'recalling',    // user tapping
  RESULT: 'result',    // attempt scored
};

export function useMemorySpan() {
  const api = useApi();
  const [phase, setPhase] = useState(Phase.IDLE);
  const [task, setTask] = useState(null);
  const [attemptToken, setAttemptToken] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const generate = useCallback(async (sessionToken) => {
    setPhase(Phase.GENERATING);
    setResult(null);
    try {
      const data = await api('/tasks/memory-span/generate', { sessionToken });
      setTask(data);
      setAttemptToken(data.attemptToken);
      setPhase(Phase.STUDYING);
    } catch (e) { setError(e.message); }
  }, [api]);

  // Component calls this when the study animation finishes (it owns the timing).
  const startRecall = useCallback(() => setPhase(Phase.RECALLING), []);

  const sendTap = useCallback(async (itemId, itemIndex) => {
    try {
      const { isCorrect } = await api('/tasks/memory-span/tap', { attemptToken, itemId, itemIndex });
      return isCorrect;
    } catch (e) { setError(e.message); }
  }, [api, attemptToken]);

  const complete = useCallback(async () => {
    try {
      const data = await api('/tasks/memory-span/complete', { attemptToken });
      setResult(data);   // { score, correctCount, total, completed, target, isLastAttempt }
      setPhase(Phase.RESULT);
    } catch (e) { setError(e.message); }
  }, [api, attemptToken]);

  return { phase, task, result, error, generate, startRecall, sendTap, complete };
}