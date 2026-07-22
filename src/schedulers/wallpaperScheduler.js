'use strict';
const { CATEGORIES, runCategoryDrop, postWallpapersToWA, downloadAndStoreWallpapers } = require('../services/wallpaper');
const logger = require('../utils/logger');
const sm = require('../config/settingsManager');

let _tgTimer = null;
let _waTimer = null;
let _tgCategoryIndex = 0;
let _waCategoryIndex = 0;

// ── Telegram Channel Scheduler ────────────────────────────────────────────────
async function scheduleNextTgDrop(bot) {
  const drops = await sm.getGroup('drops');
  if (!drops.enabled || !drops.autoDropEnabled) {
    _tgTimer = setTimeout(() => scheduleNextTgDrop(bot), 60 * 60 * 1000); // check again in 1h
    return;
  }

  const cats = CATEGORIES;
  const intervalHours = drops.intervalHours || 24;
  const staggerMinutes = drops.staggerMinutes || 20;
  const dropIntervalMs = Math.floor((intervalHours * 60 * 60 * 1000) / cats.length) + (staggerMinutes * 60 * 1000);

  const category = cats[_tgCategoryIndex % cats.length];
  logger.info(`Next TG drop: ${category} in ${Math.round(dropIntervalMs / 60000)} minutes`);

  _tgTimer = setTimeout(async () => {
    _tgCategoryIndex++;
    try {
      await runCategoryDrop(bot, category);
    } catch (e) {
      logger.error(`TG scheduler (${category}): ${e.message}`);
    }
    scheduleNextTgDrop(bot);
  }, dropIntervalMs);
}

// ── WhatsApp Channel Scheduler ────────────────────────────────────────────────
async function scheduleNextWaDrop(bot) {
  const waCfg = await sm.getGroup('waChannel');
  if (!waCfg.enabled) {
    _waTimer = setTimeout(() => scheduleNextWaDrop(bot), 60 * 60 * 1000);
    return;
  }

  // Categories for WA — use custom list or fall back to all
  const cats = (Array.isArray(waCfg.categories) && waCfg.categories.length)
    ? waCfg.categories
    : CATEGORIES;

  const timesPerDay = Math.max(1, parseInt(waCfg.timesPerDay, 10) || 2);
  const intervalMs = Math.floor(24 * 60 * 60 * 1000 / timesPerDay);

  const category = cats[_waCategoryIndex % cats.length];
  logger.info(`Next WA drop: ${category} in ${Math.round(intervalMs / 60000)} minutes`);

  _waTimer = setTimeout(async () => {
    _waCategoryIndex++;
    try {
      await downloadAndStoreWallpapers(category, 12);
      await postWallpapersToWA(category);
    } catch (e) {
      logger.error(`WA scheduler (${category}): ${e.message}`);
    }
    scheduleNextWaDrop(bot);
  }, intervalMs);
}

function startWallpaperScheduler(bot) {
  if (!_tgTimer) scheduleNextTgDrop(bot);
  if (!_waTimer) scheduleNextWaDrop(bot);
}

function stopWallpaperScheduler() {
  if (_tgTimer) { clearTimeout(_tgTimer); _tgTimer = null; }
  if (_waTimer) { clearTimeout(_waTimer); _waTimer = null; }
}

function restartWallpaperScheduler(bot) {
  stopWallpaperScheduler();
  startWallpaperScheduler(bot);
}

module.exports = { startWallpaperScheduler, stopWallpaperScheduler, restartWallpaperScheduler };
