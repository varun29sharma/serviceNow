/**
 * Live status store.
 *
 * The ambient aura needs to know the highest urgency currently in play, but it
 * lives in the shell while the data lives in the pages. Rather than have the
 * shell fetch and duplicate every page's query, pages publish what they
 * already know and the shell subscribes.
 *
 * A module-level store is the right size for this: one value, few listeners,
 * no provider ceremony.
 */
import { useEffect, useState } from 'react';

const URGENCY_RANK = { None: 0, Low: 1, Medium: 2, High: 3 };

let current = 'None';
const listeners = new Set();

export function setLiveUrgency(urgency) {
  const next = URGENCY_RANK[urgency] === undefined ? 'None' : urgency;
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener(current);
}

/** Publish the highest urgency across a collection of Cases. */
export function reportQueueUrgency(cases = []) {
  let highest = 'None';
  for (const item of cases) {
    if (URGENCY_RANK[item.urgency] > URGENCY_RANK[highest]) highest = item.urgency;
  }
  setLiveUrgency(highest);
}

export function getLiveUrgency() {
  return current;
}

export function useLiveUrgency() {
  const [value, setValue] = useState(current);
  useEffect(() => {
    listeners.add(setValue);
    setValue(current);
    return () => listeners.delete(setValue);
  }, []);
  return value;
}
