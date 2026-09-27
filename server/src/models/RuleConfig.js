/**
 * RuleConfig — the configurable Assignment Rule record.
 *
 * This is the ServiceNow-native idea the product is built to demonstrate:
 * routing logic is a *configurable record an admin edits*, not code compiled
 * into the service. One active document holds the whole triage configuration
 * (category base urgency, weighted keywords, score thresholds, the
 * category -> assignmentGroup mapping, and the impact x urgency priority
 * matrix). When no document exists, the API falls back to DEFAULT_CONFIG —
 * which is the winning config from the backtest harness, so the out-of-box
 * behaviour is always the evidence-selected one.
 */
import mongoose from 'mongoose';

const ruleConfigSchema = new mongoose.Schema(
  {
    // Only one active config at a time; keyed for a cheap findOne.
    key: { type: String, required: true, unique: true, default: 'active' },
    config: {
      categoryBaseUrgency: { type: mongoose.Schema.Types.Mixed, required: true },
      keywords: { type: mongoose.Schema.Types.Mixed, required: true },
      thresholds: { type: mongoose.Schema.Types.Mixed, required: true },
      assignmentRule: { type: mongoose.Schema.Types.Mixed, required: true },
      priorityMatrix: { type: mongoose.Schema.Types.Mixed, required: true },
    },
    updatedBy: { type: String, default: 'System Administrator' },
  },
  { timestamps: true }
);

export default mongoose.model('RuleConfig', ruleConfigSchema);
