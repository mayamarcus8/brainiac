// Task-agnostic session shell component. Handles the session lifecycle and displays the current phase, result, and any errors.
// The task-specific play area is passed in as children.

export function SessionShell({ phase, result, error, onBegin, onNext, resultMessage, children }) {
  return (
    <div>
      {error && <p role="alert">{error}</p>}

      {phase === 'idle' && (
        <button onClick={onBegin}>Start</button>
      )}

      {children /* the task's play area */}

      {phase === 'result' && (
        <div>
          {resultMessage /* task-specific sentence */}
          <button onClick={onNext}>
            {result.isLastAttempt ? 'Done' : 'Next'}
          </button>
        </div>
      )}
    </div>
  );
}