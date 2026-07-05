const { CATEGORIES, runCategoryDrop } = require('../services/wallpaper');
const logger = require('../utils/logger');

let _interval = null;
let _categoryIndex = 0;

function startWallpaperScheduler(bot) {
  if (_interval) return;

  const totalCategories = CATEGORIES.length;
  const dropIntervalMs = Math.floor((24 * 60 * 60 * 1000) / totalCategories);

  logger.info(`Wallpaper scheduler started: ${totalCategories} categories, 1 drop every ${Math.round(dropIntervalMs / 60000)} min`);

  _interval = setInterval(async () => {
    const category = CATEGORIES[_categoryIndex % totalCategories];
    _categoryIndex++;
    try {
      await runCategoryDrop(bot, category);
    } catch (e) {
      logger.error(`Wallpaper scheduler (${category}): ${e.message}`);
    }
  }, dropIntervalMs);
}

function stopWallpaperScheduler() {
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
  }
}

module.exports = { startWallpaperScheduler, stopWallpaperScheduler };
