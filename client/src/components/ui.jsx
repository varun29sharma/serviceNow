/**
 * Shared UI atoms.
 *
 * Two deliberate changes from the previous build:
 *
 * 1. `slaRemaining` lived here AND in format.js with different wording. The
 *    duplicate is gone; format.js is the single implementation.
 * 2. The payload inspector used to offer "⚡ Sync Live to Enterprise System",
 *    which was a setTimeout pretending to push to a PDI it never called. It is
 *    now an honest outbound-request preview that shows the exact method,
 *    endpoint, headers and body you would send, with copy-as-cURL. Same visual
 *    payoff, no claim the code cannot back up.
 */
import { useState } from 'react';
import { STATUSES } from '../api.js';
import { formatDateTime, slaRemaining } from '../format.js';
import { useNow } from '../lib/useNow.js';
import { formatServiceNowPayload, serviceNowEndpoint } from '../../../server/src/triage/nowAssistEngine.js';
import { PRIORITY_LABELS, PRIORITY_SHORT } from '../../../server/src/triage/priorityMatrix.js';

/** Coloured Low/Medium/High badge with icon. */
export function UrgencyBadge({ urgency, pulse = false }) {
  return (
    <span className={`badge badge-${urgency} ${pulse && urgency === 'High' ? 'badge-pulse' : ''}`}>
      <span className="badge-dot" />
      {urgency}
    </span>
  );
}

/** Status badge with ServiceNow colour standards. */
export function StatusBadge({ status }) {
  const statusClass = String(status || '').replace(/\s+/g, '-').toLowerCase();
  return <span className={`badge badge-status-${statusClass}`}>{status}</span>;
}

/** Sentiment badge for the rules-engine classification. */
export function SentimentBadge({ sentiment }) {
  if (!sentiment) return null;
  const isCrisis = sentiment === 'Severe Crisis';
  return (
    <span
      className={`badge badge-sentiment${isCrisis ? ' crisis-pulse' : ''}`}
      data-sentiment={sentiment}
    >
      {isCrisis ? '🚨 ' : '🛡️ '}
      {sentiment}
    </span>
  );
}

/** Priority badge — derived from the impact x urgency matrix, never set by hand. */
export function PriorityBadge({ priority, short = false }) {
  if (!priority) return null;
  return (
    <span className="badge badge-priority" data-pri={priority}>
      {short ? PRIORITY_SHORT[priority] : PRIORITY_LABELS[priority] || `P${priority}`}
    </span>
  );
}

/** Impact badge — the consequence half of the priority pair. */
export function ImpactBadge({ impact }) {
  if (!impact) return null;
  return (
    <span className="badge badge-impact" data-impact={impact}>
      {impact}
    </span>
  );
}

/**
 * SLA pill with a live countdown.
 *
 * Subscribes to the shared clock (lib/useNow.js) so a queue left open keeps
 * telling the truth. It used to compute the window once at render, which meant
 * the pills froze while the SLA rings beside them kept ticking — two answers to
 * the same question on the same screen.
 */
export function SlaPill({ slaTarget, status }) {
  const now = useNow();
  if (!slaTarget) return null;
  if (status === 'Resolved') {
    return <span className="sla-pill resolved">✓ SLA met</span>;
  }
  const diffMs = new Date(slaTarget) - new Date(now);
  const overdue = diffMs < 0;
  const atRisk = diffMs > 0 && diffMs < 60 * 60 * 1000;

  return (
    <span className={`sla-pill ${overdue ? 'overdue' : atRisk ? 'at-risk' : 'safe'}`}>
      {overdue ? '🚨 ' : atRisk ? '⚡ ' : '⏱️ '}
      {slaRemaining(slaTarget)}
    </span>
  );
}

/** Student monogram avatar with deterministic colour. */
export function StudentAvatar({ name = 'Student' }) {
  const initials = String(name)
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return <div className="student-avatar">{initials || 'ST'}</div>;
}

/**
 * Outbound Table API request preview.
 *
 * Shows exactly what TriageNow would send to a ServiceNow instance — method,
 * endpoint, headers and body — rather than claiming a live push it does not
 * perform. `VITE_SN_INSTANCE` points the endpoint at a real PDI when one is
 * configured; otherwise it is clearly a placeholder.
 */
export function ServiceNowModal({ isOpen, onClose, kase }) {
  const [copied, setCopied] = useState('');

  if (!isOpen || !kase) return null;

  const payload = formatServiceNowPayload(kase);
  const endpoint = serviceNowEndpoint();
  const body = JSON.stringify(payload, null, 2);

  const curl = [
    `curl -X POST '${endpoint}' \\`,
    `  -H 'Accept: application/json' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -H 'Authorization: Basic <instance-credentials>' \\`,
    `  -d '${JSON.stringify(payload)}'`,
  ].join('\n');

  function copy(label, text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="sn-brand-icon">API</span>
            <div>
              <div className="modal-title">Outbound Table API request</div>
              <div className="modal-sub">
                Target: <code>POST {endpoint}</code>
              </div>
            </div>
          </div>
          <button className="ghost-sm" type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="sn-sync-status-bar">
            <div className="sn-sync-info">
              <span className="dot-live" />
              <span>
                <strong>Outbound payload preview.</strong> This is the request TriageNow generates for
                this Case. It is not sent — point <code>VITE_SN_INSTANCE</code> at a PDI to post it for real.
              </span>
            </div>
            <button
              className="btn-accent-sm"
              type="button"
              onClick={() => copy('curl', curl)}
            >
              {copied === 'curl' ? '✓ Copied cURL' : '📋 Copy as cURL'}
            </button>
          </div>

          <div className="code-header">
            <span>Request body — Case schema</span>
            <button className="ghost-sm" type="button" onClick={() => copy('json', body)}>
              {copied === 'json' ? '✓ Copied JSON' : '📋 Copy JSON'}
            </button>
          </div>
          <pre className="code-block">{body}</pre>
        </div>

        <div className="modal-footer">
          <div className="hint">
            Fields carry <code>sys_id</code>, <code>impact</code>, <code>urgency</code>,{' '}
            <code>priority</code>, <code>assignment_group</code> and the SLA target. State codes are
            TriageNow&apos;s mapping — instances configure their own choice values.
          </div>
          <button className="secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export { STATUSES, formatDateTime };
