const { isOwner } = require('../middleware/auth');
const pi = require('./pinterestHandler');
const pa = require('./pairingHandler');
const ac = require('./accountHandler');
const su = require('./supportHandler');
const gp = require('./groupPfpHandler');
const dl = require('./downloadHandler');
const ig = require('./imageGenHandler');
const ow = require('../owner/ownerHandler');
const sm = require('../config/settingsManager');
const ui = require('../utils/ui');
const eh = require('../utils/errorHandler');
const logger = require('../utils/logger');

async function route(ctx, bot) {
  const step = ctx.userState?.step;
  const owner = isOwner(ctx.from?.id);
  if (!step) return;

  try {
    const maint = await sm.get('maintenance.enabled');
    if (maint && !owner) {
      const msg = await sm.get('maintenance.message');
      return ctx.reply(ui.warn('Maintenance Mode', msg || 'Back soon!'), { parse_mode: 'Markdown' });
    }

    switch (step) {
      case 'pi_query':
        ctx.clearState();
        return pi.search(ctx, ctx.message.text?.trim() || '', 0);

      case 'pair_phone':
        return pa.handlePhone(ctx, ctx.message.text?.trim() || '', bot);

      case 'set_pfp':
        return ac.handlePfpImage(ctx, ctx.userState.num, bot);

      case 'setname_text':
        return ac.handleSetName(ctx, ctx.userState.num);

      case 'auto_hour_interval':
      case 'auto_day_interval':
        return ac.handleAutoInterval(ctx);

      case 'auto_hour_images':
      case 'auto_day_images':
        return ac.handleAutoImages(ctx, bot);

      case 'gpfp_image':
      case 'gpfp_images':
        return gp.handleImage(ctx, bot);

      case 'gpfp_days':
        return gp.handleDays(ctx);

      case 'gpfp_link':
        return gp.handleLink(ctx, bot);

      case 'dl_url':
        return dl.handleUrl(ctx, ctx.message.text?.trim() || '', bot);

      case 'imagegen_prompt':
        return ig.handlePrompt(ctx, bot);

      case 'support_msg':
        return su.handleMsg(ctx, bot);

      case 'owner_reply':
        if (owner) return su.ownerReplyDo(ctx, bot);
        break;

      case 'broadcast':
        if (owner) return ow.broadcastDo(ctx, bot);
        break;

      case 'fj_add':
        if (owner) return ow.fjAddDo(ctx);
        break;

      case 'ch_add':
        if (owner) return ow.channelAddDo(ctx);
        break;

      case 'o_wa_set_num':
        if (owner) return ow.ownerWaSetDo(ctx);
        break;

      case 'promo_add_label':
        if (owner) return ow.promoAddLabel(ctx);
        break;

      case 'promo_add_url':
        if (owner) return ow.promoAddUrl(ctx);
        break;

      case 'promo_edit_label':
        if (owner) return ow.promoEditLabel(ctx);
        break;

      case 'promo_edit_url':
        if (owner) return ow.promoEditUrl(ctx);
        break;

      default:
        if (step.startsWith('o_settings_') && owner) {
          const ows = require('./ownerSettingsHandler');
          return ows.handleInput(ctx, bot);
        }
        break;
    }
  } catch (err) {
    return eh.handle(ctx, err, 'message_router', 'main_menu');
  }
}

module.exports = { route };
