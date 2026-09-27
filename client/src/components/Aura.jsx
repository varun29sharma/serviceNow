/**
 * Ambient urgency aura.
 *
 * Layered radial gradients behind the whole shell whose hue tracks the highest
 * live urgency in the workspace: calm teal when everything is routine, amber
 * when something is at risk, red when a Case is in crisis.
 *
 * This is atmosphere that is also a status readout — the point of the set
 * piece is that it *means* something. It carries no information on its own
 * (the badges do that), so it is purely decorative to assistive tech and
 * marked aria-hidden.
 */
const TONES = {
  High: {
    a: 'rgba(146, 40, 42, 0.9)',
    b: 'rgba(52, 16, 16, 0.92)',
    opacity: 0.72,
  },
  Medium: {
    a: 'rgba(122, 88, 30, 0.85)',
    b: 'rgba(46, 34, 12, 0.9)',
    opacity: 0.56,
  },
  Low: {
    a: 'rgba(58, 54, 38, 0.9)',
    b: 'rgba(26, 24, 16, 0.9)',
    opacity: 0.5,
  },
  None: {
    a: 'rgba(52, 49, 40, 0.88)',
    b: 'rgba(24, 23, 18, 0.9)',
    opacity: 0.42,
  },
};

export default function Aura({ urgency = 'None', live = true }) {
  const tone = TONES[urgency] || TONES.None;

  return (
    <div
      className="aura"
      aria-hidden="true"
      data-live={live ? 'true' : 'false'}
      style={{
        '--aura-a': tone.a,
        '--aura-b': tone.b,
        '--aura-opacity': tone.opacity,
      }}
    />
  );
}
