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
      '<blockquote>Send a keyword to search for HD images (up to 20 per page).</blockquote>',
      '',
      ui.italic('Examples: `sukuna`, `anime girl`, `nature 4k`')
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
      return ctx.reply(ui.info('No Results', `No images found for <b>${ui.esc(query)}</b>.`), {
        parse_mode: 'HTML', reply_markup: K.backMain(),
      });
    }

    // Download images with Pinterest referer so Telegram can receive them
    const axios = require('axios');
    const PIN_HEADERS = { Referer: 'https://www.pinterest.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

    async function fetchBuffer(url) {
      const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000, headers: PIN_HEADERS });
      return Buffer.from(r.data);
    }

    const batch1 = imgs.slice(0, 10);
    const batch2 = imgs.slice(10, 20);
    let sent = 0;

    // Send first batch
    const buffers1 = await Promise.all(batch1.map(img => fetchBuffer(img.url).catch(() => null)));
    const valid1 = buffers1.map((buf, i) => ({ buf, img: batch1[i] })).filter(x => x.buf);
    if (valid1.length) {
      try {
        const media1 = valid1.map(({ buf }, i) => ({
          type: 'photo',
          media: { source: buf },
          ...(i === 0 ? { caption: `২ৎ ── ✶ <b>${ui.esc(query)}</b> ✶ ── ২ৎ\n♥ ˚₊‧ ${imgs.length} results · Page ${page + 1}`, parse_mode: 'HTML' } : {}),
        }));
        await ctx.replyWithMediaGroup(media1);
        sent += valid1.length;
      } catch (e) {
        // fallback: send one by one
        for (const { buf, img } of valid1) {
          await ctx.replyWithPhoto({ source: buf }).catch(() => {});
          sent++;
        }
      }
    }

    // Send second batch
    if (batch2.length) {
      const buffers2 = await Promise.all(batch2.map(img => fetchBuffer(img.url).catch(() => null)));
      const valid2 = buffers2.map((buf, i) => ({ buf, img: batch2[i] })).filter(x => x.buf);
      if (valid2.length) {
        try {
          await ctx.replyWithMediaGroup(valid2.map(({ buf }) => ({ type: 'photo', media: { source: buf } })));
          sent += valid2.length;
        } catch (e) {
          for (const { buf } of valid2) { await ctx.replyWithPhoto({ source: buf }).catch(() => {}); sent++; }
        }
      }
    }

    if (!sent) {
      return ctx.reply(ui.info('No Results', `Could not load images for <b>${ui.esc(query)}</b>. Try a different keyword.`), {
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
