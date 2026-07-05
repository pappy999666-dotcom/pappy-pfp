const { User, ForceJoin } = require('../database/models');
const config = require('../config');
const { btn, SUCCESS } = require('../utils/buttonStyles');

function isOwner(id) { return config.ownerIds.includes(String(id)); }

async function upsertUser(ctx) {
  if (!ctx.from) return;
  const { id, username, first_name, last_name } = ctx.from;
  await User.findOneAndUpdate(
    { telegramId: String(id) },
    { telegramId: String(id), username, firstName: first_name, lastName: last_name, lastActive: new Date() },
    { upsert: true }
  ).catch(() => {});
}

async function checkForceJoin(ctx, bot) {
  const links = await ForceJoin.find({ isActive: true, isRequired: true, platform: 'telegram' });
  if (!links.length) return true;
  const uid = ctx.from?.id;
  if (!uid || isOwner(uid)) return true;

  const notJoined = [];
  for (const l of links) {
    try {
      const m = await bot.telegram.getChatMember(l.chatId || l.link, uid);
      if (!['member', 'administrator', 'creator'].includes(m?.status)) notJoined.push(l);
    } catch { notJoined.push(l); }
  }
  if (!notJoined.length) return true;

  // Required channel join buttons — URL type (no color, just link)
  const btns = notJoined.map(l => [{ text: `${l.title || l.link}`, url: l.link }]);

  const optionalLinks = await ForceJoin.find({ isActive: true, isRequired: false });
  for (const l of optionalLinks) {
    btns.push([{ text: `${l.title || l.link} (Optional)`, url: l.link }]);
  }

  // Green "I've Joined" check button
  btns.push([btn("✅ I've Joined - Check", 'check_join', SUCCESS)]);

  await ctx.reply(
    `*Join Required*\n\nJoin the channels below before using ${config.bot.name}:`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns } }
  ).catch(() => {});
  return false;
}

module.exports = { isOwner, upsertUser, checkForceJoin };
