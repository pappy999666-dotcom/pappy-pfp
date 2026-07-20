'use strict';
const K = require('../handlers/keyboards');
const config = require('../config');
const { isOwner, checkForceJoin } = require('../middleware/auth');
const { Channel } = require('../database/models');
const ui = require('../utils/ui');
const eh = require('../utils/errorHandler');

async function start(ctx, bot) {
  try {
    const canUse = await checkForceJoin(ctx, bot);
    if (!canUse) return;

    const name = ctx.from?.first_name || 'User';
    const owner = isOwner(ctx.from?.id);

    const channels = await Channel.find({ isActive: true });
    const waChannels = channels.filter(c => c.platform === 'whatsapp');
    const tgChannels = channels.filter(c => c.platform === 'telegram');

    const channelLines = [];
    if (tgChannels.length) {
      channelLines.push('📢 ' + ui.bold('Telegram:') + ' ' + tgChannels.map(c => c.link).join(', '));
    }
    if (waChannels.length) {
      channelLines.push('💬 ' + ui.bold('WhatsApp:') + ' ' + waChannels.map(c => c.link).join(', '));
    }
    const channelBlock = channelLines.length
      ? '\n<blockquote>' + channelLines.join('\n') + '</blockquote>'
      : '';

    const featuresBlock = ui.expandable([
      '📸 Upload HD profile pictures with zero cropping',
      '🔄 Auto-rotate profile pics on a schedule',
      '🖼 Change WhatsApp Group profile pictures',
      '📱 Manage unlimited WhatsApp accounts',
      '📥 Download media from 8+ platforms',
      '🌄 HD Wallpaper gallery &amp; AI Generator',
    ], 'Core Features');

    const text = ui.welcomeMessage(config.bot.name, name)
      + '\n\n' + featuresBlock
      + channelBlock;

    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: K.mainMenu(owner) });
  } catch (err) {
    return eh.handle(ctx, err, 'start_command', 'main_menu');
  }
}

module.exports = { start };
