'use strict';
const { User, ForceJoin } = require('../database/models');
const config = require('../config');
const { btn, SUCCESS, PRIMARY } = require('../utils/buttonStyles');
const ui = require('../utils/ui');

function isOwner(id) { return config.ownerIds.includes(String(id)); }

async function upsertUser(ctx, next) {
  if (ctx.from) {
    const { id, username, first_name, last_name } = ctx.from;
    await User.findOneAndUpdate(
      { telegramId: String(id) },
      { telegramId: String(id), username, firstName: first_name, lastName: last_name, lastActive: new Date() },
      { upsert: true }
    ).catch(() => {});
  }
  if (typeof next === 'function') return next();
}

/**
 * Resolve a usable chat identifier for getChatMember from a stored ForceJoin doc.
 * Returns @username, numeric chatId string, or null if unresolvable.
 */
function resolveChatId(fj) {
  // Already have a resolved chatId
  if (fj.chatId) return fj.chatId;

  const link = fj.link || '';

  // @username directly
  if (link.startsWith('@')) return link;

  // t.me/username (public channel)
  const usernameMatch = link.match(/t\.me\/([A-Za-z][A-Za-z0-9_]{3,})$/);
  if (usernameMatch) return '@' + usernameMatch[1];

  // Numeric ID stored as string
  if (/^-?\d+$/.test(link)) return link;

  // Invite links (t.me/+xxx or t.me/joinchat/xxx) — cannot verify membership
  return null;
}

async function checkForceJoin(ctx, bot) {
  const links = await ForceJoin.find({ isActive: true, isRequired: true, platform: 'telegram' });
  if (!links.length) return true;

  const uid = ctx.from?.id;
  if (!uid || isOwner(uid)) return true;

  const notJoined = [];
  const unverifiable = [];

  for (const fj of links) {
    const chatId = resolveChatId(fj);

    if (!chatId) {
      // Invite link — can't verify, show as required but skip membership check
      unverifiable.push(fj);
      continue;
    }

    try {
      const member = await bot.telegram.getChatMember(chatId, uid);
      const joined = ['member', 'administrator', 'creator'].includes(member?.status);
      if (!joined) notJoined.push(fj);
    } catch (e) {
      // If bot isn't in the channel or other error — treat as not joined
      notJoined.push(fj);
    }
  }

  // If all verifiable channels are joined and no unverifiable ones, allow
  if (!notJoined.length && !unverifiable.length) return true;

  // Build join buttons
  const btns = [];

  for (const fj of [...notJoined, ...unverifiable]) {
    const label = fj.title && fj.title !== fj.link
      ? `📢 ${fj.title}`
      : `📢 Join Channel`;
    btns.push([{ text: label, url: fj.link }]);
  }

  // Optional channels
  const optional = await ForceJoin.find({ isActive: true, isRequired: false, platform: 'telegram' });
  for (const fj of optional) {
    const label = fj.title && fj.title !== fj.link ? fj.title : 'Optional Channel';
    btns.push([{ text: `📌 ${label} (Optional)`, url: fj.link }]);
  }

  btns.push([btn("✅ I've Joined — Check Now", 'check_join', SUCCESS)]);

  const channelCount = notJoined.length + unverifiable.length;
  const text = [
    `🔒 ${ui.bold('Join Required')}`,
    '',
    `<blockquote>You need to join ${channelCount === 1 ? 'this channel' : `these ${channelCount} channels`} to use ${ui.esc(config.bot.name)}.\n\nTap the button${channelCount > 1 ? 's' : ''} below to join, then tap ✅ Check.</blockquote>`,
  ].join('\n');

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: btns },
  }).catch(() => {});

  return false;
}

module.exports = { isOwner, upsertUser, checkForceJoin };
