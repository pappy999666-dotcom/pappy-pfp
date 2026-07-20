const K = require('./keyboards');
const config = require('../config');
const { searchImages } = require('../services/pinterest');
const { CATEGORIES, CATEGORY_QUERIES } = require('../services/wallpaper');
const { btn, PRIMARY, SUCCESS } = require('../utils/buttonStyles');
const ui = require('../utils/ui');
const eh = require('../utils/errorHandler');
const logger = require('../utils/logger');

const CAT_EMOJIS = {
  anime: '🎌', dark_anime: '🌑', cute_anime: '🌸', manhwa: '📖', cyberpunk: '🤖', gaming: '🎮', minimal: '⬜',
  amoled: '⚫', nature: '🌿', cars: '🚗', architecture: '🏛', neon: '💡', aesthetic: '🎨', fantasy: '🏔',
  streetwear: '👕', technology: '💻', space: '🚀', rain: '🌧', luxury: '💎', japanese: '⛩', korean: '🌷',
  abstract: '🎭', night_city: '🌃', manga: '📘', novel_art: '📚', girls: '👧', boys: '👦', sports: '⚽',
  animals: '🦁', superheroes: '🦸', flowers: '🌸', quotes: '💬', fashion: '👗', food: '🍕', sci_fi: '🤖',
  horror: '💀', lofi: '☕', mountains: '⛰', ocean: '🌊', sunset: '🌅', forest: '🌲', waterfall: '💧',
  vintage: '📷', minimalist: '🔲', mythology: '⚡', dragons: '🐉', magic: '✨', warriors: '⚔', weekend_specials: '🎉'
};

async function start(ctx) {
  try {
    const text = [
      ui.screenHeader(config.bot.name, 'Wallpaper Gallery'),
      '',
      '<blockquote>📱 Browse portrait/phone HD wallpapers by category:</blockquote>'
    ].join('\n');
    
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: K.wallpaperCategories() })
      .catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: K.wallpaperCategories() }));
  } catch (err) {
    return eh.handle(ctx, err, 'wallpaper_start', 'main_menu');
  }
}

async function browseCategory(ctx, category) {
  let msg;
  try {
    const displayName = category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const emoji = CAT_EMOJIS[category] || '🖼️';
    
    msg = await ctx.reply(ui.loading(`Loading ${displayName} wallpapers...`), { parse_mode: 'HTML' });

    const query = CATEGORY_QUERIES[category] || `${category.replace(/_/g, ' ')} vertical phone wallpaper 4k`;
    const images = await searchImages(query, 0, 10);

    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});

    if (!images.length) {
      return ctx.reply(ui.info('No Wallpapers Found', `No images found for ${displayName}. Try again later.`), {
        parse_mode: 'HTML', reply_markup: K.back('wallpapers'),
      });
    }

    const caption = ui.wallpaperCaption({
      category,
      displayName,
      count: images.length,
      page: 1,
      emoji,
      hashtags: [category.replace(/_/g, ''), 'wallpapers', 'hdwallpaper', 'phonewallpaper'],
      botName: config.bot.name
    });

    const media = images.slice(0, 10).map((img, i) => ({
      type: 'photo',
      media: img.url,
      ...(i === 0 ? { caption, parse_mode: 'HTML' } : {}),
    }));

    try {
      await ctx.replyWithMediaGroup(media);
    } catch {
      for (const img of images.slice(0, 5)) {
        await ctx.replyWithPhoto(img.url, { caption: img.title }).catch(() => {});
      }
    }

    const bottomText = `> Showing ${Math.min(images.length, 10)} ${displayName} wallpapers`;
    await ctx.reply(bottomText, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [
        [btn('➕ Load More',          `wp_more:${category}:1`, SUCCESS)],
        [btn('‹ Back to Categories',  'wallpapers',            PRIMARY)],
        [btn('🏠 Main Menu',          'main_menu',             PRIMARY)],
      ]},
    });
  } catch (err) {
    if (msg) await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
    return eh.handle(ctx, err, 'wallpaper_browse', 'wallpapers');
  }
}

async function loadMore(ctx, category, page) {
  try {
    await ctx.answerCbQuery('Loading...').catch(() => {});
    const displayName = category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const emoji = CAT_EMOJIS[category] || '🖼️';

    const query = CATEGORY_QUERIES[category] || `${category.replace(/_/g, ' ')} vertical phone wallpaper 4k`;
    const images = await searchImages(query, page, 10);

    if (!images.length) {
      return ctx.reply(ui.info('End of Gallery', `No more ${displayName} wallpapers found.`), {
        parse_mode: 'HTML', reply_markup: K.back('wallpapers'),
      });
    }

    const caption = ui.wallpaperCaption({
      category,
      displayName,
      count: images.length,
      page: page + 1,
      emoji,
      hashtags: [category.replace(/_/g, ''), 'wallpapers', 'hdwallpaper', 'phonewallpaper'],
      botName: config.bot.name
    });

    const media = images.slice(0, 10).map((img, i) => ({
      type: 'photo',
      media: img.url,
      ...(i === 0 ? { caption, parse_mode: 'HTML' } : {}),
    }));

    try {
      await ctx.replyWithMediaGroup(media);
    } catch {
      for (const img of images.slice(0, 5)) {
        await ctx.replyWithPhoto(img.url, { caption: img.title }).catch(() => {});
      }
    }

    const bottomText = `> Page ${page + 1} - ${Math.min(images.length, 10)} wallpapers`;
    await ctx.reply(bottomText, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [
        [btn('➕ Load More',         `wp_more:${category}:${page + 1}`, SUCCESS)],
        [btn('‹ Back to Categories', 'wallpapers',                       PRIMARY)],
        [btn('🏠 Main Menu',         'main_menu',                        PRIMARY)],
      ]},
    });
  } catch (err) {
    return eh.handle(ctx, err, 'wallpaper_more', 'wallpapers');
  }
}

module.exports = { start, browseCategory, loadMore };
