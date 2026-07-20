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

    let channelText = '';
    if (tgChannels.length) {
      channelText += '\n> 📢 *Our Telegram Channel:*\n> ' + tgChannels.map(c => c.link).join('\n> ');
    }
    if (waChannels.length) {
      channelText += '\n> 💬 *WhatsApp Channel:*\n> ' + waChannels.map(c => c.link).join('\n> ');
    }

    const text = [
      ui.screenHeader(config.bot.name, 'Welcome', `Hello, ${name}! 🎉`),
      '',
      '> Your all-in-one WhatsApp & Media manager.',
      '',
      '*Core Features:*',
      '📸 Upload HD profile pictures with zero cropping',
      '🔄 Auto-rotate profile pics on a schedule',
      '🖼 Change WhatsApp Group profile pictures',
      '📱 Manage unlimited WhatsApp accounts',
      '📥 Download media from 8+ platforms',
      '🌄 HD Wallpaper gallery & AI Generator',
      channelText,
      '',
      ui.italic('Choose an option below to get started:')
    ].filter(Boolean).join('\n');

    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: K.mainMenu(owner) });
  } catch (err) {
    return eh.handle(ctx, err, 'start_command', 'main_menu');
  }
}

module.exports = { start };
