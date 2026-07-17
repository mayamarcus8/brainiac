import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { generateMemorySpan, scoreMemorySpan } from '../services/tasks/memorySpan.js';
import { nextDifficulty } from '../services/difficultyEngine.js';
import { insertAttempt, insertAttemptItem, getSessionByToken, getAttemptItems, updateAttemptScore,
    countCompletedAttempts, getLastAttemptDifficulty, getRecentAttemptScores } from '../db/attempts.js';
import { registerAttempt, getAttempt, endAttempt } from '../services/attemptStore.js';
import { ATTEMPTS_PER_SESSION } from '../services/tasks/attemptCounts.js';

// Fixed starting difficulty. Later on, the between-session AI will write a per-user,
// per-task starting difficulty and this default will only be the cold-start fallback.
const STARTING_DIFFICULTY = 1;

const router = Router();

// POST /generate - creates a new memory span attempt for the given session token and difficulty.
router.post('/generate', async (req, res) => {
    const { sessionToken } = req.body;
    
    // Verify possession of a valid session token as a credential.
    const session = await getSessionByToken(sessionToken);
    if (!session) {
      return res.status(403).json({ error: 'Invalid session' });
    }

    // Check if the session has already completed the maximum number of attempts.
    const completed = await countCompletedAttempts(session.id);
    const target = ATTEMPTS_PER_SESSION['memory_span'];
    if (completed >= target) {
        return res.status(409).json({ error: 'Session already complete' });
    }

    // Get next difficulty for this attempt, based on the last attempt's difficulty and recent scores.
    const lastDifficulty = await getLastAttemptDifficulty(session.id);
    const recentScores = await getRecentAttemptScores(session.id);
    const difficulty = nextDifficulty(lastDifficulty ?? STARTING_DIFFICULTY, recentScores);

    // Generate the task.
    const task = generateMemorySpan(difficulty);

    // Create the attempt row up front (score NULL = in progress).
    const attemptId = await insertAttempt(session.id, difficulty);

    // Store the answer key + context, keyed by a fresh token.
    const attemptToken = uuid();
    registerAttempt(attemptToken, {
        taskType: 'memory_span',
        sessionId: session.id,
        attemptId,
        answer: task.answer,    // ['fish','dress',...] - server truth, never sent
        difficulty,
    });

    // Strip the answer and send display data + the token the client uses for /tap.
    const { answer, ...clientPayload } = task;
    res.json({ ...clientPayload, attemptToken });
});

// POST /tap - receives a single tap from the client and checks it against the answer key.
router.post('/tap', async (req, res) => {
    const { attemptToken, itemId, itemIndex } = req.body;

    // Verify possession of a valid attempt token as a credential.
    // getAttempt also refreshes lastActivityAt (renews the idle-timeout window).
    const attempt = getAttempt(attemptToken);
    if (!attempt) {
        return res.status(400).json({ error: 'Invalid or expired attempt' });
    }

    // Score this one tap against the answer key at this position.
    const isCorrect = attempt.answer[itemIndex] === itemId;

    // Persist as an attempt_item.
    await insertAttemptItem(attempt.attemptId, itemIndex, isCorrect, itemId);

    res.json({ isCorrect });
});

// POST /complete - client signals the attempt is done, server scores it and returns the final score.
router.post('/complete', async (req, res) => {
  const { attemptToken } = req.body;

  const attempt = getAttempt(attemptToken);
  if (!attempt) {
    return res.status(400).json({ error: 'Invalid or expired attempt' });
  }

  // Read the items streamed in via /tap.
  const items = await getAttemptItems(attempt.attemptId);

  // Score against the sequence length.
  const sequenceLength = 3 + attempt.difficulty;
  const result = scoreMemorySpan(items, sequenceLength);    // { score, correctCount, total }

  // Persist the final score.
  await updateAttemptScore(attempt.attemptId, result.score);

  // Count completed attempts for this session, to determine if the session is done.
  const completed = await countCompletedAttempts(attempt.sessionId);
  const target = ATTEMPTS_PER_SESSION[attempt.taskType];

  // Attempt is finished - free its in-memory context.
  endAttempt(attemptToken);

  res.json({ ...result, completed, target, isLastAttempt: completed >= target });
});

export default router;