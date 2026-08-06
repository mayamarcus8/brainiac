import { useSession } from '../hooks/useSession.js';
import { useMemorySpan } from '../hooks/useMemorySpan.js';
import { SessionShell } from '../components/SessionShell.jsx';
import { MemorySpan } from '../tasks/MemorySpan.jsx';

export function MemorySpanRunner() {
  const { sessionToken, startSession, endSession } = useSession('memory_span');
  const { phase, task, result, generate, startRecall, sendTap, complete, reset } = useMemorySpan();

  const begin = async () => { const t = await startSession(); await generate(t); };
  const next = async () => {
    if (result.isLastAttempt) {
      await endSession();
      reset();    // reset back to idle
    } else {
      await generate(sessionToken);
    }
  };

  const resultMessage = result && (
  <p>You recalled {result.correctCount} of {result.total}!</p>
  );

  return (
    <SessionShell phase={phase} result={result} onBegin={begin} onNext={next} resultMessage={resultMessage}>
      <MemorySpan task={task} phase={phase} onStudyEnd={startRecall}
                  onTap={sendTap} onSubmit={complete} />
    </SessionShell>
  );
}