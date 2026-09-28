/**
 * Motion utilities.
 *
 * DESIGN.md requires that `prefers-reduced-motion: reduce` is honoured
 * globally. CSS media queries handle stylesheet animations, but JS-driven
 * motion (SMIL path animations, canvas, requestAnimationFrame counters) has to
 * check for itself — so this hook is the single place that decision is made.
 *
 * The OS setting is the only source. It used to also read a manual
 * `data-reduced-motion` flag exposed by the old `#/design` gallery; that
 * gallery and its setter are gone, so the dead second input went with them
 * rather than leaving a flag nothing could ever set.
 */
import { useEffect, useState } from 'react';

function readReduced() {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  return Boolean(mq && mq.matches);
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(readReduced);

  useEffect(() => {
    const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const onChange = () => setReduced(readReduced());

    // addListener is the pre-Safari-14 spelling; kept so the hook does not
    // silently stop responding on an older machine at the venue.
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else if (mq.removeListener) mq.removeListener(onChange);
    };
  }, []);

  return reduced;
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
