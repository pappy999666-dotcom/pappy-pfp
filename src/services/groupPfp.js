'use strict';
const config = require('../config');
const logger = require('../utils/logger');
const { GroupPfpTask, Channel } = require('../database/models');
const { sleep } = require('../utils/helpers');
const { ownerJoinGroup, ownerSetGroupPfp, ownerLeaveGroup, ownerSendGroupMessage, isOwnerConnected, isOwnerAdminInGroup } = require('./ownerWhatsapp');
const ui = require('../utils/ui');

function generateVerifyCode() {
  return 'PAPPY-' + Math.random().toString(36).slice(2, 7).toUpperCase();
}

async function liveLog(bot, task, text, keyboard) {
  if (!task.liveLogMsgId || !task.liveLogChatId) return;
  try {
    await bot.telegram.editMessageText(
      task.liveLogChatId, task.liveLogMsgId, null,
      text,
      { parse_mode: 'HTML', reply_markup: keyboard || undefined }
    );
  } catch (e) {
    if (!e.message?.includes('message is not modified')) {
      logger.warn(`liveLog edit failed: ${e.message}`);
    }
  }
}

function continueKeyboard(taskId) {
  return { inline_keyboard: [[{ text: '✅ I made the bot admin — Continue', callback_data: `gpfp_continue:${taskId}` }]] };
}

const mainMenuKeyboard = { inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'main_menu' }]] };

// ── Classify join errors ──────────────────────────────────────────────────────
function classifyJoinError(e) {
  const msg = String(e?.message || '').toLowerCase();
  const sc  = e?.output?.statusCode || e?.status || 0;

  if (sc === 409 || msg.includes('already') || msg.includes('participant') || msg.includes('conflict'))
    return { type: 'already_member', fatal: false };
  if (sc === 401 || msg.includes('not-authorized') || msg.includes('unauthorized'))
    return { type: 'unauthorized', fatal: true };
  if (sc === 403 || msg.includes('forbidden') || msg.includes('blocked') || msg.includes('banned'))
    return { type: 'banned', fatal: true };
  if (msg.includes('invite') || msg.includes('require') || msg.includes('approval') || msg.includes('not-allowed'))
    return { type: 'needs_approval', fatal: false };
  if (msg.includes('not found') || msg.includes('invalid') || msg.includes('expired'))
    return { type: 'invalid_link', fatal: true };
  if (msg.includes('full') || msg.includes('limit'))
    return { type: 'group_full', fatal: true };
  return { type: 'unknown', fatal: false };
}

async function createImmediateTask(telegramId, inviteCode, imagePath, liveLogMsgId, liveLogChatId) {
  const { generateTaskId } = require('../utils/helpers');
  return GroupPfpTask.create({
    taskId: generateTaskId(),
    telegramId: String(telegramId),
    groupInviteCode: inviteCode,
    mode: 'immediate',
    images: [imagePath],
    totalDays: 1,
    status: 'pending_join',
    liveLogMsgId: liveLogMsgId || null,
    liveLogChatId: liveLogChatId ? String(liveLogChatId) : null,
  });
}

async function createScheduledTask(telegramId, inviteCode, images, totalDays, liveLogMsgId, liveLogChatId) {
  const { generateTaskId } = require('../utils/helpers');
  return GroupPfpTask.create({
    taskId: generateTaskId(),
    telegramId: String(telegramId),
    groupInviteCode: inviteCode,
    mode: 'scheduled',
    images,
    totalDays,
    status: 'pending_join',
    liveLogMsgId: liveLogMsgId || null,
    liveLogChatId: liveLogChatId ? String(liveLogChatId) : null,
  });
}

async function startGroupJoin(task, bot) {
  if (!isOwnerConnected()) {
    task.status = 'failed';
    task.errorMsg = 'Owner WhatsApp not connected';
    await task.save();
    await liveLog(bot, task,
      ui.error('Service Offline', 'Owner WhatsApp is not connected. Please contact support.'),
      mainMenuKeyboard
    );
    throw new Error('Owner WhatsApp not connected.');
  }

  await liveLog(bot, task,
    `⏳ ${ui.bold('Joining Group...')}\n<blockquote>Task: ${ui.code(task.taskId)}\n\nPlease wait while the assistant joins the group.</blockquote>`
  );

  let groupJid = null;

  // Check if already in group first
  try {
    const { getOwnerSock } = require('./ownerWhatsapp');
    const sock = getOwnerSock();
    const info = await sock.groupGetInviteInfo(task.groupInviteCode);
    if (info?.id) {
      const chats = await sock.groupFetchAllParticipating();
      if (chats[info.id]) {
        groupJid = info.id;
        logger.info(`[GroupPFP] Already in group ${groupJid}, skipping join`);
      }
    }
  } catch (e) {
    logger.warn(`[GroupPFP] Pre-join check failed: ${e.message}`);
  }

  try {
    if (!groupJid) {
      groupJid = await ownerJoinGroup(task.groupInviteCode);
    }
    task.groupJid = groupJid;
    task.status = 'pending_admin';
    task.joinedAt = new Date();
    task.approvedAt = new Date();
    const code = generateVerifyCode();
    task.verifyCode = code;
    task.codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await task.save();

    await liveLog(bot, task,
      `✅ ${ui.bold('Joined the group!')}\n<blockquote>Task: ${ui.code(task.taskId)}\n\n1️⃣ Promote ${ui.bold(config.bot.name + ' Assistant')} (${ui.code('+' + config.ownerWaNumber)}) to <b>admin</b>\n2️⃣ Send this code in the <b>WhatsApp group</b>:\n\n${ui.code(code)}\n\n⏳ Code expires in <b>10 minutes</b></blockquote>`
    );
    // Also send code directly in the WA group so user sees it there
    await ownerSendGroupMessage(groupJid,
      `👋 Hi! Please make me admin, then send this code in the group:`
    ).catch(() => {});
    await ownerSendGroupMessage(groupJid, code).catch(() => {});

    startCodeExpiry(task, bot);
    return task;

  } catch (e) {
    const { type, fatal } = classifyJoinError(e);

    if (type === 'already_member') {
      logger.info(`[GroupPFP] Already in group ${task.groupInviteCode}, resolving JID...`);
      try {
        const { getOwnerSock } = require('./ownerWhatsapp');
        const sock = getOwnerSock();
        const info = await sock.groupGetInviteInfo(task.groupInviteCode);
        task.groupJid = info.id;
        logger.info(`[GroupPFP] Resolved groupJid: ${task.groupJid}`);
      } catch (infoErr) {
        logger.warn(`[GroupPFP] groupGetInviteInfo failed: ${infoErr.message}`);
      }
      task.status = 'pending_admin';
      task.joinedAt = new Date();
      task.approvedAt = new Date();
      const code = generateVerifyCode();
      task.verifyCode = code;
      task.codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await task.save();
      await liveLog(bot, task,
        `ℹ️ ${ui.bold('Already in Group')}\n<blockquote>Task: ${ui.code(task.taskId)}\n\nCheck the WhatsApp group for the code.</blockquote>`
      );
      // Send code in WA group so user sees it there
      if (task.groupJid) {
        await ownerSendGroupMessage(task.groupJid,
          `👋 Hi! Please make me admin, then send this code in the group:`
        ).catch(() => {});
        await ownerSendGroupMessage(task.groupJid, code).catch(() => {});
      }
      startCodeExpiry(task, bot);
      return task;
    }

    if (type === 'needs_approval') {
      task.status = 'pending_approval';
      await task.save();
      await liveLog(bot, task,
        `📨 ${ui.bold('Join Request Sent')}\n<blockquote>Task: ${ui.code(task.taskId)}\n\nThis group requires admin approval.\nPlease approve the join request from:\n\nName: ${ui.bold(config.bot.name + ' Assistant')}\nNumber: ${ui.code('+' + config.ownerWaNumber)}\n\nAfter approval, make the account <b>admin</b>, then click the button below.</blockquote>`,
        continueKeyboard(task.taskId)
      );
      startApprovalCheck(task, bot);
      return task;
    }

    if (type === 'banned') {
      task.status = 'failed';
      task.errorMsg = 'Bot number is banned or blocked from this group';
      task.completedAt = new Date();
      await task.save();
      await liveLog(bot, task,
        ui.error('Blocked from Group', 'The assistant number has been banned or blocked from this group. Please contact support.'),
        mainMenuKeyboard
      );
      throw new Error('Bot is banned from this group.');
    }

    if (type === 'invalid_link') {
      task.status = 'failed';
      task.errorMsg = 'Invalid or expired invite link';
      task.completedAt = new Date();
      await task.save();
      await liveLog(bot, task,
        ui.error('Invalid Link', 'The group invite link is invalid or has expired. Please get a fresh invite link and try again.'),
        mainMenuKeyboard
      );
      throw new Error('Invalid or expired invite link.');
    }

    if (type === 'group_full') {
      task.status = 'failed';
      task.errorMsg = 'Group is full';
      task.completedAt = new Date();
      await task.save();
      await liveLog(bot, task,
        ui.error('Group Full', 'This group has reached its maximum participant limit.'),
        mainMenuKeyboard
      );
      throw new Error('Group is full.');
    }

    // Unknown / non-fatal — fail gracefully
    task.status = 'failed';
    task.errorMsg = e.message;
    task.completedAt = new Date();
    await task.save();
    await liveLog(bot, task,
      ui.error('Failed to Join Group', ui.truncate(e.message, 120), 'Check the invite link and try again.'),
      mainMenuKeyboard
    );
    throw e;
  }
}

function startApprovalCheck(task, bot) {
  let checks = 0;
  const maxChecks = 60; // 30 min
  const interval = setInterval(async () => {
    checks++;
    if (checks > maxChecks) {
      clearInterval(interval);
      const t = await GroupPfpTask.findOne({ taskId: task.taskId });
      if (t && t.status === 'pending_approval') {
        t.status = 'failed';
        t.errorMsg = 'Join request not approved within 30 minutes';
        t.completedAt = new Date();
        await t.save();
        await liveLog(bot, t,
          ui.error('Timed Out', 'Join request was not approved within 30 minutes. Please try again.'),
          mainMenuKeyboard
        );
      }
      return;
    }
    const t = await GroupPfpTask.findOne({ taskId: task.taskId });
    if (!t || t.status !== 'pending_approval') clearInterval(interval);
  }, 30_000);
}

function startCodeExpiry(task, bot) {
  setTimeout(async () => {
    const t = await GroupPfpTask.findOne({ taskId: task.taskId });
    if (!t || t.status !== 'pending_admin') return;
    t.status = 'failed';
    t.errorMsg = 'Verify code expired';
    t.completedAt = new Date();
    await t.save();
    await ownerLeaveGroup(t.groupJid).catch(() => {});
    await liveLog(bot, t,
      ui.error('Code Expired', 'The verification code expired after 10 minutes. Please start a new task.'),
      mainMenuKeyboard
    );
  }, 10 * 60 * 1000);
}

async function handleVerifyCode(groupJid, senderId, code, bot) {
  const task = await GroupPfpTask.findOne({
    verifyCode: code,
    status: 'pending_admin',
    codeExpiresAt: { $gt: new Date() },
  });

  if (!task) return;

  // Always trust the groupJid from the incoming WA message
  task.groupJid = groupJid;

  const isAdmin = await isOwnerAdminInGroup(groupJid);
  if (!isAdmin) {
    const newCode = generateVerifyCode();
    task.verifyCode = newCode;
    task.codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await task.save();
    // Tell them in the WA group
    await ownerSendGroupMessage(groupJid,
      `⚠️ I'm not an admin yet!\nPlease promote me to admin first, then send this new code in the group:`
    ).catch(() => {});
    await ownerSendGroupMessage(groupJid, newCode).catch(() => {});
    startCodeExpiry(task, bot);
    return;
  }

  // Admin confirmed — proceed
  task.status = 'active';
  task.adminAt = new Date();
  task.verifyCode = null;
  task.codeExpiresAt = null;
  await task.save();

  await liveLog(bot, task,
    `✅ ${ui.bold('Verified! Changing group PFP now...')}\n<blockquote>Task: ${ui.code(task.taskId)}</blockquote>`
  );

  executeGroupPfpChange(task, bot).catch(e => logger.error(`Group PFP change: ${e.message}`));
}

async function handleContinueButton(taskId, bot) {
  return { ok: false, msg: 'Please use the verify code method instead.' };
}

async function executeGroupPfpChange(task, bot) {
  try {
    if (task.changeDone) return;

    await ownerSetGroupPfp(task.groupJid, task.images[0]);
    task.changeDone = true;
    task.lastChangeAt = new Date();

    const channels = await Channel.find({ isActive: true, platform: 'telegram' });
    const tgCh = channels.filter(c => c.link);
    const joinBtns = [
      ...tgCh.map(c => [{ text: `📢 Join ${c.title || 'Our Channel'}`, url: c.link }]),
      [{ text: '🏠 Main Menu', callback_data: 'main_menu' }],
    ];

    if (task.mode === 'immediate') {
      task.status = 'completed';
      task.currentDay = 1;
      task.completedAt = new Date();
      await task.save();

      await liveLog(bot, task,
        `🎉 ${ui.bold('Group PFP Changed!')}\n<blockquote>Task: ${ui.code(task.taskId)}\n\nThe group profile picture has been updated.\nThe bot will now leave the group.</blockquote>${tgCh.length ? '\n\n📢 ' + ui.bold('Join our channel for daily wallpapers!') : ''}`,
        { inline_keyboard: joinBtns }
      );

      await sleep(config.safety.joinLeaveDelayMs);
      await ownerLeaveGroup(task.groupJid).catch(() => {});

    } else {
      task.currentDay = 1;
      task.nextChangeAt = new Date(Date.now() + 86_400_000);
      await task.save();

      await liveLog(bot, task,
        `🎉 ${ui.bold(`Group PFP Changed! (Day 1/${task.totalDays})`)}\n<blockquote>Task: ${ui.code(task.taskId)}\n\nNext change in 24 hours.</blockquote>${tgCh.length ? '\n\n📢 ' + ui.bold('Join our channel for daily wallpapers!') : ''}`,
        { inline_keyboard: joinBtns }
      );
    }
  } catch (e) {
    logger.error(`Group PFP change error: ${e.message}`);
    task.status = 'failed';
    task.errorMsg = e.message;
    task.completedAt = new Date();
    await task.save();
    await liveLog(bot, task,
      ui.error('PFP Change Failed', ui.truncate(e.message, 120)),
      mainMenuKeyboard
    );
  }
}

async function processScheduledChanges(bot) {
  const now = new Date();
  const tasks = await GroupPfpTask.find({
    mode: 'scheduled',
    status: 'active',
    nextChangeAt: { $lte: now },
  });

  for (const task of tasks) {
    try {
      if (task.currentDay >= task.totalDays) {
        task.status = 'completed';
        task.completedAt = new Date();
        await task.save();
        await liveLog(bot, task,
          `✅ ${ui.bold('Schedule Complete!')}\n<blockquote>Task: ${ui.code(task.taskId)}\n\nAll ${task.totalDays} days done. The bot has left the group.</blockquote>`
        );
        await sleep(config.safety.joinLeaveDelayMs);
        await ownerLeaveGroup(task.groupJid).catch(() => {});
        continue;
      }

      const imageIndex = task.currentDay;
      if (imageIndex >= task.images.length) {
        task.status = 'completed';
        task.completedAt = new Date();
        await task.save();
        await ownerLeaveGroup(task.groupJid).catch(() => {});
        continue;
      }

      const isAdmin = await isOwnerAdminInGroup(task.groupJid);
      if (!isAdmin) {
        task.status = 'failed';
        task.errorMsg = 'Lost admin rights';
        task.completedAt = new Date();
        await task.save();
        await liveLog(bot, task,
          ui.error('Task Cancelled', 'Bot lost admin rights in the group.')
        );
        continue;
      }

      await ownerSetGroupPfp(task.groupJid, task.images[imageIndex]);
      task.currentDay += 1;
      task.lastChangeAt = new Date();
      task.nextChangeAt = new Date(Date.now() + 86_400_000);
      await task.save();

      await bot.telegram.sendMessage(
        task.telegramId,
        `📸 ${ui.bold(`Group PFP Updated (Day ${task.currentDay}/${task.totalDays})`)}\n<blockquote>Task: ${ui.code(task.taskId)}\n\n${task.currentDay < task.totalDays ? 'Next change in 24 hours.' : 'This was the last change!'}</blockquote>`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    } catch (e) {
      logger.error(`Scheduled change error for ${task.taskId}: ${e.message}`);
    }
  }
}

async function cancelGroupTask(taskId) {
  const task = await GroupPfpTask.findOne({ taskId });
  if (!task) return null;
  if (task.groupJid && ['pending_admin', 'active'].includes(task.status)) {
    await ownerLeaveGroup(task.groupJid).catch(() => {});
  }
  task.status = 'cancelled';
  task.completedAt = new Date();
  await task.save();
  return task;
}

module.exports = {
  createImmediateTask, createScheduledTask,
  startGroupJoin, executeGroupPfpChange, handleContinueButton,
  processScheduledChanges, cancelGroupTask, liveLog, handleVerifyCode,
};
