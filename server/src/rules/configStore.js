/**
 * Rule config store — persistence for the editable Assignment Rule.
 *
 * The pure schema helpers (builtInConfig, validateConfig, configMeta) live in
 * ruleSchema.js so the browser demo can import them without pulling Mongoose
 * into the client bundle. This module adds only the database-backed operations
 * and re-exports the helpers so callers have a single import site.
 *
 * With no stored document — or a stored one that fails validation — the API
 * falls back to the backtest winner, so routing is never undefined.
 */
import RuleConfig from '../models/RuleConfig.js';
import { builtInConfig, validateConfig, configMeta } from './ruleSchema.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

export { builtInConfig, validateConfig, configMeta };

/** Load the active config, falling back to the backtest winner. */
export async function getActiveConfig() {
  try {
    const doc = await RuleConfig.findOne({ key: 'active' }).lean();
    if (doc && doc.config && validateConfig(doc.config).length === 0) {
      return clone(doc.config);
    }
  } catch {
    // No DB available (unit tests importing the pure modules) — fall through
    // to the built-in winner rather than failing the request.
  }
  return builtInConfig();
}

/** Persist a new active config. Throws with `.validation` on bad input. */
export async function saveConfig(config, updatedBy = 'System Administrator') {
  const errors = validateConfig(config);
  if (errors.length > 0) {
    const err = new Error(errors[0]);
    err.validation = errors;
    throw err;
  }
  const doc = await RuleConfig.findOneAndUpdate(
    { key: 'active' },
    { key: 'active', config: clone(config), updatedBy },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return clone(doc.config);
}

/** Restore the backtest winner. */
export async function resetConfig(updatedBy = 'System Administrator') {
  const config = builtInConfig();
  await saveConfig(config, updatedBy);
  return config;
}

export default getActiveConfig;
