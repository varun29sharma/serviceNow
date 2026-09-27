/**
 * Case — the core ServiceNow-vocabulary document.
 *
 * Named exactly `Case` (collection `cases`) deliberately: the pitch runs on
 * ServiceNow vocabulary — Case, assignmentGroup, Assignment Rule, SLA target.
 * Not "Request", not "Ticket".
 */
import mongoose from 'mongoose';
import { CATEGORIES, ASSIGNMENT_GROUPS, URGENCIES, STATUSES } from '../constants.js';
import { IMPACTS } from '../triage/priorityMatrix.js';

const caseSchema = new mongoose.Schema(
  {
    studentAlias: { type: String, required: true, trim: true, maxlength: 80 },
    category: { type: String, required: true, enum: CATEGORIES },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    // Set by triageRequest() — the Assignment Rule — at creation time.
    urgency: { type: String, required: true, enum: URGENCIES },
    // Impact is the consequence-of-inaction assessment; priority is DERIVED
    // from impact x urgency via the matrix, never set directly by a human.
    impact: { type: String, required: true, enum: IMPACTS, default: 'Medium' },
    priority: { type: Number, required: true, min: 1, max: 4, default: 4 },
    assignmentGroup: { type: String, required: true, enum: ASSIGNMENT_GROUPS },
    status: { type: String, required: true, enum: STATUSES, default: 'New' },
    // SLA target: createdAt + 2h (High) / 24h (Medium) / 72h (Low).
    slaTarget: { type: Date, required: true },
    // Enterprise ServiceNow Now Assist fields
    sentiment: { type: String, default: 'Routine' },
    intent: { type: String, default: 'General Student Support' },
    confidence: { type: String, default: '92%' },
    matchedKeywords: { type: [String], default: [] },
    assignedTo: { type: String, default: 'Unassigned' },
    escalationLevel: { type: Number, default: 0 },
    snSysId: { type: String },
    studentProfile: {
      gpa: { type: String, default: '3.3' },
      year: { type: String, default: 'Sophomore' },
      program: { type: String, default: 'Undergraduate Studies' },
      priorCasesCount: { type: Number, default: 0 },
      riskTier: { type: String, default: 'Standard' },
    },
    activityStream: [
      {
        type: { type: String, enum: ['work_note', 'comment', 'system'], default: 'system' },
        author: { type: String, default: 'System' },
        text: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true } // gives createdAt (and updatedAt) automatically
);

// Queue view sorts by priority asc, then urgency desc, then oldest first.
caseSchema.index({ assignmentGroup: 1, priority: 1, urgency: -1, createdAt: 1 });
caseSchema.index({ priority: 1, createdAt: 1 });

export default mongoose.model('Case', caseSchema);
