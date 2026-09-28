/**
 * TriageNow Express API.
 *
 * Routes:
 *   POST   /api/requests          create a Case (Assignment Rule runs here)
 *   GET    /api/requests?group=X  queue for one assignmentGroup
 *   GET    /api/requests/:id      one Case
 *   PATCH  /api/requests/:id      update status / assignee / impact / notes
 *   GET    /api/rules             the editable Assignment Rule config
 *   PUT    /api/rules             save a new config
 *   POST   /api/rules/preview     evaluate one description without creating a Case
 *   GET    /api/dashboard         counts by assignmentGroup / urgency / priority
 */
import express from 'express';
import cors from 'cors';
import { connectDb } from './db.js';
import { seedIfEmpty } from './autoSeed.js';
import requestsRouter from './routes/requests.js';
import dashboardRouter from './routes/dashboard.js';
import rulesRouter from './routes/rules.js';

const app = express();
// Number("0") is falsy on purpose: some hosts export PORT=0, which must not win.
const PORT = Number(process.env.PORT) || 4000;

app.use(cors()); // no auth per the plan — Vite dev server on 5173 calls across
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'TriageNow API' }));
app.use('/api/requests', requestsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/rules', rulesRouter);

// 404 for unknown API paths
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Central error handler — never leak stack traces to the client
app.use((err, _req, res, _next) => {
  console.error('[api error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

connectDb()
  .then(async () => {
    // An empty database used to render every screen as zeroes with no
    // explanation. Seed it instead — additive only, never a wipe, so
    // restarting the API can never destroy Cases created during a demo.
    try {
      const seeded = await seedIfEmpty({ disabled: process.env.SEED_ON_EMPTY === '0' });
      if (seeded.cases > 0 || seeded.deflections > 0) {
        console.log(
          `[api] Empty collections detected — seeded ${seeded.cases} Cases and ` +
            `${seeded.deflections} Deflections so the dashboard is not all zeroes.`
        );
      }
    } catch (err) {
      // A seeding failure must not stop the API: a readable empty state is
      // better than no server at all.
      console.error('[api] Auto-seed skipped:', err.message);
    }

    app.listen(PORT, () => console.log(`[api] TriageNow API listening on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('[api] Failed to connect to MongoDB:', err.message);
    console.error('[api] Tip: start MongoDB, or run with USE_MEMORY_DB=1 for an in-memory DB.');
    process.exit(1);
  });

export default app;
