const axios = require('axios');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const logger = require('../utils/logger');
const { Wallpaper, Channel, PromotionLink } = require('../database/models');
const { getWallpaperCategoryDir, downloadFile } = require('../utils/storage');
const { sleep } = require('../utils/helpers');

const CATEGORIES = [
  'anime', 'manga', 'novel_art', 'girls', 'boys',
  'cars', 'nature', 'gaming', 'aesthetic', 'dark',
  'space', 'city', 'abstract', 'sports', 'animals',
  'superheroes', 'flowers', 'quotes', 'fashion', 'food',
  'fantasy', 'sci_fi', 'horror', 'cyberpunk', 'lofi',
  'mountains', 'ocean', 'sunset', 'forest', 'waterfall',
  'architecture', 'vintage', 'minimalist', 'neon',
  'mythology', 'dragons', 'magic', 'warriors',
  'weekend_specials', 'monthly_collections',
];

const CATEGORY_QUERIES = {
  anime:               'anime vertical phone wallpaper 4k portrait ultra hd',
  manga:               'manga art vertical phone wallpaper 4k portrait ultra hd',
  novel_art:           'light novel illustration vertical phone wallpaper 4k ultra hd',
  girls:               'beautiful girl portrait phone wallpaper 4k vertical ultra hd',
  boys:                'handsome man portrait phone wallpaper 4k vertical ultra hd',
  cars:                'sports car vertical phone wallpaper 4k ultra hd',
  nature:              'nature scenery vertical phone wallpaper 4k portrait ultra hd',
  gaming:              'gaming setup vertical phone wallpaper 4k dark ultra hd',
  aesthetic:           'aesthetic pastel vertical phone wallpaper 4k ultra hd',
  dark:                'dark aesthetic moody vertical phone wallpaper 4k ultra hd',
  space:               'galaxy space universe vertical phone wallpaper 4k ultra hd',
  city:                'cityscape night lights vertical phone wallpaper 4k ultra hd',
  abstract:            'abstract art colorful vertical phone wallpaper 4k ultra hd',
  sports:              'sports athlete action vertical phone wallpaper 4k ultra hd',
  animals:             'wildlife animals cute vertical phone wallpaper 4k ultra hd',
  superheroes:         'superhero marvel dc vertical phone wallpaper 4k ultra hd',
  flowers:             'flowers bloom garden vertical phone wallpaper 4k ultra hd',
  quotes:              'motivational quotes text aesthetic vertical phone wallpaper 4k',
  fashion:             'fashion style outfit portrait vertical phone wallpaper 4k ultra hd',
  food:                'food aesthetic delicious vertical phone wallpaper 4k ultra hd',
  fantasy:             'fantasy landscape magical vertical phone wallpaper 4k ultra hd',
  sci_fi:              'science fiction futuristic tech vertical phone wallpaper 4k ultra hd',
  horror:              'dark horror eerie creepy vertical phone wallpaper 4k ultra hd',
  cyberpunk:           'cyberpunk neon city rain vertical phone wallpaper 4k ultra hd',
  lofi:                'lofi cozy aesthetic chill vertical phone wallpaper 4k ultra hd',
  mountains:           'mountain peak snow landscape vertical phone wallpaper 4k ultra hd',
  ocean:               'ocean sea waves beach vertical phone wallpaper 4k ultra hd',
  sunset:              'sunset golden hour sky vertical phone wallpaper 4k ultra hd',
  forest:              'forest trees misty green vertical phone wallpaper 4k ultra hd',
  waterfall:           'waterfall nature water vertical phone wallpaper 4k ultra hd',
  architecture:        'architecture building design vertical phone wallpaper 4k ultra hd',
  vintage:             'vintage retro old school vertical phone wallpaper 4k ultra hd',
  minimalist:          'minimalist clean simple vertical phone wallpaper 4k ultra hd',
  neon:                'neon lights glow colorful vertical phone wallpaper 4k ultra hd',
  mythology:           'mythology gods legends vertical phone wallpaper 4k ultra hd',
  dragons:             'dragon fire fantasy vertical phone wallpaper 4k ultra hd',
  magic:               'magic spell wizard vertical phone wallpaper 4k ultra hd',
  warriors:            'warrior samurai knight armor vertical phone wallpaper 4k ultra hd',
  weekend_specials:    'weekend vibes chill aesthetic vertical phone wallpaper 4k',
  monthly_collections: 'monthly collection best aesthetic vertical phone wallpaper 4k ultra hd',
};

// Auto-generated hashtags per category
const CATEGORY_HASHTAGS = {
  anime:               '#Anime #AnimeWallpaper #OtakuArt #AnimeAesthetic #DailyDrop',
  manga:               '#Manga #MangaArt #OtakuVibes #MangaWallpaper #DailyDrop',
  novel_art:           '#NovelArt #LightNovel #IllustrationArt #AnimeArt #DailyDrop',
  girls:               '#GirlsWallpaper #PortraitArt #AestheticGirls #HDWallpaper #DailyDrop',
  boys:                '#BoysWallpaper #MenStyle #PortraitWallpaper #HDWallpaper #DailyDrop',
  cars:                '#CarWallpaper #SportsCar #CarLovers #AutoAesthetic #DailyDrop',
  nature:              '#NatureWallpaper #NaturePhotography #Scenery #HDNature #DailyDrop',
  gaming:              '#GamingWallpaper #GamerSetup #GamingAesthetic #PCGaming #DailyDrop',
  aesthetic:           '#Aesthetic #AestheticWallpaper #PastelVibes #AestheticArt #DailyDrop',
  dark:                '#DarkAesthetic #DarkWallpaper #MoodyVibes #DarkArt #DailyDrop',
  space:               '#SpaceWallpaper #Galaxy #Universe #CosmicArt #DailyDrop',
  city:                '#CityWallpaper #Cityscape #NightCity #UrbanAesthetic #DailyDrop',
  abstract:            '#AbstractArt #AbstractWallpaper #ColorfulArt #DigitalArt #DailyDrop',
  sports:              '#SportsWallpaper #AthleteArt #SportsAesthetic #FitnessVibes #DailyDrop',
  animals:             '#AnimalWallpaper #Wildlife #CuteAnimals #NatureLovers #DailyDrop',
  superheroes:         '#SuperheroWallpaper #Marvel #DC #ComicArt #DailyDrop',
  flowers:             '#FlowerWallpaper #FloralArt #BloomVibes #NatureBeauty #DailyDrop',
  quotes:              '#QuoteWallpaper #MotivationalQuotes #InspirationalArt #DailyVibes #DailyDrop',
  fashion:             '#FashionWallpaper #StyleAesthetic #FashionArt #OOTDVibes #DailyDrop',
  food:                '#FoodWallpaper #FoodAesthetic #FoodPhotography #Delicious #DailyDrop',
  fantasy:             '#FantasyWallpaper #FantasyArt #MagicalWorld #EpicArt #DailyDrop',
  sci_fi:              '#SciFiWallpaper #FuturisticArt #TechAesthetic #SciFiArt #DailyDrop',
  horror:              '#HorrorWallpaper #DarkArt #CreepyAesthetic #HorrorArt #DailyDrop',
  cyberpunk:           '#Cyberpunk #CyberpunkArt #NeonCity #FuturisticVibes #DailyDrop',
  lofi:                '#LoFiWallpaper #ChillVibes #CozyAesthetic #LoFiArt #DailyDrop',
  mountains:           '#MountainWallpaper #MountainViews #NatureAesthetic #HikingVibes #DailyDrop',
  ocean:               '#OceanWallpaper #BeachVibes #SeaAesthetic #OceanArt #DailyDrop',
  sunset:              '#SunsetWallpaper #GoldenHour #SunsetVibes #SkyAesthetic #DailyDrop',
  forest:              '#ForestWallpaper #ForestVibes #NatureAesthetic #GreenArt #DailyDrop',
  waterfall:           '#WaterfallWallpaper #NatureBeauty #WaterAesthetic #ScenicViews #DailyDrop',
  architecture:        '#ArchitectureWallpaper #BuildingArt #DesignAesthetic #UrbanArt #DailyDrop',
  vintage:             '#VintageWallpaper #RetroAesthetic #OldSchoolVibes #VintageArt #DailyDrop',
  minimalist:          '#MinimalistWallpaper #CleanAesthetic #SimpleArt #MinimalVibes #DailyDrop',
  neon:                '#NeonWallpaper #NeonAesthetic #GlowArt #NeonVibes #DailyDrop',
  mythology:           '#MythologyArt #GodsAndLegends #MythicWallpaper #EpicArt #DailyDrop',
  dragons:             '#DragonArt #DragonWallpaper #FantasyDragon #EpicCreatures #DailyDrop',
  magic:               '#MagicArt #WizardWallpaper #SpellAesthetic #MagicalVibes #DailyDrop',
  warriors:            '#WarriorArt #SamuraiWallpaper #KnightAesthetic #EpicWarriors #DailyDrop',
  weekend_specials:    '#WeekendVibes #WeekendWallpaper #ChillAesthetic #WeekendDrop #DailyDrop',
  monthly_collections: '#MonthlyCollection #BestWallpapers #TopPicks #HDCollection #DailyDrop',
};

// Category display names and emojis
const CATEGORY_META = {
  anime:               { emoji: '⛩️',  name: 'Anime' },
  manga:               { emoji: '📖',  name: 'Manga' },
  novel_art:           { emoji: '🎨',  name: 'Novel Art' },
  girls:               { emoji: '👩',  name: 'Girls' },
  boys:                { emoji: '👨',  name: 'Boys' },
  cars:                { emoji: '🚗',  name: 'Cars' },
  nature:              { emoji: '🌿',  name: 'Nature' },
  gaming:              { emoji: '🎮',  name: 'Gaming' },
  aesthetic:           { emoji: '✨',  name: 'Aesthetic' },
  dark:                { emoji: '🌑',  name: 'Dark' },
  space:               { emoji: '🌌',  name: 'Space' },
  city:                { emoji: '🌆',  name: 'City' },
  abstract:            { emoji: '🎭',  name: 'Abstract' },
  sports:              { emoji: '⚽',  name: 'Sports' },
  animals:             { emoji: '🦁',  name: 'Animals' },
  superheroes:         { emoji: '🦸',  name: 'Superheroes' },
  flowers:             { emoji: '🌸',  name: 'Flowers' },
  quotes:              { emoji: '💬',  name: 'Quotes' },
  fashion:             { emoji: '👗',  name: 'Fashion' },
  food:                { emoji: '🍜',  name: 'Food' },
  fantasy:             { emoji: '🧙',  name: 'Fantasy' },
  sci_fi:              { emoji: '🤖',  name: 'Sci-Fi' },
  horror:              { emoji: '💀',  name: 'Horror' },
  cyberpunk:           { emoji: '🌃',  name: 'Cyberpunk' },
  lofi:                { emoji: '🎵',  name: 'Lo-Fi' },
  mountains:           { emoji: '🏔️',  name: 'Mountains' },
  ocean:               { emoji: '🌊',  name: 'Ocean' },
  sunset:              { emoji: '🌅',  name: 'Sunset' },
  forest:              { emoji: '🌲',  name: 'Forest' },
  waterfall:           { emoji: '💧',  name: 'Waterfall' },
  architecture:        { emoji: '🏛️',  name: 'Architecture' },
  vintage:             { emoji: '📷',  name: 'Vintage' },
  minimalist:          { emoji: '⬜',  name: 'Minimalist' },
  neon:                { emoji: '💡',  name: 'Neon' },
  mythology:           { emoji: '⚡',  name: 'Mythology' },
  dragons:             { emoji: '🐉',  name: 'Dragons' },
  magic:               { emoji: '🔮',  name: 'Magic' },
  warriors:            { emoji: '⚔️',  name: 'Warriors' },
  weekend_specials:    { emoji: '🎉',  name: 'Weekend Specials' },
  monthly_collections: { emoji: '🏆',  name: 'Monthly Collection' },
};

// Track chats
const allChatIds   = new Set();
const adminChatIds = new Set();

function addAdminChannel(chatId) { if (chatId) { adminChatIds.add(String(chatId)); allChatIds.add(String(chatId)); } }
function removeAdminChannel(chatId) { if (chatId) adminChatIds.delete(String(chatId)); }
function addChat(chatId) { if (chatId) allChatIds.add(String(chatId)); }
function removeChat(chatId) { if (chatId) { allChatIds.delete(String(chatId)); adminChatIds.delete(String(chatId)); } }

// Build premium Daily Drop caption
function buildDropCaption(category, count) {
  const meta = CATEGORY_META[category] || { emoji: '🖼️', name: category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) };
  const hashtags = CATEGORY_HASHTAGS[category] || '#Wallpaper #HDWallpaper #DailyDrop';
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    `✨ *DAILY DROP IS HERE!* ✨\n` +
    `${'─'.repeat(28)}\n\n` +
    `${meta.emoji} *Category:* ${meta.name}\n` +
    `🖼 *${count} HD Wallpapers* — Fresh today\n` +
    `📅 ${dateStr}\n\n` +
    `${'─'.repeat(28)}\n` +
    `🔥 *Save your favourites & set as wallpaper!*\n\n` +
    `📲 *Follow our channel for daily drops*\n` +
    `🔁 *Share with friends who love wallpapers*\n\n` +
    `${hashtags}\n` +
    `${'─'.repeat(28)}\n` +
    `_Powered by ${config.bot.name}_`
  );
}

// Build promotion buttons from DB
async function getPromoButtons() {
  const links = await PromotionLink.find({ isEnabled: true }).sort({ order: 1 });
  if (!links.length) return [];
  // 2 buttons per row
  const rows = [];
  for (let i = 0; i < links.length; i += 2) {
    const row = [{ text: links[i].label, url: links[i].url }];
    if (links[i + 1]) row.push({ text: links[i + 1].label, url: links[i + 1].url });
    rows.push(row);
  }
  return rows;
}

async function fetchWallpapers(category, count = 10) {
  const query = CATEGORY_QUERIES[category] || `${category.replace(/_/g, ' ')} vertical phone wallpaper 4k ultra hd`;
  const images = [];

  if (config.apis.pexelsKey) {
    try {
      const r = await axios.get('https://api.pexels.com/v1/search', {
        params: { query, per_page: count, page: Math.floor(Math.random() * 8) + 1, orientation: 'portrait', size: 'large' },
        headers: { Authorization: config.apis.pexelsKey },
        timeout: 12000,
      });
      for (const photo of (r.data?.photos || [])) {
        const url = photo.src?.original || photo.src?.large2x || photo.src?.portrait;
        images.push({ url, width: photo.width, height: photo.height, source: 'pexels' });
      }
    } catch (e) { logger.warn(`Pexels (${category}): ${e.message}`); }
  }

  if (images.length < count && config.apis.unsplashKey) {
    try {
      const r = await axios.get('https://api.unsplash.com/search/photos', {
        params: { query, per_page: Math.min(count - images.length, 30), page: Math.floor(Math.random() * 8) + 1, orientation: 'portrait' },
        headers: { Authorization: `Client-ID ${config.apis.unsplashKey}` },
        timeout: 12000,
      });
      for (const photo of (r.data?.results || [])) {
        const url = photo.urls?.raw || photo.urls?.full || photo.urls?.regular;
        images.push({ url, width: photo.width, height: photo.height, source: 'unsplash' });
      }
    } catch (e) { logger.warn(`Unsplash (${category}): ${e.message}`); }
  }

  if (images.length < count) {
    try {
      const { searchImages } = require('./pinterest');
      const page = Math.floor(Math.random() * 5);
      const free = await searchImages(query, page, count - images.length + 8);
      const portrait = free.filter(img => !img.w || !img.h || img.h >= img.w * 0.85);
      for (const img of portrait.slice(0, count - images.length)) {
        images.push({ url: img.url, width: img.w, height: img.h, source: 'free' });
      }
    } catch (e) { logger.warn(`Free (${category}): ${e.message}`); }
  }

  return images.filter(img => img.url).slice(0, count);
}

async function downloadAndStoreWallpapers(category, count = 10) {
  const images = await fetchWallpapers(category, count);
  const dir = getWallpaperCategoryDir(category);
  const stored = [];

  // Download in parallel batches of 4 for speed
  const chunks = [];
  for (let i = 0; i < images.length; i += 4) chunks.push(images.slice(i, i + 4));

  for (const chunk of chunks) {
    await Promise.allSettled(chunk.map(async img => {
      try {
        const existing = await Wallpaper.findOne({ url: img.url });
        if (existing) { stored.push(existing); return; }

        const filename = `wp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
        const localPath = path.join(dir, filename);
        try {
          await downloadFile(img.url, localPath);
        } catch {
          stored.push(await Wallpaper.create({ category, url: img.url, source: img.source, width: img.width, height: img.height }));
          return;
        }
        stored.push(await Wallpaper.create({ category, url: img.url, localPath, source: img.source, width: img.width, height: img.height }));
      } catch (e) { logger.warn(`Download wp: ${e.message}`); }
    }));
    await sleep(100);
  }
  return stored;
}

async function getOrFetchWallpapers(category, count = 10) {
  let wallpapers = await Wallpaper.find({ category, postedToTg: false }).sort({ addedAt: 1 }).limit(count);
  if (wallpapers.length < count) {
    const newWps = await downloadAndStoreWallpapers(category, count - wallpapers.length + 4);
    const ids = new Set(wallpapers.map(w => String(w._id)));
    const fresh = newWps.filter(w => !ids.has(String(w._id)) && !w.postedToTg);
    wallpapers = [...wallpapers, ...fresh].slice(0, count);
  }
  return wallpapers;
}

async function postWallpapersToAllTgChannels(bot, category) {
  const dbChannels = await Channel.find({ isActive: true, platform: 'telegram' });
  const chatSet = new Set();
  for (const ch of dbChannels) chatSet.add(ch.chatId || ch.link);
  if (config.channels.telegram) chatSet.add(config.channels.telegram);
  for (const id of allChatIds) chatSet.add(id);

  if (!chatSet.size) {
    logger.info(`Drop ${category}: no chats yet`);
    return [];
  }

  const wallpapers = await getOrFetchWallpapers(category, 10);
  if (!wallpapers.length) { logger.warn(`Drop ${category}: no wallpapers`); return []; }

  const caption = buildDropCaption(category, wallpapers.length);
  const promoRows = await getPromoButtons();

  // Build DM button row
  const dmRow = config.bot.username
    ? [{ text: `💬 Get More in DM`, url: `https://t.me/${config.bot.username}` }]
    : null;

  const keyboard = [...promoRows, ...(dmRow ? [dmRow] : [])];
  const posted = [];

  for (const chatId of chatSet) {
    const batch = wallpapers.slice(0, 10);

    try {
      // Send as album (all at once, no one-by-one)
      const mediaGroup = batch.map((wp, i) => ({
        type: 'photo',
        media: (wp.localPath && fs.existsSync(wp.localPath))
          ? { source: fs.createReadStream(wp.localPath) }
          : wp.url,
        // Only first photo gets caption in album
        ...(i === 0 ? { caption, parse_mode: 'Markdown' } : {}),
      }));

      await bot.telegram.sendMediaGroup(chatId, mediaGroup);
      batch.forEach(wp => posted.push({ chatId, wp }));

      // Send promo/CTA message after album if there are buttons
      if (keyboard.length) {
        await sleep(800);
        await bot.telegram.sendMessage(chatId,
          `📲 *Follow for daily wallpaper drops!*\n🔁 Share with friends who love wallpapers`,
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard },
          }
        ).catch(() => {});
      }

    } catch (albumErr) {
      // Fallback: send photos in parallel batches of 3
      const subChunks = [];
      for (let i = 0; i < batch.length; i += 3) subChunks.push(batch.slice(i, i + 3));

      let sentCount = 0;
      for (const sub of subChunks) {
        await Promise.allSettled(sub.map(async (wp, idx) => {
          try {
            const source = (wp.localPath && fs.existsSync(wp.localPath))
              ? { source: fs.createReadStream(wp.localPath) }
              : wp.url;
            const isFirst = sentCount === 0 && idx === 0;
            await bot.telegram.sendPhoto(chatId, source, {
              caption: isFirst ? caption : undefined,
              parse_mode: isFirst ? 'Markdown' : undefined,
            });
            sentCount++;
            posted.push({ chatId, wp });
          } catch (e2) {
            if (e2.message?.includes('kicked') || e2.message?.includes('not found') || e2.message?.includes('deactivated')) {
              removeChat(chatId);
            }
          }
        }));
        await sleep(500);
      }

      if (sentCount > 0 && keyboard.length) {
        await bot.telegram.sendMessage(chatId,
          `📲 *Follow for daily wallpaper drops!*\n🔁 Share with friends who love wallpapers`,
          { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } }
        ).catch(() => {});
      }
    }

    logger.info(`Posted ${batch.length} ${category} wallpapers → ${chatId}`);
    await sleep(400);
  }

  const postedIds = new Set(posted.map(p => String(p.wp._id)));
  for (const wp of wallpapers) {
    if (postedIds.has(String(wp._id))) { wp.postedToTg = true; await wp.save().catch(() => {}); }
  }
  return posted;
}

async function postWallpapersToWA(category) {
  const { getOwnerSock, isOwnerConnected } = require('./ownerWhatsapp');
  if (!isOwnerConnected()) return [];

  const waChannels = await Channel.find({ isActive: true, platform: 'whatsapp' });
  if (!waChannels.length) return [];

  const wallpapers = await Wallpaper.find({ category, postedToWa: false }).sort({ addedAt: 1 }).limit(10);
  if (!wallpapers.length) return [];

  const sock = getOwnerSock();
  const meta = CATEGORY_META[category] || { emoji: '🖼️', name: category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) };
  const hashtags = CATEGORY_HASHTAGS[category] || '#Wallpaper #DailyDrop';
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const waCaption =
    `✨ *DAILY DROP IS HERE!* ✨\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${meta.emoji} *Category:* ${meta.name}\n` +
    `🖼 *${wallpapers.length} HD Wallpapers* — Fresh today\n` +
    `📅 ${dateStr}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔥 Save your favourites!\n` +
    `📲 Follow for daily drops\n` +
    `🔁 Share with friends\n\n` +
    `${hashtags}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `_Powered by ${config.bot.name}_`;

  const posted = [];

  for (const channel of waChannels) {
    const jid = channel.chatId || channel.link;

    // Send all images in parallel batches of 3 for speed
    const chunks = [];
    for (let i = 0; i < wallpapers.length; i += 3) chunks.push(wallpapers.slice(i, i + 3));

    let sentCount = 0;
    for (const chunk of chunks) {
      await Promise.allSettled(chunk.map(async (wp, idx) => {
        try {
          let imageData;
          if (wp.localPath && fs.existsSync(wp.localPath)) {
            imageData = fs.readFileSync(wp.localPath);
          } else {
            const r = await axios.get(wp.url, { responseType: 'arraybuffer', timeout: 15000 });
            imageData = Buffer.from(r.data);
          }
          const isFirst = sentCount === 0 && idx === 0;
          await sock.sendMessage(jid, {
            image: imageData,
            caption: isFirst ? waCaption : undefined,
          });
          sentCount++;
          posted.push(wp);
        } catch (e) { logger.warn(`WA ${jid} (${category}): ${e.message}`); }
      }));
      await sleep(1500);
    }
  }

  for (const wp of posted) { wp.postedToWa = true; await wp.save().catch(() => {}); }
  return posted;
}

async function runCategoryDrop(bot, category) {
  logger.info(`Auto-drop: ${category}`);
  try {
    await downloadAndStoreWallpapers(category, 12);
    await postWallpapersToAllTgChannels(bot, category);
    await postWallpapersToWA(category);
  } catch (e) { logger.error(`Drop (${category}): ${e.message}`); }
}

module.exports = {
  CATEGORIES, CATEGORY_QUERIES, CATEGORY_META, CATEGORY_HASHTAGS,
  fetchWallpapers, downloadAndStoreWallpapers,
  getOrFetchWallpapers, postWallpapersToAllTgChannels,
  postWallpapersToWA, runCategoryDrop,
  addAdminChannel, removeAdminChannel,
  addChat, removeChat,
  allChatIds, adminChatIds,
  buildDropCaption, getPromoButtons,
};
