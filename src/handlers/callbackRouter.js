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
const sm = require('../config/settingsManager');
const ui = require('../utils/ui');
const eh = require('../utils/errorHandler');
const logger = require('../utils/logger');
const ows = require('./ownerSettingsHandler');

async function route(ctx, bot) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;
  await ctx.answerCbQuery().catch(() => {});

  const uid = ctx.from?.id;
  const owner = isOwner(uid);

  try {
    const maint = await sm.get('maintenance.enabled');
    if (maint && !owner) {
      const msg = await sm.get('maintenance.message');
      return ctx.editMessageText(
        ui.warn('Maintenance Mode', msg || 'Back soon!'),
        { parse_mode: 'HTML' }
      ).catch(() => ctx.reply(ui.warn('Maintenance Mode', msg || 'Back soon!'), { parse_mode: 'HTML' }));
    }

    if (data !== 'check_join' && data !== 'main_menu') {
      if (!await checkForceJoin(ctx, bot)) return;
    }

    if (data === 'main_menu') {
      const text = [
        ui.screenHeader(config.bot.name, 'Main Menu'),
        '',
        '<blockquote>Choose an option below:</blockquote>'
      ].join('\n');
      return ctx.editMessageText(text, {
        parse_mode: 'HTML', reply_markup: K.mainMenu(owner),
      }).catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: K.mainMenu(owner) }));
    }

    if (data === 'check_join') {
      if (await checkForceJoin(ctx, bot)) {
        const text = [
          ui.success('Access Granted', 'Welcome to the bot!'),
          '',
          '<blockquote>Choose an option below:</blockquote>'
        ].join('\n');
        return ctx.editMessageText(text, {
          parse_mode: 'HTML', reply_markup: K.mainMenu(owner),
        }).catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: K.mainMenu(owner) }));
      }
      return;
    }

    if (data === 'pinterest') return pi.start(ctx);
    if (data.startsWith('pi_more:')) {
      const [, page, ...rest] = data.split(':');
      return pi.more(ctx, parseInt(page), rest.join(':'));
    }

    if (data === 'pair_wa') return pa.start(ctx);
    if (data.startsWith('pair_delete:')) return pa.deleteAndRepair(ctx, data.slice(12));
    if (data.startsWith('pair_code:')) return pa.doPairCode(ctx, data.slice(10), bot);
    if (data.startsWith('pair_qr:')) return pa.doPairQR(ctx, data.slice(8), bot);

    if (data === 'paired') return ac.pairedList(ctx);
    if (data.startsWith('account:')) return ac.accountMenu(ctx, data.slice(8));

    if (data.startsWith('set_pfp:')) return ac.setPfpPrompt(ctx, data.slice(8));
    if (data.startsWith('get_pfp:')) return ac.getPfp(ctx, data.slice(8));
    if (data.startsWith('del_pfp:')) return ac.delPfpConfirm(ctx, data.slice(8));
    if (data.startsWith('confirm_del_pfp:')) return ac.delPfpDo(ctx, data.slice(16));

    if (data.startsWith('setname:')) return ac.setNamePrompt(ctx, data.slice(8));

    if (data.startsWith('auto_pfp:')) return ac.autoMenu(ctx, data.slice(9));
    if (data.startsWith('auto_hour:')) return ac.autoHourPrompt(ctx, data.slice(10));
    if (data.startsWith('auto_day:')) return ac.autoDayPrompt(ctx, data.slice(9));
    if (data.startsWith('stop_auto:')) return ac.stopAuto(ctx, data.slice(10));

    if (data.startsWith('purge:')) return ac.purgeConfirm(ctx, data.slice(6));
    if (data.startsWith('confirm_purge:')) return ac.purgeDo(ctx, data.slice(14));

    if (data.startsWith('perm:')) return ac.makePermanent(ctx, data.slice(5));

    if (data === 'group_pfp') return gp.start(ctx);
    if (data === 'gpfp_immediate') return gp.immediateStart(ctx);
    if (data === 'gpfp_scheduled') return gp.scheduledStart(ctx);
    if (data === 'gpfp_tasks') return gp.listTasks(ctx);
    if (data.startsWith('gpfp_cancel:')) return gp.cancelTask(ctx, data.slice(12));
    if (data.startsWith('gpfp_continue:')) return gp.continueAdminCheck(ctx, data.slice(14), bot);

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

    if (data === 'wallpapers') return wp.start(ctx);
    if (data.startsWith('wp_more:')) {
      const parts = data.slice(8).split(':');
      return wp.loadMore(ctx, parts[0], parseInt(parts[1]));
    }
    if (data.startsWith('wp_')) {
      const category = data.slice(3);
      return wp.browseCategory(ctx, category);
    }

    if (data === 'imagegen') return ig.promptUser(ctx);

    if (data === 'support') return su.start(ctx);
    if (data.startsWith('reply_ticket:') && owner) return su.ownerReplyPrompt(ctx, data.slice(13));
    if (data.startsWith('close_ticket:') && owner) return su.closeDo(ctx, data.slice(13));

    if (!owner && data.startsWith('o_'))
      return ctx.answerCbQuery('Owner only.', { show_alert: true }).catch(() => {});

    if (data === 'owner') return ow.panel(ctx);
    if (data === 'o_settings') {
      const text = [
        ui.screenHeader('Owner Panel', 'Settings & Advanced'),
        '',
        '<blockquote>System and WhatsApp connection settings.</blockquote>'
      ].join('\n');
      return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: K.ownerSettingsMenu() }).catch(() => {});
    }
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

    if (data === 'o_promo') return ow.promoPanel(ctx);
    if (data === 'promo_add') return ow.promoAddPrompt(ctx);
    if (data.startsWith('promo_toggle:')) return ow.promoToggle(ctx, data.slice(13));
    if (data.startsWith('promo_del:')) return ow.promoDel(ctx, data.slice(10));
    if (data.startsWith('promo_edit:')) return ow.promoEditPrompt(ctx, data.slice(11));

    if (data === 'o_jid') {
      const { isOwnerConnected, getOwnerSock } = require('../services/ownerWhatsapp');
      if (!isOwnerConnected()) {
        const text = [
          ui.error('WhatsApp Not Connected', 'Pair it first via Owner Panel → Pair Owner WA.', 'Or use: /jid <invite_link>')
        ].join('\n');
        return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: K.back('o_settings') }).catch(() => {});
      }
      const sock = getOwnerSock();
      const wait = await ctx.editMessageText(ui.loading('Fetching all groups & channels...'), { parse_mode: 'HTML' }).catch(() => ctx.reply(ui.loading('Fetching...'), { parse_mode: 'HTML' }));
      try {
        const chats = await sock.groupFetchAllParticipating();
        const entries = Object.values(chats);
        const groups   = entries.filter(x => x.id.endsWith('@g.us'));
        const channels = entries.filter(x => x.id.endsWith('@newsletter'));
        
        const lines = [ui.screenHeader('Owner Panel', 'WA JID List'), ''];
        
        if (groups.length) {
          lines.push(`*👥 Groups (${groups.length}):*`);
          for (const g of groups) lines.push(`• *${g.subject || 'Unnamed'}*\n  ${ui.codeBlock(g.id)}`);
          lines.push('');
        }
        if (channels.length) {
          lines.push(`*📢 Channels (${channels.length}):*`);
          for (const ch of channels) lines.push(`• *${ch.subject || 'Unnamed'}*\n  ${ui.codeBlock(ch.id)}`);
        }
        if (!entries.length) lines.push('<blockquote>_No groups or channels found._</blockquote>');
        lines.push('', '<blockquote>_Copy a JID and add it via Channel Management_</blockquote>');
        
        const out = lines.join('\n').slice(0, 4000);
        if (wait && wait.message_id) {
          await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null, out, { parse_mode: 'HTML', reply_markup: K.back('o_settings') }).catch(() => ctx.reply(out, { parse_mode: 'HTML' }));
        }
      } catch (e) {
        return eh.handle(ctx, e, 'jid_lookup', 'o_settings');
      }
      return;
    }

    if (data === 'o_drop_now') {
      const { allChatIds } = require('../services/wallpaper');
      const chatCount = allChatIds.size;
      const text = [
        ui.screenHeader('Owner Panel', 'Manual Drop'),
        '',
        `> This will immediately drop wallpapers from all <b>40 categories</b> to all *${chatCount} chat${chatCount !== 1 ? 's' : ''}*.`,
        '',
        '⚠️ <b>Warning</b>',
        'Drops are staggered 20 mins apart — all 40 categories will fire over ~13 hours.'
      ].join('\n');
      return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: K.dropNowConfirm() })
        .catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: K.dropNowConfirm() }));
    }

    if (data === 'o_drop_now_confirm') {
      const { CATEGORIES, runCategoryDrop } = require('../services/wallpaper');
      const STAGGER_MS = 20 * 60 * 1000;
      const chatCount = require('../services/wallpaper').allChatIds.size;
      const text = [
        ui.success('Drop Started', `Dropping all categories to ${chatCount} chat${chatCount !== 1 ? 's' : ''}.`),
        '<blockquote>Categories fire every 20 minutes — done in ~13 hours.</blockquote>'
      ].join('\n');
      
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: K.back('owner') }).catch(() => {});
      
      CATEGORIES.forEach((cat, idx) => {
        setTimeout(() => {
          runCategoryDrop(bot, cat).catch(e => logger.error(`ManualDrop(${cat}): ${e.message}`));
        }, idx * STAGGER_MS);
      });
      return;
    }

    if (data === 'o_settings')                    return ows.settingsMenu(ctx);
    if (data === 'o_settings_drops')              return ows.dropsPanel(ctx);
    if (data === 'o_settings_wm')                 return ows.watermarkPanel(ctx);
    if (data === 'o_settings_enhance')            return ows.enhancerPanel(ctx);
    if (data === 'o_settings_rate')               return ows.ratePanel(ctx);
    if (data === 'o_settings_maint')              return ows.maintPanel(ctx);
    if (data === 'o_settings_log')                return ows.logPanel(ctx);
    if (data === 'o_settings_uploads')            return ows.uploadsPanel(ctx);
    if (data === 'o_settings_cooldowns')          return ows.cooldownsPanel(ctx);
    if (data === 'o_settings_scheduler')          return ows.schedulerPanel(ctx);
    if (data === 'o_settings_wa')                 return ows.waPanel(ctx);
    if (data === 'o_settings_cats')               return ows.categoriesPanel(ctx);
    if (data === 'o_settings_drop_toggle')        return ows.dropToggle(ctx);
    if (data === 'o_settings_auto_toggle')        return ows.dropAutoToggle(ctx);
    if (data === 'o_settings_wm_toggle')          return ows.wmToggle(ctx);
    if (data.startsWith('o_settings_wm_pos:'))    return ows.wmSetPositionSelect(ctx, data.split(':')[1]);
    if (data === 'o_settings_enhance_toggle')     return ows.enhancerToggleEnabled(ctx);
    if (data === 'o_settings_upscale_toggle')     return ows.enhancerToggleUpscale(ctx);
    if (data === 'o_settings_sharpen_toggle')     return ows.enhancerToggleSharpen(ctx);
    if (data === 'o_settings_artifacts_toggle')   return ows.enhancerToggleArtifacts(ctx);
    if (data === 'o_settings_maint_toggle')       return ows.maintToggle(ctx);
    if (data === 'o_settings_debug_toggle')       return ows.logToggleDebug(ctx);
    if (data === 'o_settings_wa_toggle')          return ows.waToggle(ctx);
    if (data === 'o_settings_wa_auto_toggle')     return ows.waAutoToggle(ctx);
    if (data.startsWith('o_set_wa_tg:'))          return ows.waToggle(ctx, data.split(':')[1]);
    if (data.startsWith('o_set_wa_retries:'))     return ows.waSetRetries(ctx, data.split(':')[1]);
    if (data === 'o_set_wa_join_link')            return ows.waSetJoinLinkPrompt(ctx);
    if (data === 'o_settings_wa_forward')         return ows.waForwardPanel(ctx);
    if (data === 'o_wa_forward_add')              return ows.waForwardAddPrompt(ctx);
    if (data.startsWith('o_wa_forward_remove:'))  return ows.waForwardRemove(ctx, data.split(':')[1]);
    if (data.startsWith('o_settings_cat_toggle:')) return ows.categoryToggle(ctx, data.split(':')[1]);
    if (data === 'o_settings_wm_reset')           return ows.wmReset(ctx);

  } catch (err) {
    return eh.handle(ctx, err, 'callback_router', 'main_menu');
  }
}

module.exports = { route };
