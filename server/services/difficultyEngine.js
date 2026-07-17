/**
 * Returns difficulty unchanged.
 * In the future, the body will be replaced with the rolling-window adjustment logic,
 * keeping this exact signature so nothing calling it has to change.
 *
 * @param {number} currentDifficulty
 * @param {Array}  recentResults  - recent attempt results (currently unused)
 * @returns {number} next difficulty (1–10)
 */
export function nextDifficulty(currentDifficulty, recentResults = []) {
  return currentDifficulty; // TODO: adapt based on recentResults
}