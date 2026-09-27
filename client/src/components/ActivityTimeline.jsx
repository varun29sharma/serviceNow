/**
 * Activity timeline.
 *
 * A connecting rail with per-type node colouring, rather than a flat list of
 * cards. The distinction the platform cares about is preserved visually:
 * internal **Work Notes** (amber, lock) are never mixed up with student-visible
 * **Comments** (cyan), and system entries are quiet.
 *
 * `flashIndex` re-plays a one-shot highlight on the row that just changed via
 * SSE — motion encoding "something happened", per DESIGN.md.
 */
import { formatDateTime } from '../format.js';

const ICONS = { work_note: '🔒', comment: '💬', system: '⚙️' };
const FILTERS = {
  all: () => true,
  work_notes: (a) => a.type === 'work_note',
  comments: (a) => a.type === 'comment',
};

export default function ActivityTimeline({
  items = [],
  filter = 'all',
  flashIndex = null,
  emptyText = 'No activity logged on this Case yet.',
}) {
  const predicate = FILTERS[filter] || FILTERS.all;
  const visible = items.filter(predicate);

  if (visible.length === 0) {
    return <div className="empty">{emptyText}</div>;
  }

  return (
    <div className="timeline">
      {visible.map((entry, i) => (
        <div
          key={`${entry.timestamp || i}-${i}`}
          className={`timeline-item${flashIndex === i ? ' flash' : ''}`}
          data-kind={entry.type || 'system'}
        >
          <div className="act-header">
            <span className="act-author">
              {ICONS[entry.type] || ICONS.system} {entry.author || 'System'}
            </span>
            <span className="act-time">{formatDateTime(entry.timestamp)}</span>
          </div>
          <div className="act-body">{entry.text}</div>
        </div>
      ))}
    </div>
  );
}
