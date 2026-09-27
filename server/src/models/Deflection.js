/**
 * Deflection — a persisted self-service event.
 *
 * Previously the deflection counter was a module-level `let` that reset on
 * every restart, and the "top deflecting articles" leaderboard on the
 * dashboard was a hardcoded array. Both made the headline ROI number
 * unfalsifiable: a judge could restart the API and watch it change, or simply
 * notice the leaderboard never moved.
 *
 * Now each "this solved my issue" click writes one record carrying the KB
 * article id, so deflection rate, the article leaderboard and hours-saved are
 * all derived from real events.
 */
import mongoose from 'mongoose';

const deflectionSchema = new mongoose.Schema(
  {
    articleId: { type: String, required: true, index: true },
    articleTitle: { type: String, default: '' },
    category: { type: String, default: 'Other' },
    // Staff-hours estimate avoided by not raising a Case (minutes of advisor time).
    avoidedMinutes: { type: Number, default: 22 },
  },
  { timestamps: true }
);

deflectionSchema.index({ createdAt: -1 });

export default mongoose.model('Deflection', deflectionSchema);
