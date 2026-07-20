const { searchImages } = require('../services/pinterest');
const K = require('./keyboards');
const config = require('../config');
const ui = require('../utils/ui');
const eh = require('../utils/errorHandler');
const logger = require('../utils/logger');

async function start(ctx) {
  try {
    ctx.setState({ step: 'pi_query' });
    const text = [
      ui.screenHeader(config.bot.name, 'Image Search'),
      '',
      '> Send a keyword to search for HD images (up to 20 per page).',
      '',
      ui.italic('Examples: `sukuna`, `anime girl`, `nature 4k`')
    ].join('\n');
    
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: K.back('main_menu') })
      .catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: K.back('main_menu') }));
  } catch (err) {
    return eh.handle(ctx, err, 'pinterest_start', 'main_menu');
  }
}

async function search(ctx, query, page = 0) {
  let msg;
  try {
    msg = await ctx.reply(ui.loading(`Searching for *"${query}"*...`), { parse_mode: 'Markdown' });

    const imgs = await searchImages(query, page, 20);
    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});

    if (!imgs.length) {
      return ctx.reply(ui.info('No Results', `No images found for *"${query}"*.`), {
        parse_mode: 'Markdown', reply_markup: K.backMain(),
      });
    }

    const batch1 = imgs.slice(0, 10);
    const batch2 = imgs.slice(10, 20);

    const media1 = batch1.map((img, i) => ({
      type: 'photo',
      media: img.url,
      ...(i === 0 ? { caption: `*"${query}"* - Page ${page + 1}\n${imgs.length} images`, parse_mode: 'Markdown' } : {}),
    }));

    try {
      await ctx.replyWithMediaGroup(media1);
    } catch {
      for (const img of batch1.slice(0, 5)) {
        await ctx.replyWithPhoto(img.url, { caption: img.title }).catch(() => {});
      }
    }

    if (batch2.length > 0) {
      const media2 = batch2.map(img => ({ type: 'photo', media: img.url }));
      try {
        await ctx.replyWithMediaGroup(media2);
      } catch {
        for (const img of batch2.slice(0, 5)) {
          await ctx.replyWithPhoto(img.url, { caption: img.title }).catch(() => {});
        }
      }
    }

    await ctx.reply(`> Showing *${imgs.length}* images for *"${query}"*`, {
      parse_mode: 'Markdown',
      reply_markup: K.pinterestBottom(query, page),
    });
  } catch (err) {
    if (msg) await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
    return eh.handle(ctx, err, 'pinterest_search', 'main_menu');
  }
}

async function more(ctx, page, query) {
  try {
    await ctx.answerCbQuery('Loading...').catch(() => {});
    await search(ctx, query, page);
  } catch (err) {
    return eh.handle(ctx, err, 'pinterest_more', 'main_menu');
  }
}

module.exports = { start, search, more };
