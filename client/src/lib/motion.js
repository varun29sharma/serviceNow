/**
 * Motion utilities.
 *
 * DESIGN.md requires that `prefers-reduced-motion: reduce` is honoured
 * globally. CSS media queries handle stylesheet animations, but JS-driven
 * motion (SMIL path animations, canvas, requestAnimationFrame counters) has to
 * check for itself — so this hook is the single place that decision is made.
 *
 * It also reports the manual `data-reduced-motion` flag set by the toggle in
 * the #/design gallery, so the whole team can verify the reduced-motion build
 * without changing OS settings.
 */
import { useEffect, useState } from 'react';

const MANUAL_EVENT = 'triage:motion';

function readReduced() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  return Boolean((mq && mq.matches) || document.documentElement.dataset.reducedMotion === 'on');
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(readReduced);

  useEffect(() => {
    const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(readReduced());

    if (mq && mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq && mq.addListener) mq.addListener(onChange);

    window.addEventListener(MANUAL_EVENT, onChange);
    return () => {
      if (mq && mq.removeEventListener) mq.removeEventListener('change', onChange);
      else if (mq && mq.removeListener) mq.removeListener(onChange);
      window.removeEventListener(MANUAL_EVENT, onChange);
    };
  }, []);

  return reduced;
}

/** Set the manual reduced-motion flag (used by the design gallery toggle). */
export function setReducedMotion(on) {
  document.documentElement.dataset.reducedMotion = on ? 'on' : 'off';
  window.dispatchEvent(new Event(MANUAL_EVENT));
}

/**
 * Presentation mode — lifts every surface one luminance step so a dark UI
 * survives a washed-out projector. Persisted so it isn't lost on reload.
 */
export function setPresentationMode(on) {
  document.documentElement.dataset.presentation = on ? 'on' : 'off';
  try {
    window.localStorage.setItem('triagenow.presentation', on ? '1' : '0');
  } catch {
    // storage unavailable — the mode still applies for this session
  }
}

export function readPresentationMode() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dataset.presentation === 'on';
}
