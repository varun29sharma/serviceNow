/**
 * Priority matrix — ServiceNow's impact x urgency lookup, as a real grid.
 *
 * This is both an explanation and a control: the selected Case is plotted as a
 * pulsing marker, and clicking a row sets that Case's impact, from which
 * priority re-derives. Agents override impact; they never set priority
 * directly — that is the platform behaviour, and the reason this widget exists
 * instead of a priority dropdown.
 */
import { Fragment } from 'react';
import {
  IMPACTS,
  URGENCY_KEYS,
  DEFAULT_PRIORITY_MATRIX,
  derivePriority,
  PRIORITY_SHORT,
} from '../../../server/src/triage/priorityMatrix.js';

export default function PriorityMatrix({
  matrix = DEFAULT_PRIORITY_MATRIX,
  impact,
  urgency,
  counts = {},
  onPickImpact,
  dense = false,
}) {
  return (
    <div className="priority-matrix">
      <div className="pm-axis" />
      {URGENCY_KEYS.map((u) => (
        <div key={u} className="pm-axis">
          {u}
        </div>
      ))}

      {IMPACTS.map((level) => (
        <Fragment key={level}>
          <div className="pm-axis">{level}</div>
          {URGENCY_KEYS.map((u) => {
            const priority = derivePriority(level, u, matrix);
            const isActive = impact === level && urgency === u;
            const count = counts[priority] || 0;

            return (
              <button
                type="button"
                key={`${level}-${u}`}
                className={`pm-cell${isActive ? ' active' : ''}`}
                data-pri={priority}
                onClick={onPickImpact ? () => onPickImpact(level) : undefined}
                disabled={!onPickImpact}
                title={`Impact ${level} x Urgency ${u} = Priority ${priority}`}
                aria-label={`Impact ${level}, urgency ${u}, priority ${priority}${
                  isActive ? ', current Case' : ''
                }`}
              >
                {PRIORITY_SHORT[priority]}
                {!dense && count > 0 && (
                  <span className="pm-count">
                    {count} {count === 1 ? 'case' : 'cases'}
                  </span>
                )}
                {isActive && <span className="pm-marker" />}
              </button>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}
