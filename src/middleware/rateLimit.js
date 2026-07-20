const sm = require('../config/settingsManager');
const { isOwner } = require('./auth');
const ui = require('../utils/ui');

// Per-user rate tracking (in-memory map, auto-cleared)
const userWindows = new Map();

function rateLimitMiddleware() {
  return async (ctx, next) => {
    // Skip rate limiting for owners
    if (isOwner(ctx.from?.id)) return next();
    
    const cfg = await sm.getGroup('rateLimit');
    const uid = String(ctx.from?.id || 'unknown');
    const now = Date.now();
    const window = userWindows.get(uid) || { count: 0, resetAt: now + cfg.windowMs };
    
    if (now > window.resetAt) {
      window.count = 0;
      window.resetAt = now + cfg.windowMs;
    }
    window.count++;
    userWindows.set(uid, window);
    
    if (window.count > cfg.maxRequests) {
      await ctx.reply(
        ui.warn('Slow Down', 'You are sending requests too fast. Please wait a moment.'),
        { parse_mode: 'HTML' }
      );
      return; // Don't call next()
    }
    
    return next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [uid, w] of userWindows) {
    if (now > w.resetAt) userWindows.delete(uid);
  }
}, 5 * 60 * 1000).unref();

module.exports = { rateLimitMiddleware };
