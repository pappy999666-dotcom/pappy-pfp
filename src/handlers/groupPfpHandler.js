const K = require('./keyboards');
const config = require('../config');
const { clearState } = require('../middleware/session');
const { GroupPfpTask } = require('../database/models');
const { isOwnerConnected } = require('../services/ownerWhatsapp');
const { createImmediateTask, createScheduledTask, startGroupJoin, cancelGroupTask, handleContinueButton } = require('../services/groupPfp');
const { isValidWaGroupLink, extractGroupId } = require('../utils/helpers');
const { getGroupPfpDir, downloadTelegramFile } = require('../utils/storage');
const { btn, PRIMARY, SUCCESS, DANGER } = require('../utils/buttonStyles');
const ui = require('../utils/ui');
const eh = require('../utils/errorHandler');
const logger = require('../utils/logger');

async function start(ctx) {
  try {
    if (!isOwnerConnected()) {
      const text = [
        ui.screenHeader(config.bot.name, 'Change Group PFP'),
        '',
        ui.warn('Service Offline', `The ${config.bot.name} Assistant is currently offline.`),
        'Please try again later or contact support.'
      ].join('\n');
      return ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: K.backMain() })
        .catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: K.backMain() }));
    }

    const text = [
      ui.screenHeader(config.bot.name, 'Change Group PFP'),
      '',
      '> Choose an option:',
      '',
      '*⚡ Immediate Change*',
      'Change the group PFP right now',
      '',
      '*📅 Scheduled Daily*',
      `Auto-change daily for up to ${config.limits.maxGroupPfpDays} days`
    ].join('\n');

    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: K.groupPfpMenu() })
      .catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: K.groupPfpMenu() }));
  } catch (err) {
    return eh.handle(ctx, err, 'group_pfp_start', 'main_menu');
  }
}

async function immediateStart(ctx) {
  try {
    ctx.setState({ step: 'gpfp_image', mode: 'immediate' });
    const text = [
      ui.screenHeader('Immediate Change', 'Step 1/2'),
      '',
      '> Send the image you want to set as the group profile picture.',
      '',
      '✨ Full HD — No cropping'
    ].join('\n');

    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: K.back('group_pfp') })
      .catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: K.back('group_pfp') }));
  } catch (err) {
    return eh.handle(ctx, err, 'gpfp_immediate', 'group_pfp');
  }
}

async function scheduledStart(ctx) {
  try {
    ctx.setState({ step: 'gpfp_days', mode: 'scheduled' });
    const text = [
      ui.screenHeader('Scheduled Change', 'Step 1/3'),
      '',
      `> How many days? (Maximum: ${config.limits.maxGroupPfpDays})`
    ].join('\n');

    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: K.back('group_pfp') })
      .catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: K.back('group_pfp') }));
  } catch (err) {
    return eh.handle(ctx, err, 'gpfp_scheduled', 'group_pfp');
  }
}

async function handleDays(ctx) {
  try {
    const n = parseInt(ctx.message.text?.trim());
    if (isNaN(n) || n < 1 || n > config.limits.maxGroupPfpDays) {
      return ctx.reply(ui.warn('Invalid Input', `Enter a number between 1 and ${config.limits.maxGroupPfpDays}.`), { parse_mode: 'Markdown' });
    }

    ctx.setState({ ...ctx.userState, step: 'gpfp_images', totalDays: n, images: [], required: n });
    const text = [
      ui.screenHeader('Scheduled Change', 'Step 2/3'),
      ui.stat('📅', 'Days', n),
      '',
      `> Please upload exactly *${n} image(s)* - one for each day.`,
      '',
      'Send them one by one.'
    ].join('\n');

    await ctx.reply(text, { parse_mode: 'Markdown' });
  } catch (err) {
    return eh.handle(ctx, err, 'gpfp_days', 'group_pfp');
  }
}

async function handleImage(ctx, bot) {
  try {
    const { mode, images, required, totalDays } = ctx.userState;
    const tid = String(ctx.from.id);

    const photo = ctx.message.photo;
    const doc = ctx.message.document;
    let fid;

    if (doc?.mime_type?.startsWith('image/')) fid = doc.file_id;
    else if (photo) fid = photo[photo.length - 1].file_id;
    else return ctx.reply(ui.warn('Invalid File', 'Please send an image file.'), { parse_mode: 'Markdown' });

    const tempId = `temp_${Date.now()}`;
    const dir = getGroupPfpDir(tid, tempId);
    const currentImages = images || [];
    const imgPath = await downloadTelegramFile(bot, fid, dir, `gpfp_${currentImages.length}`);
    currentImages.push(imgPath);

    if (mode === 'immediate') {
      ctx.setState({ ...ctx.userState, step: 'gpfp_link', images: currentImages });
      const text = [
        ui.success('Image Received'),
        '',
        '> Step 2: Send the WhatsApp Group invite link.',
        '',
        ui.italic('Example: `https://chat.whatsapp.com/ABC123...`')
      ].join('\n');
      
      await ctx.reply(text, { parse_mode: 'Markdown' });
      return;
    }

    const needed = required || totalDays;
    ctx.setState({ ...ctx.userState, images: currentImages });

    if (currentImages.length < needed) {
      return ctx.reply(ui.taskProgress('Images received', currentImages.length, needed), { parse_mode: 'Markdown' });
    }

    ctx.setState({ ...ctx.userState, step: 'gpfp_link', images: currentImages });
    const text = [
      ui.success('All Images Received'),
      '',
      '> Step 3: Send the WhatsApp Group invite link.',
      '',
      ui.italic('Example: `https://chat.whatsapp.com/ABC123...`')
    ].join('\n');
    
    await ctx.reply(text, { parse_mode: 'Markdown' });
  } catch (err) {
    return eh.handle(ctx, err, 'gpfp_image', 'group_pfp');
  }
}

async function handleLink(ctx, bot) {
  let liveMsg;
  try {
    const { mode, images, totalDays } = ctx.userState;
    const tid = String(ctx.from.id);
    const link = ctx.message.text?.trim();

    if (!isValidWaGroupLink(link)) {
      return ctx.reply(ui.warn('Invalid Link', 'Send a valid link like: `https://chat.whatsapp.com/ABC123...`'), { parse_mode: 'Markdown' });
    }

    const inviteCode = extractGroupId(link);
    if (!inviteCode) {
      return ctx.reply(ui.warn('Invalid Link', 'Could not extract group invite code.'), { parse_mode: 'Markdown' });
    }

    clearState(ctx.from.id);

    const ownerNum = config.ownerWaNumber;
    const text = [
      ui.screenHeader(config.bot.name, 'Group Setup'),
      '',
      '> Connecting to group...',
      '',
      ui.stat('🤖', 'Assistant', `${config.bot.name} Assistant`),
      ui.stat('📱', 'Number', `+${ownerNum}`)
    ].join('\n');

    liveMsg = await ctx.reply(text, { parse_mode: 'Markdown' });

    const liveLogMsgId = liveMsg.message_id;
    const liveLogChatId = String(ctx.chat.id);

    let task;
    if (mode === 'immediate') {
      task = await createImmediateTask(tid, inviteCode, images[0], liveLogMsgId, liveLogChatId);
    } else {
      task = await createScheduledTask(tid, inviteCode, images, totalDays, liveLogMsgId, liveLogChatId);
    }

    await startGroupJoin(task, bot);
  } catch (err) {
    logger.error('Group PFP task: ' + err.message);
    if (liveMsg) {
      await bot.telegram.editMessageText(ctx.chat.id, liveMsg.message_id, null,
        ui.error('Task Failed', err.message),
        { parse_mode: 'Markdown', reply_markup: K.backMain() }
      ).catch(() => {});
    }
  }
}

async function continueAdminCheck(ctx, taskId, bot) {
  try {
    await ctx.answerCbQuery('Checking admin status...').catch(() => {});
    const result = await handleContinueButton(taskId, bot);
    if (!result.ok) {
      await ctx.answerCbQuery(result.msg, { show_alert: true }).catch(() => {});
    }
  } catch (err) {
    logger.error(`Admin check fail: ${err.message}`);
  }
}

async function listTasks(ctx) {
  try {
    const tid = String(ctx.from.id);
    const tasks = await GroupPfpTask.find({
      telegramId: tid,
      status: { $in: ['pending_join', 'pending_approval', 'pending_admin', 'active'] },
    }).sort({ createdAt: -1 }).limit(10);

    if (!tasks.length) {
      const text = [
        ui.screenHeader(config.bot.name, 'Active Tasks'),
        '',
        '> You have no active group PFP tasks.'
      ].join('\n');
      return ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: K.back('group_pfp') }).catch(() => {});
    }

    const lines = tasks.map((t, i) => {
      const status = t.status.replace(/_/g, ' ');
      const progress = t.mode === 'scheduled' ? ` (Day ${t.currentDay}/${t.totalDays})` : '';
      return `${i + 1}. \`${t.taskId}\` - ${status}${progress}`;
    }).join('\n');

    const btns = tasks.map(t => [
      btn(`❌ Cancel ${t.taskId}`, `gpfp_cancel:${t.taskId}`, DANGER),
    ]);
    btns.push([{ text: '‹ Back', callback_data: 'group_pfp' }]);

    const text = [
      ui.screenHeader(config.bot.name, 'Active Tasks'),
      '',
      lines
    ].join('\n');

    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns } }).catch(() => {});
  } catch (err) {
    return eh.handle(ctx, err, 'list_tasks', 'group_pfp');
  }
}

async function cancelTask(ctx, taskId) {
  try {
    const task = await cancelGroupTask(taskId);
    if (!task) {
      return ctx.answerCbQuery('Task not found.').catch(() => {});
    }
    await ctx.answerCbQuery('Task cancelled!').catch(() => {});
    await listTasks(ctx);
  } catch (err) {
    await ctx.answerCbQuery(`Error: ${err.message}`).catch(() => {});
  }
}

module.exports = {
  start, immediateStart, scheduledStart,
  handleDays, handleImage, handleLink,
  continueAdminCheck, listTasks, cancelTask,
};
