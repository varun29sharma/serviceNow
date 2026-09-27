/**
 * GET /api/dashboard — operational analytics.
 *
 * Every figure here is computed from stored Cases and Deflection records.
 * The previous build returned hardcoded stand-ins (`data.deflectionRate || 38`)
 * which meant the screen could show a number nobody could reproduce, and a
 * genuine zero would silently render as 38. That is the fastest way to lose an
 * audience that asks "where does that come from?" — so there are no fallbacks
 * here. A zero is reported as a zero.
 *
 * The saved-time model is stated as named constants so the ROI claim is
 * auditable rather than magic:
 *   - automated triage avoids ~9 minutes of manual routing per Case
 *   - a deflected request avoids the advisor time a Case would have consumed
 *     (recorded per deflection, since a crisis article saves more than an ID
 *     replacement)
 */
import { Router } from 'express';
import Case from '../models/Case.js';
import Deflection from '../models/Deflection.js';
import { ASSIGNMENT_GROUPS, URGENCIES, STATUSES } from '../constants.js';
import { IMPACTS } from '../triage/priorityMatrix.js';

const router = Router();

const MINUTES_SAVED_PER_TRIAGE = 9;
const WEEKS_PER_YEAR = 52;
const SENTIMENTS = ['Severe Crisis', 'Distressed', 'Concerned', 'Routine'];

/**
 * Bucket records into the last seven days, oldest first.
 *
 * Real time series from real timestamps — the reason there is no charting
 * library here is that the shape we need is seven integers.
 */
function lastSevenDays(records, field = 'createdAt') {
  const days = [];
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(now.getTime() - i * dayMs);
    const key = day.toISOString().slice(0, 10);
    const count = records.filter((record) => {
      const value = record && record[field];
      if (!value) return false;
      return new Date(value).toISOString().slice(0, 10) === key;
    }).length;
    days.push({ date: key, label: day.toLocaleDateString('en-US', { weekday: 'short' }), count });
  }

  return days;
}

router.get('/', async (_req, res, next) => {
  try {
    const now = new Date();
    const atRiskThreshold = new Date(now.getTime() + 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      groupAgg,
      urgencyAgg,
      statusAgg,
      sentimentAgg,
      impactAgg,
      priorityAgg,
      overdue,
      atRisk,
      total,
      deflections,
      resolvedDocs,
      crisisCount,
      unassignedCount,
      caseDocs,
    ] = await Promise.all([
      Case.aggregate([{ $group: { _id: '$assignmentGroup', count: { $sum: 1 } } }]),
      Case.aggregate([{ $group: { _id: '$urgency', count: { $sum: 1 } } }]),
      Case.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Case.aggregate([{ $group: { _id: '$sentiment', count: { $sum: 1 } } }]),
      Case.aggregate([{ $group: { _id: '$impact', count: { $sum: 1 } } }]),
      Case.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
      Case.countDocuments({ slaTarget: { $lt: now }, status: { $ne: 'Resolved' } }),
      Case.countDocuments({
        slaTarget: { $gte: now, $lte: atRiskThreshold },
        status: { $ne: 'Resolved' },
      }),
      Case.countDocuments({}),
      Deflection.find({}).lean(),
      Case.find({ status: 'Resolved' }).select('createdAt updatedAt').lean(),
      Case.countDocuments({ sentiment: 'Severe Crisis' }),
      Case.countDocuments({ assignedTo: 'Unassigned' }),
      Case.find({}).select('createdAt').lean(),
    ]);

    const toMap = (rows, keys) => {
      const map = Object.fromEntries(keys.map((k) => [k, 0]));
      for (const row of rows) {
        if (row && row._id !== null && row._id !== undefined && row._id in map) {
          map[row._id] = row.count;
        }
      }
      return map;
    };

    // --- deflection ---------------------------------------------------------
    const deflected = deflections.length;
    const deflectedMinutes = deflections.reduce((n, d) => n + (d.avoidedMinutes || 0), 0);

    const articleTally = new Map();
    for (const d of deflections) {
      const current = articleTally.get(d.articleId) || {
        articleId: d.articleId,
        title: d.articleTitle || 'Knowledge Base article',
        category: d.category || 'Other',
        count: 0,
      };
      current.count += 1;
      articleTally.set(d.articleId, current);
    }
    const topDeflectedArticles = [...articleTally.values()]
      .sort((a, b) => b.count - a.count || a.articleId.localeCompare(b.articleId))
      .slice(0, 5);

    // --- rates --------------------------------------------------------------
    const inbound = total + deflected;
    const deflectionRate = inbound > 0 ? Math.round((deflected / inbound) * 100) : 0;
    const slaComplianceRate = total > 0 ? Math.round(((total - overdue) / total) * 100) : 100;
    const hoursSaved = (total * MINUTES_SAVED_PER_TRIAGE + deflectedMinutes) / 60;

    const resolvedCount = resolvedDocs.length;
    const avgResolutionHours =
      resolvedCount > 0
        ? Number(
            (
              resolvedDocs.reduce(
                (n, c) => n + (new Date(c.updatedAt) - new Date(c.createdAt)) / 3600000,
                0
              ) / resolvedCount
            ).toFixed(1)
          )
        : 0;

    res.json({
      byAssignmentGroup: toMap(groupAgg, ASSIGNMENT_GROUPS),
      byUrgency: toMap(urgencyAgg, URGENCIES),
      byStatus: toMap(statusAgg, STATUSES),
      bySentiment: toMap(sentimentAgg, SENTIMENTS),
      byImpact: toMap(impactAgg, IMPACTS),
      byPriority: toMap(priorityAgg, [1, 2, 3, 4]),

      total,
      overdue,
      atRisk,
      crisisCount,
      unassignedCount,
      resolvedCount,
      avgResolutionHours,
      windowStart: weekAgo.toISOString(),

      deflectedCount: deflected,
      deflectionRate,
      slaComplianceRate,
      topDeflectedArticles,

      // Seven-day activity, from real timestamps (drives the SVG charts).
      deflectionTrend: lastSevenDays(deflections),
      caseTrend: lastSevenDays(caseDocs),

      // Saved-time model, stated explicitly so it can be defended on stage.
      hoursSaved: Number(hoursSaved.toFixed(1)),
      hoursSavedProjectedAnnual: Math.round(hoursSaved * WEEKS_PER_YEAR),
      minutesSavedPerTriage: MINUTES_SAVED_PER_TRIAGE,
      deflectedMinutes,

      generatedAt: now.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
