'use strict';
const axios = require('axios');
const { searchImages } = require('../services/pinterest');
const K = require('./keyboards');
const config = require('../config');
const ui = require('../utils/ui');
const eh = require('../utils/errorHandler');
const logger = require('../utils/logger');

const PIN_HDR = {
  Referer: 'https://www.pinterest.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

async function fetchBuffer(url) {
  const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000, headers: PIN_HDR });
  return Buffer.from(r.data);
}

async function start(ctx) {
  try {
    ctx.setState({ step: 'pi_query' });
    const text = [
      ui.screenHeader(config.bot.name, 'Pinterest Search'),
      '',
      '<blockquote>Send any keyword to search Pinterest images.</blockquote>',
      '',
      ui.italic('Examples: Sukuna, Camaro, dark anime pfp, aesthetic wallpaper'),
    ].join('\n');
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: K.back('main_menu') })
      .catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: K.back('main_menu') }));
  } catch (err) {
    return eh.handle(ctx, err, 'pinterest_start', 'main_menu');
  }
}

async function search(ctx, query, page = 0) {
  let msg;
  try {
    msg = await ctx.reply(ui.loading(`Searching Pinterest for <b>${ui.esc(query)}</b>...`), { parse_mode: 'HTML' });

    const imgs = await searchImages(query, page, 20);
    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});

    if (!imgs.length) {
      return ctx.reply(ui.info('No Results', `Nothing found for <b>${ui.esc(query)}</b>. Try a different keyword.`), {
        parse_mode: 'HTML', reply_markup: K.backMain(),
      });
    }

    const caption = `୨ৎ ── ✦ <b>${ui.esc(query)}</b> ✦ ── ୨ৎ\n♡ ${imgs.length} results · Page ${page + 1}`;
    let sent = 0;
    let captionUsed = false;

    // Process in batches of 10
    for (let b = 0; b < imgs.length; b += 10) {
      const batch = imgs.slice(b, b + 10);

      // Try to download each image as buffer (needed for Pinterest CDN)
      const results = await Promise.all(
        batch.map(img => fetchBuffer(img.url).then(buf => ({ buf, url: img.url })).catch(() => ({ buf: null, url: img.url })))
      );

      const withBuf = results.filter(r => r.buf);
      const withUrl = results.filter(r => !r.buf);

      // Send buffered images
      if (withBuf.length) {
        try {
          const media = withBuf.map(({ buf }, i) => ({
            type: 'photo',
            media: { source: buf },
            ...(!captionUsed && i === 0 ? { caption, parse_mode: 'HTML' } : {}),
          }));
          if (media.length === 1) {
            await ctx.replyWithPhoto(media[0].media, { caption: !captionUsed ? caption : undefined, parse_mode: 'HTML' });
          } else {
            await ctx.replyWithMediaGroup(media);
          }
          sent += withBuf.length;
          captionUsed = true;
        } catch {
          for (const { buf } of withBuf) {
            await ctx.replyWithPhoto({ source: buf }, { caption: !captionUsed ? caption : undefined, parse_mode: 'HTML' }).catch(() => {});
            sent++;
            captionUsed = true;
          }
        }
      }

      // Send URL-only images directly (DDG results don't need referer)
      if (withUrl.length) {
        try {
          const media = withUrl.map(({ url }, i) => ({
            type: 'photo',
            media: url,
            ...(!captionUsed && i === 0 ? { caption, parse_mode: 'HTML' } : {}),
          }));
          if (media.length === 1) {
            await ctx.replyWithPhoto(media[0].media, { caption: !captionUsed ? caption : undefined, parse_mode: 'HTML' });
          } else {
            await ctx.replyWithMediaGroup(media);
          }
          sent += withUrl.length;
          captionUsed = true;
        } catch {
          for (const { url } of withUrl) {
            await ctx.replyWithPhoto(url, { caption: !captionUsed ? caption : undefined, parse_mode: 'HTML' }).catch(() => {});
            sent++;
            captionUsed = true;
          }
        }
      }
    }

    if (!sent) {
      return ctx.reply(ui.info('No Results', `Could not load images for <b>${ui.esc(query)}</b>. Try again.`), {
        parse_mode: 'HTML', reply_markup: K.backMain(),
      });
    }

    await ctx.reply(`📌 <b>${sent}</b> images for <b>${ui.esc(query)}</b>`, {
      parse_mode: 'HTML',
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
