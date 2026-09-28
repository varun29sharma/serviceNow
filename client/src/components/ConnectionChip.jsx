/**
 * Connection chrome — the honest status readout, in two sizes.
 *
 * Extracted from App.jsx when Home stopped wearing the app shell. Home has no
 * top bar by design, but it is exactly the page a first-time visitor lands on,
 * so it still has to be able to say "no API answered, the in-browser engine is
 * running". Both surfaces therefore render this component rather than each
 * keeping a copy of the wording — same reason lib/connection.js owns the
 * strings in the first place.
 *
 * <ConnectionChip />      compact, for a corner
 * <ConnectionBanner />    a full-width explanation, dismissible
 */
import { useState } from 'react';

import { chooseMode, describeConnection, reconnect, useConnection, MODE } from '../lib/connection.js';
import { resetDemoData } from '../demoApi.js';

/** Small pill: brand mark on the left, honest mode on the right. */
export function ConnectionChip({ className = '' }) {
  const connection = useConnection();
  const status = describeConnection(connection);
  const offline = connection.mode === MODE.DEMO;

  if (!connection.checked) {
    return (
      <span className={`conn-chip conn-chip-checking ${className}`} title="Asking the API whether it is running">
        <span className="conn-dot" />
        checking…
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`conn-chip conn-chip-${status.tone} ${className}`}
      title={`${status.title} — click to switch backend`}
      onClick={() => chooseMode(offline ? MODE.LIVE : MODE.DEMO)}
    >
      <span className="conn-dot" />
      {status.short}
    </button>
  );
}

/**
 * The banner. Only renders when there is something worth explaining, which
 * means: we are offline. A working live connection explains nothing.
 */
export function ConnectionBanner({ onDismiss }) {
  const connection = useConnection();
  const status = describeConnection(connection);
  if (connection.mode !== MODE.DEMO) return null;

  return (
    <div className={`conn-banner conn-banner-${status.tone}`}>
      <span className="conn-banner-text">{status.detail}</span>
      <span className="conn-banner-actions">
        {connection.reachable === 'unreachable' && (
          <button className="ghost conn-btn" type="button" onClick={() => reconnect()}>
            ↻ Reconnect
          </button>
        )}
        <button
          className="ghost conn-btn"
          type="button"
          onClick={() => {
            resetDemoData();
            window.location.reload();
          }}
        >
          Reset demo data
        </button>
        {onDismiss && (
          <button
            className="ghost conn-btn"
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss connection notice"
          >
            ✕
          </button>
        )}
      </span>
    </div>
  );
}

/** Convenience: a banner that remembers being dismissed for this tab. */
export function DismissibleConnectionBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return <ConnectionBanner onDismiss={() => setDismissed(true)} />;
}
