const { CATEGORIES, runCategoryDrop } = require('../services/wallpaper');
const logger = require('../utils/logger');
const sm = require('../config/settingsManager');

let _timer = null;
let _categoryIndex = 0;

async function scheduleNextDrop(bot) {
  const drops = await sm.getGroup('drops');
  const intervalHours = drops.intervalHours || 24;
  const staggerMinutes = drops.staggerMinutes || 0;
  
  const totalCategories = CATEGORIES.length;
  const dropIntervalMs = Math.floor((intervalHours * 60 * 60 * 1000) / totalCategories) + (staggerMinutes * 60 * 1000);
  
  const category = CATEGORIES[_categoryIndex % totalCategories];
  logger.info(`Next drop: ${category} in ${Math.round(dropIntervalMs / 60000)} minutes`);
  
  _timer = setTimeout(async () => {
    _categoryIndex++;
    try {
      await runCategoryDrop(bot, category);
    } catch (e) {
      logger.error(`Wallpaper scheduler (${category}): ${e.message}`);
    }
    scheduleNextDrop(bot);
  }, dropIntervalMs);
}

function startWallpaperScheduler(bot) {
  if (_timer) return;
  scheduleNextDrop(bot);
}

function stopWallpaperScheduler() {
  if (_timer) {
    clearTimeout(_timer);
    _timer = null;
  }
}

function restartWallpaperScheduler(bot) {
  stopWallpaperScheduler();
  startWallpaperScheduler(bot);
}

module.exports = { startWallpaperScheduler, stopWallpaperScheduler, restartWallpaperScheduler };
