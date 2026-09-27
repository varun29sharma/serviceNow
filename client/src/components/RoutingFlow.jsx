/**
 * Routing flow — the triage decision, visualised.
 *
 * Four stages: Category -> Assignment Rule -> assignmentGroup -> SLA target.
 * A token travels the rail when a Case is routed (and again whenever a rule
 * change re-routes it), so the single most important thing the product does is
 * legible in about three seconds without reading a word.
 *
 * The token animates with SMIL, which is why it is gated on `useReducedMotion`
 * — CSS media queries cannot switch off an SMIL animation, so the check has to
 * happen in JS or reduced-motion users get an looping animation anyway.
 */
import { useReducedMotion } from '../lib/motion.js';

const NODE_W = 160;
const GAP = 26.67;
const HEIGHT = 56;
const WIDTH = NODE_W * 4 + GAP * 3;

function truncate(value, max = 19) {
  const text = String(value ?? '—');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export default function RoutingFlow({
  category,
  ruleValue = 'matched',
  assignmentGroup,
  urgency,
  slaHours,
  priority,
  travelKey = 0,
  caption,
  compact = false,
}) {
  const reduced = useReducedMotion();

  const nodes = [
    { kicker: 'Category', value: category },
    { kicker: 'Assignment Rule', value: ruleValue },
    { kicker: 'assignmentGroup', value: assignmentGroup },
    { kicker: 'SLA target', value: slaHours ? `${slaHours}h · P${priority ?? '—'}` : undefined },
  ];

  const y = HEIGHT / 2;

  return (
    <div className="routing-flow">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Routing: ${category} to ${assignmentGroup}`}>
        {/* rail sits behind everything */}
        <line className="rf-rail" x1={NODE_W / 2} y1={y} x2={WIDTH - NODE_W / 2} y2={y} />

        {/* The token travels underneath the node boxes, so it appears to pass
            through each stage rather than slide over the labels. */}
        {!reduced && (
          <circle key={travelKey} className="rf-token" r="4" cx={NODE_W / 2} cy={y}>
            <animateMotion
              dur="1.15s"
              begin="0s"
              fill="freeze"
              path={`M ${NODE_W / 2} ${y} L ${WIDTH - NODE_W / 2} ${y}`}
            />
          </circle>
        )}

        {nodes.map((node, i) => {
          const x = i * (NODE_W + GAP);
          const isDecision = i === 2;
          const isTarget = i === 3;
          const boxClass = [
            'rf-node-box',
            isDecision ? 'active' : '',
            isTarget && urgency ? `urgency-${urgency}` : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <g key={node.kicker}>
              <rect className={boxClass} x={x} y={0} width={NODE_W} height={HEIGHT} rx={10} />
              <text className="rf-node-label" x={x + 14} y={22}>
                {node.kicker}
              </text>
              <text className="rf-node-value" x={x + 14} y={41}>
                {truncate(node.value)}
              </text>
            </g>
          );
        })}
      </svg>

      {!compact && caption && <div className="rf-caption">{caption}</div>}
    </div>
  );
}
