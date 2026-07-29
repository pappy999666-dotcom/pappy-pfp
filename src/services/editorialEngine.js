'use strict';
const axios = require('axios');
const logger = require('../utils/logger');

// ── Quote Library (60+ premium aesthetic quotes) ──────────────────────────────
const QUOTES = [
  '"Every pixel tells a story."',
  '"Choose the image that chooses you."',
  '"Art doesn\'t ask permission to be beautiful."',
  '"The right wallpaper changes the mood of the day."',
  '"In the dark, only the bold shine."',
  '"A wallpaper is a window into another world."',
  '"Style is silence speaking louder than words."',
  '"The aesthetic you choose reflects the soul you carry."',
  '"Save the ones that stop your scroll."',
  '"Every great phone screen starts with one great image."',
  '"Darkness is not the absence of light — it\'s its most honest form."',
  '"You don\'t find the perfect wallpaper. It finds you."',
  '"The rarest beauty is the kind that needs no explanation."',
  '"Curated for those who see beyond the surface."',
  '"Your screen is your first impression."',
  '"Only the worthy receive the daily drop."',
  '"Aesthetic is a language without words."',
  '"In every shadow, there is an invitation."',
  '"High resolution is a state of mind."',
  '"The ones who pause are the ones who truly see."',
  '"Every collection is a chapter of its own."',
  '"Dark art speaks what daylight cannot express."',
  '"Style without substance is decoration. This is both."',
  '"Saved once, revisited forever."',
  '"A single image can redefine your entire vibe."',
  '"The night is when beauty becomes dangerous."',
  '"From the archive. For the worthy."',
  '"Silence is the loudest aesthetic."',
  '"What you choose to display reveals what you refuse to say."',
  '"The art of curating is knowing what to leave behind."',
  '"The darkest skies hold the sharpest stars."',
  '"One image. A thousand feelings."',
  '"You\'ll know it when you see it."',
  '"The right aesthetic is the one that makes strangers stop."',
  '"Not trends. Timeless."',
  '"The rarest drops are the ones worth waiting for."',
  '"An image without quality is just noise."',
  '"Set the tone before the day sets it for you."',
  '"Art is the quietest way to be loud."',
  '"Every frame curated. Every pixel intentional."',
  '"Dark. Clean. Unmistakable."',
  '"The line between wallpaper and art is taste."',
  '"A premium drop isn\'t just images — it\'s a statement."',
  '"Those who save know. Those who skip, wonder."',
  '"Excellence doesn\'t announce itself. It arrives."',
  '"One drop per day. Every day a different mood."',
  '"Let the aesthetic speak first."',
  '"Your screen is the first story you tell yourself each morning."',
  '"The best collections have no copies."',
  '"Find the one that feels like yours before anyone else saves it."',
  '"Quality is the only currency that never depreciates."',
  '"Some images are meant to be discovered, not found."',
  '"Every dark aesthetic is a universe waiting to be opened."',
  '"Rare drops for rare taste."',
  '"Nothing mediocre ever earned a save."',
  '"The worthy collection never asks to be shared — it demands it."',
  '"Beauty curated daily. Chaos filtered out."',
  '"Every drop is a decision."',
  '"Premium is not a price. It\'s a standard."',
  '"The scroll stops here."',
  '"There are images you look at, and images you feel."',
];

// ── Divider Styles ─────────────────────────────────────────────────────────────
const DIVIDERS = [
  '═══════════════════',
  '━━━━━━━━━━━━━━━━━━━',
  '───────────────────',
  '· · · · · · · · · · · ·',
  '◈ ─────────────── ◈',
  '✦ ─────────────── ✦',
  '⸸ ─────────────── ⸸',
  '❖ ─────────────── ❖',
  '✠ ─────────────── ✠',
  '☩ ─────────────── ☩',
  '♛ ─────────────── ♛',
  '⟡ ─────────────── ⟡',
  '◇ ─────────────── ◇',
  '▸ ─────────────── ◂',
];

// ── Footer Variations (15) ─────────────────────────────────────────────────────
const FOOTERS = [
  '━━━━━━━━━━━━━━━━━\n⸸ *PAPPY* ×͜×\n━━━━━━━━━━━━━━━━━',
  '♛━━━━━━━━━━━━━━━♛\n      *P A P P Y*\n♛━━━━━━━━━━━━━━━♛',
  '╔══ *PAPPY* ════╗\n║  Premium Drops  ║\n╚════════════════╝',
  '⸸ ─── *PAPPY* ─── ⸸\n_Curated. Daily. Premium._',
  '✦ *P·A·P·P·Y* ✦\n_The Daily Drop Standard_',
  '❖ ══ *PAPPY* ══ ❖',
  '◈ ─ *PAPPY DAILY DROP* ─ ◈',
  '┏━━━━━━━━━━━━━━━━━━┓\n┃     *P A P P Y*     ┃\n┗━━━━━━━━━━━━━━━━━━┛',
  '⟡ *PAPPY* · Premium Drops ⟡',
  '╭─── *PAPPY* ────╮\n│  Daily · HD · Free  │\n╰────────────────╯',
  '✠ *PAPPY* ✠\n_Every drop, a masterpiece._',
  '☩ ─── *PAPPY* ─── ☩\n_Darkness refined into art._',
  '▸▸ *P A P P Y* ◂◂',
  '⸸ *PAPPY* ×͜× _est. forever_',
  '🖤 *PAPPY* · Drop №∞ · _Never Miss One_',
];

// ── Titles (category-aware) ────────────────────────────────────────────────────
const TITLES = {
  anime:              ['ANIME GIRLS DROP', 'SOFT GIRL COLLECTION', 'ANIME PFP PACK', 'HEROINE PORTRAITS', 'AESTHETIC ANIME DROP'],
  dark_anime:         ['DARK AESTHETIC DROP', 'SHADOW COLLECTION', 'GOTHIC ANIME PACK', 'DARK ENERGY DROP', 'MIDNIGHT AESTHETIC'],
  cute_anime:         ['KAWAII DROP', 'CUTE ANIME PACK', 'SOFT PASTEL COLLECTION', 'COZY ANIME DROP', 'SWEET AESTHETIC'],
  manhwa:             ['MANHWA COLLECTION', 'WEBTOON DROP', 'ROMANCE FANTASY PACK', 'KOREAN WEBTOON PICKS', 'MANHWA ROYALS'],
  manga:              ['MANGA ART DROP', 'INK & PANEL COLLECTION', 'MANGA AESTHETICS PACK'],
  novel_art:          ['NOVEL ART DROP', 'ILLUSTRATED COLLECTION', 'LIGHT NOVEL AESTHETICS'],
  girls:              ['PORTRAIT COLLECTION', 'GIRLS DROP', 'AESTHETIC PORTRAITS PACK'],
  boys:               ['ANIME BOYS DROP', 'HUSBANDO PACK', 'MALE LEAD COLLECTION', 'DARK BOY AESTHETIC'],
  fashion:            ['FASHION DROP', 'STYLE COLLECTION', 'EDITORIAL FASHION PACK'],
  streetwear:         ['STREETWEAR DROP', 'URBAN STYLE PACK', 'STREET AESTHETICS'],
  cyberpunk:          ['CYBERPUNK DROP', 'NEON CITY PACK', 'FUTURISTIC COLLECTION', 'NEON AESTHETIC DROP'],
  gaming:             ['GAMING AESTHETIC DROP', 'SETUP COLLECTION', 'GAMER PACK'],
  sci_fi:             ['SCI-FI DROP', 'FUTURISTIC PACK', 'TECH COLLECTION'],
  technology:         ['TECH AESTHETIC DROP', 'DIGITAL COLLECTION', 'CYBER PACK'],
  minimal:            ['MINIMAL DROP', 'CLEAN AESTHETIC PACK', 'MINIMAL COLLECTION'],
  amoled:             ['AMOLED DROP', 'PURE BLACK PACK', 'OLED COLLECTION', 'DARK WALLPAPER DROP'],
  aesthetic:          ['AESTHETIC DROP', 'TRENDING PFP PACK', 'PINTEREST FINDS', 'SAVE-WORTHY DROP'],
  neon:               ['NEON DROP', 'GLOW COLLECTION', 'NEON LIGHTS PACK'],
  abstract:           ['ABSTRACT ART DROP', 'COLORFUL COLLECTION', 'ABSTRACT PACK'],
  vintage:            ['VINTAGE DROP', 'RETRO COLLECTION', 'OLD SCHOOL AESTHETIC'],
  minimalist:         ['MINIMALIST DROP', 'CLEAN PACK', 'SIMPLE AESTHETIC'],
  nature:             ['NATURE DROP', 'SCENERY COLLECTION', 'LANDSCAPE PACK'],
  mountains:          ['MOUNTAIN DROP', 'PEAK COLLECTION', 'SUMMIT AESTHETIC'],
  ocean:              ['OCEAN DROP', 'SEA COLLECTION', 'COASTAL AESTHETIC'],
  sunset:             ['SUNSET DROP', 'GOLDEN HOUR PACK', 'TWILIGHT COLLECTION'],
  forest:             ['FOREST DROP', 'WOODLAND COLLECTION', 'MISTY FOREST PACK'],
  waterfall:          ['WATERFALL DROP', 'CASCADE COLLECTION', 'FLOW AESTHETIC'],
  flowers:            ['FLORAL DROP', 'BLOOM COLLECTION', 'FLOWER AESTHETIC'],
  rain:               ['RAIN DROP', 'MELANCHOLY COLLECTION', 'RAINY AESTHETIC'],
  cars:               ['CARS DROP', 'SPEED COLLECTION', 'AUTO AESTHETIC'],
  architecture:       ['ARCHITECTURE DROP', 'STRUCTURAL COLLECTION', 'DESIGN AESTHETIC'],
  city:               ['CITYSCAPE DROP', 'URBAN COLLECTION', 'NIGHT CITY AESTHETIC'],
  night_city:         ['NIGHT CITY DROP', 'NEON STREETS PACK', 'MIDNIGHT CITY COLLECTION'],
  fantasy:            ['FANTASY DROP', 'ETHEREAL COLLECTION', 'ROYAL FANTASY PACK'],
  space:              ['SPACE DROP', 'GALAXY COLLECTION', 'COSMIC AESTHETIC'],
  luxury:             ['LUXURY DROP', 'PREMIUM COLLECTION', 'HIGH-END AESTHETIC'],
  japanese:           ['JAPANESE AESTHETIC', 'SAKURA COLLECTION', 'ZEN DROP', 'JAPAN AESTHETIC'],
  korean:             ['KOREAN AESTHETIC', 'KPOP DROP', 'SEOUL STYLE COLLECTION'],
  mythology:          ['MYTHOLOGY DROP', 'LEGENDS COLLECTION', 'GODS AESTHETIC'],
  dragons:            ['DRAGON DROP', 'FIRE & SCALES COLLECTION', 'DRAGON AESTHETIC'],
  magic:              ['ARCANE DROP', 'SPELL COLLECTION', 'MAGICAL AESTHETIC'],
  warriors:           ['WARRIOR DROP', 'SAMURAI COLLECTION', 'BATTLE AESTHETIC'],
  superheroes:        ['HERO DROP', 'SUPERHERO PACK', 'HERO AESTHETIC'],
  horror:             ['HORROR DROP', 'DARK COLLECTION', 'CREEP AESTHETIC'],
  animals:            ['ANIMALS DROP', 'WILDLIFE COLLECTION', 'CREATURE AESTHETIC'],
  sports:             ['SPORTS DROP', 'ATHLETE COLLECTION', 'ACTION AESTHETIC'],
  lofi:               ['LOFI DROP', 'CHILL COLLECTION', 'COZY AESTHETIC'],
  food:               ['FOOD DROP', 'CULINARY COLLECTION', 'FOODIE AESTHETIC'],
  quotes:             ['QUOTES DROP', 'WISDOM COLLECTION', 'WORDS AESTHETIC'],
  weekend_specials:   ['WEEKEND SPECIAL DROP', 'WEEKEND COLLECTION', 'CHILL WEEKEND PACK'],
  monthly_collections:['MONTHLY COLLECTION', 'BEST OF THE MONTH', 'PREMIUM MONTHLY PACK'],
  pappy_digital_art:  ['𝑷𝑨𝑷𝑷𝒀 DIGITAL ART DROP', 'PIXIV COLLECTION', 'ART PACK'],
  pappy_cute_pfp:     ['𝑷𝑨𝑷𝑷𝒀 CUTE PFP DROP', 'ADORABLE PACK', 'SOFT PFP COLLECTION'],
  pappy_aesthetic_pfp:['𝑷𝑨𝑷𝑷𝒀 AESTHETIC PFP', 'GIRLY ANIME PACK', 'CUTE AESTHETIC'],
  pappy_anime_hd:     ['𝑷𝑨𝑷𝑷𝒀 ANIME HD DROP', 'ULTRA HD PACK', 'HIGH RES COLLECTION'],
  pappy_girly_pfp:    ['𝑷𝑨𝑷𝑷𝒀 GIRLY PFP DROP', 'AESTHETIC GIRLS PACK', 'GIRLY COLLECTION'],
  pappy_black_anime:  ['𝑷𝑨𝑷𝑷𝒀 BLACK ANIME DROP', 'DARK AESTHETIC PACK', 'MOODY COLLECTION'],
  pappy_manhwa_dark:  ['𝑷𝑨𝑷𝑷𝒀 DARK MANHWA DROP', 'VILLAIN AESTHETIC', 'DARK WEBTOON PACK'],
  default:            ['DAILY DROP', 'PREMIUM COLLECTION', 'FRESH PICKS', 'TODAY\'S DROP', 'CURATED PACK'],
};

// ── Static Descriptions (category-aware fallback) ──────────────────────────────
const DESCS = {
  anime:       ['Pinterest-worthy portraits you\'ll instantly save.', 'The kind of wallpapers that deserve your lockscreen.', 'Soft-glow heroines, curated for saves and shares.', 'Anime aesthetics elevated to gallery-worthy frames.'],
  dark_anime:  ['Moody shadows and gothic romance. Save-worthy.', 'For those who live in the dark aesthetic.', 'The kind of dark art that stops your scroll.', 'Shadow-drenched portraits that command a second look.'],
  cute_anime:  ['Pastel and cozy — adorable saves for your feed.', 'Maximum cuteness, minimum effort to save.', 'Soft, sweet, and perfectly aesthetic.', 'Kawaii curation at its purest.'],
  manhwa:      ['Romance-fantasy leads and polished webtoon visuals.', 'Manhwa royals and webtoon aesthetics, curated.', 'Charismatic leads rendered in stunning vertical format.'],
  cyberpunk:   ['Neon rain, lofi city nights, futuristic edits.', 'For those who live in the neon city.', 'Chrome futures and electric aesthetics.'],
  amoled:      ['Deep blacks, neon edges, OLED-safe contrast.', 'Maximum contrast. Minimum battery drain.', 'Pure black perfection for your OLED screen.'],
  fantasy:     ['Angel wings, demon aura, royal fantasy drama.', 'Where angels and demons collide.', 'Ethereal realms rendered in stunning detail.'],
  japanese:    ['Sakura, shrine nights, clean Japan-inspired compositions.', 'Zen vibes and Tokyo nights.', 'Traditional elegance meets modern aesthetic.'],
  space:       ['Galaxies, nebulae, and cosmic wonders at full resolution.', 'The universe, curated for your screen.', 'Infinite stars. One perfect lockscreen.'],
  luxury:      ['High-end aesthetics and refined visual luxury.', 'Because your screen deserves the premium treatment.', 'Opulence rendered at full resolution.'],
  minimal:     ['Clean lines and intentional emptiness.', 'Less noise. More beauty.', 'Minimal by design. Powerful by impact.'],
  nature:      ['Earth\'s finest moments captured at full resolution.', 'Nature at its most save-worthy.', 'Landscapes that make you stop and breathe.'],
  default:     ['Fresh aesthetic finds for today\'s collection.', 'Minimal. Clean. Save-worthy.', 'Curated for saves, shares, and profile pictures.', 'Premium drops, daily. Never the same twice.'],
};

// ── Platform-specific CTAs ─────────────────────────────────────────────────────
const CTAS_CHANNEL = [
  '📲 *Upload without crop.* Full HD. One tap.',
  '🌐 *No crop. No compression.* Set it now.',
  '✦ Your PFP deserves full resolution. *Upload HD.*',
  '💎 *Set this as your WhatsApp PFP* — zero cropping.',
  '📱 *Full-size PFP upload.* No quality lost.',
  '🌐 *HD. No crop. No compromise.* Upload now.',
  '✨ *Upload in full resolution.* WhatsApp won\'t crop it.',
  '💫 *One tap. Full quality.* Zero compression.',
  '⸸ *Set your PFP right.* No crop. Max resolution.',
  '◈ *Premium upload.* Your screen, perfected.',
];

const CTAS_GROUP = [
  '📲 *Change your PFP now* — no crop, full HD.',
  '🌐 *Visit the web app* for a no-crop HD PFP upload.',
  '✦ *Full HD PFP upload* — free, no app needed.',
  '💎 *Upload without cropping* via the web app below.',
  '📱 *Set any of these as your PFP* — no WhatsApp crop.',
  '🌐 *Try the web app* — upload HD PFPs in seconds.',
  '✨ *Save this. Upload it.* No crop, no quality loss.',
  '⸸ *Your PFP, perfected.* Use the link below.',
  '◈ *No-crop PFP upload* — works on any phone.',
  '🔗 *Upload full-size* via the web app. Free.',
];

// ── Anti-Repeat Tracker ────────────────────────────────────────────────────────
const _recentTemplates = [];
const AVOID_LAST_N = 7;

function trackTemplate(name) {
  _recentTemplates.unshift(name);
  if (_recentTemplates.length > AVOID_LAST_N) _recentTemplates.pop();
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function weighted(arr) {
  const total = arr.reduce((s, x) => s + (x.weight || 1), 0);
  let r = Math.random() * total;
  for (const x of arr) { r -= (x.weight || 1); if (r <= 0) return x; }
  return arr[arr.length - 1];
}

function get(map, cat) {
  return map[cat] || map[cat?.split('_')[0]] || map.default || [];
}

function pickTemplate() {
  const fresh = TEMPLATES.filter(t => !_recentTemplates.includes(t.name));
  const pool = fresh.length >= 4 ? fresh : TEMPLATES;
  return weighted(pool);
}

// ── Template Registry (40 handcrafted premium templates) ──────────────────────
// params: { title, categoryEmoji, categoryDisplay, desc, count, countWord, quote, cta, webUrl, hashtags, game, footer, divider }

const TEMPLATES = [

  // ── 1. Gothic Cathedral ────────────────────────────────────────────────────
  {
    name: 'Gothic Cathedral', weight: 3,
    render({ title, categoryEmoji, categoryDisplay, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `╔═══════════════════╗`,
        `║  ${categoryEmoji} *${title}*`,
        `╚═══════════════════╝`,
        ``,
        `_${desc}_`,
        ``,
        divider,
        `✦ *${countWord} HD Wallpapers* · Fresh drop`,
        divider,
        ``,
        `> ${quote}`,
        ``,
        `╭── 🌐 *Full-Size PFP* ──╮`,
        `│ ${cta}`,
        `│ ${webUrl}`,
        `╰──────────────────────╯`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 2. Black Church ────────────────────────────────────────────────────────
  {
    name: 'Black Church', weight: 3,
    render({ title, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer }) {
      return [
        `⸸ ─────────────────── ⸸`,
        `*${categoryEmoji} ${title}*`,
        `⸸ ─────────────────── ⸸`,
        ``,
        `☩ *${countWord} HD Wallpapers* · Today's Blessing`,
        ``,
        `_${desc}_`,
        ``,
        `${quote}`,
        ``,
        `━━━━━━━━━━━━━━━━━━━`,
        ``,
        `${cta}`,
        `🌐 ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 3. Royal Archive ───────────────────────────────────────────────────────
  {
    name: 'Royal Archive', weight: 3,
    render({ title, categoryEmoji, categoryDisplay, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `♛━━━━━━━━━━━━━━━━━━━♛`,
        `   *${title}*`,
        `   ${categoryEmoji} ${categoryDisplay} Collection`,
        `♛━━━━━━━━━━━━━━━━━━━♛`,
        ``,
        `*${countWord} HD Wallpapers* — Curated Release`,
        ``,
        `_${desc}_`,
        ``,
        divider,
        `_${quote}_`,
        divider,
        ``,
        `*📲 Full-Size PFP Upload*`,
        `${cta}`,
        `${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 4. Dark Academia ───────────────────────────────────────────────────────
  {
    name: 'Dark Academia', weight: 2,
    render({ title, categoryEmoji, categoryDisplay, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      const vol = String(Math.floor(Math.random() * 888) + 12).padStart(3, '0');
      return [
        `┌─────────────────────┐`,
        `│  ${categoryEmoji} *${categoryDisplay.toUpperCase()}*`,
        `│  _Vol. ${vol} · Daily Archive_`,
        `└─────────────────────┘`,
        ``,
        `*${title}*`,
        ``,
        `${countWord} handpicked HD wallpapers, released today.`,
        ``,
        `_${desc}_`,
        ``,
        `〝 _${quote}_ 〞`,
        ``,
        divider,
        ``,
        `📖 ${cta}`,
        `   ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 5. Cyber Gothic ────────────────────────────────────────────────────────
  {
    name: 'Cyber Gothic', weight: 2,
    render({ title, categoryEmoji, categoryDisplay, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `⟡━━━━━━━━━━━━━━━━━━━⟡`,
        `  ⚡ *${title}* ⚡`,
        `  ${categoryEmoji} ${categoryDisplay} · Drop Active`,
        `⟡━━━━━━━━━━━━━━━━━━━⟡`,
        ``,
        `▸ *${countWord} HD Wallpapers loaded.*`,
        `▸ _${desc}_`,
        ``,
        `> ${quote}`,
        ``,
        `◈ ${cta}`,
        `◈ 🔗 ${webUrl}`,
        ``,
        divider,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 6. Luxury Noir ─────────────────────────────────────────────────────────
  {
    name: 'Luxury Noir', weight: 3,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `◈ ─────────────────── ◈`,
        ``,
        `    *${title}*`,
        `    _${categoryDisplay} · ${countWord} HD_`,
        ``,
        `◈ ─────────────────── ◈`,
        ``,
        `_${desc}_`,
        ``,
        `_${quote}_`,
        ``,
        divider,
        ``,
        `💎 ${cta}`,
        `   ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 7. Moonlight ───────────────────────────────────────────────────────────
  {
    name: 'Moonlight', weight: 3,
    render({ title, categoryEmoji, categoryDisplay, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `🌙 ─────────────────── 🌙`,
        `*${title}*`,
        `_${categoryEmoji} ${categoryDisplay} · Moonlit Drop_`,
        `🌙 ─────────────────── 🌙`,
        ``,
        `✦ *${countWord} Wallpapers* · Dropped at midnight`,
        ``,
        `_${desc}_`,
        ``,
        `_${quote}_`,
        ``,
        `🌐 ${cta}`,
        `   ${webUrl}`,
        ``,
        divider,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 8. Phantom ─────────────────────────────────────────────────────────────
  {
    name: 'Phantom', weight: 2,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        divider,
        ``,
        `👁 *${title}* 👁`,
        `_${categoryDisplay} · ${countWord} HD Wallpapers_`,
        ``,
        divider,
        ``,
        `_${desc}_`,
        ``,
        `〝 _${quote}_ 〞`,
        ``,
        `◈ *Upload HD PFP — No Crop*`,
        `◈ ${cta}`,
        `◈ ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 9. Crimson Cathedral ───────────────────────────────────────────────────
  {
    name: 'Crimson Cathedral', weight: 2,
    render({ title, categoryEmoji, categoryDisplay, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `✠ ════════════════════ ✠`,
        `*${title}*`,
        `${categoryEmoji} _${categoryDisplay} · ${countWord} Pieces_`,
        `✠ ════════════════════ ✠`,
        ``,
        `_${desc}_`,
        ``,
        `❝ _${quote}_ ❞`,
        ``,
        divider,
        ``,
        `${cta}`,
        `🔗 ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 10. Obsidian ──────────────────────────────────────────────────────────
  {
    name: 'Obsidian', weight: 2,
    render({ title, categoryEmoji, categoryDisplay, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `⬛ *${title}* ⬛`,
        ``,
        `${categoryEmoji} *${countWord} HD Wallpapers* · Pure Obsidian`,
        ``,
        divider,
        ``,
        `_${desc}_`,
        ``,
        `_${quote}_`,
        ``,
        divider,
        ``,
        `📲 ${cta}`,
        `   ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 11. Eclipse ────────────────────────────────────────────────────────────
  {
    name: 'Eclipse', weight: 2,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `◐ ──────────────────── ◑`,
        `  *${title}*`,
        `  _${categoryDisplay} · ${countWord} HD_`,
        `◑ ──────────────────── ◐`,
        ``,
        `_${desc}_`,
        ``,
        `✦ _${quote}_ ✦`,
        ``,
        `🌐 ${cta}`,
        `   ${webUrl}`,
        ``,
        divider,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 12. Raven ──────────────────────────────────────────────────────────────
  {
    name: 'Raven', weight: 2,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `🖤 *${title}* 🖤`,
        divider,
        `${categoryEmoji} ${categoryDisplay} — _${countWord} HD Wallpapers_`,
        divider,
        ``,
        `_${desc}_`,
        ``,
        `_${quote}_`,
        ``,
        `╭── 🌐 No-Crop PFP ──╮`,
        `│ ${cta}`,
        `│ ${webUrl}`,
        `╰────────────────────╯`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 13. Arcane ─────────────────────────────────────────────────────────────
  {
    name: 'Arcane', weight: 2,
    render({ title, categoryEmoji, categoryDisplay, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `🔮 *ARCANE DROP* 🔮`,
        ``,
        `╔══ ${categoryEmoji} *${title}* ══╗`,
        `║ ${categoryDisplay} · ${countWord} HD Wallpapers`,
        `╚══════════════════════╝`,
        ``,
        `_${desc}_`,
        ``,
        `✧ _${quote}_ ✧`,
        ``,
        divider,
        ``,
        `${cta}`,
        `🌐 ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 14. Monastery ──────────────────────────────────────────────────────────
  {
    name: 'Monastery', weight: 1,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `☩ ─────────────────────── ☩`,
        ``,
        `      *${title}*`,
        `      _${countWord} HD · ${categoryDisplay}_`,
        ``,
        `☩ ─────────────────────── ☩`,
        ``,
        `_${desc}_`,
        ``,
        divider,
        ``,
        `_${quote}_`,
        ``,
        divider,
        ``,
        `📿 ${cta}`,
        `   ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 15. Midnight ───────────────────────────────────────────────────────────
  {
    name: 'Midnight', weight: 3,
    render({ title, categoryEmoji, categoryDisplay, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `🌑 *${title}* 🌑`,
        `_${categoryEmoji} ${categoryDisplay}_`,
        ``,
        divider,
        ``,
        `*${countWord} HD Wallpapers* · Midnight release`,
        `_${desc}_`,
        ``,
        `_${quote}_`,
        ``,
        divider,
        ``,
        `🌐 *Full-HD PFP* · ${cta}`,
        `   ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 16. Sakura Noir ────────────────────────────────────────────────────────
  {
    name: 'Sakura Noir', weight: 2,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `🌸 ─── ⸸ ─── 🌸`,
        `*${title}*`,
        `_${categoryDisplay} · ${countWord} HD_`,
        `🌸 ─── ⸸ ─── 🌸`,
        ``,
        `_${desc}_`,
        ``,
        `〝 _${quote}_ 〞`,
        ``,
        divider,
        ``,
        `${cta}`,
        `🌸 ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 17. Kawaii Gothic ──────────────────────────────────────────────────────
  {
    name: 'Kawaii Gothic', weight: 2,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `🖤🌸🖤🌸🖤🌸🖤🌸🖤`,
        `*${title}*`,
        `${categoryEmoji} _${categoryDisplay}_`,
        `🖤🌸🖤🌸🖤🌸🖤🌸🖤`,
        ``,
        `✦ *${countWord} HD Wallpapers* ✦`,
        `_${desc}_`,
        ``,
        `_${quote}_`,
        ``,
        `🌸 ${cta}`,
        `   ${webUrl}`,
        ``,
        divider,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 18. Velvet ─────────────────────────────────────────────────────────────
  {
    name: 'Velvet', weight: 2,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `❖ ═══════════════════ ❖`,
        ``,
        `  *${title}*`,
        `  ${categoryEmoji} ${categoryDisplay}`,
        ``,
        `❖ ═══════════════════ ❖`,
        ``,
        `_${countWord} velvet-quality HD wallpapers._`,
        `_${desc}_`,
        ``,
        `_${quote}_`,
        ``,
        `💎 ${cta}`,
        `   ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 19. Celestial ──────────────────────────────────────────────────────────
  {
    name: 'Celestial', weight: 2,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `✧ ─── ⟡ ─── ✧ ─── ⟡ ─── ✧`,
        `*${categoryEmoji} ${title}*`,
        `_${categoryDisplay} · ${countWord} Stars_`,
        `✧ ─── ⟡ ─── ✧ ─── ⟡ ─── ✧`,
        ``,
        `_${desc}_`,
        ``,
        `✦ _${quote}_ ✦`,
        ``,
        divider,
        ``,
        `🌐 ${cta}`,
        `   ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 20. Inferno ────────────────────────────────────────────────────────────
  {
    name: 'Inferno', weight: 2,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `🔥 ━━━━━━━━━━━━━━━━━ 🔥`,
        `*${title}*`,
        `_${categoryEmoji} ${categoryDisplay} · ${countWord} HD_`,
        `🔥 ━━━━━━━━━━━━━━━━━ 🔥`,
        ``,
        `_${desc}_`,
        ``,
        `_${quote}_`,
        ``,
        `📲 ${cta}`,
        `🔗 ${webUrl}`,
        ``,
        divider,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 21. Sovereign ──────────────────────────────────────────────────────────
  {
    name: 'Sovereign', weight: 2,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `╔══════════════════════╗`,
        `║   👑 *SOVEREIGN DROP*  ║`,
        `╠══════════════════════╣`,
        `║  ${categoryEmoji} ${categoryDisplay}`,
        `║  *${title}*`,
        `║  _${countWord} HD Wallpapers_`,
        `╚══════════════════════╝`,
        ``,
        `_${desc}_`,
        ``,
        `_${quote}_`,
        ``,
        `🌐 ${cta}`,
        `   ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 22. Neon Abyss ─────────────────────────────────────────────────────────
  {
    name: 'Neon Abyss', weight: 2,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `⚡ ─── *${title}* ─── ⚡`,
        `${categoryEmoji} *${categoryDisplay}* · ${countWord} HD`,
        ``,
        divider,
        ``,
        `_${desc}_`,
        ``,
        `> ${quote}`,
        ``,
        `🔌 *No-Crop PFP:* ${cta}`,
        `🌐 ${webUrl}`,
        ``,
        divider,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 23. Ivory Tower ────────────────────────────────────────────────────────
  {
    name: 'Ivory Tower', weight: 1,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `┏━━━━━━━━━━━━━━━━━━━━━━━┓`,
        `┃  *${title}*`,
        `┃  ${categoryEmoji} ${categoryDisplay} — ${countWord} HD`,
        `┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
        ``,
        `_${desc}_`,
        ``,
        divider,
        `_${quote}_`,
        divider,
        ``,
        `📱 ${cta}`,
        `   ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 24. Blood Moon ─────────────────────────────────────────────────────────
  {
    name: 'Blood Moon', weight: 2,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `🌕 ── ⸸ ── 🌕`,
        ``,
        `*${title}*`,
        `_Blood Moon Edition · ${countWord} HD_`,
        `_${categoryEmoji} ${categoryDisplay}_`,
        ``,
        `🌕 ── ⸸ ── 🌕`,
        ``,
        `_${desc}_`,
        ``,
        `_${quote}_`,
        ``,
        `🔗 ${cta}`,
        `   ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 25. Ancient Tome ───────────────────────────────────────────────────────
  {
    name: 'Ancient Tome', weight: 1,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      const vol = String(Math.floor(Math.random() * 999) + 1).padStart(4, '0');
      return [
        `📜 ──────────────────── 📜`,
        `*§ ${title} §*`,
        `_Tome ${vol} · ${categoryDisplay} · ${countWord} HD_`,
        `📜 ──────────────────── 📜`,
        ``,
        `_${desc}_`,
        ``,
        `〝 _${quote}_ 〞`,
        ``,
        `✍️ ${cta}`,
        `   ${webUrl}`,
        ``,
        divider,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 26. Void Walker ────────────────────────────────────────────────────────
  {
    name: 'Void Walker', weight: 1,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `· · · · · · · · · · · ·`,
        ``,
        `${categoryEmoji} *${title}*`,
        `_${categoryDisplay} · ${countWord} HD Wallpapers_`,
        ``,
        `· · · · · · · · · · · ·`,
        ``,
        `_${desc}_`,
        ``,
        `_${quote}_`,
        ``,
        `🌐 ${cta}`,
        `   ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 27. Silver Basilica ────────────────────────────────────────────────────
  {
    name: 'Silver Basilica', weight: 1,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `╭──────────────────────╮`,
        `│  ✠ *${title}*`,
        `│  ${categoryEmoji} ${categoryDisplay} · ${countWord} HD`,
        `╰──────────────────────╯`,
        ``,
        `_${desc}_`,
        ``,
        divider,
        `_${quote}_`,
        divider,
        ``,
        `📲 ${cta}`,
        `   ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 28. Noir Chronicle ─────────────────────────────────────────────────────
  {
    name: 'Noir Chronicle', weight: 2,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      const edition = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
      return [
        `📰 *DAILY CHRONICLE · ED. ${edition}*`,
        divider,
        `*${title}*`,
        `_${categoryEmoji} ${categoryDisplay} · ${countWord} HD Wallpapers_`,
        divider,
        ``,
        `_${desc}_`,
        ``,
        `_${quote}_`,
        ``,
        `🔗 ${cta}`,
        `   ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 29. Storm Crest ────────────────────────────────────────────────────────
  {
    name: 'Storm Crest', weight: 2,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `⚡━━━━━━━━━━━━━━━━━━━⚡`,
        `*${title}*`,
        `⚡━━━━━━━━━━━━━━━━━━━⚡`,
        ``,
        `${categoryEmoji} *${categoryDisplay}* · _${countWord} HD Wallpapers_`,
        ``,
        `_${desc}_`,
        ``,
        `_${quote}_`,
        ``,
        divider,
        ``,
        `📲 ${cta}`,
        `🔗 ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 30. Amber Lantern ──────────────────────────────────────────────────────
  {
    name: 'Amber Lantern', weight: 1,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `🕯️ *${title}* 🕯️`,
        `_${categoryEmoji} ${categoryDisplay}_`,
        ``,
        divider,
        ``,
        `_${countWord} HD wallpapers, lit for tonight._`,
        `_${desc}_`,
        ``,
        `〝 _${quote}_ 〞`,
        ``,
        `🕯️ ${cta}`,
        `   ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 31. Iron Cathedral ─────────────────────────────────────────────────────
  {
    name: 'Iron Cathedral', weight: 1,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓`,
        `▓  *${title}*`,
        `▓  ${categoryEmoji} ${categoryDisplay} · ${countWord} HD`,
        `▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓`,
        ``,
        `_${desc}_`,
        ``,
        `_${quote}_`,
        ``,
        `⚙️ ${cta}`,
        `   ${webUrl}`,
        ``,
        divider,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 32. Frost Grimoire ─────────────────────────────────────────────────────
  {
    name: 'Frost Grimoire', weight: 1,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `❄ ══════════════════════ ❄`,
        `*${title}*`,
        `_${categoryEmoji} ${categoryDisplay} · ${countWord} HD_`,
        `❄ ══════════════════════ ❄`,
        ``,
        `_${desc}_`,
        ``,
        `_${quote}_`,
        ``,
        `🌐 ${cta}`,
        `   ${webUrl}`,
        ``,
        divider,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 33. Crimson Curtain ────────────────────────────────────────────────────
  {
    name: 'Crimson Curtain', weight: 1,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `🎭 *ACT I: ${title}* 🎭`,
        `_${categoryEmoji} ${categoryDisplay} — ${countWord} HD Wallpapers_`,
        ``,
        divider,
        ``,
        `_${desc}_`,
        ``,
        `_${quote}_`,
        ``,
        `🎭 ${cta}`,
        `   ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 34. Emerald Sanctum ────────────────────────────────────────────────────
  {
    name: 'Emerald Sanctum', weight: 1,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `🌿 ─────────────────── 🌿`,
        `*${title}*`,
        `_${categoryEmoji} ${categoryDisplay} · ${countWord} HD_`,
        `🌿 ─────────────────── 🌿`,
        ``,
        `_${desc}_`,
        ``,
        `✦ _${quote}_ ✦`,
        ``,
        `🌿 ${cta}`,
        `   ${webUrl}`,
        ``,
        divider,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 35. Opal Shrine ────────────────────────────────────────────────────────
  {
    name: 'Opal Shrine', weight: 1,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `✧ *${title}* ✧`,
        `_${categoryEmoji} ${categoryDisplay} · ${countWord} HD Wallpapers_`,
        ``,
        divider,
        ``,
        `_${desc}_`,
        ``,
        `✧ _${quote}_ ✧`,
        ``,
        divider,
        ``,
        `✨ ${cta}`,
        `   ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 36. Dark Sovereign ─────────────────────────────────────────────────────
  {
    name: 'Dark Sovereign', weight: 2,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `⸸ ══ *${title}* ══ ⸸`,
        `${categoryEmoji} _${categoryDisplay}_ · *${countWord} HD*`,
        ``,
        `_${desc}_`,
        ``,
        divider,
        ``,
        `_${quote}_`,
        ``,
        divider,
        ``,
        `🌐 ${cta}`,
        `   ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 37. Witching Hour ──────────────────────────────────────────────────────
  {
    name: 'Witching Hour', weight: 2,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `🕛 *WITCHING HOUR DROP* 🕛`,
        ``,
        `*${title}*`,
        `_${categoryEmoji} ${categoryDisplay}_`,
        ``,
        `✦ *${countWord} HD wallpapers* — handpicked`,
        ``,
        `_${desc}_`,
        ``,
        `_${quote}_`,
        ``,
        `🔮 ${cta}`,
        `🌐 ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 38. Shadow Library ─────────────────────────────────────────────────────
  {
    name: 'Shadow Library', weight: 2,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `📚 *SHADOW LIBRARY*`,
        divider,
        `${categoryEmoji} *${title}*`,
        `_${categoryDisplay} · ${countWord} HD Wallpapers_`,
        divider,
        ``,
        `_${desc}_`,
        ``,
        `〝 _${quote}_ 〞`,
        ``,
        `📖 ${cta}`,
        `   ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 39. Vesper ─────────────────────────────────────────────────────────────
  {
    name: 'Vesper', weight: 2,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `— *${title}* —`,
        `_${categoryEmoji} ${categoryDisplay} · ${countWord} HD_`,
        ``,
        `_${desc}_`,
        ``,
        divider,
        `_${quote}_`,
        divider,
        ``,
        `📲 ${cta}`,
        `   ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },

  // ── 40. Crown Edition ──────────────────────────────────────────────────────
  {
    name: 'Crown Edition', weight: 2,
    render({ title, categoryDisplay, categoryEmoji, desc, countWord, quote, cta, webUrl, hashtags, game, footer, divider }) {
      return [
        `👑 *CROWN EDITION*`,
        `╔══════════════════════╗`,
        `║  *${title}*`,
        `║  ${categoryEmoji} ${categoryDisplay} · ${countWord} HD`,
        `╚══════════════════════╝`,
        ``,
        `_${desc}_`,
        ``,
        `_${quote}_`,
        ``,
        `💎 ${cta}`,
        `   ${webUrl}`,
        ``,
        game,
        ``,
        footer,
        ``,
        hashtags.map(h => `#${h}`).join(' '),
      ].join('\n');
    }
  },
];

// ── Telegram reaction emojis (for AI game prompts) ────────────────────────────
const TG_REACTIONS = '❤️ 🔥 👍 👎 🥰 😍 🤩 😱 🤔 🤯 😢 🎉 💯 💔 😈 🌚 ⚡ 🏆 😎 🤷 😁 🙏 👌 😇 🕊️ 😨 😭 🤬 👏 🤣 🤭 🤡 🐋 🌭 🍌 😐 😑 🍓 🍾 💋 😴 🤓 👻 👀 🎃 🙈 🤝 ✍️ 🫠 👉 👴 🎄 ⛄ 💅 😜 🗿 🆒 🩷 🙊 🦄 😘 💊 👾 🙆 🙋 😡';

// ── Static Games (fallback) ────────────────────────────────────────────────────
const STATIC_GAMES = {
  anime: [
    '🌸✨ *WOULD YOU RATHER...?*\n❤️ Soft pastel anime aesthetic forever\nOR\n🔥 Dark moody anime aesthetic forever\nReact ❤️ or 🔥',
    '🎀💫 *PICK ONE*\n❤️ Cute & Soft\n🔥 Cold & Mysterious\n😍 Elegant & Graceful\nReact with one emoji.',
    '🌟 *RATE TODAY\'S DROP*\n👍 Good\n🔥 Fire\n🤩 Saving all of them\nReact honestly.',
    '🎭✨ *MAIN CHARACTER ENERGY?*\n🥰 Soft heroine\n😈 Fierce villain\n😎 Cool loner\nReact with your energy.',
    '🌸 *SAVE OR SKIP?*\n💯 Saving all\n👍 Maybe one\n🤔 Not today\nReact honestly.',
  ],
  dark_anime: [
    '🖤🌙 *WOULD YOU RATHER...?*\n💔 Black-and-red anime room forever\nOR\n🌚 Rainy anime city at midnight forever\nReact 💔 or 🌚',
    '🕯️ *YOUR DARK AESTHETIC?*\n🔥 Black & Red\n💔 Dark Purple\n🌚 Pure Black\nReact with your vibe.',
    '🌑 *HOW DARK IS YOUR AESTHETIC?*\n👍 Slightly dark\n🔥 Full dark mode\n😈 I live in the shadows\nReact honestly.',
    '⚰️✨ *PICK YOUR VILLAIN ERA*\n😈 Cold & Ruthless\n🌚 Mysterious & Silent\n💔 Broken & Dangerous\nReact with one emoji.',
  ],
  cute_anime: [
    '🌸🍬 *WOULD YOU RATHER...?*\n🥰 Kawaii pastel room forever\nOR\n❤️ Cozy lofi setup forever\nReact 🥰 or ❤️',
    '🎀🩷 *PICK YOUR AESTHETIC*\n🥰 Candy cute\n❤️ Soft pink\n😇 Cloud aesthetic\nReact with your pick.',
    '☁️✨ *SAVING ANY?*\n💯 Yes, all of them\n👍 Maybe one\n🤔 Not today\nReact honestly.',
    '🌷💕 *WHICH VIBE ARE YOU?*\n🥰 Sweet & Soft\n😁 Bubbly & Fun\n😇 Pure & Innocent\nReact with one emoji.',
  ],
  manhwa: [
    '👑🌹 *WOULD YOU RATHER...?*\n❤️ Main lead in a romance manhwa\nOR\n🔥 Main lead in an action manhwa\nReact ❤️ or 🔥',
    '💎✨ *YOUR TYPE?*\n🔥 Cold & Powerful\n❤️ Sweet & Caring\n😍 Mysterious\n🤩 All of the above\nReact with one emoji.',
    '🌸⚔️ *WHICH MANHWA ROLE?*\n😈 The cold CEO\n❤️ The soft romantic\n🔥 The powerful warrior\n🌚 The mysterious villain\nReact with your role.',
  ],
  cyberpunk: [
    '🌃⚡ *WOULD YOU RATHER...?*\n⚡ Neon cyberpunk city forever\nOR\n❤️ Peaceful nature village forever\nReact ⚡ or ❤️',
    '🔮💜 *YOUR CYBERPUNK VIBE?*\n🔥 Neon & Dangerous\n😍 Aesthetic & Clean\n💯 Both\nReact with your vibe.',
  ],
  amoled: [
    '⬛🌑 *WOULD YOU RATHER...?*\n🌚 Pure black phone forever\nOR\n🔥 Neon dark aesthetic forever\nReact 🌚 or 🔥',
    '🖤✨ *DARK MODE LEVEL?*\n👍 Always dark mode\n🔥 Dark + neon accents\n💯 Black everything\nReact honestly.',
  ],
  fantasy: [
    '🪽😈 *WOULD YOU RATHER...?*\n🕊️ Be an angel with wings\nOR\n😈 Be a demon with power\nReact 🕊️ or 😈',
    '🌟👑 *PICK YOUR FANTASY ROLE*\n🕊️ Angel\n😈 Demon\n🏆 Royal\n🔥 Dragon Rider\nReact with one emoji.',
  ],
  boys: [
    '🗡️💙 *WOULD YOU RATHER...?*\n❤️ Soft & caring anime boy\nOR\n🔥 Cold & powerful anime boy\nReact ❤️ or 🔥',
    '👑✨ *YOUR HUSBANDO TYPE?*\n❤️ Sweet & Gentle\n🔥 Cold & Intense\n😎 Cool & Mysterious\n🤩 Chaotic & Fun\nReact with one emoji.',
  ],
  japanese: [
    '⛩️🌸 *WOULD YOU RATHER...?*\n❤️ Live in a sakura-filled anime village\nOR\n🔥 Live in neon Tokyo at night\nReact ❤️ or 🔥',
    '🎋✨ *YOUR JAPAN AESTHETIC?*\n🥰 Soft & Zen\n🔥 Neon & Modern\n😍 Traditional & Elegant\nReact with your vibe.',
  ],
  aesthetic: [
    '✨💅 *WOULD YOU RATHER...?*\n❤️ Soft pastel aesthetic forever\nOR\n🔥 Dark moody aesthetic forever\nReact ❤️ or 🔥',
    '🌈🎨 *YOUR AESTHETIC VIBE?*\n🥰 Soft & Dreamy\n🔥 Bold & Edgy\n😍 Clean & Minimal\nReact with one emoji.',
  ],
  default: [
    '🎲✨ *WOULD YOU RATHER...?*\n👍 Have 100 wallpapers you love\nOR\n😍 Have 1 perfect wallpaper forever\nReact 👍 or 😍',
    '🏆🔥 *RATE TODAY\'S DROP*\n👍 Good\n🔥 Fire\n🤩 Best drop ever\nReact honestly.',
    '💫 *REACT WITH YOUR VIBE*\n🔥 Love it\n😍 Obsessed\n💯 Saving all\n🤔 Not my vibe',
    '🌟 *SAVE OR SKIP?*\n💯 Saving at least one\n🤔 Not today\nReact honestly.',
    '🎭✨ *FIRST IMPRESSION?*\n🤩 Obsessed\n❤️ Love it\n👍 It\'s good\n😐 Meh\nReact honestly.',
  ],
};

const GAME_TYPES = [
  'Would You Rather (dramatic, make users hesitate)',
  'Pick One (4 emoji options)',
  'Rate the Drop (3 emoji tiers)',
  'This or That (2 dramatic choices)',
  'Main Character Energy (which role are you)',
  'Emoji Poll (react with your vibe)',
];

const _lastGame = {};
const _lastAIGameType = {};

function pickStaticGame(category) {
  const pool = get(STATIC_GAMES, category);
  const last = _lastGame[category];
  const fresh = pool.filter(g => g !== last);
  const chosen = pick(fresh.length ? fresh : pool);
  _lastGame[category] = chosen;
  return chosen;
}

// ── AI Game Generator ──────────────────────────────────────────────────────────
async function generateLiveGame(category, categoryName) {
  try {
    const last = _lastAIGameType[category] || '';
    const fresh = GAME_TYPES.filter(g => g !== last);
    const gameType = pick(fresh.length ? fresh : GAME_TYPES);
    _lastAIGameType[category] = gameType;

    const shortPrompt = `Create a ${gameType} game for a ${categoryName} wallpaper channel drop. The game title and description can use any fitting emoji. But the REACT options at the end MUST only use emojis from this list: ${TG_REACTIONS}. Use WhatsApp *bold* for title only. Max 5 lines. End with React [emoji] or [emoji].`;

    const r = await axios.get('https://prexzyapis.com/ai/chatbot', {
      params: { text: shortPrompt },
      timeout: 10000,
    });

    const raw = r.data?.data?.response || '';
    if (!raw || raw.length < 15 || raw.length > 600) return null;

    return raw
      .replace(/\*\*([^*]+)\*\*/g, '*$1*')
      .replace(/```[\s\S]*?```/g, '')
      .trim();
  } catch (e) {
    logger.warn('Editorial AI game: ' + e.message);
    return null;
  }
}

// ── AI Description Generator ───────────────────────────────────────────────────
async function generateAIDescription({ category, categoryName, mood, count, keywords = [] }) {
  try {
    const keywordHint = keywords.length ? ` Keywords: ${keywords.slice(0, 3).join(', ')}.` : '';
    const prompt = `You are writing a caption for a premium WhatsApp wallpaper channel drop. Category: ${categoryName}. Mood: ${mood}. ${count} HD wallpapers.${keywordHint} Write exactly 1-2 sentences in italic-compatible plain text (no markdown symbols). Make it feel curated, aesthetic, and premium — not generic. No hashtags. No emojis. Max 120 characters. Just the description text.`;

    const r = await axios.get('https://prexzyapis.com/ai/chatbot', {
      params: { text: prompt },
      timeout: 8000,
    });

    const raw = (r.data?.data?.response || '').trim();
    if (!raw || raw.length < 10 || raw.length > 200) return null;

    // Clean up any markdown bold/italic/backticks
    return raw
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`[^`]+`/g, '')
      .replace(/^[""]|[""]$/g, '')
      .trim();
  } catch (e) {
    logger.warn('Editorial AI description: ' + e.message);
    return null;
  }
}

// ── Count to word ──────────────────────────────────────────────────────────────
const COUNT_WORDS = ['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten'];

// ── Main Caption Builder ───────────────────────────────────────────────────────
async function buildEditorialCaption({
  category,
  categoryName,
  categoryEmoji = '✨',
  count,
  mood,
  hashtags = [],
  webUrl,
  platform = 'channel',  // 'channel' | 'group'
  keywords = [],
}) {
  const countWord = COUNT_WORDS[count] || String(count);

  // Pick random elements
  const title = pick(get(TITLES, category));
  const quote  = pick(QUOTES);
  const footer = pick(FOOTERS);
  const divider = pick(DIVIDERS);

  // Platform-specific CTA list
  const ctaPool = platform === 'group' ? CTAS_GROUP : CTAS_CHANNEL;
  const cta = pick(ctaPool);

  // AI description — falls back to static
  const aiDesc = await generateAIDescription({ category, categoryName, mood, count, keywords });
  const desc = aiDesc || pick(get(DESCS, category));

  // AI or static game
  const aiGame = await generateLiveGame(category, categoryName);
  const game   = aiGame || pickStaticGame(category);

  // Pick template with anti-repeat
  const template = pickTemplate();
  trackTemplate(template.name);

  logger.debug(`WA caption template: ${template.name} | platform: ${platform}`);

  const rendered = template.render({
    title,
    categoryEmoji,
    categoryDisplay: categoryName,
    desc,
    count,
    countWord,
    quote,
    cta,
    webUrl,
    hashtags: hashtags.slice(0, 6),
    game,
    footer,
    divider,
    platform,
  });

  // Collapse excessive blank lines (max 2 consecutive newlines)
  return rendered.replace(/\n{3,}/g, '\n\n').trim();
}

module.exports = { buildEditorialCaption, generateLiveGame, pickStaticGame };
