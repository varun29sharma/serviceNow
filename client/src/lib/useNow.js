/**
 * A shared clock.
 *
 * SLA countdowns have to keep ticking or a queue left open on a projector starts
 * lying — the ring re-rendered once a minute while the pills beside it froze at
 * whatever the time was when the Case list loaded. Two implementations of "how
 * long is left" gave two different answers on the same screen.
 *
 * One module-level interval drives every subscriber instead of one timer per
 * component, which matters because a queue renders a countdown per Case.
 *
 * 30s rather than 1s: the readout is in minutes and days, so a faster tick would
 * cost renders and buy nothing.
 */
import { useEffect, useState } from 'react';

export const DEFAULT_TICK_MS = 30000;

const listeners = new Set();
let currentNow = Date.now();
let timer = null;

function tick() {
  currentNow = Date.now();
  for (const listener of listeners) listener(currentNow);
}

function subscribe(listener) {
  listeners.add(listener);
  if (!timer) timer = setInterval(tick, DEFAULT_TICK_MS);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Current time, re-rendering the caller on every tick. */
export function useNow() {
  const [now, setNow] = useState(currentNow);

  useEffect(() => {
    // Re-sync on mount: the shared value may be stale after a tab was hidden.
    setNow(Date.now());
    return subscribe(setNow);
  }, []);

  return now;
}

export function nowMs() {
  return Date.now();
}
