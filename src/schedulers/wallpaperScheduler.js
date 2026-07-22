'use strict';
const { CATEGORIES, runCategoryDrop, postWallpapersToWA, downloadAndStoreWallpapers } = require('../services/wallpaper');
const logger = require('../utils/logger');
const sm = require('../config/settingsManager');

let _tgTimer = null;
let _waTimer = null;
let _tgIdx = 0;
let _waIdx = 0;

async function getActiveTgCats() {
  const catCfg = await sm.getGroup('categories');
  const disabled = catCfg.disabled || [];
  return CATEGORIES.filter(c => !disabled.includes(c) && !disabled.includes(`wp_${c}`));
}

async function getActiveWaCats() {
  const waCfg = await sm.getGroup('waChannel');
  if (Array.isArray(waCfg.categories) && waCfg.categories.length) return waCfg.categories;
  return ['anime','dark_anime','cute_anime','manhwa','aesthetic','amoled',
          'pappy_digital_art','pappy_cute_pfp','pappy_black_anime','pappy_manhwa_dark'];
}

async function scheduleNextTgDrop(bot) {
  const drops = await sm.getGroup('drops');
  if (!drops.enabled || !drops.autoDropEnabled) {
    _tgTimer = setTimeout(() => scheduleNextTgDrop(bot), 30 * 60 * 1000);
    return;
  }
  const cats = await getActiveTgCats();
  if (!cats.length) { _tgTimer = setTimeout(() => scheduleNextTgDrop(bot), 60 * 60 * 1000); return; }

  // categoriesPerDay controls how many drops per day; interval = 24h / categoriesPerDay
  const perDay = Math.min(cats.length, Math.max(1, parseInt(drops.categoriesPerDay, 10) || cats.length));
  const intervalMs = Math.floor(24 * 60 * 60 * 1000 / perDay);
  const category = cats[_tgIdx % cats.length];
  logger.info(`Next TG drop: ${category} in ${Math.round(intervalMs / 60000)}m (${perDay}/day)`);

  _tgTimer = setTimeout(async () => {
    _tgIdx = (_tgIdx + 1) % cats.length;
    try { await runCategoryDrop(bot, category); }
    catch (e) { logger.error(`TG drop (${category}): ${e.message}`); }
    scheduleNextTgDrop(bot);
  }, intervalMs);
}

async function scheduleNextWaDrop(bot) {
  const waCfg = await sm.getGroup('waChannel');
  if (!waCfg.enabled) { _waTimer = setTimeout(() => scheduleNextWaDrop(bot), 60 * 60 * 1000); return; }
  const cats = await getActiveWaCats();
  if (!cats.length) { _waTimer = setTimeout(() => scheduleNextWaDrop(bot), 60 * 60 * 1000); return; }

  const perDay = Math.max(1, parseInt(waCfg.timesPerDay, 10) || 2);
  const intervalMs = Math.floor(24 * 60 * 60 * 1000 / perDay);
  const category = cats[_waIdx % cats.length];
  logger.info(`Next WA drop: ${category} in ${Math.round(intervalMs / 60000)}m (${perDay}/day)`);

  _waTimer = setTimeout(async () => {
    _waIdx = (_waIdx + 1) % cats.length;
    try {
      await downloadAndStoreWallpapers(category, 12);
      await postWallpapersToWA(category);
    } catch (e) { logger.error(`WA drop (${category}): ${e.message}`); }
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
  _tgIdx = 0; _waIdx = 0;
  startWallpaperScheduler(bot);
}

module.exports = { startWallpaperScheduler, stopWallpaperScheduler, restartWallpaperScheduler };
