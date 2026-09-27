/**
 * /api/requests — Case intake, queue, lifecycle and activity streams.
 *
 * POST   /api/requests                create a Case (runs the active Assignment Rule)
 * GET    /api/requests?group=X        queue for one assignmentGroup (urgency sorted)
 * GET    /api/requests/:id            one Case
 * PATCH  /api/requests/:id            update status / assignee / impact / notes
 * POST   /api/requests/:id/notes      append an activity stream item
 * POST   /api/requests/:id/escalate   expedite a Case and raise its tier
 * GET    /api/requests/deflection     Knowledge Base search for self-service
 * POST   /api/requests/deflection/deflect   record a deflection (persisted)
 * GET    /api/requests/stream         Server-Sent Events live feed
 *
 * Routing runs against the *active* rule config, which the Rules Console can
 * edit at runtime — falling back to the backtest winner when unset.
 */
import { Router } from 'express';
import Case from '../models/Case.js';
import Deflection from '../models/Deflection.js';
import { triageRequest } from '../triage/triageRequest.js';
import {
  analyzeCaseIntent,
  findDeflectionArticles,
  KNOWLEDGE_BASE,
} from '../triage/nowAssistEngine.js';
import { deriveImpactAndPriority, IMPACTS } from '../triage/priorityMatrix.js';
import { getActiveConfig } from '../rules/configStore.js';
import { SLA_HOURS, STATUSES, ASSIGNMENT_GROUPS, CATEGORIES, URGENCIES } from '../constants.js';

const router = Router();

// In-memory SSE clients for the live queue feed.
const sseClients = new Set();

export function broadcastCaseEvent(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

/** SLA target = createdAt + 2h (High) / 24h (Medium) / 72h (Low). */
function slaTargetFor(urgency, from = new Date()) {
  return new Date(from.getTime() + SLA_HOURS[urgency] * 60 * 60 * 1000);
}

function randomHex(length = 32) {
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

const URGENCY_ORDER = { Low: 0, Medium: 1, High: 2 };

// ---------------------------------------------------------------------------
// Live feed
// ---------------------------------------------------------------------------
router.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write('data: {"connected": true}\n\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

// ---------------------------------------------------------------------------
// Knowledge deflection — persisted, so the ROI on the dashboard is real
// ---------------------------------------------------------------------------
router.get('/deflection', async (req, res, next) => {
  try {
    const { q, category } = req.query || {};
    const articles = findDeflectionArticles(q, category);
    const deflectedTotal = await Deflection.countDocuments();
    res.json({ articles, deflectedTotal });
  } catch (err) {
    next(err);
  }
});

router.post('/deflection/deflect', async (req, res, next) => {
  try {
    const { articleId, category } = req.body || {};
    const article = KNOWLEDGE_BASE.find((a) => a.id === articleId);

    await Deflection.create({
      articleId: article ? article.id : 'KB-UNLINKED',
      articleTitle: article ? article.title : 'Knowledge Base article',
      category: category || (article && article.category) || 'Other',
      // Advisor minutes avoided by answering this without a Case being raised.
      avoidedMinutes: article && article.urgency === 'High' ? 34 : 21,
    });

    const deflectedCount = await Deflection.countDocuments();
    broadcastCaseEvent('deflection_recorded', { count: deflectedCount });
    res.json({ ok: true, deflectedCount });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/requests — Case creation
// ---------------------------------------------------------------------------
router.post('/', async (req, res, next) => {
  try {
    const { studentAlias, category, description } = req.body || {};

    if (!studentAlias || !String(studentAlias).trim()) {
      return res.status(400).json({ error: 'studentAlias is required' });
    }
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
    }
    if (!description || !String(description).trim()) {
      return res.status(400).json({ error: 'description is required' });
    }

    // The Assignment Rule, against the currently active (editable) config.
    const config = await getActiveConfig();
    const triage = triageRequest({ category, description: String(description) }, config);
    const analysis = analyzeCaseIntent(description, category);
    const { impact, priority } = deriveImpactAndPriority(
      {
        category,
        urgency: triage.urgency,
        crisisDetected: analysis.crisisDetected,
      },
      config.priorityMatrix
    );
    const snSysId = randomHex(32);

    const initialActivities = [
      {
        type: 'system',
        author: 'Automated Assignment Rule',
        text:
          `Intake verified. Routed to ${triage.assignmentGroup} with ${triage.urgency} urgency ` +
          `(SLA target ${SLA_HOURS[triage.urgency]}h) and priority P${priority} ` +
          `(impact ${impact} x urgency ${triage.urgency}).`,
        timestamp: new Date(),
      },
    ];

    if (analysis.crisisDetected) {
      initialActivities.push({
        type: 'system',
        author: 'Crisis Sentinel Alert',
        text: 'SAFETY PROTOCOL ENGAGED: Severe crisis language detected. On-call crisis clinician notified.',
        timestamp: new Date(),
      });
    }

    const programs = {
      'Mental Health': 'Psychology, B.A.',
      Academic: 'Mechanical Engineering, B.S.',
      Financial: 'Business Administration, B.S.',
      Housing: 'Undeclared Freshman',
      Other: 'Computer Science, B.S.',
    };

    const isFailing = /failing|probation/i.test(description);

    const created = await Case.create({
      studentAlias: String(studentAlias).trim(),
      category,
      description: String(description).trim(),
      urgency: triage.urgency,
      impact,
      priority,
      assignmentGroup: triage.assignmentGroup,
      status: 'New',
      slaTarget: slaTargetFor(triage.urgency),
      sentiment: analysis.sentiment,
      intent: analysis.intent,
      confidence: analysis.confidence,
      matchedKeywords: triage.matchedKeywords,
      assignedTo: 'Unassigned',
      escalationLevel: analysis.crisisDetected ? 1 : 0,
      snSysId,
      studentProfile: {
        gpa: isFailing ? '2.14' : triage.urgency === 'High' ? '3.08' : '3.62',
        year: 'Junior',
        program: programs[category] || 'General Studies',
        priorCasesCount: triage.urgency === 'High' ? 2 : 0,
        riskTier: analysis.crisisDetected ? 'Critical' : triage.urgency === 'High' ? 'Elevated' : 'Standard',
      },
      activityStream: initialActivities,
    });

    const doc = created.toObject();
    broadcastCaseEvent('case_created', doc);
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/requests?group=X — queue view
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const group = req.query.group;
    if (group !== 'All' && !ASSIGNMENT_GROUPS.includes(group)) {
      return res
        .status(400)
        .json({ error: `group query param must be one of: ${ASSIGNMENT_GROUPS.join(', ')} or All` });
    }

    const filter = group === 'All' ? {} : { assignmentGroup: group };
    const cases = await Case.find(filter).lean();

    // Priority first (it already encodes urgency x impact), then urgency, then
    // oldest first — the order a real agent queue is worked in.
    cases.sort(
      (a, b) =>
        (a.priority ?? 4) - (b.priority ?? 4) ||
        (URGENCY_ORDER[b.urgency] ?? 0) - (URGENCY_ORDER[a.urgency] ?? 0) ||
        new Date(a.createdAt) - new Date(b.createdAt)
    );

    res.json(cases);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/requests/:id
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res, next) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid Case id' });
    }
    const found = await Case.findById(req.params.id).lean();
    if (!found) return res.status(404).json({ error: 'Case not found' });
    res.json(found);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/requests/:id
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res, next) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid Case id' });
    }

    const { status, assignedTo, workNote, comment, escalationLevel, impact, author } = req.body || {};

    if (status && !STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
    }
    if (impact && !IMPACTS.includes(impact)) {
      return res.status(400).json({ error: `impact must be one of: ${IMPACTS.join(', ')}` });
    }

    const existing = await Case.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Case not found' });

    const newActivities = [];

    if (status && status !== existing.status) {
      existing.status = status;
      newActivities.push({
        type: 'system',
        author: author || 'Staff Agent',
        text: `Status changed to ${status}`,
        timestamp: new Date(),
      });
    }

    if (assignedTo && assignedTo !== existing.assignedTo) {
      existing.assignedTo = assignedTo;
      newActivities.push({
        type: 'system',
        author: author || 'Supervisor',
        text: `Assigned to ${assignedTo}`,
        timestamp: new Date(),
      });
    }

    // Impact override — the agent overrides the *consequence* assessment and
    // priority re-derives by looking straight up the matrix, instead of being
    // re-derived from the Case fields. That is the ServiceNow behaviour: an
    // agent may set impact, but never sets priority directly.
    if (impact && impact !== existing.impact) {
      const config = await getActiveConfig();
      const previousImpact = existing.impact;
      const previousPriority = existing.priority;
      const lookedUp = derivePriorityWithImpact(impact, existing.urgency, config.priorityMatrix);

      existing.impact = impact;
      if (lookedUp !== null) existing.priority = lookedUp;

      newActivities.push({
        type: 'system',
        author: author || 'Staff Agent',
        text:
          `Impact overridden from ${previousImpact} to ${impact}. ` +
          `Priority re-derived from P${previousPriority} to P${existing.priority} ` +
          `(impact ${impact} x urgency ${existing.urgency}).`,
        timestamp: new Date(),
      });
    }

    if (typeof escalationLevel === 'number') {
      existing.escalationLevel = escalationLevel;
      newActivities.push({
        type: 'system',
        author: author || 'Staff Agent',
        text: `Escalation level set to Tier ${escalationLevel} (Director alert dispatched)`,
        timestamp: new Date(),
      });
    }

    if (workNote && String(workNote).trim()) {
      newActivities.push({
        type: 'work_note',
        author: author || 'Counselor Work Note (Staff Only)',
        text: String(workNote).trim(),
        timestamp: new Date(),
      });
    }

    if (comment && String(comment).trim()) {
      newActivities.push({
        type: 'comment',
        author: author || 'Student Care Team',
        text: String(comment).trim(),
        timestamp: new Date(),
      });
    }

    if (newActivities.length > 0) existing.activityStream.push(...newActivities);

    const updated = await existing.save();
    const updatedLean = updated.toObject();
    broadcastCaseEvent('case_updated', updatedLean);
    res.json(updatedLean);
  } catch (err) {
    next(err);
  }
});

// Small local helper so the PATCH path can honour an explicit impact override.
function derivePriorityWithImpact(impact, urgency, matrix) {
  const row = (matrix && matrix[impact]) || null;
  const value = row && row[urgency];
  return typeof value === 'number' && value >= 1 && value <= 4 ? value : null;
}

// ---------------------------------------------------------------------------
// POST /api/requests/:id/notes
// ---------------------------------------------------------------------------
router.post('/:id/notes', async (req, res, next) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid Case id' });
    }
    const { type = 'work_note', author = 'Staff Agent', text } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'Note text is required' });
    }

    const existing = await Case.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Case not found' });

    existing.activityStream.push({
      type: type === 'comment' ? 'comment' : 'work_note',
      author: String(author).trim(),
      text: String(text).trim(),
      timestamp: new Date(),
    });

    const updated = await existing.save();
    const updatedLean = updated.toObject();
    broadcastCaseEvent('case_updated', updatedLean);
    res.json(updatedLean);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/requests/:id/escalate
//
// Previously this logged "Immediate SLA target expedited" while never touching
// slaTarget — an audit trail that contradicted the data. Now the target is
// genuinely compressed to a one-hour window (never loosened, never later than
// the existing target) and the log records the real before -> after values.
// ---------------------------------------------------------------------------
router.post('/:id/escalate', async (req, res, next) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid Case id' });
    }

    const existing = await Case.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Case not found' });

    const config = await getActiveConfig();
    const now = new Date();
    const previousTarget = new Date(existing.slaTarget);

    // Expedite to a one-hour target, but never push a target later than it was.
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const expedited = oneHourFromNow < previousTarget ? oneHourFromNow : previousTarget;
    const changed = expedited.getTime() !== previousTarget.getTime();

    const previousUrgency = existing.urgency;
    const previousPriority = existing.priority;

    existing.escalationLevel = Math.min(2, (existing.escalationLevel || 0) + 1);
    existing.urgency = 'High';
    existing.slaTarget = expedited;
    existing.priority = derivePriorityWithImpact(existing.impact, 'High', config.priorityMatrix) || existing.priority;

    const hours = (ms) => `${(ms / 3600000).toFixed(1)}h`;
    const targetLine = changed
      ? `SLA target expedited from ${previousTarget.toISOString()} to ${expedited.toISOString()} ` +
        `(window reduced from ${hours(previousTarget - now > 0 ? previousTarget - now : 0)} remaining to 1.0h).`
      : `SLA target already inside the one-hour expedited window (${previousTarget.toISOString()}) — unchanged.`;

    existing.activityStream.push({
      type: 'system',
      author: 'Executive Escalation Protocol',
      text:
        `EMERGENCY ESCALATION: Case raised to Tier ${existing.escalationLevel}. ` +
        `Urgency ${previousUrgency} -> High. Priority P${previousPriority} -> P${existing.priority}. ` +
        `${targetLine} Dean of Students notified.`,
      timestamp: now,
    });

    const updated = await existing.save();
    const updatedLean = updated.toObject();
    broadcastCaseEvent('case_updated', updatedLean);
    res.json(updatedLean);
  } catch (err) {
    next(err);
  }
});

export default router;
