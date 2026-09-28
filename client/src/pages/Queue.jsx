/**
 * Agent Workspace — the staff surface.
 *
 * Split pane: a priority-ordered queue on the left, the full Case cockpit on
 * the right. The queue sorts by **priority** first (which already encodes
 * urgency x impact), then urgency, then oldest first — the order a real agent
 * works a queue in, rather than raw urgency.
 *
 * Label note: the previous build called the assist buttons "GenAI" and "AI
 * Copilot". They fill templates selected by rules; this build says so. Nothing
 * on this screen claims a model made a judgement.
 *
 * Role note: escalation is NOT offered to a provider. A provider's job is to
 * resolve the Case, so they get a set of resolution actions matched to the
 * situation (see `resolvePresets` in the engine) instead of a control that
 * hands the work back. Escalate stays on the mediator's surface only, which is
 * what auth/roles.js has always said.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE, visibleGroups } from '../auth/roles.js';
import { staffRoster } from '../auth/accounts.js';

import {
  ASSIGNMENT_GROUPS,
  listCasesByGroup,
  updateCaseStatus,
  addCaseNote,
  escalateCase,
  subscribeToCaseEvents,
} from '../api.js';
import {
  ImpactBadge,
  PriorityBadge,
  SentimentBadge,
  ServiceNowModal,
  SlaPill,
  StatusBadge,
  StudentAvatar,
  UrgencyBadge,
} from '../components/ui.jsx';
import ActivityTimeline from '../components/ActivityTimeline.jsx';
import PriorityMatrix from '../components/PriorityMatrix.jsx';
import SlaRing from '../components/SlaRing.jsx';
import RoutingFlow from '../components/RoutingFlow.jsx';
import { EmptyState, SkeletonList } from '../components/Skeleton.jsx';
import { formatDateTime } from '../format.js';
import { reportQueueUrgency } from '../lib/liveStatus.js';
import {
  generateNowAssistDraft,
  generateExecutiveSummary,
  analyzeCaseIntent,
  resolvePresets,
} from '../../../server/src/triage/nowAssistEngine.js';
import { IMPACTS } from '../../../server/src/triage/priorityMatrix.js';

/**
 * Assignable staff, DERIVED from the seeded provider accounts rather than a
 * hardcoded array, so the login screen and this dropdown cannot invent
 * different people.
 */
const STAFF_MEMBERS = staffRoster();

const SLA_WINDOW = { High: 2, Medium: 24, Low: 72 };

export default function Queue() {
  const { group } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();

  const isProvider = session?.role === ROLE.PROVIDER;
  const isMediator = session?.role === ROLE.MEDIATOR;
  const openableGroups = visibleGroups(session, ASSIGNMENT_GROUPS);

  /**
   * A provider session can only ever open its own assignmentGroup. "All" is a
   * supervisor's view, so it collapses to their group rather than being shown
   * and then emptied — a scoping rule that is stated, not implied.
   */
  const activeGroup = isProvider
    ? session.group
    : group === 'All' || ASSIGNMENT_GROUPS.includes(group)
    ? group
    : 'All';

  /** Who this session acts as, in the activity stream. */
  const actor = session?.alias || 'Staff Agent';

  const [cases, setCases] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterText, setFilterText] = useState('');
  const [filterChip, setFilterChip] = useState('All');

  const [noteType, setNoteType] = useState('work_note');
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [activityTab, setActivityTab] = useState('all');
  const [checkedSteps, setCheckedSteps] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [templateNotice, setTemplateNotice] = useState('');
  const [flashedId, setFlashedId] = useState(null);
  const [applyingId, setApplyingId] = useState(null);

  /**
   * The composer lives at the very bottom of the cockpit, thousands of pixels
   * below the buttons that fill it. Writing into it without moving the viewport
   * is indistinguishable from a button that does nothing — which is exactly how
   * this was reported. Every insert now moves to the composer and takes focus.
   */
  const composerRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listCasesByGroup(activeGroup);
      setCases(data);
      reportQueueUrgency(data);
      if (data.length > 0) setSelectedId((current) => current || data[0]._id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    // `openableGroups` is derived from `session`, so this list is stable for a
    // given sign-in; included here so the lint rule and the reviewer agree.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup]);

  useEffect(() => {
    load();
  }, [load]);

  // Live push from the API, so a new Case appears in the queue mid-demo.
  useEffect(() => {
    const unsubscribe = subscribeToCaseEvents(({ type, data }) => {
      if (type === 'case_created') {
        if (activeGroup === 'All' || data.assignmentGroup === activeGroup) {
          setCases((prev) => {
            const next = [data, ...prev.filter((c) => c._id !== data._id)];
            reportQueueUrgency(next);
            return next;
          });
          setFlashedId(data._id);
          setTimeout(() => setFlashedId(null), 1200);
        }
      } else if (type === 'case_updated') {
        setCases((prev) => {
          const next = prev.map((c) => (c._id === data._id ? { ...c, ...data } : c));
          reportQueueUrgency(next);
          return next;
        });
        setFlashedId(data._id);
        setTimeout(() => setFlashedId(null), 1200);
      }
    });
    return () => unsubscribe();
  }, [activeGroup]);

  const selected = cases.find((c) => c._id === selectedId) || cases[0] || null;
  const analysis = selected ? analyzeCaseIntent(selected.description, selected.category) : null;

  /**
   * Situations this provider can resolve, and — importantly — the situations
   * they cannot. Escalation is a mediator capability, so the only upward path
   * offered here is a request for review, which changes nothing but the record.
   */
  const presets = useMemo(
    () => (selected && !isMediator ? resolvePresets(selected) : []),
    [selected, isMediator]
  );

  const priorityCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const item of cases) if (item.priority) counts[item.priority] += 1;
    return counts;
  }, [cases]);

  const filtered = cases.filter((item) => {
    const text = filterText.toLowerCase();
    const matchesText =
      !text ||
      String(item.studentAlias).toLowerCase().includes(text) ||
      String(item.description).toLowerCase().includes(text) ||
      String(item.category).toLowerCase().includes(text);

    const matchesChip =
      filterChip === 'All' ||
      (filterChip === 'High' && item.urgency === 'High') ||
      (filterChip === 'P1' && item.priority === 1) ||
      (filterChip === 'AtRisk' &&
        new Date(item.slaTarget) < new Date(Date.now() + 60 * 60 * 1000) &&
        item.status !== 'Resolved') ||
      (filterChip === 'Unassigned' && (!item.assignedTo || item.assignedTo === 'Unassigned'));

    return matchesText && matchesChip;
  });

  function replaceCase(updated) {
    setCases((prev) => {
      const next = prev.map((c) => (c._id === updated._id ? updated : c));
      reportQueueUrgency(next);
      return next;
    });
    setFlashedId(updated._id);
    setTimeout(() => setFlashedId(null), 1200);
  }

  async function handleStatusChange(status) {
    if (!selected) return;
    try {
      replaceCase(await updateCaseStatus(selected._id, { status, author: actor }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAssigneeChange(assignedTo) {
    if (!selected) return;
    try {
      replaceCase(
        await updateCaseStatus(selected._id, {
          assignedTo,
          status:
            selected.status === 'New' && assignedTo !== 'Unassigned' ? 'Assigned' : selected.status,
          author: actor,
        })
      );
    } catch (err) {
      setError(err.message);
    }
  }

  /**
   * Impact override. Priority is deliberately NOT editable — it re-derives
   * from the matrix, which is why the control below is impact and not priority.
   */
  async function handleImpactChange(impact) {
    if (!selected || impact === selected.impact) return;
    try {
      replaceCase(await updateCaseStatus(selected._id, { impact, author: actor }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleEscalate() {
    if (!selected || !isMediator) return;
    try {
      replaceCase(await escalateCase(selected._id));
    } catch (err) {
      setError(err.message);
    }
  }

  /**
   * Move the viewport to the composer and put the caret in it.
   *
   * Deliberately synchronous, and deliberately not built on
   * `requestAnimationFrame`. Three things were each separately able to make
   * this look like a dead button:
   *
   *   - Nothing scrolled at all, so the text landed 3,000px below the fold.
   *   - `focus()` called after a smooth `scrollIntoView` CANCELS that scroll in
   *     Chromium, so the "obvious" order undoes itself.
   *   - A smooth scroll is an animation, and an animation needs a live
   *     compositor. Where there is not one the browser stays exactly where it
   *     was — silently.
   *
   * So: focus first, scroll second, and then check whether the scroll actually
   * moved anything. If it did not, snap instead of leaving the operator staring
   * at the button they just pressed.
   */
  function focusComposer() {
    const node = composerRef.current;
    if (!node) return;

    node.focus({ preventScroll: true });

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const startY = window.scrollY;
    node.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });

    if (reduced) return;
    window.setTimeout(() => {
      const current = composerRef.current;
      if (!current) return;
      if (Math.abs(window.scrollY - startY) < 2) {
        current.scrollIntoView({ behavior: 'auto', block: 'center' });
      }
    }, 240);
  }

  /**
   * Write into the composer, then GO TO IT. The scroll is the fix: the content
   * was always being written, it was just being written off-screen.
   */
  function insertIntoComposer(text, type, notice) {
    setNoteType(type);
    setNoteText(text);
    setTemplateNotice(notice);
    focusComposer();
  }

  /**
   * Apply a resolution preset: file the internal record, move the Case to the
   * status the preset owns, and pre-fill the matching student reply so the two
   * halves of the resolution cannot describe different outcomes.
   */
  async function handleApplyPreset(entry) {
    if (!selected || applyingId) return;
    setApplyingId(entry.id);
    setError('');
    try {
      let updated = await addCaseNote(selected._id, {
        type: 'work_note',
        author: actor,
        text: `${entry.label}\n${entry.detail}\n\n${entry.workNote}`,
      });
      if (entry.status && updated.status !== entry.status) {
        updated = await updateCaseStatus(updated._id, { status: entry.status, author: actor });
      }
      replaceCase(updated);
      insertIntoComposer(
        entry.studentReply,
        'comment',
        `“${entry.label}” filed as a Work Note and the Case moved to ${entry.status}. ` +
          'The student reply is drafted below — review it, then send.'
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setApplyingId(null);
    }
  }

  /**
   * The one upward path a provider legitimately has. It drafts a request for
   * the mediator — it does not raise the tier, compress the SLA, or change the
   * urgency, so a provider cannot escalate by calling it something else.
   */
  function handleAskMediator() {
    if (!selected) return;
    insertIntoComposer(
      'Request for mediator review.\n\n' +
        `Reason: <say which part of this Case ${session?.group || 'the group'} cannot resolve>\n\n` +
        'What has been attempted so far: <resolution already tried, and what the student said>',
      'work_note',
      'Request drafted below — replace the two placeholders with the real reason, then post it. ' +
        'This flags the Case for the supervisor; it does not change its tier.'
    );
  }

  async function handleSendNote(event) {
    event.preventDefault();
    if (!noteText.trim() || !selected) return;
    setSavingNote(true);
    try {
      // Author is the signed-in identity, not a generic label — an audit trail
      // that cannot say who wrote a Work Note is not an audit trail.
      replaceCase(await addCaseNote(selected._id, { type: noteType, author: actor, text: noteText }));
      setNoteText('');
      setTemplateNotice('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingNote(false);
    }
  }

  function handleInsertTemplate() {
    if (!selected) return;
    insertIntoComposer(
      generateNowAssistDraft(selected),
      'comment',
      `Public reply drafted from the top “${selected.category}” resolution for this Case — ` +
        'review it, then send.'
    );
  }

  function handleInsertSummary() {
    if (!selected) return;
    insertIntoComposer(
      generateExecutiveSummary(selected),
      'work_note',
      'Handoff summary assembled from stored Case fields. Edit before saving.'
    );
  }

  return (
    <div className="agent-workspace">
      <div className="workspace-header">
        <div className="workspace-title-area">
          <div className="workspace-badge">Agent Workspace</div>
          <h1 className="workspace-title">Service Operations</h1>
          <p className="workspace-subtitle">
            Priority-ordered queue, guided playbooks and the impact × urgency decision behind every
            routing choice
          </p>
        </div>

        <div className="workspace-actions">
          <button className="secondary btn-sm" type="button" onClick={load}>
            ↻ Refresh
          </button>
          <button
            className="btn-accent-sm"
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={!selected}
          >
            🔗 Table API request
          </button>
        </div>
      </div>

      {isProvider ? (
        <div className="group-scope-bar">
          <span className="group-scope-chip">{activeGroup}</span>
          <span className="hint">
            Scoped to your assignmentGroup. Moving a Case to another group is the mediator’s call.
          </span>
        </div>
      ) : (
        <div className="group-nav-tabs" role="tablist">
          {['All', ...openableGroups].map((g) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={g === activeGroup}
              className={`group-tab${g === activeGroup ? ' active' : ''}`}
              onClick={() => navigate(`/queue/${encodeURIComponent(g)}`)}
            >
              {g === 'All' ? 'All queues' : g}
            </button>
          ))}
        </div>
      )}

      {error && <div className="notice error">{error}</div>}

      <div className="workspace-split">
        {/* ------------------------------------------------------------ queue */}
        <div className="workspace-sidebar card">
          <div className="queue-controls">
            <input
              type="text"
              className="queue-search"
              placeholder="Search Cases, students or categories…"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
            <div className="filter-chips">
              {['All', 'P1', 'High', 'AtRisk', 'Unassigned'].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className={`chip${filterChip === chip ? ' active' : ''}`}
                  onClick={() => setFilterChip(chip)}
                >
                  {chip === 'AtRisk' ? '⚡ At risk' : chip}
                </button>
              ))}
            </div>
          </div>

          <div className="queue-meta-bar">
            <span>
              <strong>{filtered.length}</strong> Cases in queue
            </span>
            <span className="hint">Priority ordered</span>
          </div>

          {loading ? (
            <SkeletonList rows={4} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="✓"
              title="Nothing matches this view"
              hint="Clear the search or switch assignmentGroup tabs."
            />
          ) : (
            <div className="queue-list">
              {filtered.map((item) => {
                const overdue =
                  new Date(item.slaTarget) < new Date() && item.status !== 'Resolved';
                return (
                  <div
                    key={item._id}
                    className={`queue-card${selected && selected._id === item._id ? ' selected' : ''}${
                      overdue ? ' card-overdue' : ''
                    }${flashedId === item._id ? ' flash' : ''}`}
                    onClick={() => setSelectedId(item._id)}
                  >
                    <div className="queue-card-header">
                      <div className="queue-card-student">
                        <StudentAvatar name={item.studentAlias} />
                        <div>
                          <div className="card-student-name">{item.studentAlias}</div>
                          <div className="card-category-label">{item.category}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <PriorityBadge priority={item.priority} short />
                        <UrgencyBadge urgency={item.urgency} pulse={item.urgency === 'High'} />
                      </div>
                    </div>

                    <div className="card-desc-snippet">{item.description}</div>

                    <div className="queue-card-footer">
                      <StatusBadge status={item.status} />
                      <SlaPill slaTarget={item.slaTarget} status={item.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ----------------------------------------------------------- cockpit */}
        <div className="workspace-main">
          {!selected ? (
            <div className="card empty-panel">
              <h3>Select a Case from the queue</h3>
              <p>Priority derivation, Student 360 and the playbook load here.</p>
            </div>
          ) : (
            <div className="cockpit">
              <div className="card cockpit-header-card">
                <div className="cockpit-title-row">
                  <div>
                    <div className="case-ref-num">
                      CASE #{String(selected._id).slice(-6).toUpperCase()}
                      <span className="case-group-tag">· {selected.assignmentGroup}</span>
                      {selected.escalationLevel > 0 && (
                        <span className="escalation-tag">
                          Tier {selected.escalationLevel} escalated
                        </span>
                      )}
                    </div>
                    <h2 className="case-main-title">
                      {selected.category} — {selected.studentAlias}
                    </h2>
                  </div>

                  <div className="cockpit-quick-actions">
                    {/* Escalation is the mediator's protocol. A provider's
                        control is visibly different AND differently named, so
                        the two cannot be confused on a projector. */}
                    {isMediator ? (
                      <button
                        className="btn-danger-outline btn-sm"
                        type="button"
                        onClick={handleEscalate}
                        title="Expedite the SLA target and raise the escalation tier"
                      >
                        🚨 Escalate
                      </button>
                    ) : (
                      <>
                        <span className="resolve-role-hint">Provider · resolve</span>
                        <button
                          className="ghost-sm"
                          type="button"
                          onClick={handleAskMediator}
                          title="Draft a request for the mediator — does not change the tier"
                        >
                          🙋 Ask the mediator
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="cockpit-control-strip">
                  <div className="control-item">
                    <label htmlFor="cockpit-status">Status</label>
                    <select
                      id="cockpit-status"
                      className={`status-select status-select-${String(selected.status)
                        .replace(/\s+/g, '-')
                        .toLowerCase()}`}
                      value={selected.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                    >
                      {['New', 'Assigned', 'In Progress', 'Resolved'].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="control-item">
                    <label htmlFor="cockpit-assignee">Assigned staff</label>
                    <select
                      id="cockpit-assignee"
                      value={selected.assignedTo || 'Unassigned'}
                      onChange={(e) => handleAssigneeChange(e.target.value)}
                    >
                      {/* A provider assigns within their own group; a mediator
                          can hand a Case to any group's owner. */}
                      {(isProvider ? ['Unassigned', session.alias] : STAFF_MEMBERS).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="control-item">
                    <label htmlFor="cockpit-impact">Impact · sets priority</label>
                    <select
                      id="cockpit-impact"
                      value={selected.impact || 'Medium'}
                      onChange={(e) => handleImpactChange(e.target.value)}
                    >
                      {IMPACTS.map((i) => (
                        <option key={i} value={i}>
                          {i}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="control-item">
                    <label>Priority · derived</label>
                    <div>
                      <PriorityBadge priority={selected.priority} />
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 'var(--s-5)' }}>
                  <SlaRing
                    slaTarget={selected.slaTarget}
                    urgency={selected.urgency}
                    status={selected.status}
                  />
                </div>
              </div>

              <div className="cockpit-grid-two">
                <div className="card student-360-card">
                  <div className="card-subhead">Student 360</div>
                  <div className="student-profile-header">
                    <StudentAvatar name={selected.studentAlias} />
                    <div>
                      <div className="profile-name">{selected.studentAlias}</div>
                      <div className="profile-meta">
                        {selected.studentProfile?.program || 'Undergraduate Studies'} ·{' '}
                        {selected.studentProfile?.year || 'Junior'}
                      </div>
                    </div>
                  </div>

                  <div className="profile-stats-grid">
                    <div className="profile-stat-box">
                      <div className="stat-label">GPA</div>
                      <div className="stat-val">{selected.studentProfile?.gpa || '—'}</div>
                    </div>
                    <div className="profile-stat-box">
                      <div className="stat-label">Prior cases</div>
                      <div className="stat-val">{selected.studentProfile?.priorCasesCount ?? 0}</div>
                    </div>
                    <div className="profile-stat-box">
                      <div className="stat-label">Risk profile</div>
                      <div className="stat-val risk-val" data-tier={selected.studentProfile?.riskTier}>
                        {selected.studentProfile?.riskTier || 'Standard'}
                      </div>
                    </div>
                  </div>

                  <div className="case-statement-box">
                    <div className="statement-label">Original statement</div>
                    <p className="statement-text">&ldquo;{selected.description}&rdquo;</p>
                  </div>

                  <div style={{ marginTop: 'var(--s-5)' }}>
                    <div className="card-subhead">Routing path</div>
                    <RoutingFlow
                      category={selected.category}
                      ruleValue={
                        Array.isArray(selected.matchedKeywords) && selected.matchedKeywords.length > 0
                          ? `${selected.matchedKeywords.length} trigger${
                              selected.matchedKeywords.length > 1 ? 's' : ''
                            }`
                          : 'no triggers'
                      }
                      assignmentGroup={selected.assignmentGroup}
                      urgency={selected.urgency}
                      slaHours={SLA_WINDOW[selected.urgency]}
                      priority={selected.priority}
                      compact
                    />
                  </div>
                </div>

                <div className="card now-assist-card">
                  <div className="card-subhead-ai">
                    <span>Triage engine insights</span>
                    <span className="confidence-pill">
                      {selected.confidence || analysis?.confidence || '—'} certainty
                    </span>
                  </div>

                  <div className="ai-insight-row">
                    <div className="insight-label">Sentiment</div>
                    <SentimentBadge sentiment={selected.sentiment || analysis?.sentiment} />
                  </div>

                  <div className="ai-insight-row">
                    <div className="insight-label">Intent</div>
                    <div className="intent-val">{selected.intent || analysis?.intent}</div>
                  </div>

                  <div className="ai-insight-row">
                    <div className="insight-label">Impact × urgency</div>
                    <div className="intent-val">
                      {selected.impact} × {selected.urgency} → P{selected.priority}
                    </div>
                  </div>

                  {Array.isArray(selected.matchedKeywords) && selected.matchedKeywords.length > 0 && (
                    <div className="ai-insight-row">
                      <div className="insight-label">Matched triggers</div>
                      <div className="trigger-chips">
                        {selected.matchedKeywords.map((keyword) => (
                          <span key={keyword} className="trigger-chip">
                            #{keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="ai-action-buttons">
                    <button className="ai-btn" type="button" onClick={handleInsertTemplate}>
                      Insert response template
                    </button>
                    <button className="ai-btn-secondary" type="button" onClick={handleInsertSummary}>
                      Summarise for handoff
                    </button>
                  </div>

                  {/* Confirmation next to the button that was pressed. The
                      composer is far down the page; a notice that only renders
                      there reads as nothing having happened. */}
                  {templateNotice && (
                    <div className="assist-notice" role="status">
                      <span className="assist-notice-text">{templateNotice}</span>
                      <button type="button" className="assist-notice-jump" onClick={focusComposer}>
                        Go to composer ↓
                      </button>
                    </div>
                  )}

                  <div className="hint" style={{ marginTop: 'var(--s-3)' }}>
                    Classification is deterministic keyword matching — no model call, no
                    hallucination path. See <strong>Assignment Rules</strong> for the config behind it.
                  </div>
                </div>
              </div>

              {/* -------------------------------------------- resolution actions */}
              {!isMediator && presets.length > 0 && (
                <div className="card resolve-card">
                  <div className="resolve-head">
                    <div>
                      <div className="card-subhead">Resolve this Case</div>
                      <p className="resolve-sub">
                        Actions for <strong>{selected.category}</strong> at{' '}
                        <strong>{analysis?.sentiment}</strong> sentiment. Each one files the internal
                        Work Note, sets the status, and drafts the student reply that says the same
                        thing — so the record and the message cannot disagree.
                      </p>
                    </div>
                    <span className="resolve-badge">
                      {analysis?.crisisDetected || selected.urgency === 'High'
                        ? 'Elevated case'
                        : 'Standard case'}
                    </span>
                  </div>

                  <div className="resolve-actions">
                    {presets.map((entry) => (
                      <div
                        key={entry.id}
                        className={`resolve-action${entry.status === 'Resolved' ? ' resolve-action-closing' : ''}`}
                      >
                        <div className="resolve-action-body">
                          <div className="resolve-action-label">{entry.label}</div>
                          <div className="resolve-action-detail">{entry.detail}</div>
                        </div>
                        <div className="resolve-action-side">
                          <span
                            className={`badge badge-status-${entry.status
                              .toLowerCase()
                              .replace(/\s+/g, '-')}`}
                          >
                            {entry.status}
                          </span>
                          <button
                            type="button"
                            className="resolve-apply"
                            disabled={Boolean(applyingId)}
                            onClick={() => handleApplyPreset(entry)}
                          >
                            {applyingId === entry.id ? 'Applying…' : 'Apply'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="resolve-foot">
                    <span className="resolve-role-hint">Provider · resolve</span>
                    <span className="hint">
                      Escalation is not a provider action here — if this Case genuinely belongs
                      somewhere else, use <strong>Ask the mediator</strong> in the header and say why.
                    </span>
                  </div>
                </div>
              )}

              <div className="card">
                <div className="card-subhead">
                  Priority matrix — impact × urgency, with the live queue counted
                </div>
                <PriorityMatrix
                  matrix={undefined}
                  impact={selected.impact || 'Medium'}
                  urgency={selected.urgency}
                  counts={priorityCounts}
                  onPickImpact={handleImpactChange}
                />
                <div className="hint">
                  The current Case is marked. Click any row to override impact — priority
                  re-derives from the grid and the change is written to the activity stream.
                  Agents never set priority directly.
                </div>
              </div>

              {analysis && analysis.playbook && (
                <div className="card playbook-card">
                  <div className="card-subhead">
                    Guided playbook — {selected.category}
                  </div>
                  <div className="playbook-steps">
                    {analysis.playbook.map((step) => {
                      const key = `${selected._id}_step_${step.step}`;
                      const checked = Boolean(checkedSteps[key]);
                      return (
                        <label key={step.step} className={`playbook-step-row${checked ? ' completed' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setCheckedSteps((prev) => ({ ...prev, [key]: e.target.checked }))
                            }
                          />
                          <span className="step-num">Step {step.step}</span>
                          <span className="step-text">{step.text}</span>
                          {step.required && <span className="required-tag">Mandatory</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="card activity-card">
                <div className="activity-tabs-row">
                  <div className="card-subhead">Activity stream</div>
                  <div className="activity-tabs">
                    {[
                      ['all', `All activity (${selected.activityStream?.length || 0})`],
                      ['work_notes', '🔒 Work notes (staff only)'],
                      ['comments', '💬 Public comments'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={`act-tab${activityTab === value ? ' active' : ''}`}
                        onClick={() => setActivityTab(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ maxHeight: 380, overflowY: 'auto', marginBottom: 'var(--s-4)' }}>
                  <ActivityTimeline
                    items={selected.activityStream || []}
                    filter={activityTab}
                    flashIndex={flashedId === selected._id ? 0 : null}
                    emptyText="No activity of this kind on the Case yet."
                  />
                </div>

                <form className="activity-compose-form" onSubmit={handleSendNote}>
                  {templateNotice && (
                    <div className="notice ok ai-notice">
                      {templateNotice}{' '}
                      <strong>
                        Nothing is posted until you press the button below.
                      </strong>
                    </div>
                  )}

                  <div className="compose-type-toggle">
                    <button
                      type="button"
                      className={`toggle-btn${noteType === 'work_note' ? ' active-worknote' : ''}`}
                      onClick={() => setNoteType('work_note')}
                    >
                      🔒 Work note — internal
                    </button>
                    <button
                      type="button"
                      className={`toggle-btn${noteType === 'comment' ? ' active-comment' : ''}`}
                      onClick={() => setNoteType('comment')}
                    >
                      💬 Public comment — visible to student
                    </button>
                  </div>

                  <textarea
                    ref={composerRef}
                    rows={4}
                    placeholder={
                      noteType === 'work_note'
                        ? 'Private handoff notes, safety checks, audit detail…'
                        : 'Reply visible to the student on their Case tracker…'
                    }
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    required
                  />

                  <div className="compose-actions-bar">
                    <span className="hint">
                      {noteType === 'work_note'
                        ? 'Internal note — never shown to the student.'
                        : 'Public comment — posted to the student tracker immediately.'}
                    </span>
                    <button type="submit" disabled={savingNote || !noteText.trim()}>
                      {savingNote
                        ? 'Saving…'
                        : noteType === 'work_note'
                        ? 'Post work note'
                        : 'Send comment'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="hint">
                Case raised {formatDateTime(selected.createdAt)} · last updated{' '}
                {formatDateTime(selected.updatedAt)}
              </div>
            </div>
          )}
        </div>
      </div>

      <ServiceNowModal isOpen={modalOpen} onClose={() => setModalOpen(false)} kase={selected} />
    </div>
  );
}
