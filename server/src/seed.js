/**
 * Seed / demo data.
 *
 * `npm run seed` wipes the Case and Deflection collections and inserts a demo
 * set that spans every assignmentGroup, urgency, priority, sentiment and
 * status — including Cases that are genuinely overdue and a week of real
 * deflection records, so every number the dashboard shows is derived rather
 * than hardcoded.
 *
 * Uses the shared builder, which runs the REAL Assignment Rule and Now Assist
 * analysis, so the live backend and the browser demo tell the same story.
 */
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from './db.js';
import Case from './models/Case.js';
import Deflection from './models/Deflection.js';
import { buildSeedCases, buildSeedDeflections } from './seedCases.js';

async function seed() {
  await connectDb();

  const now = new Date();
  await Case.deleteMany({});
  await Deflection.deleteMany({});

  const inserted = await Case.insertMany(buildSeedCases({ now }));
  const deflections = await Deflection.insertMany(buildSeedDeflections({ now }));

  const tally = (docs, field) =>
    docs.reduce((acc, doc) => ({ ...acc, [doc[field]]: (acc[doc[field]] || 0) + 1 }), {});

  const overdue = inserted.filter((c) => c.slaTarget < now && c.status !== 'Resolved').length;
  const deflectedMinutes = deflections.reduce((n, d) => n + (d.avoidedMinutes || 0), 0);
  const inbound = inserted.length + deflections.length;

  console.log(`[seed] Inserted ${inserted.length} Cases.`);
  console.log('[seed] By urgency:', tally(inserted, 'urgency'));
  console.log('[seed] By priority:', tally(inserted, 'priority'));
  console.log('[seed] By assignmentGroup:', tally(inserted, 'assignmentGroup'));
  console.log('[seed] By status:', tally(inserted, 'status'));
  console.log('[seed] By sentiment:', tally(inserted, 'sentiment'));
  console.log(`[seed] Overdue Cases (past SLA target, not Resolved): ${overdue}`);
  console.log(`[seed] Inserted ${deflections.length} Deflections across ${new Set(deflections.map((d) => d.articleId)).size} KB articles.`);
  console.log(
    `[seed] Deflection rate: ${Math.round((deflections.length / inbound) * 100)}% ` +
      `(${deflections.length} of ${inbound} inbound requests).`
  );
  console.log(
    `[seed] Advisor hours saved this week: ${((inserted.length * 9 + deflectedMinutes) / 60).toFixed(1)}h`
  );

  await disconnectDb();
}

seed().catch((err) => {
  process.exitCode = 1;
  mongoose.connection.close().finally(() => {
    console.error('[seed] Failed:', err.message);
  });
});
