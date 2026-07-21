'use strict';
const { isOwnerConnected, getOwnerSock } = require('../services/ownerWhatsapp');
const { getSock, getActiveSessions } = require('../services/whatsapp');
const { Session, Channel } = require('../database/models');
const config = require('../config');
const ui = require('../utils/ui');

// /jid — list all groups/channels the owner WA is in
// /jid <invite_link> — resolve a group invite link to JID
async function jidCommand(ctx) {
  if (!config.ownerIds.includes(String(ctx.from.id))) return;

  const args = ctx.message.text?.split(' ').slice(1).join(' ').trim();

  if (args) {
    // Resolve a single invite link
    const inviteCode = args
      .replace('https://chat.whatsapp.com/', '')
      .replace('https://whatsapp.com/channel/', '')
      .trim();

    if (!isOwnerConnected()) {
      return ctx.reply(ui.error('Owner WA Not Connected', 'Pair it first via Owner Panel → Pair Owner WA.'), { parse_mode: 'HTML' });
    }
    const sock = getOwnerSock();
    try {
      // Try group first
      const info = await sock.groupGetInviteInfo(inviteCode).catch(() => null);
      if (info) {
        return ctx.reply([
          `🔍 ${ui.bold('Group Info')}`,
          `<blockquote>📛 Name: ${ui.bold(info.subject || 'Unnamed')}\n🆔 JID: ${ui.code(info.id)}\n👥 Participants: ${ui.bold(String(info.size || '?'))}</blockquote>`,
          `\n${ui.italic('Copy the JID above and add it via Owner Panel → Channel Management')}`,
        ].join('\n'), { parse_mode: 'HTML' });
      }
      // Try newsletter
      const nlMeta = await sock.newsletterMetadata('invite', inviteCode).catch(() => null);
      if (nlMeta) {
        return ctx.reply([
          `🔍 ${ui.bold('Newsletter / Channel Info')}`,
          `<blockquote>📛 Name: ${ui.bold(nlMeta.name || 'Unnamed')}\n🆔 JID: ${ui.code(nlMeta.id)}\n👥 Subscribers: ${ui.bold(String(nlMeta.subscriberCount || '?'))}</blockquote>`,
          `\n${ui.italic('Copy the JID above and add it via Owner Panel → Channel Management')}`,
        ].join('\n'), { parse_mode: 'HTML' });
      }
      return ctx.reply(ui.error('Could Not Resolve', 'Link may be invalid or expired.'), { parse_mode: 'HTML' });
    } catch (e) {
      return ctx.reply(ui.error('Resolve Failed', e.message), { parse_mode: 'HTML' });
    }
  }

  // List all groups & channels
  if (!isOwnerConnected()) {
    return ctx.reply(ui.error('Owner WA Not Connected', 'Pair it first via Owner Panel → Pair Owner WA.'), { parse_mode: 'HTML' });
  }

  const sock = getOwnerSock();
  const wait = await ctx.reply(ui.loading('Fetching all groups & channels...'), { parse_mode: 'HTML' });

  try {
    const chats = await sock.groupFetchAllParticipating();
    const entries = Object.values(chats);

    if (!entries.length) {
      await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null,
        ui.info('No Groups Found', 'Owner WA is not in any groups or channels.'),
        { parse_mode: 'HTML' }
      );
      return;
    }

    const groups   = entries.filter(c => c.id.endsWith('@g.us'));
    const channels = entries.filter(c => c.id.endsWith('@newsletter'));

    const lines = [`🆔 ${ui.bold('WhatsApp JID List')}\n`];

    if (groups.length) {
      lines.push(`${ui.bold(`👥 Groups (${groups.length}):`)}`)
      for (const g of groups) lines.push(`• ${ui.bold(g.subject || 'Unnamed')}\n  ${ui.code(g.id)}`);
      lines.push('');
    }
    if (channels.length) {
      lines.push(`${ui.bold(`📢 Channels (${channels.length}):`)}`)
      for (const c of channels) lines.push(`• ${ui.bold(c.subject || 'Unnamed')}\n  ${ui.code(c.id)}`);
    }

    lines.push(`\n${ui.italic('Copy any JID and add it via Owner Panel → Channel Management')}`);
    lines.push(`${ui.italic('Use /resolve <link> to convert an invite link to JID')}`);

    const text = lines.join('\n');

    if (text.length > 4000) {
      await ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(() => {});
      const chunks = [];
      let chunk = '';
      for (const line of text.split('\n')) {
        if ((chunk + line).length > 3800) { chunks.push(chunk); chunk = ''; }
        chunk += line + '\n';
      }
      if (chunk) chunks.push(chunk);
      for (const c of chunks) await ctx.reply(c, { parse_mode: 'HTML' });
    } else {
      await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null, text, { parse_mode: 'HTML' });
    }
  } catch (e) {
    await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null,
      ui.error('Fetch Failed', e.message), { parse_mode: 'HTML' }
    ).catch(() => {});
  }
}

// /resolve <wa_channel_url_or_invite> — resolve invite link → JID and optionally update DB channel
async function resolveCommand(ctx) {
  if (!config.ownerIds.includes(String(ctx.from.id))) return;

  const args = ctx.message.text?.split(' ').slice(1).join(' ').trim();
  if (!args) {
    return ctx.reply([
      `${ui.bold('/resolve — Convert WA invite link to JID')}`,
      '',
      '<blockquote>Usage: /resolve &lt;link&gt;\n\nExamples:\n/resolve https://whatsapp.com/channel/0029VbXXXX\n/resolve https://chat.whatsapp.com/ABCDEF123</blockquote>',
    ].join('\n'), { parse_mode: 'HTML' });
  }

  if (!isOwnerConnected()) {
    return ctx.reply(ui.error('Owner WA Not Connected', 'Pair it first via Owner Panel → Pair Owner WA.'), { parse_mode: 'HTML' });
  }

  const sock = getOwnerSock();
  const wait = await ctx.reply(ui.loading('Resolving link...'), { parse_mode: 'HTML' });

  // Extract invite code
  const inviteCode = args
    .replace(/https?:\/\/whatsapp\.com\/channel\//i, '')
    .replace(/https?:\/\/chat\.whatsapp\.com\//i, '')
    .trim();

  try {
    // Try newsletter first (WA Channel)
    let jid = null;
    let name = null;
    let type = 'unknown';

    try {
      const nlMeta = await sock.newsletterMetadata('invite', inviteCode);
      if (nlMeta?.id) {
        jid = nlMeta.id;
        name = nlMeta.name || 'Unnamed Channel';
        type = 'newsletter';
      }
    } catch {}

    // Try group invite
    if (!jid) {
      try {
        const info = await sock.groupGetInviteInfo(inviteCode);
        if (info?.id) {
          jid = info.id;
          name = info.subject || 'Unnamed Group';
          type = 'group';
        }
      } catch {}
    }

    if (!jid) {
      await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null,
        ui.error('Could Not Resolve', 'Link may be invalid, expired, or the owner WA is not connected to WhatsApp servers.'),
        { parse_mode: 'HTML' }
      ).catch(() => {});
      return;
    }

    // Update DB channel if it exists with this invite code
    const updated = await Channel.findOneAndUpdate(
      { $or: [{ link: { $regex: inviteCode } }, { chatId: inviteCode }] },
      { chatId: jid, title: name },
      { new: true }
    ).catch(() => null);

    const dbNote = updated
      ? `\n✅ ${ui.bold('DB Updated:')} Channel record updated with real JID.`
      : `\n${ui.italic('No matching channel in DB — add it via Owner Panel → Channel Management using this JID.')}`;

    await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null, [
      `✅ ${ui.bold('Resolved!')}`,
      '',
      `<blockquote>📛 Name: ${ui.bold(name)}\n🆔 JID: ${ui.code(jid)}\n📂 Type: ${ui.bold(type)}</blockquote>`,
      dbNote,
    ].join('\n'), { parse_mode: 'HTML' }).catch(() => {});

  } catch (e) {
    await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null,
      ui.error('Resolve Failed', e.message), { parse_mode: 'HTML' }
    ).catch(() => {});
  }
}

// /unfollow — list and unfollow WA newsletters/channels the owner WA is subscribed to
async function unfollowCommand(ctx) {
  if (!config.ownerIds.includes(String(ctx.from.id))) return;

  const args = ctx.message.text?.split(' ').slice(1).join(' ').trim();

  if (!isOwnerConnected()) {
    return ctx.reply(ui.error('Owner WA Not Connected', 'Pair it first via Owner Panel → Pair Owner WA.'), { parse_mode: 'HTML' });
  }

  const sock = getOwnerSock();

  // /unfollow <jid> — unfollow a specific newsletter JID
  if (args) {
    const jid = args.trim();
    if (!jid.endsWith('@newsletter')) {
      return ctx.reply(ui.warn('Invalid JID', 'Newsletter JIDs must end with <code>@newsletter</code>.\nUse /unfollow without arguments to list all subscribed channels.'), { parse_mode: 'HTML' });
    }
    const wait = await ctx.reply(ui.loading(`Unfollowing ${jid}...`), { parse_mode: 'HTML' });
    try {
      await sock.newsletterUnfollow(jid);
      await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null,
        ui.success('Unfollowed', `Successfully unfollowed:\n${jid}`), { parse_mode: 'HTML' }
      ).catch(() => {});
    } catch (e) {
      await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null,
        ui.error('Unfollow Failed', e.message), { parse_mode: 'HTML' }
      ).catch(() => {});
    }
    return;
  }

  // List all subscribed newsletters
  const wait = await ctx.reply(ui.loading('Fetching subscribed channels...'), { parse_mode: 'HTML' });
  try {
    const subscribed = await sock.newsletterSubscribed();
    if (!subscribed || !subscribed.length) {
      await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null,
        ui.info('No Subscriptions', 'Owner WA is not following any WhatsApp channels.'), { parse_mode: 'HTML' }
      ).catch(() => {});
      return;
    }

    const lines = [
      `📢 ${ui.bold(`Subscribed Channels (${subscribed.length})`)}`,
      '',
      '<blockquote>To unfollow one, copy its JID and run:\n/unfollow &lt;jid&gt;</blockquote>',
      '',
    ];

    for (const ch of subscribed) {
      const jid = ch.id || ch.jid || String(ch);
      const name = ch.name || ch.subject || 'Unnamed';
      lines.push(`• ${ui.bold(name)}\n  ${ui.code(jid)}`);
    }

    await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null,
      lines.join('\n'), { parse_mode: 'HTML' }
    ).catch(() => {});
  } catch (e) {
    await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null,
      ui.error('Fetch Failed', e.message, 'Your Baileys version may not support newsletterSubscribed.'), { parse_mode: 'HTML' }
    ).catch(() => {});
  }
}

// /jiduser <wa_number> — list all groups a specific paired user is in
async function jidUserCommand(ctx) {
  if (!config.ownerIds.includes(String(ctx.from.id))) return;

  const args = ctx.message.text?.split(' ').slice(1).join(' ').trim();
  if (!args) return ctx.reply(`Usage: ${ui.code('/jiduser <whatsapp_number>')}\nExample: ${ui.code('/jiduser 1234567890')}`, { parse_mode: 'HTML' });

  const num = args.replace(/\D/g, '');
  const session = await Session.findOne({ whatsappNumber: num, isActive: true });
  if (!session) return ctx.reply(ui.error('Session Not Found', `No active session for +${num}`), { parse_mode: 'HTML' });

  const sock = getSock(session.telegramId, num);
  if (!sock) return ctx.reply(ui.warn('Socket Inactive', 'Session exists but socket not active. User needs to reconnect.'), { parse_mode: 'HTML' });

  const wait = await ctx.reply(ui.loading(`Fetching groups for +${num}...`), { parse_mode: 'HTML' });
  try {
    const chats = await sock.groupFetchAllParticipating();
    const entries = Object.values(chats);
    if (!entries.length) {
      await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null,
        ui.info('No Groups', `+${num} is not in any groups.`), { parse_mode: 'HTML' }
      );
      return;
    }
    const lines = [`${ui.bold(`Groups for +${num} (${entries.length}):`)}`, ''];
    for (const g of entries) lines.push(`• ${ui.bold(g.subject || 'Unnamed')}\n  ${ui.code(g.id)}`);
    await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null, lines.join('\n'), { parse_mode: 'HTML' });
  } catch (e) {
    await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null,
      ui.error('Fetch Failed', e.message), { parse_mode: 'HTML' }
    ).catch(() => {});
  }
}

module.exports = { jidCommand, jidUserCommand, resolveCommand, unfollowCommand };
