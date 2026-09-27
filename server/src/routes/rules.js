/**
 * /api/rules — the Assignment Rule, as a configurable record.
 *
 *   GET    /api/rules           active config + built-in winner + scores
 *   PUT    /api/rules           validate & save a new active config
 *   POST   /api/rules/preview   evaluate one { category, description } without
 *                               creating a Case (powers the live Rule Tester)
 *   POST   /api/rules/reset     restore the backtest winner
 *   GET    /api/rules/score     re-score the active config on demand
 *
 * This is the ServiceNow-native centrepiece: routing logic an administrator
 * edits at runtime, whose quality is measured by the same harness that chose
 * the shipped default.
 */
import { Router } from 'express';

import {
  builtInConfig,
  getActiveConfig,
  saveConfig,
  resetConfig,
  configMeta,
  validateConfig,
} from '../rules/configStore.js';
import { evaluateConfig } from '../rules/backtestScore.js';
import { triageRequest } from '../triage/triageRequest.js';
import { deriveImpactAndPriority } from '../triage/priorityMatrix.js';
import { analyzeCaseIntent } from '../triage/nowAssistEngine.js';
import { CATEGORIES, SLA_HOURS } from '../constants.js';

const router = Router();

/** Compact metric shape for the UI — no miss list, rounded numbers only. */
function scoreSummary(metrics) {
  return {
    exact: metrics.exact,
    n: metrics.n,
    exactPct: metrics.exactPct,
    highRecallPct: metrics.highRecallPct,
    highPrecisionPct: metrics.highPrecisionPct,
    withinOnePct: metrics.withinOnePct,
    score: Number(metrics.score.toFixed(1)),
    misses: metrics.misses,
  };
}

// GET /api/rules — everything the console needs in one round trip.
router.get('/', async (_req, res, next) => {
  try {
    const active = await getActiveConfig();
    const builtIn = builtInConfig();
    res.json({
      active,
      builtIn,
      meta: configMeta(active),
      activeScore: scoreSummary(evaluateConfig(active)),
      builtInScore: scoreSummary(evaluateConfig(builtIn)),
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/rules — save. Validation failures return 400 with every error, so
// the console can point at the exact field instead of failing vaguely.
router.put('/', async (req, res, next) => {
  try {
    const { config, updatedBy } = req.body || {};
    let saved;
    try {
      saved = await saveConfig(config, updatedBy || 'System Administrator');
    } catch (err) {
      if (err.validation) {
        return res.status(400).json({ error: err.message, errors: err.validation });
      }
      throw err;
    }
    res.json({
      active: saved,
      meta: configMeta(saved),
      activeScore: scoreSummary(evaluateConfig(saved)),
      builtInScore: scoreSummary(evaluateConfig(builtInConfig())),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/rules/reset — restore the backtest winner.
router.post('/reset', async (_req, res, next) => {
  try {
    const restored = await resetConfig();
    res.json({
      active: restored,
      meta: configMeta(restored),
      activeScore: scoreSummary(evaluateConfig(restored)),
      builtInScore: scoreSummary(evaluateConfig(builtInConfig())),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/rules/score — re-score the active config.
router.get('/score', async (_req, res, next) => {
  try {
    const active = await getActiveConfig();
    res.json({
      activeScore: scoreSummary(evaluateConfig(active)),
      builtInScore: scoreSummary(evaluateConfig(builtInConfig())),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/rules/preview — "what would this rule do?", without persisting a
// Case. Also used to compute the "N Cases would route differently" diff.
//
// Accepts an optional candidate `config` in the body so the console can test
// UNSAVED edits. Nothing is persisted on this path either way, so it is safe
// to accept a caller-supplied config here — and it is what makes the live
// tester honest: you see the effect of the edit you are looking at.
router.post('/preview', async (req, res, next) => {
  try {
    const { category, description, config: candidate } = req.body || {};
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
    }
    if (!description || !String(description).trim()) {
      return res.status(400).json({ error: 'description is required' });
    }

    let config = await getActiveConfig();
    if (candidate) {
      const errors = validateConfig(candidate);
      if (errors.length > 0) {
        return res.status(400).json({ error: errors[0], errors });
      }
      config = candidate;
    }

    const triaged = triageRequest({ category, description: String(description) }, config);
    const analysis = analyzeCaseIntent(description, category);
    const { impact, priority } = deriveImpactAndPriority(
      { category, urgency: triaged.urgency, crisisDetected: analysis.crisisDetected },
      config.priorityMatrix
    );

    res.json({
      assignmentGroup: triaged.assignmentGroup,
      urgency: triaged.urgency,
      matchedKeywords: triaged.matchedKeywords,
      score: triaged.score,
      impact,
      priority,
      sentiment: analysis.sentiment,
      intent: analysis.intent,
      confidence: analysis.confidence,
      crisisDetected: analysis.crisisDetected,
      slaHours: SLA_HOURS[triaged.urgency],
    });
  } catch (err) {
    next(err);
  }
});

export default router;
