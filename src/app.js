require('dotenv').config();
const http = require('http');
const config = require('./config');
const { Telegraf } = require('telegraf');
const { connectDB } = require('./database/connect');
const mongoose = require('mongoose');
const logger = require('./utils/logger');
const sm = require('./config/settingsManager');
const ui = require('./utils/ui');
const perfMonitor = require('./utils/performanceMonitor');
const ows = require('./handlers/ownerSettingsHandler');

// ── Global error guards ───────────────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error('[UnhandledRejection] ' + (reason?.stack || reason?.message || String(reason)));
});
process.on('uncaughtException', (err) => {
  logger.error('[UncaughtException] ' + (err?.stack || err?.message || String(err)));
});
process.on('SIGPIPE', () => {
  logger.warn('[SIGPIPE] Ignored broken pipe');
});

const { sessionMiddleware } = require('./middleware/session');
const { rateLimitMiddleware } = require('./middleware/rateLimit');
const { upsertUser, isOwner } = require('./middleware/auth');
const { start: startCmd } = require('./commands/start');
const { route: cbRoute } = require('./handlers/callbackRouter');
const { route: msgRoute } = require('./handlers/messageRouter');
const { handleInlineQuery } = require('./inline/inlineHandler');
const { startWorker, restoreJobs } = require('./schedulers/autoChange');
const { startGroupPfpScheduler, stopGroupPfpScheduler } = require('./schedulers/groupPfpScheduler');
const { startWallpaperScheduler, stopWallpaperScheduler } = require('./schedulers/wallpaperScheduler');
const { connectOwnerWA, setupGroupEventListeners, disconnectOwner } = require('./services/ownerWhatsapp');
const { addAdminChannel, removeAdminChannel, addChat, removeChat } = require('./services/wallpaper');
const { btn, PRIMARY, SUCCESS } = require('./utils/buttonStyles');

if (!config.botToken) { logger.error('BOT_TOKEN missing!'); process.exit(1); }

const PORT = process.env.PORT || 8080;

// Minimal health-check HTTP server so Replit workflow port check passes
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', bot: config.bot.name, version: config.bot.version }));
});

const bot = new Telegraf(config.botToken);

async function launch() {
  // 1. Start HTTP health server immediately
  await new Promise(resolve => server.listen(PORT, () => {
    logger.info(`Health server on port ${PORT}`);
    resolve();
  }));

  // 2. Connect DB
  await connectDB();

  // 3. Initialize settings manager
  await sm.getAll();

  // 4. Register bot middleware
  bot.use(upsertUser);
  bot.use(sessionMiddleware());
  bot.use(rateLimitMiddleware());
  
  bot.use(async (ctx, next) => {
    // Skip maintenance check for owners
    if (isOwner(ctx.from?.id)) return next();
    const maint = await sm.get('maintenance.enabled');
    if (maint) {
      const msg = await sm.get('maintenance.message');
      await ctx.reply(ui.warn('Maintenance Mode', msg || 'Back soon!'), { parse_mode: 'Markdown' });
      return; // Don't call next()
    }
    return next();
  });

  // 5. Register all commands and handlers
  bot.start(async ctx => { await startCmd(ctx, bot); });

  bot.help(async ctx => {
    await ctx.reply(
      `*${config.bot.name} Help*\n\n` +
      `/start - Main menu\n` +
      `/help - This message\n` +
      `/imagine <prompt> - Generate an AI image\n` +
      `/download <url> - Download media\n` +
      `/setname <name> - Change WA display name\n\n` +
      `Use inline buttons to navigate.`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('imagine', async ctx => {
    const prompt = ctx.message.text?.split(' ').slice(1).join(' ').trim();
    const { promptUser, handlePrompt } = require('./handlers/imageGenHandler');
    if (!prompt) return promptUser(ctx);
    const { setState } = require('./middleware/session');
    setState(ctx.from.id, { step: 'imagegen_prompt' });
    ctx.message = { ...ctx.message, text: prompt };
    return handlePrompt(ctx, bot);
  });

  const { jidCommand, jidUserCommand } = require('./commands/jid');
  bot.command('jid', ctx => jidCommand(ctx));
  bot.command('jiduser', ctx => jidUserCommand(ctx));

  bot.command('setname', async ctx => {
    const name = ctx.message.text?.split(' ').slice(1).join(' ').trim();
    const { Session } = require('./database/models');
    const tid = String(ctx.from.id);
    const sessions = await Session.find({ telegramId: tid, isActive: true });
    if (!sessions.length) {
      return ctx.reply('No paired WhatsApp accounts. Pair one first.', {
        reply_markup: { inline_keyboard: [
          [btn('📱 Pair WhatsApp', 'pair_wa', SUCCESS)],
        ]},
      });
    }
    if (!name) {
      if (sessions.length === 1) {
        const { setState } = require('./middleware/session');
        setState(ctx.from.id, { step: 'setname_text', num: sessions[0].whatsappNumber });
        return ctx.reply('Send the new display name:');
      }
      const btns = sessions.map(s => [btn(`+${s.whatsappNumber}`, `setname:${s.whatsappNumber}`, PRIMARY)]);
      return ctx.reply('Choose account:', { reply_markup: { inline_keyboard: btns } });
    }
    if (name.length > 25) return ctx.reply('Max 25 characters.');
    const num = sessions[0].whatsappNumber;
    const msg = await ctx.reply(`⏳ Changing name to *${name}*...`, { parse_mode: 'Markdown' });
    try {
      const { setDisplayName } = require('./services/whatsapp');
      await setDisplayName(tid, num, name);
      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `✅ *Name changed to "${name}"*`, { parse_mode: 'Markdown' });
    } catch (e) {
      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ Failed: ${e.message}`).catch(() => {});
    }
  });

  bot.on('inline_query', handleInlineQuery);
  bot.on('callback_query', ctx => cbRoute(ctx, bot));

  bot.on('my_chat_member', async ctx => {
    const update = ctx.myChatMember;
    if (!update) return;
    const { chat, new_chat_member: nc, old_chat_member: oc } = update;
    const chatId = chat.id;

    const joined = ['member', 'administrator', 'creator'].includes(nc?.status);
    const wasIn  = ['member', 'administrator', 'creator'].includes(oc?.status);
    const left   = ['left', 'kicked', 'restricted'].includes(nc?.status);

    if (joined && !wasIn) {
      addChat(chatId);
      logger.info(`Bot joined ${chat.type} ${chatId} (${chat.title || ''}) — added to auto-drop`);
    }
    if (nc?.status === 'administrator' && oc?.status !== 'administrator') {
      addAdminChannel(chatId);
      logger.info(`Bot became admin in ${chatId}`);
    }
    if (left) {
      removeChat(chatId);
      removeAdminChannel(chatId);
      logger.info(`Bot left ${chatId} — removed from auto-drop`);
    }
    if (nc?.status !== 'administrator' && oc?.status === 'administrator') {
      removeAdminChannel(chatId);
    }
  });

  bot.on('message', async ctx => {
    if (ctx.chat?.type && ctx.chat.type !== 'private') addChat(ctx.chat.id);
    await msgRoute(ctx, bot);
  });

  bot.catch((err, ctx) => logger.error(`[${ctx?.updateType}] ${err.message}`));

  // 6. Start schedulers
  try {
    await startWorker(bot);
    await restoreJobs(bot);
  } catch (e) {
    logger.warn('Redis unavailable — auto-change scheduler disabled: ' + e.message);
  }

  startGroupPfpScheduler(bot);
  startWallpaperScheduler(bot);

  // Memory monitoring
  perfMonitor.start(30 * 60 * 1000);

  const { Settings } = require('./database/models');
  const savedNum = await Settings.findOne({ key: 'ownerWaNumber' });
  if (savedNum?.value && !config.ownerWaNumber) {
    config.ownerWaNumber = savedNum.value;
    logger.info(`Owner WA loaded: +${savedNum.value}`);
  }

  if (config.ownerWaNumber) {
    try {
      await connectOwnerWA({
        onConnected: () => {
          setupGroupEventListeners(bot);
          logger.info(`Owner WA connected: +${config.ownerWaNumber}`);
        },
      });
    } catch (e) {
      logger.warn('Owner WA auto-connect failed: ' + e.message);
    }
  }

  // 7. Launch bot
  await bot.launch({ dropPendingUpdates: true });

  // 8. Fetch bot username
  try {
    const me = await bot.telegram.getMe();
    config.bot.username = me.username || '';
    logger.info(`Bot username: @${config.bot.username}`);
  } catch (e) {
    logger.warn('Could not fetch bot username: ' + e.message);
  }

  // 9. Register command hints
  const privateCommands = [
    { command: 'start',    description: '🏠 Open main menu' },
    { command: 'help',     description: '❓ Help & guide' },
    { command: 'imagine',  description: '🎨 Generate AI image' },
    { command: 'download', description: '📥 Download media from URL' },
    { command: 'setname',  description: '✏️ Change WhatsApp display name' },
    { command: 'jid',      description: '🔍 List WA group/channel JIDs (owner)' },
  ];
  const groupCommands = [
    { command: 'start',    description: '🏠 Open bot menu in DM' },
    { command: 'imagine',  description: '🎨 Generate AI image' },
    { command: 'download', description: '📥 Download media from URL' },
    { command: 'help',     description: '❓ Bot help & commands' },
  ];
  await Promise.allSettled([
    bot.telegram.setMyCommands(privateCommands, { scope: { type: 'default' } }),
    bot.telegram.setMyCommands(groupCommands,   { scope: { type: 'all_group_chats' } }),
  ]);
  logger.info('Bot commands registered for private + group scopes');

  // 10. Print clean startup banner
  logger.info('╔══════════════════════════════╗');
  logger.info('║    PAPPY PFP V3 — ONLINE     ║');
  logger.info('║  Telegram + WhatsApp Premium ║');
  logger.info('╚══════════════════════════════╝');

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`\n[${signal}] Shutting down gracefully...`);
    try {
      if (typeof stopWallpaperScheduler === 'function') stopWallpaperScheduler();
      if (typeof stopGroupPfpScheduler === 'function') stopGroupPfpScheduler();
    } catch(e) {}
    try { bot.stop(signal); } catch(e) {}
    try { server.close(); } catch(e) {}
    try { await mongoose.connection.close(); } catch(e) {}
    try {
      if (typeof disconnectOwner === 'function') await disconnectOwner();
    } catch(e) {}
    try { perfMonitor.stop(); } catch(e) {}
    logger.info('Shutdown complete.');
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

launch().catch(err => { logger.error('Launch failed: ' + err.message); process.exit(1); });
