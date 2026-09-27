/**
 * SLA ring — an SVG countdown gauge.
 *
 * Replaces the flat SLA pill in the Case cockpit. The fraction is the share of
 * the SLA window still remaining (derived from the urgency's window, so it is
 * meaningful even for Cases seeded hours ago), and the ring breathes once the
 * Case enters the at-risk window.
 *
 * The numeric readout uses tabular mono so a ticking countdown does not reflow
 * its own width — see DESIGN.md rule 2.
 */
import { useEffect, useState } from 'react';

const WINDOW_HOURS = { High: 2, Medium: 24, Low: 72 };

function formatRemaining(ms) {
  const overdue = ms < 0;
  const abs = Math.abs(ms);
  const mins = Math.floor(abs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  let span;
  if (days > 0) span = `${days}d ${hours % 24}h`;
  else if (hours > 0) span = `${hours}h ${mins % 60}m`;
  else span = `${mins}m`;

  return overdue ? `${span} over` : `${span} left`;
}

export default function SlaRing({ slaTarget, urgency, status, size = 64, label = 'SLA target' }) {
  const [, forceTick] = useState(0);

  // Re-render once a minute so the countdown stays honest on a static screen.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const totalMs = (WINDOW_HOURS[urgency] || 72) * 60 * 60 * 1000;
  const remaining = new Date(slaTarget).getTime() - Date.now();
  const resolved = status === 'Resolved';
  const overdue = !resolved && remaining < 0;
  const atRisk = !resolved && !overdue && remaining < 60 * 60 * 1000;

  const fraction = resolved ? 1 : Math.max(0, Math.min(1, remaining / totalMs));
  const tone = resolved ? 'resolved' : overdue ? 'overdue' : atRisk ? 'at-risk' : 'safe';

  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className={`sla-ring ${tone}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          className="sla-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
        />
        <circle
          className="sla-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          className="sla-ring-text"
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
        >
          {Math.round(fraction * 100)}%
        </text>
      </svg>

      <div className="sla-ring-meta">
        <span className="sla-ring-label">{label}</span>
        <span className="sla-ring-value">
          {resolved ? 'SLA met' : formatRemaining(remaining)}
        </span>
      </div>
    </div>
  );
}
