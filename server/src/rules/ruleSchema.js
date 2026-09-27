/**
 * Rule schema — pure helpers for the editable Assignment Rule config.
 *
 * Deliberately free of any database import so the browser demo can use it.
 * (An earlier version lived inside configStore.js, which imports the Mongoose
 * model — that would have pulled Mongoose into the client bundle.)
 *
 * The validation here is the boundary that protects the fixed ServiceNow
 * vocabulary: categories, assignmentGroups, urgencies and the four statuses
 * can never be changed by a rule edit — only mappings, keyword weights,
 * thresholds and the priority matrix.
 */
import { DEFAULT_CONFIG, ASSIGNMENT_RULE } from '../triage/triageRequest.js';
import { DEFAULT_PRIORITY_MATRIX, IMPACTS, URGENCY_KEYS } from '../triage/priorityMatrix.js';
import { CATEGORIES, ASSIGNMENT_GROUPS, URGENCIES } from '../constants.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

/** The out-of-box config: the winning config from `npm run backtest`. */
export function builtInConfig() {
  return {
    categoryBaseUrgency: clone(DEFAULT_CONFIG.categoryBaseUrgency),
    keywords: clone(DEFAULT_CONFIG.keywords),
    thresholds: clone(DEFAULT_CONFIG.thresholds),
    assignmentRule: clone(ASSIGNMENT_RULE),
    priorityMatrix: clone(DEFAULT_PRIORITY_MATRIX),
  };
}

/**
 * validateConfig(config) -> string[]
 *
 * Empty result means valid. Deliberately exhaustive: every rejection names the
 * offending field so the Rules Console can show it verbatim instead of a
 * generic failure.
 */
export function validateConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return ['config must be an object'];
  }

  // --- category base urgency -------------------------------------------------
  const cbu = config.categoryBaseUrgency;
  if (!cbu || typeof cbu !== 'object' || Array.isArray(cbu)) {
    errors.push('categoryBaseUrgency is required');
  } else {
    for (const category of CATEGORIES) {
      if (!(category in cbu)) errors.push(`categoryBaseUrgency is missing category "${category}"`);
    }
    for (const [key, value] of Object.entries(cbu)) {
      if (!CATEGORIES.includes(key)) errors.push(`categoryBaseUrgency has unknown category "${key}"`);
      if (!URGENCIES.includes(value)) {
        errors.push(`categoryBaseUrgency["${key}"] must be one of ${URGENCIES.join(', ')}`);
      }
    }
  }

  // --- keywords -------------------------------------------------------------
  const kw = config.keywords;
  if (!kw || typeof kw !== 'object' || Array.isArray(kw)) {
    errors.push('keywords must be an object of keyword -> weight');
  } else {
    const keys = Object.keys(kw);
    if (keys.length === 0) errors.push('keywords must contain at least one keyword');
    if (keys.length > 80) errors.push('keywords may not exceed 80 entries');
    for (const [key, weight] of Object.entries(kw)) {
      if (!String(key).trim()) errors.push('keyword keys may not be empty');
      if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0 || weight > 5) {
        errors.push(`keyword "${key}" weight must be a number between 0 and 5`);
      }
    }
  }

  // --- thresholds -----------------------------------------------------------
  const t = config.thresholds;
  if (!t || typeof t !== 'object' || Array.isArray(t)) {
    errors.push('thresholds is required');
  } else {
    for (const key of ['high', 'medium']) {
      const value = t[key];
      if (!Number.isInteger(value) || value < 0 || value > 20) {
        errors.push(`thresholds.${key} must be a whole number between 0 and 20`);
      }
    }
    if (Number.isInteger(t.high) && Number.isInteger(t.medium) && t.high < t.medium) {
      errors.push('thresholds.high must be greater than or equal to thresholds.medium');
    }
  }

  // --- assignment rule ------------------------------------------------------
  const ar = config.assignmentRule;
  if (!ar || typeof ar !== 'object' || Array.isArray(ar)) {
    errors.push('assignmentRule is required');
  } else {
    for (const category of CATEGORIES) {
      if (!(category in ar)) {
        errors.push(`assignmentRule is missing category "${category}"`);
        continue;
      }
      if (!ASSIGNMENT_GROUPS.includes(ar[category])) {
        errors.push(`assignmentRule["${category}"] must be one of ${ASSIGNMENT_GROUPS.join(', ')}`);
      }
    }
    for (const key of Object.keys(ar)) {
      if (!CATEGORIES.includes(key)) errors.push(`assignmentRule has unknown category "${key}"`);
    }
  }

  // --- priority matrix ------------------------------------------------------
  const pm = config.priorityMatrix;
  if (!pm || typeof pm !== 'object' || Array.isArray(pm)) {
    errors.push('priorityMatrix is required');
  } else {
    for (const impact of IMPACTS) {
      const row = pm[impact];
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        errors.push(`priorityMatrix is missing impact "${impact}"`);
        continue;
      }
      for (const urgency of URGENCY_KEYS) {
        const value = row[urgency];
        if (!Number.isInteger(value) || value < 1 || value > 4) {
          errors.push(`priorityMatrix["${impact}"]["${urgency}"] must be a whole number between 1 and 4`);
        }
      }
    }
  }

  return errors;
}

/**
 * Keyword weight tiers, derived from the weights themselves rather than
 * hardcoded lists — so the Rules Console keeps its grouping sensible after an
 * admin edits weights.
 */
export function keywordTier(weight) {
  if (weight >= 3) return 'crisis';
  if (weight === 2) return 'acute';
  if (weight === 1) return 'pressure';
  return 'disabled';
}

export const TIER_LABELS = {
  crisis: 'Crisis language',
  acute: 'Acute need',
  pressure: 'Pressure signal',
  disabled: 'Not scored',
};

/** Group a config's keywords into tiers for the console UI. */
export function groupKeywords(keywords = {}) {
  const groups = { crisis: [], acute: [], pressure: [], disabled: [] };
  for (const [keyword, weight] of Object.entries(keywords)) {
    groups[keywordTier(weight)].push({ keyword, weight });
  }
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => a.keyword.localeCompare(b.keyword));
  }
  return groups;
}

/** Metadata about where the active config sits relative to the winner. */
export function configMeta(active) {
  return {
    isModified: JSON.stringify(active) !== JSON.stringify(builtInConfig()),
    keywordCount: Object.keys((active && active.keywords) || {}).length,
  };
}

export default builtInConfig;
