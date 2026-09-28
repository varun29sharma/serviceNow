/**
 * Seed-on-boot.
 *
 * The live path used to require an explicit `npm run seed` before it showed
 * anything meaningful. Start the API against a fresh database — which is the
 * normal thing to do — and every screen read zero: dashboard at 0%, empty
 * queue, no deflection history. It looked broken, and no screen explained why.
 *
 * So the server now seeds itself when the collections are empty. It is
 * deliberately NOT a wipe-and-reseed (that is `npm run seed`): this only ever
 * adds data to an empty collection, so restarting the API can never destroy
 * Cases created during a demo.
 *
 * Disable with SEED_ON_EMPTY=0.
 */
import Case from './models/Case.js';
import Deflection from './models/Deflection.js';
import { buildSeedCases, buildSeedDeflections } from './seedCases.js';

/**
 * seedIfEmpty({ now, disabled }) -> { seeded, cases, deflections, reason? }
 *
 * Each collection is considered independently, so a database with Cases but no
 * deflection history (or the reverse) is topped up rather than left half-empty.
 */
export async function seedIfEmpty({ now = new Date(), disabled = false } = {}) {
  if (disabled) return { seeded: false, cases: 0, deflections: 0, reason: 'disabled' };

  const result = { seeded: false, cases: 0, deflections: 0 };

  if ((await Case.estimatedDocumentCount()) === 0) {
    const inserted = await Case.insertMany(buildSeedCases({ now }));
    result.cases = inserted.length;
    result.seeded = true;
  }

  if ((await Deflection.estimatedDocumentCount()) === 0) {
    const inserted = await Deflection.insertMany(buildSeedDeflections({ now }));
    result.deflections = inserted.length;
    result.seeded = true;
  }

  return result;
}

export default seedIfEmpty;
