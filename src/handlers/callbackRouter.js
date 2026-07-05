const { isOwner, checkForceJoin } = require('../middleware/auth');
const K = require('./keyboards');
const config = require('../config');
const { CATEGORIES } = require('../services/wallpaper');
const pi = require('./pinterestHandler');
const pa = require('./pairingHandler');
const ac = require('./accountHandler');
const su = require('./supportHandler');
const gp = require('./groupPfpHandler');
const dl = require('./downloadHandler');
const wp = require('./wallpaperHandler');
const ig = require('./imageGenHandler');
const ow = require('../owner/ownerHandler');
const logger = require('../utils/logger');

async function route(ctx, bot) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;
  await ctx.answerCbQuery().catch(() => {});

  const uid = ctx.from?.id;
  const owner = isOwner(uid);

  try {
    if (data !== 'check_join' && data !== 'main_menu') {
      if (!await checkForceJoin(ctx, bot)) return;
    }

    if (data === 'main_menu') {
      return ctx.editMessageText(`*${config.bot.name} - Main Menu*\n\nChoose an option:`, {
        parse_mode: 'Markdown', reply_markup: K.mainMenu(owner),
      }).catch(() => ctx.reply('Main Menu:', { reply_markup: K.mainMenu(owner) }));
    }

    if (data === 'check_join') {
      if (await checkForceJoin(ctx, bot)) {
        return ctx.editMessageText(`✅ *Access granted!*\n\nChoose an option:`, {
          parse_mode: 'Markdown', reply_markup: K.mainMenu(owner),
        }).catch(() => ctx.reply('Verified!', { reply_markup: K.mainMenu(owner) }));
      }
      return;
    }

    /* ── Pinterest ── */
    if (data === 'pinterest') return pi.start(ctx);
    if (data.startsWith('pi_more:')) {
      const [, page, ...rest] = data.split(':');
      return pi.more(ctx, parseInt(page), rest.join(':'));
    }

    /* ── Pairing ── */
    if (data === 'pair_wa') return pa.start(ctx);
    if (data.startsWith('pair_delete:')) return pa.deleteAndRepair(ctx, data.slice(12));
    if (data.startsWith('pair_code:')) return pa.doPairCode(ctx, data.slice(10), bot);
    if (data.startsWith('pair_qr:')) return pa.doPairQR(ctx, data.slice(8), bot);

    /* ── Paired accounts ── */
    if (data === 'paired') return ac.pairedList(ctx);
    if (data.startsWith('account:')) return ac.accountMenu(ctx, data.slice(8));

    /* ── PFP actions ── */
    if (data.startsWith('set_pfp:')) return ac.setPfpPrompt(ctx, data.slice(8));
    if (data.startsWith('get_pfp:')) return ac.getPfp(ctx, data.slice(8));
    if (data.startsWith('del_pfp:')) return ac.delPfpConfirm(ctx, data.slice(8));
    if (data.startsWith('confirm_del_pfp:')) return ac.delPfpDo(ctx, data.slice(16));

    /* ── Set Display Name ── */
    if (data.startsWith('setname:')) return ac.setNamePrompt(ctx, data.slice(8));

    /* ── Auto change ── */
    if (data.startsWith('auto_pfp:')) return ac.autoMenu(ctx, data.slice(9));
    if (data.startsWith('auto_hour:')) return ac.autoHourPrompt(ctx, data.slice(10));
    if (data.startsWith('auto_day:')) return ac.autoDayPrompt(ctx, data.slice(9));
    if (data.startsWith('stop_auto:')) return ac.stopAuto(ctx, data.slice(10));

    /* ── Purge ── */
    if (data.startsWith('purge:')) return ac.purgeConfirm(ctx, data.slice(6));
    if (data.startsWith('confirm_purge:')) return ac.purgeDo(ctx, data.slice(14));

    /* ── Permanent session ── */
    if (data.startsWith('perm:')) return ac.makePermanent(ctx, data.slice(5));

    /* ── Group PFP ── */
    if (data === 'group_pfp') return gp.start(ctx);
    if (data === 'gpfp_immediate') return gp.immediateStart(ctx);
    if (data === 'gpfp_scheduled') return gp.scheduledStart(ctx);
    if (data === 'gpfp_tasks') return gp.listTasks(ctx);
    if (data.startsWith('gpfp_cancel:')) return gp.cancelTask(ctx, data.slice(12));
    if (data.startsWith('gpfp_continue:')) return gp.continueAdminCheck(ctx, data.slice(14), bot);

    /* ── Download ── */
    if (data === 'download') return dl.start(ctx);
    if (data === 'dl_auto') return dl.promptUrl(ctx, null);
    if (data.startsWith('dl_')) {
      const platform = data.slice(3);
      const names = {
        pinterest: 'Pinterest', tiktok: 'TikTok', instagram: 'Instagram',
        twitter: 'Twitter/X', youtube: 'YouTube', facebook: 'Facebook',
        threads: 'Threads', reddit: 'Reddit',
      };
      return dl.promptUrl(ctx, names[platform] || platform);
    }

    /* ── Wallpapers ── */
    if (data === 'wallpapers') return wp.start(ctx);
    if (data.startsWith('wp_more:')) {
      const parts = data.slice(8).split(':');
      return wp.loadMore(ctx, parts[0], parseInt(parts[1]));
    }
    if (data.startsWith('wp_')) {
      const category = data.slice(3);
      if (CATEGORIES.includes(category)) return wp.browseCategory(ctx, category);
    }

    /* ── AI Image Generator ── */
    if (data === 'imagegen') return ig.promptUser(ctx);

    /* ── Support ── */
    if (data === 'support') return su.start(ctx);
    if (data.startsWith('reply_ticket:') && owner) return su.ownerReplyPrompt(ctx, data.slice(13));
    if (data.startsWith('close_ticket:') && owner) return su.closeDo(ctx, data.slice(13));

    /* ── Owner panel ── */
    if (!owner && data.startsWith('o'))
      return ctx.answerCbQuery('Owner only.', { show_alert: true }).catch(() => {});

    if (data === 'owner') return ow.panel(ctx);
    if (data === 'o_stats') return ow.stats(ctx);
    if (data === 'o_users') return ow.users(ctx);
    if (data === 'o_broadcast') return ow.broadcastPrompt(ctx);
    if (data === 'o_restart') return ow.restart(ctx);
    if (data === 'o_fj') return ow.fjPanel(ctx);
    if (data === 'fj_add') return ow.fjAddPrompt(ctx);
    if (data.startsWith('fj_del:')) return ow.fjDel(ctx, data.slice(7));
    if (data === 'o_channels') return ow.channelPanel(ctx);
    if (data === 'ch_add_wa') return ow.channelAddPrompt(ctx, 'whatsapp');
    if (data === 'ch_add_tg') return ow.channelAddPrompt(ctx, 'telegram');
    if (data.startsWith('ch_del:')) return ow.channelDel(ctx, data.slice(7));
    if (data === 'o_wa_status') return ow.ownerWaStatus(ctx);
    if (data === 'o_wa_set') return ow.ownerWaSetPrompt(ctx);
    if (data === 'o_wa_pair') return ow.ownerWaPair(ctx, bot);
    if (data === 'o_wa_pair_code') return ow.ownerWaPairCode(ctx, bot);
    if (data === 'o_wa_pair_qr') return ow.ownerWaPairQR(ctx, bot);

    /* ── Promotion Manager ── */
    if (data === 'o_promo') return ow.promoPanel(ctx);
    if (data === 'promo_add') return ow.promoAddPrompt(ctx);
    if (data.startsWith('promo_toggle:')) return ow.promoToggle(ctx, data.slice(13));
    if (data.startsWith('promo_del:')) return ow.promoDel(ctx, data.slice(10));
    if (data.startsWith('promo_edit:')) return ow.promoEditPrompt(ctx, data.slice(11));

    /* ── JID lookup ── */
    if (data === 'o_jid') {
      const { isOwnerConnected, getOwnerSock } = require('../services/ownerWhatsapp');
      if (!isOwnerConnected()) {
        return ctx.editMessageText(
          '*❌ Owner WA not connected.*\n\nPair it first via Owner Panel → Pair Owner WA.\n\nOr use: /jid <invite_link>',
          { parse_mode: 'Markdown', reply_markup: K.back('owner') }
        ).catch(() => {});
      }
      const sock = getOwnerSock();
      const wait = await ctx.editMessageText('⏳ Fetching all groups & channels...').catch(() => ctx.reply('⏳ Fetching...'));
      try {
        const chats = await sock.groupFetchAllParticipating();
        const entries = Object.values(chats);
        const groups   = entries.filter(x => x.id.endsWith('@g.us'));
        const channels = entries.filter(x => x.id.endsWith('@newsletter'));
        let text = '*📋 WA JID List*\n\n';
        if (groups.length) {
          text += '*👥 Groups (' + groups.length + '):*\n';
          for (const g of groups) text += '• *' + (g.subject || 'Unnamed') + '*\n  `' + g.id + '`\n';
          text += '\n';
        }
        if (channels.length) {
          text += '*📢 Channels (' + channels.length + '):*\n';
          for (const ch of channels) text += '• *' + (ch.subject || 'Unnamed') + '*\n  `' + ch.id + '`\n';
        }
        if (!entries.length) text += '_No groups or channels found._';
        text += '\n\n_Copy a JID and add it via Channel Management_';
        const out = text.slice(0, 4000);
        if (wait && wait.message_id) {
          await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null, out, { parse_mode: 'Markdown', reply_markup: K.back('owner') }).catch(() => ctx.reply(out, { parse_mode: 'Markdown' }));
        }
      } catch (e) { await ctx.reply('❌ Error: ' + e.message); }
      return;
    }


    /* ── Drop Now (Owner) ── */
    if (data === 'o_drop_now') {
      const { allChatIds } = require('../services/wallpaper');
      const chatCount = allChatIds.size;
      return ctx.editMessageText(
        `*🚀 Manual Wallpaper Drop*\n\n` +
        `This will immediately drop wallpapers from all *40 categories* (10 imgs each) to all *${chatCount} chat${chatCount !== 1 ? 's' : ''}* the bot is in.\n\n` +
        `⚠️ Drops are staggered 20 mins apart — all 40 categories will fire over ~13 hours.\n\n` +
        `Confirm?`,
        { parse_mode: 'Markdown', reply_markup: K.dropNowConfirm() }
      ).catch(() => ctx.reply('Confirm drop?', { reply_markup: K.dropNowConfirm() }));
    }

    if (data === 'o_drop_now_confirm') {
      const { CATEGORIES, runCategoryDrop } = require('../services/wallpaper');
      const STAGGER_MS = 20 * 60 * 1000;
      const chatCount = require('../services/wallpaper').allChatIds.size;
      await ctx.editMessageText(
        `✅ *Drop started!*\n\n` +
        `Dropping all 40 categories to ${chatCount} chat${chatCount !== 1 ? 's' : ''}.\n` +
        `Categories fire every 20 minutes — done in ~13 hours.\n\n` +
        `You'll see logs in the console.`,
        { parse_mode: 'Markdown', reply_markup: K.back('owner') }
      ).catch(() => {});
      // Fire all drops with stagger, non-blocking
      CATEGORIES.forEach((cat, idx) => {
        setTimeout(() => {
          runCategoryDrop(bot, cat).catch(e => logger.error(`ManualDrop(${cat}): ${e.message}`));
        }, idx * STAGGER_MS);
      });
      return;
    }

  } catch (err) {
    logger.error('cb router: ' + err.message);
    await ctx.reply('Something went wrong. Please try again.').catch(() => {});
  }
}

module.exports = { route };
