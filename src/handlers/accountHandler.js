const fs = require('fs');
const { Session } = require('../database/models');
const { setProfilePicture, getProfilePicture, deleteProfilePicture, disconnect, setDisplayName } = require('../services/whatsapp');
const { scheduleJob, cancelJob, getActiveJob } = require('../schedulers/autoChange');
const { getUserImageDir, getUserSessionDir, downloadTelegramFile, deleteDir } = require('../utils/storage');
const { calcImageCount } = require('../utils/helpers');
const K = require('./keyboards');
const config = require('../config');
const { clearState } = require('../middleware/session');
const { btn, PRIMARY, SUCCESS, DANGER } = require('../utils/buttonStyles');
const ui = require('../utils/ui');
const eh = require('../utils/errorHandler');
const logger = require('../utils/logger');

async function pairedList(ctx) {
  try {
    const tid = String(ctx.from.id);
    const sessions = await Session.find({ telegramId: tid });

    if (!sessions.length) {
      const text = [
        ui.screenHeader(config.bot.name, 'Paired Accounts'),
        '',
        '<blockquote>You have no paired accounts yet.</blockquote>',
        '',
        'Pair a WhatsApp account to start managing profile pictures and media.'
      ].join('\n');
      
      return ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [
          [btn('📱 Pair WhatsApp', 'pair_wa', SUCCESS)],
          [btn('🏠 Main Menu',    'main_menu', PRIMARY)],
        ]},
      }).catch(() => ctx.reply(text, { parse_mode: 'HTML' }));
    }

    const btns = sessions.map(s => [
      btn(`${s.isActive ? '🟢' : '🔴'} +${s.whatsappNumber}`, `account:${s.whatsappNumber}`, PRIMARY),
    ]);
    btns.push([btn('➕ Pair New Account', 'pair_wa',   SUCCESS)]);
    btns.push([btn('🏠 Main Menu',        'main_menu', PRIMARY)]);

    const text = [
      ui.screenHeader(config.bot.name, 'Paired Accounts'),
      '',
      '<blockquote>Tap an account below to manage it.</blockquote>'
    ].join('\n');

    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } })
      .catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } }));
  } catch (err) {
    return eh.handle(ctx, err, 'paired_list', 'main_menu');
  }
}

async function accountMenu(ctx, num) {
  try {
    const tid = String(ctx.from.id);
    const s = await Session.findOne({ telegramId: tid, whatsappNumber: num });
    const job = await getActiveJob(tid, num);
    
    const text = [
      ui.screenHeader(config.bot.name, 'Account Manager'),
      ui.accountHeader(num, s?.isActive, job),
      '',
      '<blockquote>Choose an action below:</blockquote>'
    ].join('\n');

    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: K.accountMenu(num) })
      .catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: K.accountMenu(num) }));
  } catch (err) {
    return eh.handle(ctx, err, 'account_menu', 'paired');
  }
}

async function setPfpPrompt(ctx, num) {
  try {
    ctx.setState({ step: 'set_pfp', num });
    const text = [
      ui.screenHeader(config.bot.name, 'Change Profile Picture'),
      ui.stat('📱', 'Account', `+${num}`),
      '',
      '<blockquote>Send the image you want to set.</blockquote>',
      '',
      '✨ Full HD — No cropping — Original ratio kept'
    ].join('\n');

    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: K.back(`account:${num}`) })
      .catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: K.back(`account:${num}`) }));
  } catch (err) {
    return eh.handle(ctx, err, 'set_pfp_prompt', `account:${num}`);
  }
}

async function handlePfpImage(ctx, num, bot) {
  let msg;
  try {
    const tid = String(ctx.from.id);
    clearState(ctx.from.id);

    const photo = ctx.message.photo;
    const doc = ctx.message.document;
    let fid;

    if (doc?.mime_type?.startsWith('image/')) fid = doc.file_id;
    else if (photo) fid = photo[photo.length - 1].file_id;
    else return ctx.reply(ui.warn('Invalid File', 'Please send a valid image file.'), { parse_mode: 'HTML' });

    msg = await ctx.reply(ui.loading('Uploading to WhatsApp...'), { parse_mode: 'HTML' });
    
    const dir = getUserImageDir(tid, num);
    const imgPath = await downloadTelegramFile(bot, fid, dir, `pfp_${Date.now()}`);
    await setProfilePicture(tid, num, imgPath);
    
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null,
      ui.success('Profile Picture Updated', `Account: +${num}`),
      { parse_mode: 'HTML', reply_markup: K.accountMenu(num) }
    );
  } catch (err) {
    if (msg) {
      await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
    }
    return eh.handle(ctx, err, 'set_pfp', `account:${num}`);
  }
}

async function getPfp(ctx, num) {
  let msg;
  try {
    const tid = String(ctx.from.id);
    msg = await ctx.reply(ui.loading('Fetching profile picture...'), { parse_mode: 'HTML' });
    
    const url = await getProfilePicture(tid, num);
    await ctx.replyWithPhoto(url, {
      caption: `<b>Current Profile Picture</b>\n${ui.codeBlock('+' + num)}`,
      parse_mode: 'HTML', reply_markup: K.back(`account:${num}`),
    });
    
    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
  } catch (err) {
    if (msg) {
      await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
    }
    return eh.handle(ctx, err, 'get_pfp', `account:${num}`);
  }
}

async function delPfpConfirm(ctx, num) {
  try {
    const text = [
      ui.screenHeader('Delete PFP', 'Confirmation'),
      ui.stat('📱', 'Account', `+${num}`),
      '',
      ui.confirm('Delete Profile Picture', 'This will remove your current WhatsApp profile picture.', 'Are you sure?')
    ].join('\n');

    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: K.confirm(`confirm_del_pfp:${num}`, `account:${num}`) })
      .catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: K.confirm(`confirm_del_pfp:${num}`, `account:${num}`) }));
  } catch (err) {
    return eh.handle(ctx, err, 'del_pfp_confirm', `account:${num}`);
  }
}

async function delPfpDo(ctx, num) {
  let msg;
  try {
    const tid = String(ctx.from.id);
    msg = await ctx.editMessageText(ui.loading('Deleting profile picture...'), { parse_mode: 'HTML' }).catch(() => null);
    
    await deleteProfilePicture(tid, num);
    
    const text = ui.success('Profile Picture Deleted', `Account: +${num}`);
    if (msg) {
      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, text, { parse_mode: 'HTML', reply_markup: K.accountMenu(num) });
    } else {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: K.accountMenu(num) }).catch(() => {});
    }
  } catch (err) {
    return eh.handle(ctx, err, 'del_pfp', `account:${num}`);
  }
}

async function setNamePrompt(ctx, num) {
  try {
    ctx.setState({ step: 'setname_text', num });
    const text = [
      ui.screenHeader(config.bot.name, 'Change Display Name'),
      ui.stat('📱', 'Account', `+${num}`),
      '',
      '<blockquote>Send the new display name you want to set.</blockquote>'
    ].join('\n');

    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: K.back(`account:${num}`) })
      .catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: K.back(`account:${num}`) }));
  } catch (err) {
    return eh.handle(ctx, err, 'set_name_prompt', `account:${num}`);
  }
}

async function handleSetName(ctx, num) {
  let msg;
  try {
    const tid = String(ctx.from.id);
    clearState(ctx.from.id);
    const name = ctx.message.text?.trim();

    if (!name || name.length < 1 || name.length > 25) {
      return ctx.reply(ui.warn('Invalid Name', 'Name must be 1-25 characters long. Try again.'), { parse_mode: 'HTML' });
    }

    msg = await ctx.reply(ui.loading(`Changing display name to *${name}*...`), { parse_mode: 'HTML' });
    
    await setDisplayName(tid, num, name);
    
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null,
      ui.success('Display Name Changed', `Account: +${num}`, `New Name: ${name}`),
      { parse_mode: 'HTML', reply_markup: K.accountMenu(num) }
    );
  } catch (err) {
    if (msg) {
      await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
    }
    return eh.handle(ctx, err, 'set_name', `account:${num}`);
  }
}

async function autoMenu(ctx, num) {
  try {
    const tid = String(ctx.from.id);
    const job = await getActiveJob(tid, num);
    
    const parts = [
      ui.screenHeader(config.bot.name, 'Auto Change PFP'),
      ui.stat('📱', 'Account', `+${num}`)
    ];
    
    if (job) {
      parts.push('', ui.warn('Active Schedule', `Every ${job.interval} ${job.mode}(s) - stop it before starting a new one.`));
    }
    
    parts.push('', '<blockquote>Choose schedule mode:</blockquote>');

    await ctx.editMessageText(parts.join('\n'), { parse_mode: 'HTML', reply_markup: K.autoMenu(num) })
      .catch(() => ctx.reply(parts.join('\n'), { parse_mode: 'HTML', reply_markup: K.autoMenu(num) }));
  } catch (err) {
    return eh.handle(ctx, err, 'auto_menu', `account:${num}`);
  }
}

async function autoHourPrompt(ctx, num) {
  try {
    const tid = String(ctx.from.id);
    if (await getActiveJob(tid, num)) {
      return ctx.editMessageText(ui.warn('Schedule Exists', 'Stop current auto-change job first.'), { parse_mode: 'HTML', reply_markup: K.back(`account:${num}`) });
    }
    
    ctx.setState({ step: 'auto_hour_interval', num });
    const text = [
      ui.screenHeader('Auto Change', 'Hour Based'),
      ui.stat('📱', 'Account', `+${num}`),
      '',
      '<blockquote>How many hours between changes? (1-24)</blockquote>',
      '',
      '*Examples:*',
      '• 1h = 24 images',
      '• 2h = 12 images',
      '• 6h = 4 images',
      '• 12h = 2 images'
    ].join('\n');

    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: K.back(`account:${num}`) })
      .catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: K.back(`account:${num}`) }));
  } catch (err) {
    return eh.handle(ctx, err, 'auto_hour_prompt', `account:${num}`);
  }
}

async function autoDayPrompt(ctx, num) {
  try {
    const tid = String(ctx.from.id);
    if (await getActiveJob(tid, num)) {
      return ctx.editMessageText(ui.warn('Schedule Exists', 'Stop current auto-change job first.'), { parse_mode: 'HTML', reply_markup: K.back(`account:${num}`) });
    }
    
    ctx.setState({ step: 'auto_day_interval', num });
    const text = [
      ui.screenHeader('Auto Change', 'Day Based'),
      ui.stat('📱', 'Account', `+${num}`),
      '',
      '<blockquote>How many days between changes? (1-30)</blockquote>'
    ].join('\n');

    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: K.back(`account:${num}`) })
      .catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: K.back(`account:${num}`) }));
  } catch (err) {
    return eh.handle(ctx, err, 'auto_day_prompt', `account:${num}`);
  }
}

async function handleAutoInterval(ctx) {
  try {
    const { step, num } = ctx.userState;
    const n = parseInt(ctx.message.text?.trim());
    const isHour = step === 'auto_hour_interval';

    if (isHour && (isNaN(n) || n < 1 || n > 24))
      return ctx.reply(ui.warn('Invalid Input', 'Enter a number 1-24.'), { parse_mode: 'HTML' });
    if (!isHour && (isNaN(n) || n < 1 || n > 30))
      return ctx.reply(ui.warn('Invalid Input', 'Enter a number 1-30.'), { parse_mode: 'HTML' });

    const mode = isHour ? 'hour' : 'day';
    const required = calcImageCount(mode, n);

    ctx.setState({ step: `auto_${mode}_images`, num, interval: n, required, images: [] });
    
    const text = [
      ui.screenHeader('Schedule Setup', `Every ${n} ${mode}(s)`),
      '',
      `> I need *${required} image(s)* total.`,
      '',
      'Send them one by one.'
    ].join('\n');
    
    await ctx.reply(text, { parse_mode: 'HTML' });
  } catch (err) {
    return eh.handle(ctx, err, 'auto_interval', `account:${ctx.userState?.num || ''}`);
  }
}

async function handleAutoImages(ctx, bot) {
  let m;
  try {
    const { step, num, interval, required, images } = ctx.userState;
    const mode = step.includes('hour') ? 'hour' : 'day';
    const tid = String(ctx.from.id);

    const photo = ctx.message.photo;
    const doc = ctx.message.document;
    let fid;

    if (doc?.mime_type?.startsWith('image/')) fid = doc.file_id;
    else if (photo) fid = photo[photo.length - 1].file_id;
    else return ctx.reply(ui.warn('Invalid File', 'Please send an image.'), { parse_mode: 'HTML' });

    const dir = getUserImageDir(tid, num);
    const imgPath = await downloadTelegramFile(bot, fid, dir, `auto_${mode}_${images.length}`);
    images.push(imgPath);
    ctx.setState({ ...ctx.userState, images });

    if (images.length < required) {
      return ctx.reply(ui.taskProgress('Images received', images.length, required), { parse_mode: 'HTML' });
    }

    clearState(ctx.from.id);
    m = await ctx.reply(ui.loading('Setting up scheduler...'), { parse_mode: 'HTML' });
    
    await scheduleJob(tid, num, mode, interval, images);
    
    const text = [
      ui.success('Auto Change Scheduled!'),
      ui.stat('📱', 'Account', `+${num}`),
      ui.stat('⏱️', 'Schedule', `Every ${interval} ${mode}(s)`),
      ui.stat('🖼️', 'Images', `${images.length} items`),
      '',
      '<blockquote>You will be notified on each change!</blockquote>'
    ].join('\n');
    
    await ctx.telegram.editMessageText(ctx.chat.id, m.message_id, null, text, { parse_mode: 'HTML', reply_markup: K.accountMenu(num) });
  } catch (err) {
    if (m) {
      await ctx.telegram.deleteMessage(ctx.chat.id, m.message_id).catch(() => {});
    }
    return eh.handle(ctx, err, 'auto_images', `account:${ctx.userState?.num || ''}`);
  }
}

async function stopAuto(ctx, num) {
  try {
    const tid = String(ctx.from.id);
    await cancelJob(tid, num);
    await ctx.editMessageText(
      ui.success('Auto Change Stopped', `Account: +${num}`),
      { parse_mode: 'HTML', reply_markup: K.accountMenu(num) }
    );
  } catch (err) {
    return eh.handle(ctx, err, 'stop_auto', `account:${num}`);
  }
}

async function purgeConfirm(ctx, num) {
  try {
    const text = [
      ui.screenHeader('Purge Session', 'Danger Zone'),
      ui.stat('📱', 'Account', `+${num}`),
      '',
      ui.confirm('Permanent Deletion', 'This will delete session data, stored images, and active schedules.', '<b>Cannot be undone!</b>')
    ].join('\n');

    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: K.confirm(`confirm_purge:${num}`, `account:${num}`) })
      .catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: K.confirm(`confirm_purge:${num}`, `account:${num}`) }));
  } catch (err) {
    return eh.handle(ctx, err, 'purge_confirm', `account:${num}`);
  }
}

async function purgeDo(ctx, num) {
  let msg;
  try {
    const tid = String(ctx.from.id);
    msg = await ctx.editMessageText(ui.loading('Purging session data...'), { parse_mode: 'HTML' }).catch(() => null);
    
    await cancelJob(tid, num);
    await disconnect(tid, num);
    deleteDir(getUserImageDir(tid, num));
    deleteDir(getUserSessionDir(tid, num));
    await Session.findOneAndDelete({ telegramId: tid, whatsappNumber: num });
    
    const text = ui.success('Session Purged', `All data for +${num} has been permanently deleted.`);
    
    if (msg) {
      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, text, { parse_mode: 'HTML', reply_markup: K.backMain() });
    } else {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: K.backMain() }).catch(() => {});
    }
  } catch (err) {
    return eh.handle(ctx, err, 'purge', `account:${num}`);
  }
}

async function makePermanent(ctx, num) {
  try {
    await Session.findOneAndUpdate({ telegramId: String(ctx.from.id), whatsappNumber: num }, { isPermanent: true });
    await ctx.answerCbQuery('Session marked permanent!').catch(() => {});
    await ctx.editMessageText(
      ui.success('Session is now permanent', `Account: +${num}`),
      { parse_mode: 'HTML', reply_markup: K.accountMenu(num) }
    ).catch(() => {});
  } catch (err) {
    return eh.handle(ctx, err, 'make_permanent', `account:${num}`);
  }
}

module.exports = {
  pairedList, accountMenu, setPfpPrompt, handlePfpImage, getPfp,
  delPfpConfirm, delPfpDo, setNamePrompt, handleSetName,
  autoMenu, autoHourPrompt, autoDayPrompt,
  handleAutoInterval, handleAutoImages, stopAuto, purgeConfirm, purgeDo, makePermanent,
};
