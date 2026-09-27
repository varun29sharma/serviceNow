/**
 * Seed / demo data — shared by the server seeder and the browser demo.
 *
 * Previously these two diverged badly: `server/src/seed.js` inserted bare
 * documents (so every seeded Case had sentiment 'Routine', an empty activity
 * stream and no matched keywords) while the browser demo built rich ones. The
 * live path therefore looked unfinished exactly where the demo looked good,
 * and the dashboard's sentiment panel fell back to invented numbers.
 *
 * There is now exactly one builder. Whatever the seeder writes, demo mode
 * writes the same thing — and the seed runs through the *real* Assignment Rule
 * and Now Assist analysis, so what you demo is what the app does.
 *
 * Timestamps are ISO strings throughout: Mongoose casts them on insert, and
 * the browser demo stores them verbatim, so both paths serialise identically.
 */
import { triageRequest } from './triage/triageRequest.js';
import { SLA_HOURS } from './constants.js';
import { analyzeCaseIntent, KNOWLEDGE_BASE } from './triage/nowAssistEngine.js';
import { deriveImpactAndPriority } from './triage/priorityMatrix.js';

export const SEED_CASES = [
  {
    studentAlias: 'Jordan P.',
    category: 'Mental Health',
    description:
      'I have been having panic attacks before every exam and I am not sleeping. I think I need counseling soon.',
    hoursAgo: 3,
  },
  {
    // Deliberately the highest-severity Case in the set: it gives the
    // dashboard a real 'Severe Crisis' sentiment to report, exercises the
    // Crisis Sentinel activity entry on the live path, and lands inside the
    // at-risk SLA window so that KPI is populated too.
    studentAlias: 'Nadia F.',
    category: 'Mental Health',
    description:
      'I have been having thoughts of suicide and I do not feel safe at home tonight. I need to speak to someone.',
    hoursAgo: 1.2,
  },
  {
    studentAlias: 'Sam R.',
    category: 'Mental Health',
    description: 'Feeling anxious about the semester and would like someone to talk to.',
    hoursAgo: 20, // inside the 24h Medium window — not every old Case should breach
  },
  {
    studentAlias: 'Alex K.',
    category: 'Academic',
    description: 'I am failing two classes and might also be overdue on an essay. Can advising help me plan?',
    hoursAgo: 5, // High urgency (2h) and long open — one of the deliberate breaches
  },
  {
    studentAlias: 'Riley M.',
    category: 'Academic',
    description: 'Struggling in calculus and falling a bit behind on assignments. Looking for tutoring options.',
    hoursAgo: 18,
  },
  {
    studentAlias: 'Casey T.',
    category: 'Financial',
    description: 'Got a final notice on my tuition payment plan and my aid did not come through. I am overdue.',
    hoursAgo: 7,
  },
  {
    studentAlias: 'Jamie L.',
    category: 'Financial',
    description: 'Questions about work-study and budgeting for next semester.',
    hoursAgo: 30,
  },
  {
    studentAlias: 'Taylor W.',
    category: 'Housing',
    description: 'My roommate situation is unlivable and I need to move out. Looking at options on campus.',
    hoursAgo: 4,
  },
  {
    studentAlias: 'Morgan D.',
    category: 'Housing',
    description: 'I got evicted last week and have no place to sleep this weekend.',
    // 1.5h into a 2h window: comfortably inside the at-risk band, and safely
    // clear of the boundary so the at-risk count cannot flake between runs.
    hoursAgo: 1.5,
  },
  {
    studentAlias: 'Devon S.',
    category: 'Other',
    description: 'Not sure who to ask: I lost my student ID and need help figuring out transportation help.',
    hoursAgo: 20,
  },
  {
    studentAlias: 'Avery H.',
    category: 'Other',
    description: 'General question about campus resources for commuter students.',
    hoursAgo: 50,
  },
  {
    studentAlias: 'Chris B.',
    category: 'Financial',
    description: 'My utilities got a shut off notice and bills are piling up while I wait for my refund.',
    hoursAgo: 90, // resolved long ago — deliberately not part of the overdue story
  },
  {
    // No trigger keyword matches, so urgency stays Low — but the domain is
    // Mental Health, so impact is High. That combination is what makes the
    // priority matrix worth showing: Low urgency + High impact is P3, not P4.
    studentAlias: 'Priya N.',
    category: 'Mental Health',
    description:
      'I would like some information about the student wellness centre and which programmes run next semester.',
    hoursAgo: 6,
  },
];

/** Statuses cycled across the set so the queue shows the full lifecycle. */
export const STATUS_CYCLE = [
  'New',
  'Assigned',
  'In Progress',
  'Resolved',
  'New',
  'Assigned',
  'In Progress',
];

/** The advisor a Case is assigned to once it leaves the New state. */
const GROUP_OWNER = {
  Counseling: 'Dr. Elena Vance, LCSW',
  'Academic Advising': 'Marcus Thorne, Academic Advisor',
  'Financial Aid': 'Sarah Jenkins, Financial Aid Lead',
  'Peer Support': 'Jordan Martinez, Student Advocate',
};

const PROGRAMS = [
  'Computer Science, B.S.',
  'Psychology, B.A.',
  'Nursing, B.S.N.',
  'Business Administration, B.S.',
  'Mechanical Engineering, B.S.',
];

/** Advisor minutes avoided each time a student self-serves instead of raising a Case. */
export const DEFLECTION_MINUTES = { High: 34, Default: 21 };

/**
 * The seven-day deflection history.
 *
 * Seeded as real records rather than a hardcoded "38%" on the dashboard, so
 * the headline ROI number is reproducible: restart the API and it does not
 * change; open the leaderboard and it reflects actual events.
 */
export const SEED_DEFLECTION_PLAN = [
  { articleId: 'KB0010391', count: 4 }, // food pantry + meal vouchers
  { articleId: 'KB0010219', count: 3 }, // tuition deferrals + micro-grants
  { articleId: 'KB0010103', count: 3 }, // ID replacement, transit, laptops
  { articleId: 'KB0010554', count: 2 }, // probation recovery + late drop
  { articleId: 'KB0010822', count: 2 }, // emergency shelter
  { articleId: 'KB0010482', count: 1 }, // crisis services
];

function randomHex(length = 32) {
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/**
 * Deterministic 24-character hex id.
 *
 * Browser-generated Cases have no ObjectId. Deriving one that is the right
 * shape means the UI can render a Case number and sys_id from the same code
 * path as the server, instead of showing something like "#M00001".
 */
export function demoHexId(seed = 0) {
  const head = ((0x5f3a1c + seed * 0x1013).toString(16) + 'a7b8c9d0e1f2').slice(0, 18).padEnd(18, '0');
  const tail = (0x4f2a10 + seed * 0x2f3b).toString(16).padStart(6, '0').slice(-6);
  return head + tail;
}

const iso = (date) => date.toISOString();

/**
 * buildSeedCases({ now, withIds }) -> array of Case documents
 *
 * Every field the UI renders is populated, so the Agent Workspace, the
 * activity timeline and the sentiment panel all have something real to show on
 * the live backend as well as in demo mode.
 */
export function buildSeedCases({ now = new Date(), withIds = false } = {}) {
  return SEED_CASES.map((c, i) => {
    const createdAt = new Date(now.getTime() - c.hoursAgo * 60 * 60 * 1000);
    const triage = triageRequest({ category: c.category, description: c.description });
    const analysis = analyzeCaseIntent(c.description, c.category);
    const status = STATUS_CYCLE[i % STATUS_CYCLE.length];
    const { impact, priority } = deriveImpactAndPriority({
      category: c.category,
      urgency: triage.urgency,
      crisisDetected: analysis.crisisDetected,
    });

    const assignedTo = status === 'New' ? 'Unassigned' : GROUP_OWNER[triage.assignmentGroup];
    const slaTarget = new Date(createdAt.getTime() + SLA_HOURS[triage.urgency] * 60 * 60 * 1000);

    // A resolved Case closes well inside its window; anything else is still open.
    const resolved = status === 'Resolved';
    const closedAt = resolved
      ? new Date(createdAt.getTime() + SLA_HOURS[triage.urgency] * 0.4 * 60 * 60 * 1000)
      : null;
    const updatedAt = closedAt || createdAt;

    const activityStream = [
      {
        type: 'system',
        author: 'Automated Assignment Rule',
        text:
          `Intake verified. Routed to ${triage.assignmentGroup} with ${triage.urgency} urgency ` +
          `(SLA target ${SLA_HOURS[triage.urgency]}h) and priority P${priority} ` +
          `(impact ${impact} x urgency ${triage.urgency}).`,
        timestamp: iso(createdAt),
      },
    ];

    if (analysis.crisisDetected) {
      activityStream.push({
        type: 'system',
        author: 'Crisis Sentinel Alert',
        text: 'SAFETY PROTOCOL ENGAGED: Severe crisis language detected. On-call crisis clinician notified.',
        timestamp: iso(new Date(createdAt.getTime() + 60 * 1000)),
      });
    }

    if (status !== 'New') {
      activityStream.push({
        type: 'system',
        author: 'Supervisor',
        text: `Assigned to ${assignedTo}`,
        timestamp: iso(new Date(createdAt.getTime() + 15 * 60 * 1000)),
      });
      activityStream.push({
        type: 'work_note',
        author: assignedTo,
        text: `Initial review complete. Case is active in the ${triage.assignmentGroup} priority queue.`,
        timestamp: iso(new Date(createdAt.getTime() + 45 * 60 * 1000)),
      });
    }

    if (status === 'In Progress' || status === 'Resolved') {
      activityStream.push({
        type: 'comment',
        author: assignedTo,
        text:
          `Hello ${c.studentAlias}, we are coordinating the resources you need and have updated your ` +
          `student record. Please check back here for updates.`,
        timestamp: iso(new Date(createdAt.getTime() + 90 * 60 * 1000)),
      });
    }

    if (status === 'Resolved') {
      activityStream.push({
        type: 'system',
        author: assignedTo,
        text: `Case resolved inside the ${SLA_HOURS[triage.urgency]}h SLA target. Student confirmed the outcome.`,
        timestamp: iso(closedAt),
      });
    }

    const doc = {
      studentAlias: c.studentAlias,
      category: c.category,
      description: c.description,
      urgency: triage.urgency,
      impact,
      priority,
      assignmentGroup: triage.assignmentGroup,
      status,
      createdAt: iso(createdAt),
      updatedAt: iso(updatedAt),
      slaTarget: iso(slaTarget),
      sentiment: analysis.sentiment,
      intent: analysis.intent,
      confidence: analysis.confidence,
      matchedKeywords: triage.matchedKeywords,
      assignedTo,
      escalationLevel: analysis.crisisDetected ? 1 : 0,
      snSysId: randomHex(32),
      studentProfile: {
        gpa: /failing|probation/i.test(c.description) ? '2.18' : triage.urgency === 'High' ? '3.08' : '3.62',
        year: i % 3 === 0 ? 'Sophomore' : 'Junior',
        program: PROGRAMS[i % PROGRAMS.length],
        priorCasesCount: analysis.crisisDetected ? 2 : i % 4 === 0 ? 1 : 0,
        riskTier: analysis.crisisDetected ? 'Critical' : triage.urgency === 'High' ? 'Elevated' : 'Standard',
      },
      activityStream,
    };

    if (withIds) {
      doc._id = demoHexId(i + 1);
    }

    return doc;
  });
}

/** buildSeedDeflections({ now }) -> array of Deflection documents */
export function buildSeedDeflections({ now = new Date() } = {}) {
  const records = [];
  const dayMs = 24 * 60 * 60 * 1000;

  SEED_DEFLECTION_PLAN.forEach((plan, planIndex) => {
    const article = KNOWLEDGE_BASE.find((a) => a.id === plan.articleId);
    for (let n = 0; n < plan.count; n += 1) {
      // Spread across the past seven days, deterministically (no RNG), so the
      // seeded dataset is reproducible run to run.
      const daysAgo = ((planIndex * 2 + n) % 7) + 0.4;
      records.push({
        articleId: plan.articleId,
        articleTitle: article ? article.title : 'Knowledge Base article',
        category: article ? article.category : 'Other',
        avoidedMinutes:
          article && article.urgency === 'High' ? DEFLECTION_MINUTES.High : DEFLECTION_MINUTES.Default,
        createdAt: iso(new Date(now.getTime() - daysAgo * dayMs)),
      });
    }
  });

  return records;
}

export default buildSeedCases;
