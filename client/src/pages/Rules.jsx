/**
 * Assignment Rules Console.
 *
 * The centrepiece of the product, and the answer to "is routing configurable
 * or hardcoded?" — in ServiceNow, routing logic is a record an admin edits, not
 * code that ships. This screen edits it at runtime.
 *
 * Three things make it more than a settings page:
 *
 * 1. The score strip. The draft config is scored against the same 36 labelled
 *    Cases the CLI harness uses — computed locally, so it re-scores on every
 *    keystroke with no round trip. Edit a weight and watch accuracy move.
 * 2. The Rule Tester. Paste a description, see the routing decision, and see
 *    the path it took. Tests UNSAVED edits.
 * 3. The queue diff. "N of 13 Cases would route differently" — computed by
 *    replaying every live Case through the draft config.
 *
 * Validation runs locally too, so the fixed ServiceNow vocabulary cannot be
 * corrupted from this screen.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ASSIGNMENT_GROUPS,
  CATEGORIES,
  getRules,
  listCasesByGroup,
  previewRule,
  resetRules,
  saveRules,
} from '../api.js';
import { validateConfig, groupKeywords, TIER_LABELS } from '../../../server/src/rules/ruleSchema.js';
import { scoreCases } from '../../../server/src/rules/backtestScorePure.js';
import { BACKTEST_CASES } from '../lib/backtestCases.generated.js';
import {
  IMPACTS,
  URGENCY_KEYS,
  DEFAULT_PRIORITY_MATRIX,
} from '../../../server/src/triage/priorityMatrix.js';
import RoutingFlow from '../components/RoutingFlow.jsx';
import { SkeletonBlock } from '../components/Skeleton.jsx';

const SCORE_FIELDS = [
  { key: 'exact', label: 'Exact match', format: (m) => `${m.exact}/${m.n}` },
  { key: 'highRecallPct', label: 'High-urgency recall', format: (m) => `${m.highRecallPct}%` },
  { key: 'highPrecisionPct', label: 'High precision', format: (m) => `${m.highPrecisionPct}%` },
  { key: 'withinOnePct', label: 'Within one level', format: (m) => `${m.withinOnePct}%` },
];

function tone(current, baseline, key) {
  if (!current || !baseline) return '';
  const a = key === 'exact' ? current.exact : current[key];
  const b = key === 'exact' ? baseline.exact : baseline[key];
  if (a > b) return 'better';
  if (a < b) return 'worse';
  return '';
}

export default function Rules() {
  const [snapshot, setSnapshot] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [previewCategory, setPreviewCategory] = useState('Academic');
  const [previewText, setPreviewText] = useState(
    'I am failing two classes and I am urgently behind on my coursework.'
  );
  const [previewResult, setPreviewResult] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [travelKey, setTravelKey] = useState(0);

  const [diff, setDiff] = useState(null);
  const [diffRunning, setDiffRunning] = useState(false);

  const [newKeyword, setNewKeyword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getRules();
      setSnapshot(data);
      setDraft(JSON.parse(JSON.stringify(data.active)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Validation and scoring both run locally: instant feedback, and the console
  // still works with no server at all (offline demo is the stage surface).
  const validationErrors = useMemo(() => (draft ? validateConfig(draft) : []), [draft]);

  const draftScore = useMemo(() => {
    if (!draft || validationErrors.length > 0) return null;
    return scoreCases(BACKTEST_CASES, draft);
  }, [draft, validationErrors.length]);

  const dirty = useMemo(
    () => Boolean(snapshot && draft) && JSON.stringify(snapshot.active) !== JSON.stringify(draft),
    [snapshot, draft]
  );

  const keywordGroups = useMemo(() => groupKeywords((draft && draft.keywords) || {}), [draft]);

  // ---------------------------------------------------------------- mutations
  function setRule(category, group) {
    setDraft((d) => ({ ...d, assignmentRule: { ...d.assignmentRule, [category]: group } }));
  }

  function setWeight(keyword, raw) {
    const value = raw === '' ? 0 : Math.max(0, Math.min(5, Number(raw)));
    setDraft((d) => ({ ...d, keywords: { ...d.keywords, [keyword]: value } }));
  }

  function removeKeyword(keyword) {
    setDraft((d) => {
      const next = { ...d.keywords };
      delete next[keyword];
      return { ...d, keywords: next };
    });
  }

  function addKeyword() {
    const keyword = newKeyword.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!keyword) return;
    setDraft((d) => ({ ...d, keywords: { ...d.keywords, [keyword]: 1 } }));
    setNewKeyword('');
  }

  function setThreshold(key, raw) {
    const value = raw === '' ? 0 : Math.max(0, Math.min(20, Math.round(Number(raw))));
    setDraft((d) => ({ ...d, thresholds: { ...d.thresholds, [key]: value } }));
  }

  function setMatrixCell(impact, urgency, raw) {
    const value = Math.max(1, Math.min(4, Math.round(Number(raw))));
    setDraft((d) => ({
      ...d,
      priorityMatrix: { ...d.priorityMatrix, [impact]: { ...d.priorityMatrix[impact], [urgency]: value } },
    }));
  }

  function setBaseUrgency(category, urgency) {
    setDraft((d) => ({ ...d, categoryBaseUrgency: { ...d.categoryBaseUrgency, [category]: urgency } }));
  }

  // ------------------------------------------------------------------ actions
  async function handleSave() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const data = await saveRules(draft);
      setSnapshot(data);
      setDraft(JSON.parse(JSON.stringify(data.active)));
      setNotice(
        'Config saved. New Cases now route with these rules — the score strip shows what the change did.'
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const data = await resetRules();
      setSnapshot(data);
      setDraft(JSON.parse(JSON.stringify(data.active)));
      setNotice('Restored the backtest winner. This is the config the product ships with.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    setPreviewError('');
    setPreviewResult(null);
    try {
      const result = await previewRule(previewCategory, previewText, draft);
      setPreviewResult(result);
      setTravelKey((n) => n + 1);
    } catch (err) {
      setPreviewError(err.message);
    }
  }

  async function handleDiff() {
    setDiffRunning(true);
    setDiff(null);
    setError('');
    try {
      const cases = await listCasesByGroup('All');
      const evaluated = await Promise.all(
        cases.map(async (item) => {
          const result = await previewRule(item.category, item.description, draft);
          const changed =
            result.assignmentGroup !== item.assignmentGroup || result.urgency !== item.urgency;
          return {
            id: item._id,
            name: item.studentAlias,
            category: item.category,
            fromGroup: item.assignmentGroup,
            toGroup: result.assignmentGroup,
            fromUrgency: item.urgency,
            toUrgency: result.urgency,
            changed,
          };
        })
      );
      const changed = evaluated.filter((row) => row.changed);
      setDiff({ total: evaluated.length, changed });
    } catch (err) {
      setError(err.message);
    } finally {
      setDiffRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="rules-wrap">
        <div className="portal-head">
          <div className="portal-badge">Assignment Rules</div>
          <h1>Loading rule configuration…</h1>
        </div>
        <SkeletonBlock lines={6} />
      </div>
    );
  }

  if (!draft || !snapshot) {
    return <div className="notice error">{error || 'Could not load the rule configuration.'}</div>;
  }

  const shipped = snapshot.builtInScore;

  return (
    <div className="rules-wrap">
      <div className="portal-head">
        <div className="portal-badge">Assignment Rule · Configuration</div>
        <h1>Assignment Rules</h1>
        <p>
          Routing logic as a configurable record. Edit the category → assignmentGroup mapping, the
          keyword weights that drive urgency, the score thresholds, or the priority matrix and the
          queue re-routes immediately. The shipped config is the winner of our backtest, and every
          edit is re-scored against the same 36 labelled Cases.
        </p>
      </div>

      <div className="rules-banner">
        <div className="rules-banner-text">
          <strong>
            {snapshot.meta.isModified
              ? 'Running a modified config'
              : 'Running the backtest winner'}
          </strong>
          <p>
            {snapshot.meta.isModified
              ? 'Someone has edited these rules. Reset restores the config selected by the harness.'
              : `${snapshot.meta.keywordCount} scored keywords, ${CATEGORIES.length} category mappings, selected from 105 candidate configs.`}
          </p>
        </div>
        <button className="secondary btn-sm" type="button" onClick={handleReset} disabled={saving}>
          ↺ Reset to backtest winner
        </button>
      </div>

      {error && <div className="notice error">{error}</div>}
      {notice && <div className="notice ok">{notice}</div>}
      {validationErrors.length > 0 && (
        <div className="notice error">
          <strong>This config is not valid and cannot be saved:</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {validationErrors.slice(0, 6).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ---------------------------------------------------------- score strip */}
      <div className="card">
        <div className="card-subhead">
          Backtest score — {BACKTEST_CASES.length} labelled Cases, same harness as the CLI
        </div>

        <div className="rules-score-strip">
          {SCORE_FIELDS.map((field) => (
            <div key={field.key} className="rules-score-cell">
              <div className="rs-label">{field.label} · shipped</div>
              <div className="rs-val">{field.format(shipped)}</div>
            </div>
          ))}
        </div>

        <div className="rules-score-strip" style={{ marginBottom: 0 }}>
          {SCORE_FIELDS.map((field) => (
            <div
              key={field.key}
              className={`rules-score-cell ${tone(draftScore, shipped, field.key)}`}
            >
              <div className="rs-label">{field.label} · your edit</div>
              <div className="rs-val">{draftScore ? field.format(draftScore) : '—'}</div>
            </div>
          ))}
        </div>

        <div className="hint" style={{ marginTop: 'var(--s-4)' }}>
          Scoring runs in the browser against the same labelled set the harness uses, so the numbers
          update as you type. High-urgency recall is weighted heaviest — the costly error in triage
          is under-triaging someone in crisis, not over-triaging a routine question.
        </div>

        {draftScore && draftScore.misses.length > 0 && (
          <div className="diff-list">
            {draftScore.misses.slice(0, 6).map((miss) => (
              <div className="diff-row" key={miss.alias}>
                <span className="diff-name">
                  {miss.alias} · {miss.category}
                </span>
                <span className="diff-from">{miss.expected}</span>
                <span className="diff-to">{miss.got}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rules-grid">
        {/* ------------------------------------------------ category mapping */}
        <div className="card">
          <div className="card-subhead">Category → assignmentGroup</div>
          <table className="rule-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Base urgency</th>
                <th>Routes to</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((category) => (
                <tr key={category}>
                  <td>{category}</td>
                  <td>
                    <select
                      value={draft.categoryBaseUrgency[category]}
                      onChange={(e) => setBaseUrgency(category, e.target.value)}
                      aria-label={`Base urgency for ${category}`}
                    >
                      {['Low', 'Medium', 'High'].map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={draft.assignmentRule[category]}
                      onChange={(e) => setRule(category, e.target.value)}
                      aria-label={`assignmentGroup for ${category}`}
                    >
                      {ASSIGNMENT_GROUPS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="hint">
            The vocabulary is fixed: 5 categories and 4 assignmentGroups. Rules change the mapping,
            never the words.
          </div>
        </div>

        {/* --------------------------------------------------- thresholds */}
        <div className="card">
          <div className="card-subhead">Urgency thresholds</div>
          <div className="threshold-row">
            <div>
              <label htmlFor="th-high">Score for High</label>
              <input
                id="th-high"
                type="number"
                min="0"
                max="20"
                value={draft.thresholds.high}
                onChange={(e) => setThreshold('high', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="th-med">Score for Medium</label>
              <input
                id="th-med"
                type="number"
                min="0"
                max="20"
                value={draft.thresholds.medium}
                onChange={(e) => setThreshold('medium', e.target.value)}
              />
            </div>
          </div>
          <div className="hint">
            A description whose keyword score reaches <strong>{draft.thresholds.high}</strong> is
            triaged High; <strong>{draft.thresholds.medium}</strong> is Medium; below that the
            category&apos;s base urgency applies. Raise the High threshold and fewer Cases escalate.
          </div>

          <div className="card-subhead" style={{ marginTop: 'var(--s-6)' }}>
            Priority matrix (impact × urgency → priority)
          </div>
          <table className="rule-table">
            <thead>
              <tr>
                <th>Impact</th>
                {URGENCY_KEYS.map((u) => (
                  <th key={u}>{u} urgency</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {IMPACTS.map((impact) => (
                <tr key={impact}>
                  <td>{impact}</td>
                  {URGENCY_KEYS.map((urgency) => (
                    <td key={urgency}>
                      <select
                        value={(draft.priorityMatrix || DEFAULT_PRIORITY_MATRIX)[impact][urgency]}
                        onChange={(e) => setMatrixCell(impact, urgency, e.target.value)}
                        aria-label={`Priority for impact ${impact} and urgency ${urgency}`}
                      >
                        {[1, 2, 3, 4].map((p) => (
                          <option key={p} value={p}>
                            P{p}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="hint">
            Agents override <strong>impact</strong>; priority is always derived from this grid, never
            set directly.
          </div>
        </div>
      </div>

      {/* --------------------------------------------------- keyword weights */}
      <div className="card">
        <div className="card-subhead">
          Keyword weights — score = sum of matches · {Object.keys(draft.keywords).length} keywords
        </div>

        <div className="rules-grid">
          {['crisis', 'acute', 'pressure', 'disabled'].map((tier) => (
            <div className="weight-group" key={tier}>
              <div className="weight-group-title">
                <span>{TIER_LABELS[tier]}</span>
                <span className="wg-tier">{keywordGroups[tier].length}</span>
              </div>
              <div className="weight-list">
                {keywordGroups[tier].map(({ keyword, weight }) => (
                  <div className="weight-row" key={keyword}>
                    <span className="weight-key" title={keyword}>
                      {keyword}
                    </span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        max="5"
                        value={weight}
                        onChange={(e) => setWeight(keyword, e.target.value)}
                        aria-label={`Weight for ${keyword}`}
                      />
                      <button
                        type="button"
                        className="ghost-sm"
                        title={`Remove "${keyword}"`}
                        onClick={() => removeKeyword(keyword)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                {keywordGroups[tier].length === 0 && (
                  <div className="hint" style={{ marginTop: 0 }}>
                    No keywords in this tier.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="rules-actions">
          <input
            type="text"
            placeholder="Add a keyword or phrase…"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addKeyword();
              }
            }}
            style={{ maxWidth: 260 }}
          />
          <button className="secondary btn-sm" type="button" onClick={addKeyword}>
            ＋ Add keyword
          </button>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--s-2)' }}>
            <button
              className="secondary btn-sm"
              type="button"
              disabled={!dirty || saving}
              onClick={() => setDraft(JSON.parse(JSON.stringify(snapshot.active)))}
            >
              Discard edits
            </button>
            <button
              className="btn-accent-sm"
              type="button"
              disabled={!dirty || saving || validationErrors.length > 0}
              onClick={handleSave}
            >
              {saving ? 'Saving…' : dirty ? 'Save & re-score' : 'Saved'}
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------- rule tester */}
      <div className="rules-grid">
        <div className="card">
          <div className="card-subhead">Rule tester — test unsaved edits</div>

          <label htmlFor="preview-category">Category</label>
          <select
            id="preview-category"
            value={previewCategory}
            onChange={(e) => setPreviewCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <label htmlFor="preview-text">Description</label>
          <textarea
            id="preview-text"
            rows={4}
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
          />

          <div className="rules-actions">
            <button
              className="btn-accent-sm"
              type="button"
              onClick={handlePreview}
              disabled={validationErrors.length > 0}
            >
              ⚡ Preview routing decision
            </button>
          </div>

          {previewError && <div className="notice error" style={{ marginTop: 'var(--s-4)' }}>{previewError}</div>}

          {previewResult && (
            <div className="preview-result">
              <div className="preview-result-head">
                <strong style={{ color: 'var(--text-hi)' }}>Decision</strong>
                <span className="hint" style={{ marginTop: 0 }}>
                  {previewResult.crisisDetected ? '🚨 crisis language detected' : previewResult.sentiment}
                </span>
              </div>

              <dl className="preview-kv">
                <dt>assignmentGroup</dt>
                <dd>{previewResult.assignmentGroup}</dd>
                <dt>Urgency</dt>
                <dd>{previewResult.urgency}</dd>
                <dt>Impact</dt>
                <dd>{previewResult.impact}</dd>
                <dt>Priority</dt>
                <dd>P{previewResult.priority}</dd>
                <dt>SLA target</dt>
                <dd className="mono">{previewResult.slaHours}h</dd>
                <dt>Score</dt>
                <dd className="mono">{previewResult.score}</dd>
                <dt>Matched</dt>
                <dd>
                  {previewResult.matchedKeywords.length > 0
                    ? previewResult.matchedKeywords.join(', ')
                    : 'nothing matched'}
                </dd>
              </dl>

              <div style={{ marginTop: 'var(--s-4)' }}>
                <RoutingFlow
                  category={previewCategory}
                  ruleValue={
                    previewResult.matchedKeywords.length > 0
                      ? `${previewResult.matchedKeywords.length} trigger${previewResult.matchedKeywords.length > 1 ? 's' : ''}`
                      : 'no triggers'
                  }
                  assignmentGroup={previewResult.assignmentGroup}
                  urgency={previewResult.urgency}
                  slaHours={previewResult.slaHours}
                  priority={previewResult.priority}
                  travelKey={travelKey}
                />
              </div>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------ queue diff */}
        <div className="card">
          <div className="card-subhead">Impact on the live queue</div>
          <p className="hint" style={{ marginTop: 0 }}>
            Replays every Case currently in the queues through your edited config and reports which
            ones would route somewhere else. This is the honest version of "it works" — the actual
            effect of the edit on real records.
          </p>

          <div className="rules-actions">
            <button
              className="secondary btn-sm"
              type="button"
              onClick={handleDiff}
              disabled={diffRunning || validationErrors.length > 0}
            >
              {diffRunning ? 'Replaying Cases…' : '▶ Replay queue with these rules'}
            </button>
          </div>

          {diff && (
            <div style={{ marginTop: 'var(--s-4)' }}>
              {diff.changed.length === 0 ? (
                <div className="notice ok">
                  No change — all {diff.total} Cases route to the same assignmentGroup and urgency
                  under this config.
                </div>
              ) : (
                <>
                  <div className="notice" style={{ marginBottom: 'var(--s-3)' }}>
                    <strong style={{ color: 'var(--urg-m)' }}>
                      {diff.changed.length} of {diff.total} Cases
                    </strong>{' '}
                    would route differently.
                  </div>
                  <div className="diff-list">
                    {diff.changed.map((row) => (
                      <div className="diff-row" key={row.id}>
                        <span className="diff-name">
                          {row.name} · {row.category}
                        </span>
                        <span className="diff-from">
                          {row.fromGroup.slice(0, 8)} / {row.fromUrgency}
                        </span>
                        <span className="diff-to">
                          {row.toGroup.slice(0, 8)} / {row.toUrgency}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {!diff && !diffRunning && (
            <div className="hint">
              Tip for the demo: zero the crisis keyword weights and replay. Recall falls from 100% to
              77% and Cases stop escalating — then hit reset.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
