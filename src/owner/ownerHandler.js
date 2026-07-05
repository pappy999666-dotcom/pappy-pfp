const { User, Session, AutoChangeJob, SupportTicket, ForceJoin, Channel, GroupPfpTask, Settings, PromotionLink } = require('../database/models');
const K = require('../handlers/keyboards');
const config = require('../config');
const { setState, clearState } = require('../middleware/session');
const { chunkArray, isValidPhoneNumber, formatPhoneNumber } = require('../utils/helpers');
const { isOwnerConnected, connectOwnerWA, disconnectOwner, setOwnerNumber } = require('../services/ownerWhatsapp');
const { btn, PRIMARY, SUCCESS, DANGER } = require('../utils/buttonStyles');
const logger = require('../utils/logger');

async function panel(ctx) {
  await ctx.editMessageText(`*${config.bot.name} - Owner Control Panel*\n\nWhat would you like to manage?`,
    { parse_mode: 'Markdown', reply_markup: K.ownerPanel() })
    .catch(() => ctx.reply('Owner Panel:', { reply_markup: K.ownerPanel() }));
}

async function stats(ctx) {
  const [users, activeSessions, allSessions, activeJobs, openTickets, groupTasks] = await Promise.all([
    User.countDocuments(),
    Session.countDocuments({ isActive: true }),
    Session.countDocuments(),
    AutoChangeJob.countDocuments({ isActive: true }),
    SupportTicket.countDocuments({ status: 'open' }),
    GroupPfpTask.countDocuments({ status: { $in: ['pending_join', 'pending_approval', 'pending_admin', 'active'] } }),
  ]);
  const ownerWaStatus = isOwnerConnected() ? '🟢 Connected' : '🔴 Disconnected';

  await ctx.editMessageText(
    `*${config.bot.name} Statistics*\n\n` +
    `👥 Total Users: *${users}*\n` +
    `📱 Total Sessions: *${allSessions}*\n` +
    `🟢 Active Sessions: *${activeSessions}*\n` +
    `🔄 Active Auto-Changes: *${activeJobs}*\n` +
    `🖼 Active Group PFP Tasks: *${groupTasks}*\n` +
    `🎫 Open Tickets: *${openTickets}*\n` +
    `📱 Owner WA: *${ownerWaStatus}*`,
    { parse_mode: 'Markdown', reply_markup: K.back('owner') }
  ).catch(() => {});
}

async function users(ctx) {
  const list = await User.find().sort({ lastActive: -1 }).limit(20);
  const lines = list.map((u, i) =>
    `${i + 1}. ${u.firstName || ''} @${u.username || '-'} (\`${u.telegramId}\`)`
  ).join('\n') || 'No users yet.';
  await ctx.editMessageText(`*Users (last 20)*\n\n${lines}`,
    { parse_mode: 'Markdown', reply_markup: K.back('owner') }).catch(() => {});
}

async function broadcastPrompt(ctx) {
  ctx.setState({ step: 'broadcast' });
  await ctx.editMessageText(
    `*Broadcast*\n\nSend the message to broadcast (text, photo, video, or document):`,
    { parse_mode: 'Markdown', reply_markup: K.back('owner') }
  ).catch(() => ctx.reply('Send broadcast message:'));
}

async function broadcastDo(ctx, bot) {
  clearState(ctx.from.id);
  const all = await User.find({ isBlocked: false });
  const m = await ctx.reply(`📣 Broadcasting to ${all.length} users...`);

  let ok = 0, fail = 0;
  for (const chunk of chunkArray(all, 25)) {
    await Promise.allSettled(chunk.map(async u => {
      try {
        const tid = u.telegramId;
        if (ctx.message.text) {
          await bot.telegram.sendMessage(tid, ctx.message.text, { parse_mode: 'Markdown' });
        } else if (ctx.message.photo) {
          await bot.telegram.sendPhoto(tid, ctx.message.photo.at(-1).file_id, { caption: ctx.message.caption || '' });
        } else if (ctx.message.video) {
          await bot.telegram.sendVideo(tid, ctx.message.video.file_id, { caption: ctx.message.caption || '' });
        } else if (ctx.message.document) {
          await bot.telegram.sendDocument(tid, ctx.message.document.file_id, { caption: ctx.message.caption || '' });
        }
        ok++;
      } catch { fail++; }
    }));
    await new Promise(r => setTimeout(r, 80));
  }

  await ctx.telegram.editMessageText(ctx.chat.id, m.message_id, null,
    `✅ *Broadcast done*\n\nSuccess: ${ok}\nFailed: ${fail}`,
    { parse_mode: 'Markdown', reply_markup: K.back('owner') }
  );
}

async function fjPanel(ctx) {
  const links = await ForceJoin.find();
  const btns = links.map(l => [
    btn(`${l.title || l.link} ${l.isRequired ? '(Required)' : '(Optional)'}`, `fj_info:${l._id}`, PRIMARY),
    btn('❌', `fj_del:${l._id}`, DANGER),
  ]);
  if (links.length < 5) btns.push([btn('➕ Add Link', 'fj_add', SUCCESS)]);
  btns.push([{ text: '‹ Back', callback_data: 'owner' }]);
  await ctx.editMessageText(
    `*Force Join Settings*\n${links.length}/5 links configured:`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns } }
  ).catch(() => {});
}

async function fjAddPrompt(ctx) {
  ctx.setState({ step: 'fj_add' });
  await ctx.editMessageText(
    `*Add Force Join Link*\n\nSend the channel/group invite link:`,
    { parse_mode: 'Markdown', reply_markup: K.back('o_fj') }
  ).catch(() => ctx.reply('Send invite link:'));
}

async function fjAddDo(ctx) {
  clearState(ctx.from.id);
  const link = ctx.message.text?.trim();
  if (!link.startsWith('http') && !link.startsWith('@'))
    return ctx.reply('Invalid. Send a t.me link or @username.');
  await ForceJoin.create({ link, title: link, isRequired: true, platform: 'telegram' });
  await ctx.reply('✅ Link added.', { reply_markup: K.back('o_fj') });
}

async function fjDel(ctx, id) {
  await ForceJoin.findByIdAndDelete(id);
  await ctx.answerCbQuery('Removed').catch(() => {});
  await fjPanel(ctx);
}

async function channelPanel(ctx) {
  const channels = await Channel.find({ isActive: true });
  const waChs = channels.filter(c => c.platform === 'whatsapp');
  const tgChs = channels.filter(c => c.platform === 'telegram');

  let text = `*${config.bot.name} - Channel Management*\n\n`;
  text += `*WhatsApp Channels:*\n`;
  text += waChs.length ? waChs.map(c => `- ${c.title || c.link}`).join('\n') : 'None';
  text += `\n\n*Telegram Channels/Groups:*\n`;
  text += tgChs.length ? tgChs.map(c => `- ${c.title || c.link}`).join('\n') : 'None (auto-tracked when bot is admin)';

  const btns = [];
  for (const ch of channels) {
    btns.push([
      btn(`${ch.platform === 'whatsapp' ? '📱 WA' : '📢 TG'}: ${ch.title || ch.link}`, `ch_info:${ch._id}`, PRIMARY),
      btn('❌', `ch_del:${ch._id}`, DANGER),
    ]);
  }
  btns.push([
    btn('➕ Add WhatsApp Channel', 'ch_add_wa', SUCCESS),
    btn('➕ Add Telegram Channel', 'ch_add_tg', SUCCESS),
  ]);
  btns.push([{ text: '‹ Back', callback_data: 'owner' }]);

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns },
  }).catch(() => {});
}

async function channelAddPrompt(ctx, platform) {
  ctx.setState({ step: 'ch_add', platform });
  await ctx.editMessageText(
    `*Add ${platform === 'whatsapp' ? 'WhatsApp Channel JID' : 'Telegram Channel/Group'}*\n\n` +
    (platform === 'whatsapp'
      ? `Send the WhatsApp channel/group JID\n_Example:_ \`120363XXXXXXXXX@newsletter\` or \`XXXXXXXXXX@g.us\``
      : `Send the Telegram channel username or chat ID\n_Example:_ \`@mychannel\` or \`-100XXXXXXXXXX\``),
    { parse_mode: 'Markdown', reply_markup: K.back('o_channels') }
  ).catch(() => ctx.reply('Send channel identifier:'));
}

async function channelAddDo(ctx) {
  const { platform } = ctx.userState;
  clearState(ctx.from.id);
  const link = ctx.message.text?.trim();
  if (!link) return ctx.reply('Invalid. Send a valid link or ID.');
  await Channel.create({ platform, link, title: link });
  await ctx.reply(`✅ ${platform === 'whatsapp' ? 'WhatsApp' : 'Telegram'} channel added.\n\nWallpaper drops will now be sent here.`, { reply_markup: K.back('o_channels') });
}

async function channelDel(ctx, id) {
  await Channel.findByIdAndDelete(id);
  await ctx.answerCbQuery('Channel removed').catch(() => {});
  await channelPanel(ctx);
}

async function ownerWaStatus(ctx) {
  const connected = isOwnerConnected();
  const num = config.ownerWaNumber || 'Not configured';
  await ctx.editMessageText(
    `*Owner WhatsApp Status*\n\n` +
    `Number: \`+${num}\`\n` +
    `Status: ${connected ? '🟢 Connected' : '🔴 Disconnected'}\n\n` +
    `${!connected ? 'Use "Set/Change Owner WA Number" to configure, then "Pair Owner WA" to connect.' : 'The owner account is active and ready for group PFP tasks.'}`,
    { parse_mode: 'Markdown', reply_markup: K.back('owner') }
  ).catch(() => {});
}

async function ownerWaSetPrompt(ctx) {
  const current = config.ownerWaNumber;
  ctx.setState({ step: 'o_wa_set_num' });
  await ctx.editMessageText(
    `*Set Owner WhatsApp Number*\n\n` +
    `Current: ${current ? `\`+${current}\`` : '_Not set_'}\n\n` +
    `Send the WhatsApp number with country code:\n_Example:_ \`+1234567890\``,
    { parse_mode: 'Markdown', reply_markup: K.back('owner') }
  ).catch(() => ctx.reply('Send owner WhatsApp number with country code:'));
}

async function ownerWaSetDo(ctx) {
  clearState(ctx.from.id);
  const phone = ctx.message.text?.trim();
  if (!isValidPhoneNumber(phone)) {
    return ctx.reply('Invalid number. Include country code, e.g. `+12345678900`', { parse_mode: 'Markdown' });
  }
  const num = formatPhoneNumber(phone);

  if (isOwnerConnected()) await disconnectOwner();

  await Settings.findOneAndUpdate(
    { key: 'ownerWaNumber' },
    { key: 'ownerWaNumber', value: num, updatedAt: new Date() },
    { upsert: true }
  );
  config.ownerWaNumber = num;
  setOwnerNumber(num);

  await ctx.reply(
    `✅ *Owner WA number set to* \`+${num}\`\n\nNow use "Pair Owner WA" to connect this number.`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [
        [btn('🔗 Pair Owner WA',        'o_wa_pair', SUCCESS)],
        [btn('‹ Back to Owner Panel',   'owner',     PRIMARY)],
      ]},
    }
  );
}

async function ownerWaPair(ctx, bot) {
  if (!config.ownerWaNumber) {
    return ctx.editMessageText(
      `*Owner WA Pairing*\n\nNo number configured.\nUse "Set/Change Owner WA Number" first.`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [
          [btn('🔧 Set Owner WA Number', 'o_wa_set', SUCCESS)],
          [btn('‹ Back',                'owner',     PRIMARY)],
        ]},
      }
    ).catch(() => {});
  }

  if (isOwnerConnected()) {
    return ctx.editMessageText(
      `*Owner WA*\n\nAlready connected as \`+${config.ownerWaNumber}\`\n\nTo re-pair, set a new number first.`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [
          [btn('🔄 Change Number', 'o_wa_set', SUCCESS)],
          [btn('‹ Back',          'owner',     PRIMARY)],
        ]},
      }
    ).catch(() => {});
  }

  await ctx.editMessageText(
    `*${config.bot.name} - Pair Owner WA*\n\`+${config.ownerWaNumber}\`\n\nChoose pairing method:`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [
        [btn('🔢 Pair with Code', 'o_wa_pair_code', SUCCESS)],
        [btn('📷 Pair with QR',   'o_wa_pair_qr',   SUCCESS)],
        [btn('❌ Cancel',          'owner',          DANGER)],
      ]},
    }
  ).catch(() => {});
}

async function ownerWaPairCode(ctx, bot) {
  const num = config.ownerWaNumber;
  const wait = await ctx.editMessageText(`⏳ Connecting owner WA \`+${num}\` via pairing code...`, { parse_mode: 'Markdown' })
    .catch(() => ctx.reply(`⏳ Connecting owner WA \`+${num}\` via pairing code...`, { parse_mode: 'Markdown' }));

  try {
    await connectOwnerWA({
      onCode: async code => {
        const formatted = code.replace(/(.{4})/g, '$1-').replace(/-$/, '');
        try { await ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id); } catch {}
        await ctx.reply(
          `*${config.bot.name} Owner WA Pairing Code*\n\`+${num}\`\n\n` +
          `\`${formatted}\`\n\n` +
          `*Steps:*\n` +
          `1. Open WhatsApp on the owner phone\n` +
          `2. Settings → Linked Devices\n` +
          `3. Link a Device → Link with phone number\n` +
          `4. Enter the code above\n\n` +
          `_Code expires in 60 seconds_`,
          { parse_mode: 'Markdown' }
        );
      },
      onConnected: async () => {
        const { setupGroupEventListeners } = require('../services/ownerWhatsapp');
        setupGroupEventListeners(bot);
        await ctx.reply(
          `✅ *Owner WA Connected!*\n\`+${num}\`\n\nGroup PFP features are now active.`,
          { parse_mode: 'Markdown', reply_markup: K.back('owner') }
        );
      },
    });
  } catch (e) {
    logger.error('Owner WA pair code: ' + e.message);
    try { await ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id); } catch {}
    await ctx.reply(`❌ Owner WA pairing failed: ${e.message}`, { reply_markup: K.back('owner') });
  }
}

async function ownerWaPairQR(ctx, bot) {
  const QRCode = require('qrcode');
  const num = config.ownerWaNumber;
  const wait = await ctx.editMessageText(`⏳ Generating QR code for owner WA \`+${num}\`...`, { parse_mode: 'Markdown' })
    .catch(() => ctx.reply(`⏳ Generating QR code for owner WA \`+${num}\`...`, { parse_mode: 'Markdown' }));

  let qrSent = false;

  try {
    await connectOwnerWA({
      onQR: async qr => {
        if (qrSent) return;
        qrSent = true;
        try {
          const qrBuffer = await QRCode.toBuffer(qr, { width: 512, margin: 2 });
          try { await ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id); } catch {}
          await ctx.replyWithPhoto(
            { source: qrBuffer },
            {
              caption: `*${config.bot.name} Owner WA QR Code*\n\`+${num}\`\n\nScan in WhatsApp → Linked Devices`,
              parse_mode: 'Markdown',
            }
          );
        } catch (e) {
          logger.warn('Owner QR send failed: ' + e.message);
        }
      },
      onConnected: async () => {
        const { setupGroupEventListeners } = require('../services/ownerWhatsapp');
        setupGroupEventListeners(bot);
        await ctx.reply(
          `✅ *Owner WA Connected!*\n\`+${num}\`\n\nGroup PFP features are now active.`,
          { parse_mode: 'Markdown', reply_markup: K.back('owner') }
        );
      },
    });
  } catch (e) {
    logger.error('Owner WA pair QR: ' + e.message);
    try { await ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id); } catch {}
    await ctx.reply(`❌ Owner WA QR pairing failed: ${e.message}`, { reply_markup: K.back('owner') });
  }
}

async function restart(ctx) {
  await ctx.editMessageText('♻️ Restarting...', { parse_mode: 'Markdown' }).catch(() => {});
  logger.info('Restart requested by owner');
  setTimeout(() => process.exit(0), 500);
}

// ── Promotion Manager ──────────────────────────────────────────────────────
async function promoPanel(ctx) {
  const links = await PromotionLink.find().sort({ order: 1 });
  let text = `*📣 Promotion Manager*\n\n`;
  text += `These buttons appear on every Daily Drop.\n`;
  text += `*${links.filter(l => l.isEnabled).length}/${links.length}* enabled\n\n`;

  const btns = [];
  for (const l of links) {
    const status = l.isEnabled ? '✅' : '⏸';
    btns.push([
      btn(`${status} ${l.label}`, `promo_toggle:${l._id}`, l.isEnabled ? SUCCESS : PRIMARY),
      btn('✏️', `promo_edit:${l._id}`, PRIMARY),
      btn('🗑', `promo_del:${l._id}`, DANGER),
    ]);
  }
  btns.push([btn('➕ Add Button', 'promo_add', SUCCESS)]);
  btns.push([btn('‹ Back', 'owner', PRIMARY)]);

  await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns } })
    .catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns } }));
}

async function promoAddPrompt(ctx) {
  ctx.setState({ step: 'promo_add_label' });
  await ctx.editMessageText(
    `*➕ Add Promotion Button*\n\nStep 1/2: Send the button label\n_Example:_ \`📢 Join WhatsApp\``,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[btn('❌ Cancel', 'o_promo', DANGER)]] } }
  ).catch(() => ctx.reply('Send button label:'));
}

async function promoAddLabel(ctx) {
  const label = ctx.message.text?.trim();
  if (!label) return ctx.reply('Invalid. Send a button label.');
  ctx.setState({ step: 'promo_add_url', promoLabel: label });
  await ctx.reply(
    `*Step 2/2: Send the URL*\n_Example:_ \`https://t.me/yourchannel\``,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[btn('❌ Cancel', 'o_promo', DANGER)]] } }
  );
}

async function promoAddUrl(ctx) {
  const { promoLabel } = ctx.userState;
  clearState(ctx.from.id);
  const url = ctx.message.text?.trim();
  if (!url?.startsWith('http')) return ctx.reply('Invalid URL. Must start with http.');
  const count = await PromotionLink.countDocuments();
  await PromotionLink.create({ label: promoLabel, url, order: count });
  await ctx.reply(`✅ Button added: *${promoLabel}*`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[btn('‹ Back to Promo', 'o_promo', PRIMARY)]] } });
}

async function promoToggle(ctx, id) {
  const link = await PromotionLink.findById(id);
  if (!link) return ctx.answerCbQuery('Not found').catch(() => {});
  link.isEnabled = !link.isEnabled;
  await link.save();
  await ctx.answerCbQuery(link.isEnabled ? '✅ Enabled' : '⏸ Disabled').catch(() => {});
  await promoPanel(ctx);
}

async function promoDel(ctx, id) {
  await PromotionLink.findByIdAndDelete(id);
  await ctx.answerCbQuery('🗑 Removed').catch(() => {});
  await promoPanel(ctx);
}

async function promoEditPrompt(ctx, id) {
  const link = await PromotionLink.findById(id);
  if (!link) return ctx.answerCbQuery('Not found').catch(() => {});
  ctx.setState({ step: 'promo_edit_label', promoId: id, promoLabel: link.label });
  await ctx.editMessageText(
    `*✏️ Edit Button*\n\nCurrent label: \`${link.label}\`\nCurrent URL: \`${link.url}\`\n\nSend new label (or send \`-\` to keep current):`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[btn('❌ Cancel', 'o_promo', DANGER)]] } }
  ).catch(() => ctx.reply('Send new label or - to keep:'));
}

async function promoEditLabel(ctx) {
  const { promoId, promoLabel } = ctx.userState;
  const input = ctx.message.text?.trim();
  const newLabel = input === '-' ? promoLabel : input;
  ctx.setState({ step: 'promo_edit_url', promoId, promoLabel: newLabel });
  await ctx.reply(`Send new URL (or \`-\` to keep current):`, { parse_mode: 'Markdown' });
}

async function promoEditUrl(ctx) {
  const { promoId, promoLabel } = ctx.userState;
  clearState(ctx.from.id);
  const link = await PromotionLink.findById(promoId);
  if (!link) return ctx.reply('Not found.');
  const input = ctx.message.text?.trim();
  if (input !== '-') {
    if (!input.startsWith('http')) return ctx.reply('Invalid URL.');
    link.url = input;
  }
  link.label = promoLabel;
  await link.save();
  await ctx.reply(`✅ Button updated: *${link.label}*`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[btn('‹ Back to Promo', 'o_promo', PRIMARY)]] } });
}

module.exports = {
  panel, stats, users, broadcastPrompt, broadcastDo,
  fjPanel, fjAddPrompt, fjAddDo, fjDel,
  channelPanel, channelAddPrompt, channelAddDo, channelDel,
  ownerWaStatus, ownerWaSetPrompt, ownerWaSetDo,
  ownerWaPair, ownerWaPairCode, ownerWaPairQR, restart,
  promoPanel, promoAddPrompt, promoAddLabel, promoAddUrl,
  promoToggle, promoDel, promoEditPrompt, promoEditLabel, promoEditUrl,
};
