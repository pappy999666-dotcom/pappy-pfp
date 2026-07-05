const config = require('../config');
const logger = require('../utils/logger');
const { GroupPfpTask, Channel } = require('../database/models');
const { sleep, extractGroupId } = require('../utils/helpers');
const { ownerJoinGroup, ownerSetGroupPfp, ownerLeaveGroup, isOwnerConnected, isOwnerAdminInGroup } = require('./ownerWhatsapp');

async function liveLog(bot, task, text, keyboard) {
  if (!task.liveLogMsgId || !task.liveLogChatId) return;
  try {
    await bot.telegram.editMessageText(
      task.liveLogChatId, task.liveLogMsgId, null,
      text,
      { parse_mode: 'Markdown', reply_markup: keyboard || undefined }
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

function joinChannelKeyboard() {
  return async () => {
    const channels = await Channel.find({ isActive: true, platform: 'telegram' });
    const tgCh = channels.filter(c => c.link);
    const btns = [];
    if (tgCh.length) {
      btns.push(...tgCh.map(c => [{ text: `Join ${c.title || 'Our Channel'}`, url: c.link }]));
    }
    btns.push([{ text: '🏠 Main Menu', callback_data: 'main_menu' }]);
    return { inline_keyboard: btns };
  };
}

async function createImmediateTask(telegramId, inviteCode, imagePath, liveLogMsgId, liveLogChatId) {
  const { generateTaskId } = require('../utils/helpers');
  const task = await GroupPfpTask.create({
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
  return task;
}

async function createScheduledTask(telegramId, inviteCode, images, totalDays, liveLogMsgId, liveLogChatId) {
  const { generateTaskId } = require('../utils/helpers');
  const task = await GroupPfpTask.create({
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
  return task;
}

async function startGroupJoin(task, bot) {
  if (!isOwnerConnected()) {
    task.status = 'failed';
    task.errorMsg = 'Owner WhatsApp not connected';
    await task.save();
    await liveLog(bot, task,
      `❌ *Task Failed*\nTask: \`${task.taskId}\`\n\n*Owner WhatsApp is not connected.*\nPlease contact support.`,
      { inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'main_menu' }]] }
    );
    throw new Error('Owner WhatsApp not connected. Please contact the bot owner.');
  }

  await liveLog(bot, task,
    `⏳ *Joining Group...*\nTask: \`${task.taskId}\`\n\nPlease wait while the assistant joins the group.`
  );

  try {
    const groupJid = await ownerJoinGroup(task.groupInviteCode);
    task.groupJid = groupJid;
    task.status = 'pending_admin';
    task.joinedAt = new Date();
    task.approvedAt = new Date();
    await task.save();

    await liveLog(bot, task,
      `✅ *Joined the group!*\nTask: \`${task.taskId}\`\n\n` +
      `Please promote *${config.bot.name} Assistant* (\`+${config.ownerWaNumber}\`) to *admin* in the group, then click the button below.`,
      continueKeyboard(task.taskId)
    );

    startAdminTimeout(task, bot);
    return task;
  } catch (e) {
    if (e.message?.includes('invite') || e.message?.includes('not-authorized') || e.message?.includes('require')) {
      task.status = 'pending_approval';
      await task.save();

      await liveLog(bot, task,
        `📨 *Join Request Sent*\nTask: \`${task.taskId}\`\n\n` +
        `The group requires approval. Please approve the join request from:\n` +
        `Name: *${config.bot.name} Assistant*\n` +
        `Number: \`+${config.ownerWaNumber}\`\n\n` +
        `After approval, make the account *admin*, then click the button below.`,
        continueKeyboard(task.taskId)
      );

      startApprovalCheck(task, bot);
      return task;
    }

    task.status = 'failed';
    task.errorMsg = e.message;
    task.completedAt = new Date();
    await task.save();

    await liveLog(bot, task,
      `❌ *Failed to Join Group*\nTask: \`${task.taskId}\`\n\n${e.message}`,
      { inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'main_menu' }]] }
    );
    throw e;
  }
}

function startApprovalCheck(task, bot) {
  let checks = 0;
  const maxChecks = 60;
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
          `⏰ *Timed Out*\nTask: \`${t.taskId}\`\n\nJoin request was not approved within 30 minutes. Please try again.`,
          { inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'main_menu' }]] }
        );
      }
      return;
    }

    const t = await GroupPfpTask.findOne({ taskId: task.taskId });
    if (!t || t.status !== 'pending_approval') {
      clearInterval(interval);
      return;
    }
  }, 30_000);
}

function startAdminTimeout(task, bot) {
  setTimeout(async () => {
    const t = await GroupPfpTask.findOne({ taskId: task.taskId });
    if (!t || t.status !== 'pending_admin') return;

    t.status = 'failed';
    t.errorMsg = 'Not promoted to admin within 30 minutes';
    t.completedAt = new Date();
    await t.save();

    await ownerLeaveGroup(t.groupJid).catch(() => {});
    await liveLog(bot, t,
      `⏰ *Timed Out*\nTask: \`${t.taskId}\`\n\nBot was not promoted to admin within 30 minutes. The bot has left the group.`,
      { inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'main_menu' }]] }
    );
  }, 30 * 60 * 1000);
}

async function handleContinueButton(taskId, bot) {
  const task = await GroupPfpTask.findOne({ taskId });
  if (!task) return { ok: false, msg: 'Task not found.' };

  if (!['pending_admin', 'pending_approval'].includes(task.status)) {
    return { ok: false, msg: `Task is already ${task.status.replace(/_/g, ' ')}.` };
  }

  if (task.changeDone) {
    return { ok: false, msg: 'PFP already changed for this task.' };
  }

  if (!task.groupJid) {
    return { ok: false, msg: 'Group not joined yet. Please wait for approval.' };
  }

  await liveLog(bot, task, `⚙️ *Checking admin status...*\nTask: \`${task.taskId}\``);

  const isAdmin = await isOwnerAdminInGroup(task.groupJid);
  if (!isAdmin) {
    await liveLog(bot, task,
      `❌ *Not Admin Yet*\nTask: \`${task.taskId}\`\n\n` +
      `The bot is not an admin in the group yet.\nPlease promote *${config.bot.name} Assistant* to admin, then click the button again.`,
      continueKeyboard(task.taskId)
    );
    return { ok: false, msg: 'Bot is not admin yet in the group.' };
  }

  task.status = 'active';
  task.adminAt = new Date();
  await task.save();

  await liveLog(bot, task,
    `✅ *Admin Confirmed!*\nTask: \`${task.taskId}\`\n\n⚙️ Changing group profile picture...`
  );

  executeGroupPfpChange(task, bot).catch(e =>
    logger.error(`Group PFP change error: ${e.message}`)
  );

  return { ok: true };
}

async function executeGroupPfpChange(task, bot) {
  try {
    if (task.changeDone) return;

    await ownerSetGroupPfp(task.groupJid, task.images[0]);

    task.changeDone = true;
    task.lastChangeAt = new Date();

    const channels = await Channel.find({ isActive: true, platform: 'telegram' });
    const tgCh = channels.filter(c => c.link);
    const joinBtns = [];
    if (tgCh.length) {
      joinBtns.push(...tgCh.map(c => [{ text: `📢 Join ${c.title || 'Our Channel'}`, url: c.link }]));
    }
    joinBtns.push([{ text: '🏠 Main Menu', callback_data: 'main_menu' }]);
    const joinKeyboard = { inline_keyboard: joinBtns };

    if (task.mode === 'immediate') {
      task.status = 'completed';
      task.currentDay = 1;
      task.completedAt = new Date();
      await task.save();

      await liveLog(bot, task,
        `🎉 *Group PFP Changed Successfully!*\nTask: \`${task.taskId}\`\n\n` +
        `The group profile picture has been updated.\nThe bot will now leave the group.` +
        (tgCh.length ? '\n\n📢 *Join our channel for daily wallpapers!*' : ''),
        joinKeyboard
      );

      await sleep(config.safety.joinLeaveDelayMs);
      await ownerLeaveGroup(task.groupJid).catch(() => {});
    } else {
      task.currentDay = 1;
      task.nextChangeAt = new Date(Date.now() + 86_400_000);
      await task.save();

      await liveLog(bot, task,
        `🎉 *Group PFP Changed! (Day 1/${task.totalDays})*\nTask: \`${task.taskId}\`\n\n` +
        `Next change in 24 hours.` +
        (tgCh.length ? '\n\n📢 *Join our channel for daily wallpapers!*' : ''),
        joinKeyboard
      );
    }
  } catch (e) {
    logger.error(`Group PFP change error: ${e.message}`);
    task.status = 'failed';
    task.errorMsg = e.message;
    task.completedAt = new Date();
    await task.save();

    await liveLog(bot, task,
      `❌ *PFP Change Failed*\nTask: \`${task.taskId}\`\n\n${e.message}`,
      { inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'main_menu' }]] }
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
          `✅ *Schedule Complete!*\nTask: \`${task.taskId}\`\n\nAll ${task.totalDays} days done. The bot has left the group.`
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
          `❌ *Task Cancelled*\nTask: \`${task.taskId}\`\n\nBot lost admin rights in the group.`
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
        `📸 *Group PFP Updated (Day ${task.currentDay}/${task.totalDays})*\nTask: \`${task.taskId}\`\n\n` +
        `${task.currentDay < task.totalDays ? 'Next change in 24 hours.' : 'This was the last change!'}`,
        { parse_mode: 'Markdown' }
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
  processScheduledChanges, cancelGroupTask, liveLog,
};
