import { useState, useEffect } from 'react';

export function MemorySpan({ task, phase, onStudyEnd, onTap, onSubmit }) {
  const [current, setCurrent] = useState(null);    // item flashing during study

  // Study phase: play the sequence item by item, using the server's timings.
  useEffect(() => {
    if (phase !== 'studying' || !task) return;

    const { sequence, displayDurationMs, gapDurationMs } = task;
    let i = 0;
    let timer;

    const showNext = () => {
      if (i >= sequence.length) {
        setCurrent(null);
        onStudyEnd();    // hook flips phase to 'recalling'
        return;
      }
      setCurrent(sequence[i]);    // show item i
      timer = setTimeout(() => {
        setCurrent(null);    // blank gap
        i++;
        timer = setTimeout(showNext, gapDurationMs);
      }, displayDurationMs);
    };

    showNext();
    return () => clearTimeout(timer);   // cancel on unmount / phase change
  }, [phase, task, onStudyEnd]);

  if (phase === 'studying') {
    return (
      <div>
        <p>Memorize the sequence</p>
        <div style={{ fontSize: '4rem', height: '6rem' }}>
          {current ? current.placeholder : ''}
        </div>
      </div>
    );
  }

  if (phase === 'recalling') {
    return (
      <div>
        <p>Tap the relevant items in the order they appeared, then submit</p>
        <div>
          {task.palette.map(item => (
            <button
              key={item.id}
              onClick={() => onTap(item.id)}
              style={{ fontSize: '2rem' }}
            >
              {item.placeholder}
            </button>
          ))}
        </div>
        <button onClick={onSubmit}>Submit</button>
      </div>
    );
  }

  return null;    // idle / generating / result
}