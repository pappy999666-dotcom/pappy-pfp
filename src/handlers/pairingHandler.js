const QRCode = require('qrcode');
const { createWhatsAppSession, disconnect } = require('../services/whatsapp');
const { Session } = require('../database/models');
const { getUserSessionDir, getUserImageDir, deleteDir } = require('../utils/storage');
const K = require('./keyboards');
const config = require('../config');
const { clearState, setState } = require('../middleware/session');
const { isValidPhoneNumber, formatPhoneNumber } = require('../utils/helpers');
const { cancelJob } = require('../schedulers/autoChange');
const { btn, PRIMARY, SUCCESS, DANGER } = require('../utils/buttonStyles');
const logger = require('../utils/logger');

async function start(ctx) {
  ctx.setState({ step: 'pair_phone' });
  const text = `*${config.bot.name} - Pair WhatsApp Account*\n\nSend your WhatsApp number with country code.\n\n_Example:_ \`+1234567890\``;
  await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: K.back('main_menu') })
    .catch(() => ctx.reply(text, { parse_mode: 'Markdown' }));
}

async function handlePhone(ctx, phone, bot) {
  const tid = String(ctx.from.id);
  const num = formatPhoneNumber(phone);

  if (!isValidPhoneNumber(phone)) {
    return ctx.reply('❌ Invalid number. Include country code, e.g. `+12345678900`', { parse_mode: 'Markdown' });
  }

  const existing = await Session.findOne({ telegramId: tid, whatsappNumber: num });
  if (existing) {
    ctx.setState({ step: 'pair_existing', num });
    const status = existing.isActive ? '🟢 Active' : '🔴 Inactive';
    return ctx.reply(
      `⚠️ *Session Already Exists*\n\n` +
      `📱 Number: \`+${num}\`\n` +
      `Status: ${status}\n\n` +
      `Do you want to delete this session and re-pair?`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [
          [btn('🗑️  Yes — Delete & Re-Pair', `pair_delete:${num}`, DANGER)],
          [btn('↩️  No — Keep Session',       'paired',            SUCCESS)],
        ]},
      }
    );
  }

  const existingCount = await Session.countDocuments({ telegramId: tid });
  if (existingCount >= config.limits.maxPairedAccounts) {
    return ctx.reply(
      `❌ Maximum *${config.limits.maxPairedAccounts}* paired accounts reached.\nRemove one first.`,
      { parse_mode: 'Markdown', reply_markup: K.backMain() }
    );
  }

  ctx.setState({ step: 'pair_method', num });
  await ctx.reply(
    `📱 *Pair WhatsApp Account*\n\`+${num}\`\n\nChoose how to link this number:`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [
        [btn('🔢  Pair with Code', `pair_code:${num}`, SUCCESS)],
        [btn('📷  Pair with QR',   `pair_qr:${num}`,   SUCCESS)],
        [btn('❌  Cancel',          'main_menu',        DANGER)],
      ]},
    }
  );
}

async function deleteAndRepair(ctx, num) {
  const tid = String(ctx.from.id);
  try {
    await cancelJob(tid, num).catch(() => {});
    await disconnect(tid, num).catch(() => {});
    deleteDir(getUserImageDir(tid, num));
    deleteDir(getUserSessionDir(tid, num));
    await Session.findOneAndDelete({ telegramId: tid, whatsappNumber: num });
  } catch (e) {
    logger.warn('delete session: ' + e.message);
  }

  ctx.setState({ step: 'pair_method', num });
  const text = `✅ *Session Deleted*\n\`+${num}\`\n\nNow choose how to re-link:`;
  const markup = { inline_keyboard: [
    [btn('🔢  Pair with Code', `pair_code:${num}`, SUCCESS)],
    [btn('📷  Pair with QR',   `pair_qr:${num}`,   SUCCESS)],
    [btn('❌  Cancel',          'main_menu',        DANGER)],
  ]};
  await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: markup })
    .catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: markup }));
}

async function doPairCode(ctx, num, bot) {
  const tid = String(ctx.from.id);
  clearState(ctx.from.id);
  const wait = await ctx.editMessageText(`⏳ Connecting \`+${num}\` via pairing code...`, { parse_mode: 'Markdown' })
    .catch(() => ctx.reply(`⏳ Connecting \`+${num}\` via pairing code...`, { parse_mode: 'Markdown' }));

  try {
    await createWhatsAppSession(tid, num, {
      onCode: async code => {
        // Format: XXXX-XXXX
        const formatted = code.length === 8
          ? `${code.slice(0, 4)}-${code.slice(4)}`
          : code.replace(/[^A-Z0-9]/g, '').replace(/(.{4})(?=.)/g, '$1-');
        try { await ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id); } catch {}
        await ctx.reply(
          `🔗 *Pairing Code* — \`+${num}\`\n\n` +
          `_Tap the button below to copy your code, then enter it in WhatsApp_\n\n` +
          `📲 WhatsApp → Settings → Linked Devices → Link with phone number\n\n` +
          `⏳ Code expires in ~60 seconds`,
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [
              // Blue copy button — Telegram Bot API 7.3+ copy_text feature
              [btn(`🔑  ${formatted}`, null, SUCCESS, { copy_text: { text: formatted } })],
              [btn('🏠  Main Menu', 'main_menu', PRIMARY)],
            ]},
          }
        );
      },
      onConnected: async sock => {
        const info = sock.user;
        await Session.findOneAndUpdate(
          { telegramId: tid, whatsappNumber: num },
          { telegramId: tid, whatsappNumber: num, isActive: true, lastConnected: new Date(), failCount: 0 },
          { upsert: true }
        );
        await ctx.reply(
          `✅ *Paired Successfully!*\n\n` +
          `📱 Number: \`+${num}\`\n` +
          `👤 Name: ${info?.name || 'Unknown'}\n\n` +
          `What would you like to do next?`,
          { parse_mode: 'Markdown', reply_markup: K.afterPair(num) }
        );
      },
      onDisconnected: async (reconnect, code) => {
        if (!reconnect) {
          await ctx.reply(
            `🔴 Session ended — you were logged out from \`+${num}\`.`,
            { parse_mode: 'Markdown', reply_markup: K.backMain() }
          );
        }
      },
    });
  } catch (e) {
    logger.error('Pairing code: ' + e.message);
    try { await ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id); } catch {}
    await ctx.reply(`❌ Pairing failed: ${e.message}\n\nPlease try again.`, { reply_markup: K.backMain() });
  }
}

async function doPairQR(ctx, num, bot) {
  const tid = String(ctx.from.id);
  clearState(ctx.from.id);
  const wait = await ctx.editMessageText(`⏳ Generating QR code for \`+${num}\`...`, { parse_mode: 'Markdown' })
    .catch(() => ctx.reply(`⏳ Generating QR code for \`+${num}\`...`, { parse_mode: 'Markdown' }));

  let qrSent = false;

  try {
    await createWhatsAppSession(tid, num, {
      onQR: async qr => {
        if (qrSent) return;
        qrSent = true;
        try {
          const qrBuffer = await QRCode.toBuffer(qr, { width: 512, margin: 2 });
          try { await ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id); } catch {}
          await ctx.replyWithPhoto(
            { source: qrBuffer },
            {
              caption: `*${config.bot.name} QR Code*\n\`+${num}\`\n\nScan this QR code in WhatsApp → Linked Devices`,
              parse_mode: 'Markdown',
            }
          );
        } catch (e) {
          logger.warn('QR send failed: ' + e.message);
        }
      },
      onConnected: async sock => {
        const info = sock.user;
        await Session.findOneAndUpdate(
          { telegramId: tid, whatsappNumber: num },
          { telegramId: tid, whatsappNumber: num, isActive: true, lastConnected: new Date(), failCount: 0 },
          { upsert: true }
        );
        await ctx.reply(
          `✅ *Paired Successfully!*\n\n` +
          `📱 Number: \`+${num}\`\n` +
          `👤 Name: ${info?.name || 'Unknown'}\n\n` +
          `What would you like to do next?`,
          { parse_mode: 'Markdown', reply_markup: K.afterPair(num) }
        );
      },
      onDisconnected: async (reconnect, code) => {
        if (!reconnect) {
          await ctx.reply(
            `🔴 Session ended — you were logged out from \`+${num}\`.`,
            { parse_mode: 'Markdown', reply_markup: K.backMain() }
          );
        }
      },
    });
  } catch (e) {
    logger.error('Pairing QR: ' + e.message);
    try { await ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id); } catch {}
    await ctx.reply(`❌ QR pairing failed: ${e.message}\n\nPlease try again.`, { reply_markup: K.backMain() });
  }
}

module.exports = { start, handlePhone, deleteAndRepair, doPairCode, doPairQR };
