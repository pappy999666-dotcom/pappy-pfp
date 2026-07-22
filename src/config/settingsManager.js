'use strict';
/**
 * settingsManager.js — Persistent Runtime Settings for PAPPY PFP V3
 *
 * All owner-configurable settings live here and are persisted in MongoDB
 * via the Settings model. Changes take effect immediately without restart.
 *
 * Settings are split into feature groups:
 *  - drops       : Daily wallpaper drop system
 *  - watermark   : Branding/watermark config
 *  - enhancer    : Image enhancement pipeline
 *  - rateLimit   : Rate limiting per user
 *  - maintenance : Maintenance mode
 *  - logging     : Log level/debug
 *  - uploads     : Upload limits
 *  - cooldowns   : Action cooldowns
 *  - scheduler   : Scheduling config
 *  - whatsapp    : WhatsApp channel publishing
 */

const { Settings } = require('../database/models');
const logger = require('../utils/logger');

// ── Default settings ──────────────────────────────────────────────────────────
const DEFAULTS = {
  drops: {
    enabled:          true,
    autoDropEnabled:  true,
    intervalHours:    24,
    staggerMinutes:   20,
    imagesPerDrop:    10,
    categoriesPerDay: 0,   // 0 = all active categories, N = post N categories per day
    maxQuality:       true,
    minWidthPx:       400,
    minHeightPx:      500,
    recentSearches:   [],
  },
  watermark: {
    enabled:  false,
    opacity:  0.35,
    position: 'bottom-right',
    size:     48,
    marginX:  24,
    marginY:  24,
    text:     '⸸ PAPPY',
  },
  enhancer: {
    enabled:   true,
    upscale:   true,
    sharpen:   true,
    artifacts: true,
  },
  rateLimit: {
    windowMs:    60_000,
    maxRequests: 30,
  },
  maintenance: {
    enabled: false,
    message: 'PAPPY PFP is undergoing maintenance. We\'ll be back shortly.',
  },
  logging: {
    level: 'info',
    debug: false,
  },
  uploads: {
    maxImages:       30,
    maxFileSizeMB:   50,
    maxScheduleDays: 30,
  },
  cooldowns: {
    pairingMs:      60_000,
    groupJoinMs:   120_000,
    broadcastDelayMs: 80,
  },
  scheduler: {
    autoCleanupDays: 30,
    cleanupEnabled:  true,
  },
  whatsapp: {
    channelEnabled:         true,
    autoPublishDrops:       true,
    retryOnFailure:         true,
    maxRetries:             3,
    duplicatePreventionHrs: 24,
    autoJoinChannel:        'https://whatsapp.com/channel/0029VbCSVL9HLHQgReyVeE39',
    autoJoinEnabled:        true,
    forwardingEnabled:      false,
    forwardingDestinations: [],
  },
  waChannel: {
    enabled:        true,
    categories:     [],          // empty = use all CATEGORIES
    timesPerDay:    2,           // how many drops per day (evenly spaced)
    imagesPerDrop:  10,
    lastDropTimes:  {},          // { category: timestamp }
  },
  waGroup: {
    enabled:              false,
    destinations:         [],    // @g.us JIDs
    timesPerDay:          2,     // morning + night
    buttonText:           '📢 Join Our Channel',
    buttonUrl:            '',
    lastSent:             {},    // { jid: timestamp }
    mentionAll:           true,
  },
  categories: {
    // Which wallpaper categories are active (all on by default)
    disabled: [],
  },
};

// ── In-memory runtime cache ───────────────────────────────────────────────────
let _cache = null;

async function _load() {
  try {
    const all = await Settings.find({});
    const result = {};
    for (const doc of all) {
      result[doc.key] = doc.value;
    }
    return result;
  } catch (err) {
    logger.warn('Settings load failed — using defaults: ' + err.message);
    return {};
  }
}

async function _init() {
  if (_cache) return;
  const stored = await _load();
  _cache = {};
  for (const [group, defaults] of Object.entries(DEFAULTS)) {
    _cache[group] = { ...defaults, ...(stored[group] || {}) };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get all settings (initialises from DB on first call).
 */
async function getAll() {
  await _init();
  return { ..._cache };
}

/**
 * Get a specific setting group.
 */
async function getGroup(group) {
  await _init();
  return { ...(_cache[group] || {}) };
}

/**
 * Get a single nested value.
 * Example: get('watermark.enabled')
 */
async function get(dotPath) {
  await _init();
  const [group, key] = dotPath.split('.');
  if (key === undefined) return _cache[group];
  return _cache[group]?.[key];
}

/**
 * Update a setting group with a partial patch.
 * Persists to MongoDB immediately.
 */
async function setGroup(group, patch) {
  await _init();
  if (!_cache[group]) _cache[group] = { ...(DEFAULTS[group] || {}) };
  _cache[group] = { ..._cache[group], ...patch };
  try {
    await Settings.findOneAndUpdate(
      { key: group },
      { key: group, value: _cache[group], updatedAt: new Date() },
      { upsert: true }
    );
  } catch (err) {
    logger.error('Settings save failed: ' + err.message);
  }
}

/**
 * Set a single value at a dot-path.
 * Example: set('watermark.enabled', true)
 */
async function set(dotPath, value) {
  const [group, key] = dotPath.split('.');
  if (key === undefined) {
    return setGroup(group, value);
  }
  await _init();
  if (!_cache[group]) _cache[group] = { ...(DEFAULTS[group] || {}) };
  _cache[group][key] = value;
  await setGroup(group, _cache[group]);
}

/**
 * Toggle a boolean setting. Returns the new value.
 */
async function toggle(dotPath) {
  const current = await get(dotPath);
  const newVal  = !current;
  await set(dotPath, newVal);
  return newVal;
}

/**
 * Reset a group to factory defaults.
 */
async function resetGroup(group) {
  if (!DEFAULTS[group]) return;
  _cache[group] = { ...DEFAULTS[group] };
  try {
    await Settings.findOneAndUpdate(
      { key: group },
      { key: group, value: _cache[group], updatedAt: new Date() },
      { upsert: true }
    );
  } catch (err) {
    logger.error('Settings reset failed: ' + err.message);
  }
}

/**
 * Invalidate in-memory cache so next access re-reads from DB.
 */
function invalidate() {
  _cache = null;
}

/**
 * Get defaults (for display in the owner panel).
 */
function getDefaults() {
  return { ...DEFAULTS };
}

module.exports = { getAll, getGroup, get, setGroup, set, toggle, resetGroup, invalidate, getDefaults, DEFAULTS };
