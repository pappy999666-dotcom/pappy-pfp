'use strict';
/**
 * groupDashboardHandler.js — Per-Group Dashboard & Bulk Management
 *
 * Features:
 *  - Per-group dashboard with invite link, member/admin counts, description
 *  - Kick All Members (non-admin, non-owner, non-bot)
 *  - Kick All Admins (removable admins only, never owner or bot)
 *  - Demote All Admins (except owner and bot)
 *  - Group Invite Link (display or generate)
 *  - Approve Requests: All / By Amount / By Country
 */

const ui = require('../utils/ui');
const config = require('../config');
const logger = require('../utils/logger');
const { btn, backBtn, mainMenuBtn, PRIMARY, SUCCESS, DANGER } = require('../utils/buttonStyles');
const { setState, clearState } = require('../middleware/session');
const { isOwnerConnected, getOwnerSock } = require('../services/ownerWhatsapp');

// ── In-memory invite link cache (jid → {link, fetchedAt}) ─────────────────
const inviteCache = new Map();
const INVITE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// ── Helpers ───────────────────────────────────────────────────────────────

function requireOwnerWA(ctx, backTo = 'o_group_mgmt') {
  if (!isOwnerConnected()) {
    const text = ui.error(
      'WhatsApp Not Connected',
      'Pair the owner WhatsApp first via Owner Panel → Pair Owner WA.'
    );
    return ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[backBtn(backTo)]] },
    }).catch(() => ctx.reply(text, { parse_mode: 'HTML' }));
  }
  return null;
}

/** Resolve bot's own number for exclusion checks */
function getBotNumber(sock) {
  return (sock.user?.id || '').split('@')[0].split(':')[0];
}

/** Normalize a participant JID to its phone number string */
function jidToNum(jid) {
  return (jid || '').split('@')[0].split(':')[0];
}

/** Sleep helper */
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Batch-process an array of JIDs with live progress editing.
 * Returns { removed, failed, skipped }.
 */
async function batchGroupOp(sock, groupJid, jids, action, ctx, msgId, label) {
  const BATCH = 5;
  const DELAY = 600; // ms between batches
  let removed = 0, failed = 0;
  const total = jids.length;

  for (let i = 0; i < jids.length; i += BATCH) {
    const chunk = jids.slice(i, i + BATCH);
    try {
      await sock.groupParticipantsUpdate(groupJid, chunk, action);
      removed += chunk.length;
    } catch (e) {
      // Try one-by-one if batch fails
      for (const jid of chunk) {
        try {
          await sock.groupParticipantsUpdate(groupJid, [jid], action);
          removed++;
        } catch {
          failed++;
        }
        await sleep(200);
      }
    }

    // Live progress update every batch
    const remaining = total - removed - failed;
    const progressText = [
      ui.screenHeader(config.bot.name, label),
      '',
      `<blockquote>`,
      `✔ <b>${removed}</b> ${action === 'remove' ? 'Removed' : action === 'demote' ? 'Demoted' : 'Done'}`,
      `⏳ <b>${Math.max(0, remaining)}</b> Remaining`,
      failed ? `❌ <b>${failed}</b> Failed` : '',
      `</blockquote>`,
    ].filter(Boolean).join('\n');

    await ctx.telegram.editMessageText(ctx.chat.id, msgId, null, progressText, {
      parse_mode: 'HTML',
    }).catch(() => {});

    if (i + BATCH < jids.length) await sleep(DELAY);
  }
  return { removed, failed };
}

// ── Group List ────────────────────────────────────────────────────────────

async function groupList(ctx) {
  const err = requireOwnerWA(ctx, 'owner');
  if (err) return err;

  const sock = getOwnerSock();
  const wait = await ctx.editMessageText(ui.loading('Fetching your groups...'), {
    parse_mode: 'HTML',
  }).catch(() => ctx.reply(ui.loading('Fetching your groups...'), { parse_mode: 'HTML' }));

  try {
    const chats = await sock.groupFetchAllParticipating();
    const groups = Object.values(chats).filter(x => x.id.endsWith('@g.us'));

    if (!groups.length) {
      return ctx.telegram.editMessageText(
        ctx.chat.id, wait.message_id, null,
        ui.warn('No Groups', 'The owner WhatsApp is not in any groups.'),
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[backBtn('owner')]] } }
      ).catch(() => {});
    }

    const text = [
      ui.screenHeader(config.bot.name, 'Group Management'),
      '',
      `<blockquote>Found <b>${groups.length}</b> group${groups.length !== 1 ? 's' : ''}. Select one to manage.</blockquote>`,
    ].join('\n');

    // Up to 20 groups as buttons (2 per row)
    const shown = groups.slice(0, 20);
    const groupBtns = [];
    for (let i = 0; i < shown.length; i += 2) {
      const row = [btn(
        ui.truncate(shown[i].subject || 'Unnamed', 22),
        `grp_dash:${shown[i].id}`,
        PRIMARY
      )];
      if (shown[i + 1]) row.push(btn(
        ui.truncate(shown[i + 1].subject || 'Unnamed', 22),
        `grp_dash:${shown[i + 1].id}`,
        PRIMARY
      ));
      groupBtns.push(row);
    }
    if (groups.length > 20) {
      groupBtns.push([btn(`… and ${groups.length - 20} more (use /jid to view all)`, 'o_jid', PRIMARY)]);
    }
    groupBtns.push([backBtn('owner')]);

    await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: groupBtns },
    }).catch(() => {});
  } catch (e) {
    logger.error('[GroupDash] groupList: ' + e.message);
    await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null,
      ui.error('Failed to fetch groups', e.message),
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[backBtn('owner')]] } }
    ).catch(() => {});
  }
}

// ── Per-Group Dashboard ───────────────────────────────────────────────────

async function groupDash(ctx, groupJid) {
  const err = requireOwnerWA(ctx, 'o_group_mgmt');
  if (err) return err;

  const sock = getOwnerSock();
  const wait = await ctx.editMessageText(ui.loading('Loading group dashboard...'), {
    parse_mode: 'HTML',
  }).catch(() => ctx.reply(ui.loading('Loading...'), { parse_mode: 'HTML' }));

  try {
    const meta = await sock.groupMetadata(groupJid);

    const total = meta.participants.length;
    const admins = meta.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
    const members = total - admins.length;
    const createdAt = meta.creation
      ? new Date(meta.creation * 1000).toLocaleDateString('en-GB')
      : 'Unknown';

    // Invite link from cache or fetch
    let inviteLink = '—';
    const cached = inviteCache.get(groupJid);
    if (cached && Date.now() - cached.fetchedAt < INVITE_CACHE_TTL) {
      inviteLink = cached.link;
    } else {
      try {
        const code = await sock.groupInviteCode(groupJid);
        inviteLink = `https://chat.whatsapp.com/${code}`;
        inviteCache.set(groupJid, { link: inviteLink, fetchedAt: Date.now() });
      } catch {
        inviteLink = '⚠️ No permission to fetch link';
      }
    }

    const desc = meta.desc ? ui.truncate(meta.desc, 120) : 'No description set.';

    const text = [
      ui.screenHeader(config.bot.name, 'Group Dashboard'),
      '',
      `<b>${ui.esc(meta.subject || 'Unnamed Group')}</b>`,
      '',
      `<blockquote>`,
      `👥 Members: <b>${members}</b>`,
      `👑 Admins: <b>${admins.length}</b>`,
      `📅 Created: <b>${createdAt}</b>`,
      `</blockquote>`,
      '',
      `📋 <b>Description</b>`,
      `<blockquote>${ui.esc(desc)}</blockquote>`,
      '',
      `🔗 <b>Invite Link</b>`,
      `<blockquote expandable>${ui.esc(inviteLink)}</blockquote>`,
    ].join('\n');

    const jidShort = `grp_dash:${groupJid}`;
    const keyboards = [
      [btn('🔗 Refresh Invite Link', `grp_invite:${groupJid}`, PRIMARY)],
      [btn('📋 Approve Requests', `grp_approve:${groupJid}`, SUCCESS)],
      [btn('⬇️ Demote All Admins', `grp_demote:${groupJid}`, DANGER)],
      [btn('👢 Kick All Admins', `grp_kick_adm:${groupJid}`, DANGER)],
      [btn('💣 Kick All Members', `grp_kick_all:${groupJid}`, DANGER)],
      [backBtn('o_group_mgmt')],
    ];

    await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboards },
    }).catch(() => {});
  } catch (e) {
    logger.error('[GroupDash] groupDash: ' + e.message);
    await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null,
      ui.error('Failed to load group', e.message),
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[backBtn('o_group_mgmt')]] } }
    ).catch(() => {});
  }
}

// ── Invite Link ───────────────────────────────────────────────────────────

async function refreshInviteLink(ctx, groupJid) {
  const err = requireOwnerWA(ctx, `grp_dash:${groupJid}`);
  if (err) return err;

  const sock = getOwnerSock();
  // Invalidate cache
  inviteCache.delete(groupJid);

  try {
    const code = await sock.groupInviteCode(groupJid);
    const link = `https://chat.whatsapp.com/${code}`;
    inviteCache.set(groupJid, { link, fetchedAt: Date.now() });

    const text = [
      ui.screenHeader(config.bot.name, 'Group Invite Link'),
      '',
      `<blockquote>${ui.esc(link)}</blockquote>`,
      '',
      ui.info('Tap to copy', 'Hold the link above to copy it.'),
    ].join('\n');

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [btn('🔄 Regenerate Link', `grp_invite_new:${groupJid}`, SUCCESS)],
          [backBtn(`grp_dash:${groupJid}`)],
        ],
      },
    }).catch(() => {});
  } catch (e) {
    logger.error('[GroupDash] refreshInviteLink: ' + e.message);
    await ctx.editMessageText(ui.error('Cannot fetch invite link', e.message), {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[backBtn(`grp_dash:${groupJid}`)]] },
    }).catch(() => {});
  }
}

async function regenerateInviteLink(ctx, groupJid) {
  const err = requireOwnerWA(ctx, `grp_invite:${groupJid}`);
  if (err) return err;

  const sock = getOwnerSock();
  inviteCache.delete(groupJid);

  try {
    await sock.groupRevokeInvite(groupJid);
    const code = await sock.groupInviteCode(groupJid);
    const link = `https://chat.whatsapp.com/${code}`;
    inviteCache.set(groupJid, { link, fetchedAt: Date.now() });

    const text = [
      ui.screenHeader(config.bot.name, 'New Invite Link'),
      '',
      ui.success('Link Regenerated', 'The old link is now invalid.'),
      '',
      `<blockquote>${ui.esc(link)}</blockquote>`,
    ].join('\n');

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[backBtn(`grp_dash:${groupJid}`)]] },
    }).catch(() => {});
  } catch (e) {
    logger.error('[GroupDash] regenerateInviteLink: ' + e.message);
    await ctx.editMessageText(ui.error('Regeneration failed', e.message), {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[backBtn(`grp_dash:${groupJid}`)]] },
    }).catch(() => {});
  }
}

// ── Kick All Members ──────────────────────────────────────────────────────

async function kickAllConfirm(ctx, groupJid) {
  const text = [
    `⚠️ <b>Kick All Members</b>`,
    '',
    `<blockquote>You are about to remove <b>every non-admin member</b> from this group.\n\nThe group owner and bot will not be touched.\n\nThis action <b>cannot be undone</b>.</blockquote>`,
    '',
    `<i>Are you sure?</i>`,
  ].join('\n');

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [btn('✅ Yes — Kick All Members', `grp_kick_all_go:${groupJid}`, SUCCESS)],
        [btn('❌ Cancel', `grp_dash:${groupJid}`, DANGER)],
      ],
    },
  }).catch(() => {});
}

async function kickAllGo(ctx, groupJid) {
  const err = requireOwnerWA(ctx, `grp_dash:${groupJid}`);
  if (err) return err;

  const sock = getOwnerSock();
  const botNum = getBotNumber(sock);

  const progressMsg = await ctx.editMessageText(ui.loading('Fetching member list...'), {
    parse_mode: 'HTML',
  }).catch(() => null);
  if (!progressMsg) return;

  try {
    const meta = await sock.groupMetadata(groupJid);

    // Exclude: group owner (superadmin), any admin, and the bot itself
    const toKick = meta.participants
      .filter(p => {
        if (p.admin === 'superadmin' || p.admin === 'admin') return false;
        if (jidToNum(p.id) === botNum) return false;
        return true;
      })
      .map(p => p.id);

    if (!toKick.length) {
      await ctx.telegram.editMessageText(ctx.chat.id, progressMsg.message_id, null,
        ui.info('Nothing to do', 'No removable members found.'),
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[backBtn(`grp_dash:${groupJid}`)]] } }
      ).catch(() => {});
      return;
    }

    const { removed, failed } = await batchGroupOp(
      sock, groupJid, toKick, 'remove', ctx, progressMsg.message_id, 'Kick All Members'
    );

    const finalText = [
      ui.screenHeader(config.bot.name, 'Kick All Members'),
      '',
      ui.success('Operation Complete'),
      '',
      `<blockquote>`,
      `✔ <b>${removed}</b> Removed`,
      failed ? `❌ <b>${failed}</b> Failed` : '',
      `</blockquote>`,
    ].filter(Boolean).join('\n');

    await ctx.telegram.editMessageText(ctx.chat.id, progressMsg.message_id, null, finalText, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[backBtn(`grp_dash:${groupJid}`)]] },
    }).catch(() => {});
  } catch (e) {
    logger.error('[GroupDash] kickAllGo: ' + e.message);
    await ctx.telegram.editMessageText(ctx.chat.id, progressMsg.message_id, null,
      ui.error('Operation Failed', e.message),
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[backBtn(`grp_dash:${groupJid}`)]] } }
    ).catch(() => {});
  }
}

// ── Kick All Admins ───────────────────────────────────────────────────────

async function kickAdminsConfirm(ctx, groupJid) {
  const text = [
    `⚠️ <b>Kick All Admins</b>`,
    '',
    `<blockquote>You are about to remove <b>every removable admin</b> from this group.\n\nThe group owner and bot will never be removed.\n\nThis action <b>cannot be undone</b>.</blockquote>`,
    '',
    `<i>Are you sure?</i>`,
  ].join('\n');

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [btn('✅ Yes — Kick All Admins', `grp_kick_adm_go:${groupJid}`, SUCCESS)],
        [btn('❌ Cancel', `grp_dash:${groupJid}`, DANGER)],
      ],
    },
  }).catch(() => {});
}

async function kickAdminsGo(ctx, groupJid) {
  const err = requireOwnerWA(ctx, `grp_dash:${groupJid}`);
  if (err) return err;

  const sock = getOwnerSock();
  const botNum = getBotNumber(sock);

  const progressMsg = await ctx.editMessageText(ui.loading('Fetching admin list...'), {
    parse_mode: 'HTML',
  }).catch(() => null);
  if (!progressMsg) return;

  try {
    const meta = await sock.groupMetadata(groupJid);

    // Only removable admins — never superadmin (owner) or bot
    const toKick = meta.participants
      .filter(p => {
        if (p.admin !== 'admin') return false; // skip regular members and superadmin
        if (jidToNum(p.id) === botNum) return false; // skip bot
        return true;
      })
      .map(p => p.id);

    if (!toKick.length) {
      await ctx.telegram.editMessageText(ctx.chat.id, progressMsg.message_id, null,
        ui.info('Nothing to do', 'No removable admins found.'),
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[backBtn(`grp_dash:${groupJid}`)]] } }
      ).catch(() => {});
      return;
    }

    const { removed, failed } = await batchGroupOp(
      sock, groupJid, toKick, 'remove', ctx, progressMsg.message_id, 'Kick All Admins'
    );

    const finalText = [
      ui.screenHeader(config.bot.name, 'Kick All Admins'),
      '',
      ui.success('Operation Complete'),
      '',
      `<blockquote>`,
      `✔ <b>${removed}</b> Removed`,
      failed ? `❌ <b>${failed}</b> Failed` : '',
      `</blockquote>`,
    ].filter(Boolean).join('\n');

    await ctx.telegram.editMessageText(ctx.chat.id, progressMsg.message_id, null, finalText, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[backBtn(`grp_dash:${groupJid}`)]] },
    }).catch(() => {});
  } catch (e) {
    logger.error('[GroupDash] kickAdminsGo: ' + e.message);
    await ctx.telegram.editMessageText(ctx.chat.id, progressMsg.message_id, null,
      ui.error('Operation Failed', e.message),
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[backBtn(`grp_dash:${groupJid}`)]] } }
    ).catch(() => {});
  }
}

// ── Demote All Admins ─────────────────────────────────────────────────────

async function demoteAllConfirm(ctx, groupJid) {
  const text = [
    `⚠️ <b>Demote All Admins</b>`,
    '',
    `<blockquote>You are about to remove admin privileges from <b>every removable admin</b>.\n\nThe group owner and bot will never be demoted.</blockquote>`,
    '',
    `<i>Are you sure?</i>`,
  ].join('\n');

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [btn('✅ Yes — Demote All Admins', `grp_demote_go:${groupJid}`, SUCCESS)],
        [btn('❌ Cancel', `grp_dash:${groupJid}`, DANGER)],
      ],
    },
  }).catch(() => {});
}

async function demoteAllGo(ctx, groupJid) {
  const err = requireOwnerWA(ctx, `grp_dash:${groupJid}`);
  if (err) return err;

  const sock = getOwnerSock();
  const botNum = getBotNumber(sock);

  const progressMsg = await ctx.editMessageText(ui.loading('Fetching admin list...'), {
    parse_mode: 'HTML',
  }).catch(() => null);
  if (!progressMsg) return;

  try {
    const meta = await sock.groupMetadata(groupJid);

    // Only regular admins — never superadmin or bot
    const toDemote = meta.participants
      .filter(p => {
        if (p.admin !== 'admin') return false;
        if (jidToNum(p.id) === botNum) return false;
        return true;
      })
      .map(p => p.id);

    if (!toDemote.length) {
      await ctx.telegram.editMessageText(ctx.chat.id, progressMsg.message_id, null,
        ui.info('Nothing to do', 'No demotable admins found.'),
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[backBtn(`grp_dash:${groupJid}`)]] } }
      ).catch(() => {});
      return;
    }

    const { removed: demoted, failed } = await batchGroupOp(
      sock, groupJid, toDemote, 'demote', ctx, progressMsg.message_id, 'Demote All Admins'
    );

    const finalText = [
      ui.screenHeader(config.bot.name, 'Demote All Admins'),
      '',
      ui.success('Operation Complete'),
      '',
      `<blockquote>`,
      `✔ <b>${demoted}</b> Demoted`,
      failed ? `❌ <b>${failed}</b> Failed` : '',
      `</blockquote>`,
    ].filter(Boolean).join('\n');

    await ctx.telegram.editMessageText(ctx.chat.id, progressMsg.message_id, null, finalText, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[backBtn(`grp_dash:${groupJid}`)]] },
    }).catch(() => {});
  } catch (e) {
    logger.error('[GroupDash] demoteAllGo: ' + e.message);
    await ctx.telegram.editMessageText(ctx.chat.id, progressMsg.message_id, null,
      ui.error('Operation Failed', e.message),
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[backBtn(`grp_dash:${groupJid}`)]] } }
    ).catch(() => {});
  }
}

// ── Approve Requests Menu ─────────────────────────────────────────────────

async function approveMenu(ctx, groupJid) {
  const err = requireOwnerWA(ctx, `grp_dash:${groupJid}`);
  if (err) return err;

  const sock = getOwnerSock();

  try {
    const requests = await sock.groupRequestParticipantsList(groupJid).catch(() => []);
    const count = requests.length;

    const text = [
      ui.screenHeader(config.bot.name, 'Approve Requests'),
      '',
      `<blockquote>Pending Requests: <b>${count}</b></blockquote>`,
      '',
      count === 0
        ? '<blockquote>No pending join requests.</blockquote>'
        : '<blockquote>Choose an approval method below.</blockquote>',
    ].join('\n');

    const keyboards = count > 0 ? [
      [btn('✅ Approve All', `grp_apr_all:${groupJid}`, SUCCESS)],
      [btn('🔢 Approve by Amount', `grp_apr_num:${groupJid}`, PRIMARY)],
      [btn('🌍 Approve by Country', `grp_apr_ctr:${groupJid}`, PRIMARY)],
      [backBtn(`grp_dash:${groupJid}`)],
    ] : [
      [backBtn(`grp_dash:${groupJid}`)],
    ];

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboards },
    }).catch(() => {});
  } catch (e) {
    logger.error('[GroupDash] approveMenu: ' + e.message);
    await ctx.editMessageText(ui.error('Failed to fetch requests', e.message), {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[backBtn(`grp_dash:${groupJid}`)]] },
    }).catch(() => {});
  }
}

// ── Approve All ───────────────────────────────────────────────────────────

async function approveAllConfirm(ctx, groupJid) {
  const err = requireOwnerWA(ctx, `grp_approve:${groupJid}`);
  if (err) return err;

  const sock = getOwnerSock();
  const requests = await sock.groupRequestParticipantsList(groupJid).catch(() => []);
  const count = requests.length;

  if (!count) {
    return ctx.editMessageText(ui.info('No Pending Requests', 'There is nothing to approve.'), {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[backBtn(`grp_approve:${groupJid}`)]] },
    }).catch(() => {});
  }

  const text = [
    `⚠️ <b>Approve All Requests</b>`,
    '',
    `<blockquote>You are about to approve <b>${count}</b> pending join request${count !== 1 ? 's' : ''}.</blockquote>`,
    '',
    `<i>Continue?</i>`,
  ].join('\n');

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [btn(`✅ Yes — Approve All (${count})`, `grp_apr_all_go:${groupJid}`, SUCCESS)],
        [btn('❌ Cancel', `grp_approve:${groupJid}`, DANGER)],
      ],
    },
  }).catch(() => {});
}

async function approveAllGo(ctx, groupJid) {
  const err = requireOwnerWA(ctx, `grp_approve:${groupJid}`);
  if (err) return err;

  const sock = getOwnerSock();

  const progressMsg = await ctx.editMessageText(ui.loading('Fetching pending requests...'), {
    parse_mode: 'HTML',
  }).catch(() => null);
  if (!progressMsg) return;

  try {
    const requests = await sock.groupRequestParticipantsList(groupJid).catch(() => []);
    const jids = requests.map(r => r.jid || r.id);

    if (!jids.length) {
      await ctx.telegram.editMessageText(ctx.chat.id, progressMsg.message_id, null,
        ui.info('No Pending Requests', 'There is nothing to approve.'),
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[backBtn(`grp_approve:${groupJid}`)]] } }
      ).catch(() => {});
      return;
    }

    const total = jids.length;
    let approved = 0, failed = 0;
    const BATCH = 10;
    const DELAY = 500;

    for (let i = 0; i < jids.length; i += BATCH) {
      const chunk = jids.slice(i, i + BATCH);
      try {
        await sock.groupRequestParticipantsUpdate(groupJid, chunk, 'approve');
        approved += chunk.length;
      } catch {
        for (const jid of chunk) {
          try {
            await sock.groupRequestParticipantsUpdate(groupJid, [jid], 'approve');
            approved++;
          } catch { failed++; }
          await sleep(150);
        }
      }

      // Live progress
      const progressText = [
        ui.screenHeader(config.bot.name, 'Approve All Requests'),
        '',
        `<blockquote>Pending Requests: <b>${total}</b></blockquote>`,
        '',
        `<blockquote>`,
        `Approved:`,
        `✔ <b>${approved}</b>`,
        failed ? `❌ Failed: <b>${failed}</b>` : '',
        `</blockquote>`,
      ].filter(Boolean).join('\n');

      await ctx.telegram.editMessageText(ctx.chat.id, progressMsg.message_id, null, progressText, {
        parse_mode: 'HTML',
      }).catch(() => {});

      if (i + BATCH < jids.length) await sleep(DELAY);
    }

    const finalText = [
      ui.screenHeader(config.bot.name, 'Approve All Requests'),
      '',
      ui.success('Completed'),
      '',
      `<blockquote>`,
      `Pending Requests: ${total}`,
      '',
      `Approved:`,
      `✔ <b>${approved}</b>`,
      failed ? `❌ Failed: <b>${failed}</b>` : '',
      `</blockquote>`,
    ].filter(Boolean).join('\n');

    await ctx.telegram.editMessageText(ctx.chat.id, progressMsg.message_id, null, finalText, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[backBtn(`grp_approve:${groupJid}`)]] },
    }).catch(() => {});
  } catch (e) {
    logger.error('[GroupDash] approveAllGo: ' + e.message);
    await ctx.telegram.editMessageText(ctx.chat.id, progressMsg.message_id, null,
      ui.error('Approval Failed', e.message),
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[backBtn(`grp_approve:${groupJid}`)]] } }
    ).catch(() => {});
  }
}

// ── Approve by Amount ─────────────────────────────────────────────────────

async function approveByAmountPrompt(ctx, groupJid) {
  setState(ctx.from.id, { step: 'grp_apr_num', groupJid });
  await ctx.editMessageText([
    ui.screenHeader(config.bot.name, 'Approve by Amount'),
    '',
    '<blockquote>How many pending requests would you like to approve?</blockquote>',
    '<blockquote expandable>Send a number — only the first N requests will be approved.</blockquote>',
  ].join('\n'), {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[btn('❌ Cancel', `grp_approve:${groupJid}`, DANGER)]] },
  }).catch(() => {});
}

async function approveByAmountDo(ctx, groupJid, rawAmount) {
  clearState(ctx.from.id);
  const amount = parseInt(rawAmount, 10);
  if (!amount || amount < 1) {
    return ctx.reply(ui.warn('Invalid number', 'Please send a positive number.'), { parse_mode: 'HTML' });
  }

  const err = requireOwnerWA(ctx, `grp_approve:${groupJid}`);
  if (err) return err;

  const sock = getOwnerSock();
  const wait = await ctx.reply(ui.loading(`Approving up to ${amount} requests...`), { parse_mode: 'HTML' });

  try {
    const requests = await sock.groupRequestParticipantsList(groupJid).catch(() => []);
    const jids = requests.slice(0, amount).map(r => r.jid || r.id);
    const remaining = Math.max(0, requests.length - amount);
    const total = requests.length;

    if (!jids.length) {
      return ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null,
        ui.info('No Pending Requests', 'There is nothing to approve.'),
        { parse_mode: 'HTML' }
      ).catch(() => {});
    }

    let approved = 0, failed = 0;
    for (const jid of jids) {
      try {
        await sock.groupRequestParticipantsUpdate(groupJid, [jid], 'approve');
        approved++;
      } catch { failed++; }
      await sleep(200);
    }

    const finalText = [
      ui.screenHeader(config.bot.name, 'Approve by Amount'),
      '',
      `<blockquote>`,
      `Requested: <b>${amount}</b>`,
      '',
      `Approved:`,
      `✔ <b>${approved}</b>`,
      failed ? `❌ Failed: <b>${failed}</b>` : '',
      '',
      `Remaining: <b>${remaining}</b>`,
      `</blockquote>`,
    ].filter(Boolean).join('\n');

    await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null, finalText, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [backBtn(`grp_approve:${groupJid}`)],
          [backBtn(`grp_dash:${groupJid}`, '‹ Group Dashboard')],
        ],
      },
    }).catch(() => {});
  } catch (e) {
    logger.error('[GroupDash] approveByAmountDo: ' + e.message);
    await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null,
      ui.error('Approval Failed', e.message),
      { parse_mode: 'HTML' }
    ).catch(() => {});
  }
}

// ── Approve by Country ────────────────────────────────────────────────────

async function approveByCountryPrompt(ctx, groupJid) {
  setState(ctx.from.id, { step: 'grp_apr_ctr', groupJid });
  await ctx.editMessageText([
    ui.screenHeader(config.bot.name, 'Approve by Country'),
    '',
    '<blockquote>Enter the country code to approve.\n\nExamples: +234, +1, +44, +91, +81</blockquote>',
    '<blockquote expandable>Only users whose phone numbers start with the code you enter will be approved.</blockquote>',
  ].join('\n'), {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[btn('❌ Cancel', `grp_approve:${groupJid}`, DANGER)]] },
  }).catch(() => {});
}

async function approveByCountryDo(ctx, groupJid, rawCode) {
  clearState(ctx.from.id);
  const countryCode = rawCode.trim().replace(/^\+/, '');
  if (!countryCode || !/^\d+$/.test(countryCode)) {
    return ctx.reply(
      ui.warn('Invalid country code', 'Send a code like +234 or +1 (digits only after the +).'),
      { parse_mode: 'HTML' }
    );
  }

  const err = requireOwnerWA(ctx, `grp_approve:${groupJid}`);
  if (err) return err;

  const sock = getOwnerSock();
  const wait = await ctx.reply(ui.loading(`Looking up requests for +${countryCode}...`), { parse_mode: 'HTML' });

  try {
    const requests = await sock.groupRequestParticipantsList(groupJid).catch(() => []);
    const total = requests.length;
    const matching = requests.filter(r => {
      const num = jidToNum(r.jid || r.id || '');
      return num.startsWith(countryCode);
    });

    if (!matching.length) {
      await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null, [
        ui.screenHeader(config.bot.name, 'Approve by Country'),
        '',
        ui.info(`Country: +${countryCode}`, `Found: 0 matching requests\n\nNo users with this country code are waiting.`),
      ].join('\n'), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[backBtn(`grp_approve:${groupJid}`)]] },
      }).catch(() => {});
      return;
    }

    let approved = 0, failed = 0;
    for (const req of matching) {
      try {
        await sock.groupRequestParticipantsUpdate(groupJid, [req.jid || req.id], 'approve');
        approved++;
      } catch { failed++; }
      await sleep(200);
    }

    const remaining = total - approved;
    const finalText = [
      ui.screenHeader(config.bot.name, 'Approve by Country'),
      '',
      `<blockquote>`,
      `Country: <b>+${countryCode}</b>`,
      '',
      `Found: <b>${matching.length}</b> Requests`,
      '',
      `Approved:`,
      `✔ <b>${approved}</b>`,
      failed ? `❌ Failed: <b>${failed}</b>` : '',
      '',
      `Remaining: <b>${remaining}</b>`,
      `</blockquote>`,
    ].filter(Boolean).join('\n');

    await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null, finalText, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [backBtn(`grp_approve:${groupJid}`)],
          [backBtn(`grp_dash:${groupJid}`, '‹ Group Dashboard')],
        ],
      },
    }).catch(() => {});
  } catch (e) {
    logger.error('[GroupDash] approveByCountryDo: ' + e.message);
    await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null,
      ui.error('Approval Failed', e.message),
      { parse_mode: 'HTML' }
    ).catch(() => {});
  }
}

module.exports = {
  groupList,
  groupDash,
  refreshInviteLink,
  regenerateInviteLink,
  kickAllConfirm,
  kickAllGo,
  kickAdminsConfirm,
  kickAdminsGo,
  demoteAllConfirm,
  demoteAllGo,
  approveMenu,
  approveAllConfirm,
  approveAllGo,
  approveByAmountPrompt,
  approveByAmountDo,
  approveByCountryPrompt,
  approveByCountryDo,
};
