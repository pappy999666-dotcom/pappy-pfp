const QRCode = require('qrcode');
const { createWhatsAppSession, disconnect } = require('../services/whatsapp');
const { Session } = require('../database/models');
const { getUserSessionDir, getUserImageDir, deleteDir } = require('../utils/storage');
const K = require('./keyboards');
const config = require('../config');
const { clearState } = require('../middleware/session');
const { isValidPhoneNumber, formatPhoneNumber } = require('../utils/helpers');
const { cancelJob } = require('../schedulers/autoChange');
const { btn, PRIMARY, SUCCESS, DANGER } = require('../utils/buttonStyles');
const ui = require('../utils/ui');
const eh = require('../utils/errorHandler');
const logger = require('../utils/logger');

async function start(ctx) {
  try {
    ctx.setState({ step: 'pair_phone' });
    const text = [
      ui.screenHeader(config.bot.name, 'Pair WhatsApp Account'),
      '',
      '<blockquote>Send your WhatsApp number with country code.</blockquote>',
      '',
      ui.italic('Example: `+1234567890`')
    ].join('\n');
    
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: K.back('main_menu') })
      .catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: K.back('main_menu') }));
  } catch (err) {
    return eh.handle(ctx, err, 'pair_start', 'main_menu');
  }
}

async function handlePhone(ctx, phone, bot) {
  try {
    const tid = String(ctx.from.id);
    const num = formatPhoneNumber(phone);

    if (!isValidPhoneNumber(phone)) {
      return ctx.reply(ui.warn('Invalid Number', 'Include country code, e.g. `+12345678900`'), { parse_mode: 'HTML' });
    }

    const existing = await Session.findOne({ telegramId: tid, whatsappNumber: num });
    if (existing) {
      ctx.setState({ step: 'pair_existing', num });
      const status = existing.isActive ? '🟢 Active' : '🔴 Inactive';
      const text = [
        ui.warn('Session Already Exists', 'This number is already paired.'),
        ui.stat('📱', 'Number', `+${num}`),
        ui.stat('📊', 'Status', status),
        '',
        '<blockquote>Do you want to delete this session and re-pair?</blockquote>'
      ].join('\n');
      
      return ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [
          [btn('🗑️  Yes — Delete & Re-Pair', `pair_delete:${num}`, DANGER)],
          [btn('↩️  No — Keep Session',       'paired',            SUCCESS)],
        ]},
      });
    }

    const existingCount = await Session.countDocuments({ telegramId: tid });
    if (existingCount >= config.limits.maxPairedAccounts) {
      return ctx.reply(
        ui.error('Limit Reached', `Maximum ${config.limits.maxPairedAccounts} paired accounts reached.`, 'Remove one first.'),
        { parse_mode: 'HTML', reply_markup: K.backMain() }
      );
    }

    ctx.setState({ step: 'pair_method', num });
    const text = [
      ui.screenHeader('Pair WhatsApp', 'Link Device'),
      ui.stat('📱', 'Number', `+${num}`),
      '',
      '<blockquote>Choose how to link this number:</blockquote>'
    ].join('\n');
    
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [
        [btn('🔢  Pair with Code', `pair_code:${num}`, SUCCESS)],
        [btn('📷  Pair with QR',   `pair_qr:${num}`,   SUCCESS)],
        [btn('❌  Cancel',          'main_menu',        DANGER)],
      ]},
    });
  } catch (err) {
    return eh.handle(ctx, err, 'pair_phone', 'main_menu');
  }
}

async function deleteAndRepair(ctx, num) {
  try {
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
    const text = [
      ui.success('Session Deleted', `Account +${num} removed.`),
      '',
      '<blockquote>Now choose how to re-link:</blockquote>'
    ].join('\n');
    
    const markup = { inline_keyboard: [
      [btn('🔢  Pair with Code', `pair_code:${num}`, SUCCESS)],
      [btn('📷  Pair with QR',   `pair_qr:${num}`,   SUCCESS)],
      [btn('❌  Cancel',          'main_menu',        DANGER)],
    ]};
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: markup })
      .catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: markup }));
  } catch (err) {
    return eh.handle(ctx, err, 'repair', 'main_menu');
  }
}

async function doPairCode(ctx, num, bot) {
  let wait;
  try {
    const tid = String(ctx.from.id);
    clearState(ctx.from.id);
    wait = await ctx.editMessageText(ui.loading(`Connecting \`+${num}\` via pairing code...`), { parse_mode: 'HTML' })
      .catch(() => ctx.reply(ui.loading(`Connecting \`+${num}\` via pairing code...`), { parse_mode: 'HTML' }));

    await createWhatsAppSession(tid, num, {
      onCode: async code => {
        const formatted = code.length === 8
          ? `${code.slice(0, 4)}-${code.slice(4)}`
          : code.replace(/[^A-Z0-9]/g, '').replace(/(.{4})(?=.)/g, '$1-');
          
        if (wait) {
          try { await ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id); wait = null; } catch {}
        }
        
        const text = ui.pairingCodeMessage(num, formatted);
        
        await ctx.reply(text, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [
            [btn(`🔑  Copy Code: ${formatted}`, null, SUCCESS, { copy_text: { text: formatted } })],
            [btn('🏠  Main Menu', 'main_menu', PRIMARY)],
          ]},
        });
      },
      onConnected: async sock => {
        const info = sock.user;
        await Session.findOneAndUpdate(
          { telegramId: tid, whatsappNumber: num },
          { telegramId: tid, whatsappNumber: num, isActive: true, lastConnected: new Date(), failCount: 0 },
          { upsert: true }
        );
        
        const text = [
          ui.success('Paired Successfully!'),
          ui.stat('📱', 'Number', `+${num}`),
          ui.stat('👤', 'Name', info?.name || 'Unknown'),
          '',
          '<blockquote>What would you like to do next?</blockquote>'
        ].join('\n');
        
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: K.afterPair(num) });
      },
      onDisconnected: async (reconnect, code) => {
        if (!reconnect) {
          await ctx.reply(
            ui.error('Session Ended', `You were logged out from +${num}.`, 'Pair again to continue.'),
            { parse_mode: 'HTML', reply_markup: K.backMain() }
          );
        }
      },
    });
  } catch (err) {
    if (wait) {
      try { await ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id); } catch {}
    }
    logger.error('Pairing code: ' + err.message);
    await ctx.reply(ui.error('Pairing Failed', err.message, 'Please try again.'), { parse_mode: 'HTML', reply_markup: K.backMain() });
  }
}

async function doPairQR(ctx, num, bot) {
  let wait;
  let qrSent = false;
  try {
    const tid = String(ctx.from.id);
    clearState(ctx.from.id);
    wait = await ctx.editMessageText(ui.loading(`Generating QR code for \`+${num}\`...`), { parse_mode: 'HTML' })
      .catch(() => ctx.reply(ui.loading(`Generating QR code for \`+${num}\`...`), { parse_mode: 'HTML' }));

    await createWhatsAppSession(tid, num, {
      onQR: async qr => {
        if (qrSent) return;
        qrSent = true;
        try {
          const qrBuffer = await QRCode.toBuffer(qr, { width: 512, margin: 2 });
          if (wait) {
            try { await ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id); wait = null; } catch {}
          }
          await ctx.replyWithPhoto(
            { source: qrBuffer },
            { caption: ui.qrCaption(num), parse_mode: 'HTML' }
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
        
        const text = [
          ui.success('Paired Successfully!'),
          ui.stat('📱', 'Number', `+${num}`),
          ui.stat('👤', 'Name', info?.name || 'Unknown'),
          '',
          '<blockquote>What would you like to do next?</blockquote>'
        ].join('\n');
        
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: K.afterPair(num) });
      },
      onDisconnected: async (reconnect, code) => {
        if (!reconnect) {
          await ctx.reply(
            ui.error('Session Ended', `You were logged out from +${num}.`, 'Pair again to continue.'),
            { parse_mode: 'HTML', reply_markup: K.backMain() }
          );
        }
      },
    });
  } catch (err) {
    if (wait) {
      try { await ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id); } catch {}
    }
    logger.error('Pairing QR: ' + err.message);
    await ctx.reply(ui.error('QR Pairing Failed', err.message, 'Please try again.'), { parse_mode: 'HTML', reply_markup: K.backMain() });
  }
}

module.exports = { start, handlePhone, deleteAndRepair, doPairCode, doPairQR };
