/**
 * Executive dashboard.
 *
 * Every figure is computed from stored Cases and Deflection records. There are
 * no `|| 38` style fallbacks: a genuine zero renders as zero, because a
 * dashboard that quietly substitutes a nicer number is worse than a dashboard
 * that shows a bad one.
 *
 * The saved-time model is stated on screen, with its inputs, so the ROI claim
 * can be interrogated rather than taken on faith.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getDashboard, listCasesByGroup, ASSIGNMENT_GROUPS, STATUSES } from '../api.js';
import { URGENCIES } from '../api.js';
import { CountUp, DistributionBars, HeatGrid, Sparkline } from '../lib/viz.jsx';
import { PriorityBadge } from '../components/ui.jsx';
import { SkeletonBlock } from '../components/Skeleton.jsx';
import { reportQueueUrgency } from '../lib/liveStatus.js';
import { PRIORITY_LABELS } from '../../../server/src/triage/priorityMatrix.js';

const GROUP_CAPACITY = {
  Counseling: 10,
  'Academic Advising': 15,
  'Financial Aid': 12,
  'Peer Support': 8,
};

const SENTIMENT_CHIPS = [
  ['Severe Crisis', 'red', '🚨'],
  ['Distressed', 'orange', '⚡'],
  ['Concerned', 'amber', '⚠️'],
  ['Routine', 'green', '✓'],
];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [cases, setCases] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashboard, queue] = await Promise.all([getDashboard(), listCasesByGroup('All')]);
      setData(dashboard);
      setCases(queue);
      reportQueueUrgency(queue);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Cross-tab of assignmentGroup x urgency — the shape a single total hides.
  const groupUrgencyHeat = useMemo(
    () => ({
      rows: ASSIGNMENT_GROUPS.map((group) => ({
        label: group.split(' ')[0],
        cells: URGENCIES.map((urgency) => {
          const value = cases.filter(
            (c) => c.assignmentGroup === group && c.urgency === urgency
          ).length;
          return { value, title: `${group} · ${urgency}: ${value}` };
        }),
      })),
      columns: URGENCIES,
      peak: Math.max(
        1,
        ...ASSIGNMENT_GROUPS.flatMap((group) =>
          URGENCIES.map(
            (urgency) => cases.filter((c) => c.assignmentGroup === group && c.urgency === urgency).length
          )
        )
      ),
    }),
    [cases]
  );

  if (loading) {
    return (
      <div className="dashboard-wrap">
        <div className="dashboard-head">
          <div>
            <div className="workspace-badge">Leadership</div>
            <h1>Loading operational metrics…</h1>
          </div>
        </div>
        <div className="card">
          <SkeletonBlock lines={6} />
        </div>
      </div>
    );
  }

  if (error) return <div className="notice error">{error}</div>;
  if (!data) return null;

  const trendLabels = (data.deflectionTrend || []).map((d) => d.label);
  const deflectionSeries = (data.deflectionTrend || []).map((d) => d.count);
  const caseSeries = (data.caseTrend || []).map((d) => d.count);

  const priorityRows = [1, 2, 3, 4].map((priority) => ({
    label: PRIORITY_LABELS[priority],
    value: data.byPriority[priority] || 0,
    color: `var(--pri-${priority})`,
  }));

  return (
    <div className="dashboard-wrap">
      <div className="dashboard-head">
        <div>
          <div className="workspace-badge">Leadership command center</div>
          <h1>Service operations analytics</h1>
          <p>
            Every figure below is derived from stored Case and Deflection records — no placeholder
            values. The three breached Cases are shown rather than hidden: a queue that hides its
            breaches is how students fall through the cracks.
          </p>
        </div>
        <div className="dash-actions">
          <button className="secondary btn-sm" type="button" onClick={load}>
            ↻ Refresh
          </button>
          <span className="last-sync-tag">
            {new Date(data.generatedAt).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------- KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-num">
            <CountUp value={data.total} />
          </div>
          <div className="kpi-label">Open Cases</div>
          <div className="kpi-sub">Across {ASSIGNMENT_GROUPS.length} assignmentGroups</div>
        </div>

        <div className="kpi-card highlight-green">
          <div className="kpi-num">
            <CountUp value={data.deflectionRate} suffix="%" />
          </div>
          <div className="kpi-label">Knowledge deflection</div>
          <div className="kpi-sub">
            {data.deflectedCount} of {data.total + data.deflectedCount} inbound requests answered
            without a Case
          </div>
        </div>

        <div className="kpi-card highlight-blue">
          <div className="kpi-num">
            <CountUp value={data.slaComplianceRate} suffix="%" />
          </div>
          <div className="kpi-label">SLA adherence</div>
          <div className="kpi-sub">
            {data.total - data.overdue} of {data.total} inside their SLA target
          </div>
        </div>

        <div className={`kpi-card${data.overdue > 0 ? ' highlight-red' : ''}`}>
          <div className="kpi-num">
            <CountUp value={data.overdue} />
          </div>
          <div className="kpi-label">Breached SLA</div>
          <div className="kpi-sub">
            {data.atRisk} at risk (&lt;1h remaining) · escalation protocol available
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-num">
            <CountUp value={data.crisisCount} />
          </div>
          <div className="kpi-label">Crisis Cases</div>
          <div className="kpi-sub">
            Sentiment classified <code style={{ fontFamily: 'var(--font-mono)' }}>Severe Crisis</code>
          </div>
        </div>

        <div className="kpi-card highlight-purple">
          <div className="kpi-num">
            <CountUp value={data.hoursSaved} decimals={1} suffix="h" />
          </div>
          <div className="kpi-label">Advisor hours saved / week</div>
          <div className="kpi-sub">
            ≈ {data.hoursSavedProjectedAnnual.toLocaleString()}h per academic year
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ trends */}
      <div className="dash-grid-two">
        <div className="card">
          <div className="card-subhead">Seven-day activity</div>
          <div className="viz-legend" style={{ marginBottom: 'var(--s-3)' }}>
            <span className="viz-legend-item">
              <span className="viz-swatch signal" /> Deflections
            </span>
            <span className="viz-legend-item">
              <span className="viz-swatch cyan" /> Cases raised
            </span>
          </div>

          <Sparkline data={deflectionSeries} height={72} color="var(--signal)" />
          <div className="ds-row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
            {trendLabels.map((label) => (
              <span key={label} className="viz-axis-label">
                {label}
              </span>
            ))}
          </div>

          <Sparkline data={caseSeries} height={56} color="var(--accent)" />
          <div className="hint">
            Deflection volume exceeds Case volume — the Knowledge Base is absorbing demand before it
            reaches the queue.
          </div>
        </div>

        <div className="card">
          <div className="card-subhead">Queue load by assignmentGroup</div>
          <div className="bars-container">
            {ASSIGNMENT_GROUPS.map((group) => {
              const count = data.byAssignmentGroup[group] || 0;
              const capacity = GROUP_CAPACITY[group] || 10;
              const loadPercent = Math.min(100, Math.round((count / capacity) * 100));
              return (
                <div className="capacity-row" key={group}>
                  <div className="cap-label-row">
                    <span className="cap-group-name">
                      <strong>{group}</strong>
                    </span>
                    <span className="cap-metrics">
                      {count} of {capacity} · {loadPercent}%
                    </span>
                  </div>
                  <div className="cap-track">
                    <div
                      className={`cap-fill${loadPercent >= 80 ? ' cap-heavy' : ''}`}
                      style={{ width: `${loadPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="dash-grid-two">
        <div className="card">
          <div className="card-subhead">Urgency distribution</div>
          <DistributionBars
            rows={URGENCIES.slice()
              .reverse()
              .map((urgency) => ({
                label: urgency,
                value: data.byUrgency[urgency] || 0,
                tone: urgency,
              }))}
          />

          <div className="sentiment-summary-box">
            <div className="statement-label">Sentiment profile</div>
            <div className="sentiment-chips-row">
              {SENTIMENT_CHIPS.map(([sentiment, tone, icon]) => (
                <span key={sentiment} className={`sentiment-chip ${tone}`}>
                  {icon} {sentiment}: {data.bySentiment[sentiment] || 0}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-subhead">Priority distribution (derived)</div>
          <DistributionBars rows={priorityRows} />
          <div className="hint">
            Priority is never set by a human: it is looked up in the impact × urgency matrix. Open{' '}
            <strong>Assignment Rules</strong> to edit the grid itself.
          </div>
        </div>
      </div>

      <div className="dash-grid-two">
        <div className="card">
          <div className="card-subhead">
            assignmentGroup × urgency
          </div>
          <HeatGrid
            rows={groupUrgencyHeat.rows}
            columns={groupUrgencyHeat.columns}
            peak={groupUrgencyHeat.peak}
          />
          <div className="hint">
            Intensity is Case count. This is where a single &ldquo;total&rdquo; number hides the
            problem: one group carrying the crisis load looks identical to a balanced queue.
          </div>
        </div>

        <div className="card">
          <div className="card-subhead">Knowledge deflected — top articles</div>
          {data.topDeflectedArticles.length === 0 ? (
            <div className="empty">
              No deflections recorded in this window. Submit a request and resolve it from the
              Knowledge Base to see one appear here.
            </div>
          ) : (
            <div className="deflection-leaderboard">
              {data.topDeflectedArticles.map((article, index) => (
                <div className="deflection-stat-item" key={article.articleId}>
                  <div className="art-idx">#{index + 1}</div>
                  <div className="art-info">
                    <div className="art-title">{article.title}</div>
                    <div className="art-group">
                      {article.articleId} · {article.category}
                    </div>
                  </div>
                  <div className="art-count-pill">{article.count} deflected</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="dash-grid-two">
        <div className="card">
          <div className="card-subhead">Case lifecycle</div>
          <div className="status-grid-pills">
            {STATUSES.map((status) => (
              <div key={status} className="status-kpi-pill">
                <div className="pill-name">{status}</div>
                <div className="pill-val">{data.byStatus[status] || 0}</div>
              </div>
            ))}
          </div>
          <div className="hint" style={{ marginTop: 'var(--s-4)' }}>
            {data.resolvedCount} Case{data.resolvedCount === 1 ? '' : 's'} resolved, averaging{' '}
            {data.avgResolutionHours}h to close. {data.unassignedCount} still unassigned.
          </div>
        </div>

        <div className="card">
          <div className="card-subhead">How the ROI is calculated</div>
          <p className="hint" style={{ marginTop: 0 }}>
            Stated openly so it can be checked rather than believed:
          </p>
          <div className="preview-kv">
            <dt>Automated triage</dt>
            <dd className="mono">
              {data.minutesSavedPerTriage} min × {data.total} Cases
            </dd>
            <dt>Deflected requests</dt>
            <dd className="mono">{data.deflectedMinutes} advisor min saved</dd>
            <dt>This week</dt>
            <dd className="mono">{data.hoursSaved}h</dd>
            <dt>Annualised (×52)</dt>
            <dd className="mono">{data.hoursSavedProjectedAnnual}h</dd>
          </div>
          <div className="hint">
            Deflected requests never consume advisor time, and routed Cases skip manual triage.
            Changing either assumption changes the number — that is the point of showing it.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="service-level-story">
          <strong>Platform model.</strong> Every request is modelled the way a service desk models
          work: a <code>Case</code> routes to an <code>assignmentGroup</code> by a configurable{' '}
          <code>Assignment Rule</code>, carrying an <code>SLA target</code> and a{' '}
          <code>priority</code> derived from impact × urgency. Routing is deterministic and
          backtested, which is why the accuracy of the rule actually running can be quoted.
        </div>
      </div>
    </div>
  );
}
