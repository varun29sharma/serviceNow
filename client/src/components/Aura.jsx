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
 *
 * The tones come from styles/tokens.css (`--aura-<urgency>-a/-b/-opacity`)
 * rather than from rgba literals here: an atmosphere that carries meaning is
 * subject to the same tokens-only rule as every other colour in the app.
 */
const URGENCIES = ['High', 'Medium', 'Low', 'None'];

export default function Aura({ urgency = 'None', live = true }) {
  const key = URGENCIES.includes(urgency) ? urgency.toLowerCase() : 'none';

  return (
    <div
      className="aura"
      aria-hidden="true"
      data-live={live ? 'true' : 'false'}
      style={{
        '--aura-a': `var(--aura-${key}-a)`,
        '--aura-b': `var(--aura-${key}-b)`,
        '--aura-opacity': `var(--aura-${key}-opacity)`,
      }}
    />
  );
}
