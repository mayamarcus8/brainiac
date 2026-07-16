import { shuffle } from './shuffle.js';

// --- Item pool -------------------------------------------------------------
// Placeholder emoji for now, until real assets exist and we add an 'image' field
// that the client will prefer over 'placeholder'.
// TODO: grow pool size
const ITEMS = [
  { id: 'dress',  name: 'Dress',  placeholder: '👗' },
  { id: 'bucket', name: 'Bucket', placeholder: '🪣' },
  { id: 'fish',   name: 'Fish',   placeholder: '🐟' },
  { id: 'n64',    name: '64',     placeholder: '6️⃣4️⃣' },
  { id: 'apple',  name: 'Apple',  placeholder: '🍎' },
  { id: 'key',    name: 'Key',    placeholder: '🔑' },
  { id: 'clock',  name: 'Clock',  placeholder: '🕐' },
  { id: 'star',   name: 'Star',   placeholder: '⭐' },
  { id: 'car',    name: 'Car',    placeholder: '🚗' },
  { id: 'tree',   name: 'Tree',   placeholder: '🌳' },
  { id: 'book',   name: 'Book',   placeholder: '📖' },
  { id: 'moon',   name: 'Moon',   placeholder: '🌙' },
];

const DISTRACTOR_COUNT = 4;

// --- Generator -------------------------------------------------------------
export function generateMemorySpan(difficulty = 1) {
  const sequenceLength = 3 + difficulty; // diff 1 => 4 items ... diff 6 => 9 items

  // The sequence (and the answer).
  const pool = shuffle(ITEMS);
  const sequenceItems = pool.slice(0, sequenceLength);

  // Distractors (for the recall palette).
  const distractors = pool.slice(sequenceLength, sequenceLength + DISTRACTOR_COUNT);

  // Recall palette: correct items + distractors, shuffled so position leaks nothing.
  const palette = shuffle([...sequenceItems, ...distractors]);

  return {
    taskType: 'memory_span',
    difficulty,
    sequence: sequenceItems,    // shown during the study phase
    answer: sequenceItems.map(i => i.id),
    palette,    // shuffled items+distractors for tap-to-build
    displayDurationMs: 800,
    gapDurationMs: 200,
  };
}

// --- Scorer -----------------------------------------------------------------
export function scoreMemorySpan(items, sequenceLength) {
  const correctCount = items.filter(i => i.is_correct).length;

  // Normalize to 0–100 against the sequence length (the max possible correct).
  const score = (correctCount / sequenceLength) * 100;

  return {
    score: Math.round(score * 100) / 100,  // 2 decimals, matches NUMERIC(5,2)
    correctCount,
    total: sequenceLength,
  };
}