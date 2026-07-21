const axios = require('axios');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const logger = require('../utils/logger');
const { Wallpaper, Channel, PromotionLink } = require('../database/models');
const { getWallpaperCategoryDir, downloadFile } = require('../utils/storage');
const { sleep } = require('../utils/helpers');
const { wallpaperCache } = require('../utils/cache');
const { filterUrls, verifyBuffer } = require('../utils/qualityFilter');
const { enhance } = require('../utils/imageEnhancer');
const { applyWatermark } = require('../utils/watermark');
const sm = require('../config/settingsManager');
const ui = require('../utils/ui');

const CATEGORIES = [
  'anime', 'dark_anime', 'cute_anime', 'manhwa', 'manga', 'novel_art',
  'girls', 'boys', 'fashion', 'streetwear',
  'cyberpunk', 'gaming', 'sci_fi', 'technology',
  'minimal', 'amoled', 'aesthetic', 'neon', 'abstract', 'vintage', 'minimalist',
  'nature', 'mountains', 'ocean', 'sunset', 'forest', 'waterfall', 'flowers', 'rain',
  'cars', 'architecture', 'city', 'night_city',
  'fantasy', 'space', 'luxury', 'japanese', 'korean',
  'mythology', 'dragons', 'magic', 'warriors', 'superheroes', 'horror',
  'animals', 'sports', 'lofi', 'food', 'quotes',
  'weekend_specials', 'monthly_collections',
  'pappy_digital_art', 'pappy_cute_pfp', 'pappy_aesthetic_pfp', 'pappy_anime_hd', 'pappy_girly_pfp', 'pappy_black_anime', 'pappy_manhwa_dark',
];

const CATEGORY_QUERIES = {
  anime: 'anime vertical phone wallpaper 4k portrait ultra hd',
  dark_anime: 'dark anime aesthetic moody vertical phone wallpaper 4k ultra hd',
  cute_anime: 'cute kawaii anime girl vertical phone wallpaper 4k ultra hd pastel',
  manhwa: 'manhwa webtoon stylish charismatic male character vertical phone wallpaper 4k ultra hd',
  manga: 'manga art vertical phone wallpaper 4k portrait ultra hd',
  novel_art: 'light novel illustration vertical phone wallpaper 4k ultra hd',
  girls: 'beautiful girl portrait phone wallpaper 4k vertical ultra hd',
  boys: 'handsome man portrait phone wallpaper 4k vertical ultra hd',
  fashion: 'fashion style outfit portrait vertical phone wallpaper 4k ultra hd',
  streetwear: 'streetwear fashion outfit urban vertical phone wallpaper 4k ultra hd',
  cyberpunk: 'cyberpunk neon city rain vertical phone wallpaper 4k ultra hd',
  gaming: 'gaming setup vertical phone wallpaper 4k dark ultra hd',
  sci_fi: 'science fiction futuristic tech vertical phone wallpaper 4k ultra hd',
  technology: 'technology digital futuristic vertical phone wallpaper 4k ultra hd',
  minimal: 'minimal clean aesthetic vertical phone wallpaper 4k ultra hd',
  amoled: 'pure black amoled dark vertical phone wallpaper 4k ultra hd minimal',
  aesthetic: 'aesthetic pastel vertical phone wallpaper 4k ultra hd',
  neon: 'neon lights glow colorful vertical phone wallpaper 4k ultra hd',
  abstract: 'abstract art colorful vertical phone wallpaper 4k ultra hd',
  vintage: 'vintage retro old school vertical phone wallpaper 4k ultra hd',
  minimalist: 'minimalist clean simple vertical phone wallpaper 4k ultra hd',
  nature: 'nature scenery vertical phone wallpaper 4k portrait ultra hd',
  mountains: 'mountain peak snow landscape vertical phone wallpaper 4k ultra hd',
  ocean: 'ocean sea waves beach vertical phone wallpaper 4k ultra hd',
  sunset: 'sunset golden hour sky vertical phone wallpaper 4k ultra hd',
  forest: 'forest trees misty green vertical phone wallpaper 4k ultra hd',
  waterfall: 'waterfall nature water vertical phone wallpaper 4k ultra hd',
  flowers: 'flowers bloom garden vertical phone wallpaper 4k ultra hd',
  rain: 'rain aesthetic melancholic vertical phone wallpaper 4k ultra hd',
  cars: 'sports car vertical phone wallpaper 4k ultra hd',
  architecture: 'architecture building design vertical phone wallpaper 4k ultra hd',
  city: 'cityscape night lights vertical phone wallpaper 4k ultra hd',
  night_city: 'night city lights rain neon vertical phone wallpaper 4k ultra hd',
  fantasy: 'fantasy landscape magical vertical phone wallpaper 4k ultra hd',
  space: 'galaxy space universe vertical phone wallpaper 4k ultra hd',
  luxury: 'luxury lifestyle aesthetic rich vertical phone wallpaper 4k ultra hd',
  japanese: 'japanese aesthetic zen sakura vertical phone wallpaper 4k ultra hd',
  korean: 'korean aesthetic kpop vertical phone wallpaper 4k ultra hd',
  mythology: 'mythology gods legends vertical phone wallpaper 4k ultra hd',
  dragons: 'dragon fire fantasy vertical phone wallpaper 4k ultra hd',
  magic: 'magic spell wizard vertical phone wallpaper 4k ultra hd',
  warriors: 'warrior samurai knight armor vertical phone wallpaper 4k ultra hd',
  superheroes: 'superhero marvel dc vertical phone wallpaper 4k ultra hd',
  horror: 'dark horror eerie creepy vertical phone wallpaper 4k ultra hd',
  animals: 'wildlife animals cute vertical phone wallpaper 4k ultra hd',
  sports: 'sports athlete action vertical phone wallpaper 4k ultra hd',
  lofi: 'lofi cozy aesthetic chill vertical phone wallpaper 4k ultra hd',
  food: 'food aesthetic delicious vertical phone wallpaper 4k ultra hd',
  quotes: 'motivational quotes text aesthetic vertical phone wallpaper 4k',
  weekend_specials: 'weekend vibes chill aesthetic vertical phone wallpaper 4k',
  pappy_digital_art: 'digital art anime character portrait vertical phone wallpaper 4k ultra hd pixiv',
  pappy_cute_pfp: 'cute anime pfp aesthetic portrait vertical phone wallpaper 4k ultra hd',
  pappy_aesthetic_pfp: 'aesthetic anime pfp girly cute portrait vertical phone wallpaper 4k ultra hd',
  pappy_anime_hd: 'anime wallpaper hd 1080p portrait vertical phone ultra hd 4k',
  pappy_girly_pfp: 'girly pfp aesthetic anime black cute portrait vertical phone wallpaper 4k',
  pappy_black_anime: 'black anime photo dark aesthetic portrait vertical phone wallpaper 4k ultra hd',
  pappy_manhwa_dark: 'manhwa pfp dark aesthetic portrait vertical phone wallpaper 4k ultra hd',
  monthly_collections: 'monthly collection best aesthetic vertical phone wallpaper 4k ultra hd',
};

const CATEGORY_HASHTAGS = {
  anime: ['Anime', 'AnimeWallpaper', 'OtakuArt', 'AnimeAesthetic', 'DailyDrop'],
  dark_anime: ['DarkAnime', 'AnimeAesthetic', 'MoodyAnime', 'AnimeWallpaper', 'DailyDrop'],
  cute_anime: ['CuteAnime', 'KawaiiArt', 'AnimeGirl', 'PastelAnime', 'DailyDrop'],
  manhwa: ['Manhwa', 'Webtoon', 'ManhwaArt', 'KoreanWebtoon', 'DailyDrop'],
  manga: ['Manga', 'MangaArt', 'OtakuVibes', 'MangaWallpaper', 'DailyDrop'],
  novel_art: ['NovelArt', 'LightNovel', 'IllustrationArt', 'AnimeArt', 'DailyDrop'],
  girls: ['GirlsWallpaper', 'PortraitArt', 'AestheticGirls', 'HDWallpaper', 'DailyDrop'],
  boys: ['BoysWallpaper', 'MenStyle', 'PortraitWallpaper', 'HDWallpaper', 'DailyDrop'],
  fashion: ['FashionWallpaper', 'StyleAesthetic', 'FashionArt', 'OOTDVibes', 'DailyDrop'],
  streetwear: ['Streetwear', 'UrbanFashion', 'OutfitInspo', 'StreetStyle', 'DailyDrop'],
  cyberpunk: ['Cyberpunk', 'CyberpunkArt', 'NeonCity', 'FuturisticVibes', 'DailyDrop'],
  gaming: ['GamingWallpaper', 'GamerSetup', 'GamingAesthetic', 'PCGaming', 'DailyDrop'],
  sci_fi: ['SciFiWallpaper', 'FuturisticArt', 'TechAesthetic', 'SciFiArt', 'DailyDrop'],
  technology: ['Technology', 'TechAesthetic', 'Futuristic', 'CyberVibes', 'DailyDrop'],
  minimal: ['Minimal', 'CleanAesthetic', 'MinimalDesign', 'SimpleVibes', 'DailyDrop'],
  amoled: ['AMOLED', 'DarkWallpaper', 'PureBlack', 'OLEDWallpaper', 'DailyDrop'],
  aesthetic: ['Aesthetic', 'AestheticWallpaper', 'PastelVibes', 'AestheticArt', 'DailyDrop'],
  neon: ['NeonWallpaper', 'NeonAesthetic', 'GlowArt', 'NeonVibes', 'DailyDrop'],
  abstract: ['AbstractArt', 'AbstractWallpaper', 'ColorfulArt', 'DigitalArt', 'DailyDrop'],
  vintage: ['VintageWallpaper', 'RetroAesthetic', 'OldSchoolVibes', 'VintageArt', 'DailyDrop'],
  minimalist: ['MinimalistWallpaper', 'CleanAesthetic', 'SimpleArt', 'MinimalVibes', 'DailyDrop'],
  nature: ['NatureWallpaper', 'NaturePhotography', 'Scenery', 'HDNature', 'DailyDrop'],
  mountains: ['MountainWallpaper', 'MountainViews', 'NatureAesthetic', 'HikingVibes', 'DailyDrop'],
  ocean: ['OceanWallpaper', 'BeachVibes', 'SeaAesthetic', 'OceanArt', 'DailyDrop'],
  sunset: ['SunsetWallpaper', 'GoldenHour', 'SunsetVibes', 'SkyAesthetic', 'DailyDrop'],
  forest: ['ForestWallpaper', 'ForestVibes', 'NatureAesthetic', 'GreenArt', 'DailyDrop'],
  waterfall: ['WaterfallWallpaper', 'NatureBeauty', 'WaterAesthetic', 'ScenicViews', 'DailyDrop'],
  flowers: ['FlowerWallpaper', 'FloralArt', 'BloomVibes', 'NatureBeauty', 'DailyDrop'],
  rain: ['RainAesthetic', 'MoodyVibes', 'RainDay', 'Melancholy', 'DailyDrop'],
  cars: ['CarWallpaper', 'SportsCar', 'CarLovers', 'AutoAesthetic', 'DailyDrop'],
  architecture: ['ArchitectureWallpaper', 'BuildingArt', 'DesignAesthetic', 'UrbanArt', 'DailyDrop'],
  city: ['CityWallpaper', 'Cityscape', 'NightCity', 'UrbanAesthetic', 'DailyDrop'],
  night_city: ['NightCity', 'CyberpunkVibes', 'CityLights', 'NeonCity', 'DailyDrop'],
  fantasy: ['FantasyWallpaper', 'FantasyArt', 'MagicalWorld', 'EpicArt', 'DailyDrop'],
  space: ['SpaceWallpaper', 'Galaxy', 'Universe', 'CosmicArt', 'DailyDrop'],
  luxury: ['LuxuryLifestyle', 'RichVibes', 'LuxuryAesthetic', 'PremiumWallpaper', 'DailyDrop'],
  japanese: ['JapaneseAesthetic', 'ZenVibes', 'Sakura', 'TokyoAesthetic', 'DailyDrop'],
  korean: ['KoreanAesthetic', 'KpopVibes', 'SeoulStyle', 'KoreanArt', 'DailyDrop'],
  mythology: ['MythologyArt', 'GodsAndLegends', 'MythicWallpaper', 'EpicArt', 'DailyDrop'],
  dragons: ['DragonArt', 'DragonWallpaper', 'FantasyDragon', 'EpicCreatures', 'DailyDrop'],
  magic: ['MagicArt', 'WizardWallpaper', 'SpellAesthetic', 'MagicalVibes', 'DailyDrop'],
  warriors: ['WarriorArt', 'SamuraiWallpaper', 'KnightAesthetic', 'EpicWarriors', 'DailyDrop'],
  superheroes: ['SuperheroWallpaper', 'Marvel', 'DC', 'ComicArt', 'DailyDrop'],
  horror: ['HorrorWallpaper', 'DarkArt', 'CreepyAesthetic', 'HorrorArt', 'DailyDrop'],
  animals: ['AnimalWallpaper', 'Wildlife', 'CuteAnimals', 'NatureLovers', 'DailyDrop'],
  sports: ['SportsWallpaper', 'AthleteArt', 'SportsAesthetic', 'FitnessVibes', 'DailyDrop'],
  lofi: ['LoFiWallpaper', 'ChillVibes', 'CozyAesthetic', 'LoFiArt', 'DailyDrop'],
  food: ['FoodWallpaper', 'FoodAesthetic', 'FoodPhotography', 'Delicious', 'DailyDrop'],
  quotes: ['QuoteWallpaper', 'MotivationalQuotes', 'InspirationalArt', 'DailyVibes', 'DailyDrop'],
  weekend_specials: ['WeekendVibes', 'WeekendWallpaper', 'ChillAesthetic', 'WeekendDrop', 'DailyDrop'],
  monthly_collections: ['MonthlyCollection', 'BestWallpapers', 'TopPicks', 'HDCollection', 'DailyDrop'],
  pappy_digital_art: ['DigitalArt', 'AnimeArt', 'Pixiv', 'AnimePortrait', 'DailyDrop'],
  pappy_cute_pfp: ['CutePFP', 'AnimePFP', 'CuteAnime', 'AestheticPFP', 'DailyDrop'],
  pappy_aesthetic_pfp: ['AestheticPFP', 'GirlyAnime', 'CuteAesthetic', 'AnimePFP', 'DailyDrop'],
  pappy_anime_hd: ['AnimeWallpaper', 'AnimeHD', '1080p', 'AnimeAesthetic', 'DailyDrop'],
  pappy_girly_pfp: ['GirlyPFP', 'AestheticAnime', 'BlackCute', 'AnimePFP', 'DailyDrop'],
  pappy_black_anime: ['BlackAnime', 'DarkAesthetic', 'AnimeBlack', 'DarkAnime', 'DailyDrop'],
  pappy_manhwa_dark: ['ManhwaPFP', 'DarkManhwa', 'ManhwaAesthetic', 'WebtoonDark', 'DailyDrop'],
};

const CATEGORY_META = {
  anime: { emoji: '⛩️', name: 'Anime' },
  dark_anime: { emoji: '🌑', name: 'Dark Anime' },
  cute_anime: { emoji: '🌸', name: 'Cute Anime' },
  manhwa: { emoji: '📚', name: 'Manhwa' },
  manga: { emoji: '📖', name: 'Manga' },
  novel_art: { emoji: '🎨', name: 'Novel Art' },
  girls: { emoji: '👩', name: 'Girls' },
  boys: { emoji: '👨', name: 'Boys' },
  fashion: { emoji: '👗', name: 'Fashion' },
  streetwear: { emoji: '🧥', name: 'Streetwear' },
  cyberpunk: { emoji: '🌃', name: 'Cyberpunk' },
  gaming: { emoji: '🎮', name: 'Gaming' },
  sci_fi: { emoji: '🤖', name: 'Sci-Fi' },
  technology: { emoji: '💻', name: 'Technology' },
  minimal: { emoji: '➖', name: 'Minimal' },
  amoled: { emoji: '⬛', name: 'AMOLED' },
  aesthetic: { emoji: '✨', name: 'Aesthetic' },
  neon: { emoji: '💡', name: 'Neon' },
  abstract: { emoji: '🎭', name: 'Abstract' },
  vintage: { emoji: '📷', name: 'Vintage' },
  minimalist: { emoji: '⬜', name: 'Minimalist' },
  nature: { emoji: '🌿', name: 'Nature' },
  mountains: { emoji: '🏔️', name: 'Mountains' },
  ocean: { emoji: '🌊', name: 'Ocean' },
  sunset: { emoji: '🌅', name: 'Sunset' },
  forest: { emoji: '🌲', name: 'Forest' },
  waterfall: { emoji: '💧', name: 'Waterfall' },
  flowers: { emoji: '🌸', name: 'Flowers' },
  rain: { emoji: '🌧️', name: 'Rain' },
  cars: { emoji: '🚗', name: 'Cars' },
  architecture: { emoji: '🏛️', name: 'Architecture' },
  city: { emoji: '🌆', name: 'City' },
  night_city: { emoji: '🌃', name: 'Night City' },
  fantasy: { emoji: '🧙', name: 'Fantasy' },
  space: { emoji: '🌌', name: 'Space' },
  luxury: { emoji: '💎', name: 'Luxury' },
  japanese: { emoji: '⛩️', name: 'Japanese' },
  korean: { emoji: '🫰', name: 'Korean' },
  mythology: { emoji: '⚡', name: 'Mythology' },
  dragons: { emoji: '🐉', name: 'Dragons' },
  magic: { emoji: '🔮', name: 'Magic' },
  warriors: { emoji: '⚔️', name: 'Warriors' },
  superheroes: { emoji: '🦸', name: 'Superheroes' },
  horror: { emoji: '💀', name: 'Horror' },
  animals: { emoji: '🦁', name: 'Animals' },
  sports: { emoji: '⚽', name: 'Sports' },
  lofi: { emoji: '🎵', name: 'Lo-Fi' },
  food: { emoji: '🍜', name: 'Food' },
  quotes: { emoji: '💬', name: 'Quotes' },
  weekend_specials: { emoji: '🎉', name: 'Weekend Specials' },
  monthly_collections: { emoji: '🏆', name: 'Monthly Collection' },
  pappy_digital_art: { emoji: '⸸', name: '𝑷𝑨𝑷𝑷𝒀 Digital Art' },
  pappy_cute_pfp: { emoji: '🌸', name: '𝑷𝑨𝑷𝑷𝒀 Cute PFP' },
  pappy_aesthetic_pfp: { emoji: '✨', name: '𝑷𝑨𝑷𝑷𝒀 Aesthetic PFP' },
  pappy_anime_hd: { emoji: '🎌', name: '𝑷𝑨𝑷𝑷𝒀 Anime HD' },
  pappy_girly_pfp: { emoji: '🖤', name: '𝑷𝑨𝑷𝑷𝒀 Girly PFP' },
  pappy_black_anime: { emoji: '🌑', name: '𝑷𝑨𝑷𝑷𝒀 Black Anime' },
  pappy_manhwa_dark: { emoji: '👑', name: '𝑷𝑨𝑷𝑷𝒀 Manhwa Dark' },
};



// Pinterest dump-style search profiles — each seed is a real Pinterest-style dump query
const EDITORIAL_SEARCH_PROFILES = [
  {
    category: 'anime',
    emoji: '🎀', name: 'Anime Girls',
    mood: 'soft glow heroine portraits, save-worthy profile pictures',
    seeds: [
      'anime girl pfp dump', 'cute anime girl wallpaper dump', 'anime girl portrait dump pinterest',
      'aesthetic anime girl pfp dump 2024', 'anime girl phone wallpaper dump hd',
    ],
  },
  {
    category: 'boys',
    emoji: '🗡️', name: 'Anime Boys',
    mood: 'sharp character portraits with cinematic lighting',
    seeds: [
      'anime boy pfp dump', 'dark anime boy wallpaper dump', 'manhwa male lead pfp dump',
      'handsome anime boy portrait dump', 'anime boy aesthetic wallpaper dump pinterest',
    ],
  },
  {
    category: 'amoled',
    emoji: '⬛', name: 'AMOLED Wallpapers',
    mood: 'deep blacks, neon edges, OLED-safe contrast',
    seeds: [
      'black anime wallpaper dump', 'amoled dark anime pfp dump', 'pure black phone wallpaper dump',
      'dark amoled wallpaper dump 4k', 'black aesthetic anime wallpaper dump',
    ],
  },
  {
    category: 'cute_anime',
    emoji: '🌸', name: 'Cute / Kawaii',
    mood: 'pastel, cozy, adorable saves for Gen Z feeds',
    seeds: [
      'cute anime pfp dump', 'kawaii anime girl wallpaper dump', 'pastel anime aesthetic pfp dump',
      'soft cute anime portrait dump', 'adorable anime girl pfp dump pinterest',
    ],
  },
  {
    category: 'dark_anime',
    emoji: '🕯️', name: 'Dark Aesthetic',
    mood: 'moody shadows, gothic romance, premium edit material',
    seeds: [
      'dark anime pfp dump', 'gothic anime wallpaper dump', 'dark aesthetic anime portrait dump',
      'moody dark anime girl pfp dump', 'dark anime boy wallpaper dump pinterest',
    ],
  },
  {
    category: 'manhwa',
    emoji: '👑', name: 'Manhwa / Webtoon',
    mood: 'romance-fantasy leads and polished Korean webtoon visuals',
    seeds: [
      'manhwa pfp dump', 'webtoon character wallpaper dump', 'manhwa romance fantasy pfp dump',
      'korean webtoon aesthetic pfp dump', 'manhwa couple matching pfp dump',
    ],
  },
  {
    category: 'fantasy',
    emoji: '🪽', name: 'Fantasy Angels & Demons',
    mood: 'angel wings, demon aura, royal fantasy drama',
    seeds: [
      'fantasy anime pfp dump', 'anime angel demon wallpaper dump', 'dark fantasy portrait dump pinterest',
      'anime demon girl pfp dump', 'fantasy character wallpaper dump hd',
    ],
  },
  {
    category: 'cyberpunk',
    emoji: '🌃', name: 'Cyberpunk Night',
    mood: 'neon rain, lofi city nights, futuristic edits',
    seeds: [
      'cyberpunk wallpaper dump', 'neon city anime wallpaper dump', 'cyberpunk aesthetic pfp dump',
      'lofi night city wallpaper dump', 'cyberpunk anime portrait dump pinterest',
    ],
  },
  {
    category: 'japanese',
    emoji: '⛩️', name: 'Japanese Aesthetic',
    mood: 'sakura, shrine nights, clean Japan-inspired compositions',
    seeds: [
      'japanese aesthetic wallpaper dump', 'anime sakura pfp dump', 'tokyo night anime wallpaper dump',
      'japanese anime portrait dump pinterest', 'lofi japan aesthetic wallpaper dump',
    ],
  },
  {
    category: 'aesthetic',
    emoji: '✨', name: 'Trending Pinterest Art',
    mood: 'Pinterest-save energy: clean, stylish, and highly shareable',
    seeds: [
      'aesthetic anime pfp dump', 'trending anime wallpaper dump 2024', 'pixiv art dump pinterest',
      'aesthetic pfp dump pinterest', 'anime matching pfp dump',
    ],
  },
  {
    category: 'pappy_digital_art',
    emoji: '⸸', name: 'PAPPY Digital Art',
    mood: 'high-detail digital paintings, pixiv-quality character art',
    seeds: [
      'digital art anime dump', 'pixiv art dump wallpaper', 'anime digital painting dump pinterest',
      'character art dump hd', 'anime illustration dump 4k',
    ],
  },
  {
    category: 'pappy_cute_pfp',
    emoji: '🌸', name: 'PAPPY Cute PFP',
    mood: 'adorable save-worthy profile pictures for every feed',
    seeds: [
      'cute pfp dump', 'cute anime pfp dump pinterest', 'adorable pfp dump 2024',
      'soft cute pfp dump aesthetic', 'cute girl pfp dump hd',
    ],
  },
  {
    category: 'pappy_aesthetic_pfp',
    emoji: '✨', name: 'PAPPY Aesthetic PFP',
    mood: 'clean aesthetic profile pictures, highly shareable',
    seeds: [
      'aesthetic pfp dump', 'girly aesthetic pfp dump pinterest', 'aesthetic anime pfp dump 2024',
      'soft aesthetic pfp dump', 'aesthetic profile picture dump hd',
    ],
  },
  {
    category: 'pappy_anime_hd',
    emoji: '🎌', name: 'PAPPY Anime HD',
    mood: '1080p+ anime wallpapers, crisp and vibrant',
    seeds: [
      'anime wallpaper dump hd', 'anime 4k wallpaper dump', 'hd anime portrait dump pinterest',
      'anime wallpaper dump 1080p', 'ultra hd anime wallpaper dump',
    ],
  },
  {
    category: 'pappy_girly_pfp',
    emoji: '🖤', name: 'PAPPY Girly PFP',
    mood: 'girly aesthetic pfps, black and cute vibes',
    seeds: [
      'girly pfp dump', 'black girly pfp dump pinterest', 'cute girly anime pfp dump',
      'girly aesthetic pfp dump 2024', 'black cute pfp dump hd',
    ],
  },
  {
    category: 'pappy_black_anime',
    emoji: '🌑', name: 'PAPPY Black Anime',
    mood: 'dark black anime aesthetics, moody and premium',
    seeds: [
      'black anime pfp dump', 'dark black anime wallpaper dump', 'black aesthetic anime dump pinterest',
      'black anime portrait dump 4k', 'dark anime black pfp dump',
    ],
  },
  {
    category: 'pappy_manhwa_dark',
    emoji: '👑', name: 'PAPPY Manhwa Dark',
    mood: 'dark manhwa aesthetics, powerful character energy',
    seeds: [
      'dark manhwa pfp dump', 'manhwa dark aesthetic dump pinterest', 'dark webtoon character pfp dump',
      'manhwa villain pfp dump', 'dark manhwa wallpaper dump hd',
    ],
  },
];

const SEARCH_HISTORY_LIMIT = 50;
let editorialCursor = Math.floor(Date.now() / 36e5) % EDITORIAL_SEARCH_PROFILES.length;

function pickEditorialProfile(category) {
  const direct = EDITORIAL_SEARCH_PROFILES.find(p => p.category === category);
  if (direct) return direct;
  const profile = EDITORIAL_SEARCH_PROFILES[editorialCursor % EDITORIAL_SEARCH_PROFILES.length];
  editorialCursor = (editorialCursor + 1) % EDITORIAL_SEARCH_PROFILES.length;
  return profile;
}

async function buildEditorialQuery(category) {
  const dropsCfg = await sm.getGroup('drops');
  const recent = Array.isArray(dropsCfg.recentSearches) ? dropsCfg.recentSearches : [];
  const profile = pickEditorialProfile(category);
  const seeds = profile.seeds;

  // Pick a seed not recently used, rotating by minute
  const minuteSlot = Math.floor(Date.now() / 60000);
  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[(minuteSlot + i) % seeds.length];
    if (!recent.includes(seed)) {
      const nextRecent = [seed, ...recent.filter(q => q !== seed)].slice(0, SEARCH_HISTORY_LIMIT);
      await sm.set('drops.recentSearches', nextRecent).catch(() => {});
      return seed;
    }
  }
  // All seeds recently used — just rotate
  const seed = seeds[minuteSlot % seeds.length];
  const nextRecent = [seed, ...recent.filter(q => q !== seed)].slice(0, SEARCH_HISTORY_LIMIT);
  await sm.set('drops.recentSearches', nextRecent).catch(() => {});
  return seed;
}

const allChatIds = new Set();
const adminChatIds = new Set();

// Load persisted chats from MongoDB into memory
async function loadPersistedChats() {
  try {
    const { TgChat } = require('../database/models');
    const chats = await TgChat.find({});
    for (const c of chats) {
      allChatIds.add(c.chatId);
      if (c.isAdmin) adminChatIds.add(c.chatId);
    }
    logger.info(`Loaded ${chats.length} persisted chat IDs from DB`);
  } catch (e) {
    logger.warn('Could not load persisted chats: ' + e.message);
  }
}

async function _persistChat(chatId, isAdmin = false) {
  try {
    const { TgChat } = require('../database/models');
    await TgChat.findOneAndUpdate(
      { chatId: String(chatId) },
      { chatId: String(chatId), isAdmin, lastSeen: new Date() },
      { upsert: true, new: true }
    );
  } catch (e) { /* non-fatal */ }
}

async function _removePersistedChat(chatId) {
  try {
    const { TgChat } = require('../database/models');
    await TgChat.deleteOne({ chatId: String(chatId) });
  } catch (e) { /* non-fatal */ }
}

function addAdminChannel(chatId) {
  if (!chatId) return;
  adminChatIds.add(String(chatId));
  allChatIds.add(String(chatId));
  _persistChat(String(chatId), true);
}
function removeAdminChannel(chatId) {
  if (!chatId) return;
  adminChatIds.delete(String(chatId));
  _persistChat(String(chatId), false);
}
function addChat(chatId) {
  if (!chatId) return;
  allChatIds.add(String(chatId));
  _persistChat(String(chatId), adminChatIds.has(String(chatId)));
}
function removeChat(chatId) {
  if (!chatId) return;
  allChatIds.delete(String(chatId));
  adminChatIds.delete(String(chatId));
  _removePersistedChat(String(chatId));
}

function buildDropCaption(category, count) {
  const meta = CATEGORY_META[category] || { emoji: '🖼️', name: category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) };
  const hashtags = (CATEGORY_HASHTAGS[category] || []).map(h => `#${h}`).join(' ');
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    `✨ <b>DAILY DROP IS HERE!</b> ✨\n` +
    `${'─'.repeat(28)}\n\n` +
    `${meta.emoji} <b>Category:</b> ${meta.name}\n` +
    `🖼 <b>${count} HD Wallpapers</b> — Fresh today\n` +
    `📅 ${dateStr}\n\n` +
    `${'─'.repeat(28)}\n` +
    `🔥 <b>Save your favourites &amp; set as wallpaper!</b>\n\n` +
    `📲 <b>Follow our channel for daily drops</b>\n` +
    `🔁 <b>Share with friends who love wallpapers</b>\n\n` +
    `${hashtags}\n` +
    `${'─'.repeat(28)}\n` +
    `<i>Powered by ${config.bot.name}</i>`
  );
}

async function getPromoButtons() {
  const links = await PromotionLink.find({ isEnabled: true }).sort({ order: 1 });
  if (!links.length) return [];
  const rows = [];
  for (let i = 0; i < links.length; i += 2) {
    const row = [{ text: links[i].label, url: links[i].url }];
    if (links[i + 1]) row.push({ text: links[i + 1].label, url: links[i + 1].url });
    rows.push(row);
  }
  return rows;
}

async function fetchWallpapers(category, count = 10) {
  const query = await buildEditorialQuery(category) || CATEGORY_QUERIES[category] || `${category.replace(/_/g, ' ')} vertical phone wallpaper 4k ultra hd`;
  const cacheKey = `search_${category}_${query.replace(/[^a-z0-9]/gi, '_').slice(0, 48)}`;

  return wallpaperCache.getOrSet(cacheKey, async () => {
    const images = [];

    // 1. DuckDuckGo search
    try {
      const r1 = await axios.get('https://duckduckgo.com/', {
        params: { q: query, iax: 'images', ia: 'images' },
        headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' },
        timeout: 10000,
      });
      const match = r1.data.match(/vqd=([\d-]+)/);
      if (match) {
        const vqd = match[1];
        const r2 = await axios.get('https://duckduckgo.com/i.js', {
          params: { l: 'us-en', o: 'json', q: query, vqd, f: ',,,,,', p: '1', s: '0' },
          headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36', Referer: 'https://duckduckgo.com' },
          timeout: 10000,
        });
        const ddgResults = (r2.data?.results || []).map(r => ({ url: r.image, source: 'duckduckgo' }));
        images.push(...filterUrls(ddgResults));
      }
    } catch (e) {
      logger.warn(`DDG search (${category}): ${e.message}`);
    }

    // 2. Unsplash fallback
    if (images.length < 5 && config.apis.unsplashKey) {
      try {
        const r = await axios.get('https://api.unsplash.com/search/photos', {
          params: { query, per_page: 30, orientation: 'portrait' },
          headers: { Authorization: `Client-ID ${config.apis.unsplashKey}` },
          timeout: 10000,
        });
        const unResults = (r.data?.results || []).map(p => ({ url: p.urls?.raw || p.urls?.full || p.urls?.regular, source: 'unsplash' }));
        images.push(...filterUrls(unResults));
      } catch (e) { logger.warn(`Unsplash (${category}): ${e.message}`); }
    }

    // 3. Pexels fallback
    if (images.length < 5 && config.apis.pexelsKey) {
      try {
        const r = await axios.get('https://api.pexels.com/v1/search', {
          params: { query, per_page: 30, orientation: 'portrait', size: 'large' },
          headers: { Authorization: config.apis.pexelsKey },
          timeout: 10000,
        });
        const pexResults = (r.data?.photos || []).map(p => ({ url: p.src?.original || p.src?.large2x || p.src?.portrait, source: 'pexels' }));
        images.push(...filterUrls(pexResults));
      } catch (e) { logger.warn(`Pexels (${category}): ${e.message}`); }
    }

    return images.filter(img => img.url).slice(0, Math.max(count, 30));
  }, 10 * 60 * 1000);
}

async function downloadAndStoreWallpapers(category, count = 10) {
  const images = await fetchWallpapers(category, count);
  const dir = getWallpaperCategoryDir(category);
  const stored = [];

  const enhancerCfg = await sm.getGroup('enhancer');
  const wmCfg = await sm.getGroup('watermark');

  for (const img of images) {
    if (stored.length >= count) break;

    const existing = await Wallpaper.findOne({ url: img.url });
    if (existing) {
      if (existing.postedToTg || existing.postedToWa) continue;
      stored.push(existing);
      continue;
    }

    try {
      const r = await axios.get(img.url, { responseType: 'arraybuffer', timeout: 15000 });
      let buffer = Buffer.from(r.data);

      const verify = await verifyBuffer(buffer);
      if (!verify.ok) {
        logger.debug(`Skipped bad image: ${verify.reason}`);
        continue;
      }

      if (enhancerCfg && enhancerCfg.enabled) {
        try {
          buffer = await enhance(buffer, { upscale: true, sharpen: true, artifacts: true });
        } catch (e) { logger.warn(`Enhance failed: ${e.message}`); }
      }

      if (wmCfg && wmCfg.enabled) {
        try {
          buffer = await applyWatermark(buffer, wmCfg);
        } catch (e) { logger.warn(`Watermark failed: ${e.message}`); }
      }

      const filename = `wp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
      const localPath = path.join(dir, filename);
      fs.writeFileSync(localPath, buffer);

      stored.push(await Wallpaper.create({ category, url: img.url, localPath, source: img.source, width: verify.width, height: verify.height }));
    } catch (e) {
      logger.warn(`Download wp failed: ${e.message}`);
    }
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


async function optimizeTelegramDiscoverability(bot, chatId, category) {
  const meta = CATEGORY_META[category] || { emoji: '🖼️', name: category.replace(/_/g, ' ') };
  const title = `${meta.emoji} ${config.bot.name} Daily Drops`;
  const description = [
    `${config.bot.name} curates premium portrait wallpapers, anime/manhwa PFPs, AMOLED drops, and aesthetic digital art every day.`,
    'Organic tags: anime wallpapers, manhwa art, matching PFPs, AMOLED, Pixiv-style digital paintings.',
    'Save, share, and upload full-size profile pictures without crop.'
  ].join(' ');
  try {
    const chat = await bot.telegram.getChat(chatId);
    if (['group', 'supergroup', 'channel'].includes(chat.type)) {
      if (!chat.title) {
        await bot.telegram.setChatTitle(chatId, title).catch(() => {});
      }
      if (!chat.description || chat.description.length < 80) {
        await bot.telegram.setChatDescription(chatId, description.slice(0, 255)).catch(() => {});
      }
    }
  } catch (e) {
    logger.debug('Telegram discoverability skipped for ' + chatId + ': ' + e.message);
  }
}

async function postWallpapersToAllTgChannels(bot, category) {
  const dbChannels = await Channel.find({ isActive: true, platform: 'telegram' });
  const chatSet = new Set();
  for (const ch of dbChannels) chatSet.add(ch.chatId || ch.link);
  if (config.channels?.telegram) chatSet.add(config.channels.telegram);
  for (const id of allChatIds) chatSet.add(id);

  if (!chatSet.size) {
    logger.info(`Drop ${category}: no chats yet`);
    return [];
  }

  const dropsCfg = await sm.getGroup('drops');
  const dropCount = Math.min(Math.max(parseInt(dropsCfg.imagesPerDrop, 10) || 10, 2), 10);
  const wallpapers = await getOrFetchWallpapers(category, dropCount);
  if (!wallpapers.length) { logger.warn(`Drop ${category}: no wallpapers`); return []; }

  const meta = CATEGORY_META[category] || { emoji: '🖼️', name: category.replace(/_/g, ' ') };
  const captionLines = ui.dropCaption({
    category,
    displayName: meta.name,
    emoji: meta.emoji,
    hashtags: CATEGORY_HASHTAGS[category] || [],
    botName: config.bot.name,
    botUsername: config.bot.username,
    count: wallpapers.length,
    description: pickEditorialProfile(category).mood,
  });
  const captionText = captionLines;

  const promoRows = await getPromoButtons();
  const keyboard = [
    [{ text: '🌐 Upload Full PFP', url: config.webUrl }],
    ...(config.bot.username ? [[{ text: '🤖 Open Telegram Bot', url: `https://t.me/${config.bot.username}` }]] : []),
    ...promoRows,
  ];
  
  const posted = [];

  for (const chatId of chatSet) {
    await optimizeTelegramDiscoverability(bot, chatId, category);
    const batch = wallpapers.slice(0, 10);
    try {
      const mediaGroup = batch.map((wp, i) => ({
        type: 'photo',
        media: (wp.localPath && fs.existsSync(wp.localPath))
          ? { source: fs.createReadStream(wp.localPath) }
          : wp.url,
        ...(i === 0 ? { caption: captionText, parse_mode: 'HTML' } : {}),
      }));

      await bot.telegram.sendMediaGroup(chatId, mediaGroup);
      batch.forEach(wp => posted.push({ chatId, wp }));

      if (keyboard.length) {
        await sleep(800);
        await bot.telegram.sendMessage(chatId,
          `📲 <b>Follow for daily wallpaper drops!</b>
🔁 Share with friends who love wallpapers`,
          { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }
        ).catch(() => {});
      }
    } catch (albumErr) {
      let sentCount = 0;
      for (const wp of batch) {
        try {
          const source = (wp.localPath && fs.existsSync(wp.localPath))
            ? { source: fs.createReadStream(wp.localPath) }
            : wp.url;
          const isFirst = sentCount === 0;
          await bot.telegram.sendPhoto(chatId, source, {
            caption: isFirst ? captionText : undefined,
            parse_mode: isFirst ? 'HTML' : undefined,
          });
          sentCount++;
          posted.push({ chatId, wp });
        } catch (e2) {
          if (e2.message?.includes('kicked') || e2.message?.includes('not found') || e2.message?.includes('deactivated')) {
            removeChat(chatId);
          }
        }
        await sleep(500);
      }
      if (sentCount > 0 && keyboard.length) {
        await bot.telegram.sendMessage(chatId,
          `📲 <b>Follow for daily wallpaper drops!</b>
🔁 Share with friends who love wallpapers`,
          { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }
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

async function readWallpaperBuffer(wp, enhancerCfg, wmCfg) {
  let buffer;
  if (wp.localPath && fs.existsSync(wp.localPath)) {
    buffer = fs.readFileSync(wp.localPath);
  } else {
    const r = await axios.get(wp.url, { responseType: 'arraybuffer', timeout: 15000 });
    buffer = Buffer.from(r.data);
    if (enhancerCfg && enhancerCfg.enabled) buffer = await enhance(buffer, { upscale: true, sharpen: true, artifacts: true }).catch(() => buffer);
    if (wmCfg && wmCfg.enabled) buffer = await applyWatermark(buffer, wmCfg).catch(() => buffer);
  }
  return buffer;
}

async function getGroupMentions(sock, jid) {
  if (!String(jid).endsWith('@g.us')) return [];
  try {
    const meta = await sock.groupMetadata(jid);
    return (meta.participants || []).map(p => p.id).filter(Boolean);
  } catch (e) {
    logger.warn('WA mentions unavailable for ' + jid + ': ' + e.message);
    return [];
  }
}

async function fetchWyrQuestion() {
  try {
    const r = await axios.get('https://prexzyapis.com/ai/chatbot', {
      params: { text: 'Give me one short fun "Would You Rather" question about anime, aesthetics, or wallpapers. Just the question, no explanation.' },
      timeout: 6000,
    });
    const answer = r.data?.response || r.data?.message || r.data?.answer || '';
    return answer.trim().slice(0, 200) || null;
  } catch (e) {
    return null;
  }
}

async function buildWaCaption(category, count) {
  const profile = pickEditorialProfile(category);
  const hashtags = (CATEGORY_HASHTAGS[category] || []).slice(0, 6).map(t => '#' + t).join(' ');
  const botUrl = config.bot.username ? `https://t.me/${config.bot.username}` : '';
  const wyr = await fetchWyrQuestion();
  return [
    `╭─ ${profile.emoji} *DAILY DROP* ─╮`,
    `*${profile.name}* · ${count} premium picks`,
    '╰────────────────╯',
    '',
    `> ${profile.mood}`,
    '',
    wyr ? `🎲 *WYR:* ${wyr}` : '',
    '',
    '• Portrait-first HD wallpapers',
    '• Save-ready PFP / lockscreen quality',
    '• Use the uploader to set full-size profile pictures without WhatsApp cropping.',
    '',
    `🌐 ${config.webUrl}`,
    botUrl ? `🤖 ${botUrl}` : '',
    '',
    hashtags,
  ].filter(Boolean).join('\n');
}

async function sendWaDailyDrop(sock, jid, wallpapers, caption, mentions = []) {
  // WA Channels do not support buttons/nativeFlow/footer — send clean album only
  const safeMentions = String(jid).endsWith('@g.us') ? mentions : [];

  // Attempt 1: album message (Baileys album API)
  try {
    const album = wallpapers.map((wp, i) => ({
      image: wp._buffer,
      caption: i === 0 ? caption : undefined,
      mimetype: 'image/jpeg',
      mentions: i === 0 ? safeMentions : undefined,
    }));
    const sent = await sock.sendMessage(jid, { album, caption, mentions: safeMentions }, { delayMs: 900 });
    return sent;
  } catch (albumErr) {
    logger.warn('WA album send failed for ' + jid + ': ' + albumErr.message);
  }

  // Attempt 2: individual images one by one
  let firstMessage;
  for (let i = 0; i < wallpapers.length; i++) {
    try {
      const sent = await sock.sendMessage(jid, {
        image: wallpapers[i]._buffer,
        caption: i === 0 ? caption : undefined,
        mimetype: 'image/jpeg',
        mentions: i === 0 ? safeMentions : undefined,
      });
      firstMessage ||= sent;
    } catch (e) {
      logger.warn('WA single image failed for ' + jid + ' img ' + i + ': ' + e.message);
    }
    await sleep(650);
  }
  return firstMessage;
}


async function postWallpapersToWA(category) {
  const { getOwnerSock, isOwnerConnected } = require('./ownerWhatsapp');
  if (!isOwnerConnected()) return [];

  const waChannels = await Channel.find({ isActive: true, platform: 'whatsapp' });
  if (!waChannels.length) return [];

  const dropsCfg = await sm.getGroup('drops');
  const dropCount = Math.min(Math.max(parseInt(dropsCfg.imagesPerDrop, 10) || 10, 2), 10);
  const wallpapers = await Wallpaper.find({ category, postedToWa: false }).sort({ addedAt: 1 }).limit(dropCount);
  if (!wallpapers.length) return [];

  const sock = getOwnerSock();
  const waCfg = await sm.getGroup('whatsapp');
  const caption = buildWaCaption(category, wallpapers.length);
  const enhancerCfg = await sm.getGroup('enhancer');
  const wmCfg = await sm.getGroup('watermark');

  for (const wp of wallpapers) wp._buffer = await readWallpaperBuffer(wp, enhancerCfg, wmCfg);

  const posted = [];
  for (const channel of waChannels) {
    let jid = channel.chatId || channel.link;
    const inviteMatch = String(jid).match(/(?:channel\/|^)([A-Za-z0-9]{20,})$/);
    if (inviteMatch && !String(jid).includes('@')) {
      try {
        const nlMeta = await sock.newsletterMetadata('invite', inviteMatch[1]);
        if (nlMeta && nlMeta.id) {
          jid = nlMeta.id;
          await Channel.findByIdAndUpdate(channel._id, { chatId: jid });
          logger.info('Resolved newsletter JID: ' + jid);
        }
      } catch (e) { logger.warn('Could not resolve newsletter JID for ' + jid + ': ' + e.message); }
    }

    await sendWaDailyDrop(sock, jid, wallpapers, caption, []);
    posted.push(...wallpapers);
    logger.info('WA drop: sent album of ' + wallpapers.length + ' ' + category + ' wallpapers to ' + jid);

    if (waCfg.forwardingEnabled && Array.isArray(waCfg.forwardingDestinations)) {
      const timesPerDay = Math.max(1, parseInt(waCfg.forwardTimesPerDay, 10) || 1);
      const cooldownMs = Math.floor(24 * 60 * 60 * 1000 / timesPerDay);
      const now = Date.now();
      const lastSent = waCfg.forwardLastSent || {};

      // Build button to attach to group forwards
      const channelUrl = waCfg.forwardButtonUrl || config.webUrl;
      const channelBtnText = waCfg.forwardButtonText || '📢 Join Our WA Channel';

      for (const dest of waCfg.forwardingDestinations.filter(Boolean)) {
        const lastTs = lastSent[dest] || 0;
        if (now - lastTs < cooldownMs) {
          logger.info(`WA forward skip ${dest}: cooldown (${Math.round((cooldownMs - (now - lastTs)) / 60000)}m left)`);
          continue;
        }

        const mentions = await getGroupMentions(sock, dest);
        const groupCaption = caption + `\n\n${channelBtnText}\n${channelUrl}`;
        await sendWaDailyDrop(sock, dest, wallpapers, groupCaption, mentions);

        // Update last sent timestamp
        lastSent[dest] = now;
        await sm.set('whatsapp.forwardLastSent', lastSent).catch(() => {});
        await sleep(900);
      }
    }
  }

  for (const wp of posted) { delete wp._buffer; wp.postedToWa = true; await wp.save().catch(() => {}); }
  return posted;
}

async function runCategoryDrop(bot, category) {
  const drops = await sm.getGroup('drops');
  if (!drops.enabled) { logger.info('Drops disabled'); return; }
  if (!drops.autoDropEnabled) { logger.info('Auto-drops disabled'); return; }

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
  addChat, removeChat, loadPersistedChats,
  allChatIds, adminChatIds,
  buildDropCaption, buildWaCaption, buildEditorialQuery, getPromoButtons,
};