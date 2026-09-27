/**
 * Data visualisation primitives — hand-authored SVG, no charting library.
 *
 * The project constraint is no charting dependency, and that is also the right
 * call for a single-file offline build: a chart library is 50-300 KB to draw
 * five shapes we already know the geometry of. These primitives are on-brand by
 * construction (they consume the same tokens as everything else) and cost
 * nothing in bundle size.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { useReducedMotion } from './motion.js';

/** Animated number. Counts up on mount; honours reduced motion by snapping. */
export function CountUp({ value = 0, decimals = 0, duration = 750, suffix = '' }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  const frame = useRef(0);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return undefined;
    }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(value * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration, reduced]);

  const shown =
    decimals > 0
      ? Number(display).toFixed(decimals)
      : Math.round(display).toLocaleString('en-US');

  return (
    <>
      {shown}
      {suffix}
    </>
  );
}

/**
 * Sparkline / area chart.
 *
 * `preserveAspectRatio="none"` lets the SVG stretch to any container width.
 * That would normally distort the stroke, so the line carries
 * `vector-effect="non-scaling-stroke"` to stay crisp.
 */
export function Sparkline({ data = [], height = 72, color = 'var(--signal)', showDots = true }) {
  const gid = useId().replace(/:/g, '');
  const values = data.length > 0 ? data : [0, 0];
  const max = Math.max(...values, 1);
  const width = 300;
  const pad = 6;
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;

  const points = values.map((v, i) => {
    const x = pad + i * step;
    const y = height - pad - (v / max) * (height - pad * 2);
    return [x, y];
  });

  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
  const area = `${line} L ${points[points.length - 1][0]} ${height - pad} L ${points[0][0]} ${height - pad} Z`;

  return (
    <svg
      className="viz-spark"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.36" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        className="viz-spark-line"
        d={line}
        style={{ stroke: color }}
        vectorEffect="non-scaling-stroke"
      />
      {showDots &&
        points.map(([x, y], i) => (
          <circle
            key={i}
            className="viz-spark-dot"
            cx={x}
            cy={y}
            r={2.5}
            style={{ stroke: color }}
            vectorEffect="non-scaling-stroke"
          />
        ))}
    </svg>
  );
}

/**
 * Horizontal distribution bars on a shared baseline grid.
 * `rows`: [{ label, value, tone }]
 */
export function DistributionBars({ rows = [], max, formatValue }) {
  const peak = max || Math.max(1, ...rows.map((r) => r.value || 0));
  return (
    <div className="bars-container">
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <div className="bar-label">{row.label}</div>
          <div className="bar-track">
            <div
              className={`bar-fill ${row.tone ? `urgency-${row.tone}` : ''}`}
              style={{
                width: `${Math.max(row.value > 0 ? 2 : 0, (row.value / peak) * 100)}%`,
                ...(row.color ? { background: row.color, color: row.color } : {}),
              }}
            />
          </div>
          <div className="bar-count">{row.value}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * Heat grid — used for the seven-day deflection/case activity matrix.
 * `rows`: [{ label, cells: [{ value, title }] }]
 */
export function HeatGrid({ rows = [], columns = [], peak }) {
  const max = peak || Math.max(1, ...rows.flatMap((r) => r.cells.map((c) => c.value || 0)));
  return (
    <div className="viz-stack">
      <div className="viz-heat" style={{ gridTemplateColumns: `52px repeat(${columns.length}, 1fr)` }}>
        <div className="viz-axis-label" />
        {columns.map((c) => (
          <div key={c} className="viz-axis-label" style={{ textAlign: 'center' }}>
            {c}
          </div>
        ))}
        {rows.map((row) => (
          <FragmentRow key={row.label} row={row} max={max} columns={columns.length} />
        ))}
      </div>
    </div>
  );
}

function FragmentRow({ row, max, columns }) {
  return (
    <>
      <div className="viz-axis-label" style={{ alignSelf: 'center' }}>{row.label}</div>
      {Array.from({ length: columns }).map((_, i) => {
        const cell = row.cells[i] || { value: 0 };
        const intensity = max > 0 ? cell.value / max : 0;
        return (
          <div
            key={i}
            className="viz-heat-cell"
            title={cell.title || `${cell.value}`}
            style={{
              background:
                cell.value === 0
                  ? 'rgba(255,255,255,0.03)'
                  : `color-mix(in srgb, var(--signal) ${Math.round(18 + intensity * 72)}%, transparent)`,
            }}
          />
        );
      })}
    </>
  );
}

export default Sparkline;
