'use strict';
const axios = require('axios');
const logger = require('../utils/logger');

// ── ASCII Styles (weighted) ───────────────────────────────────────────────────
const ASCII = [
  { top: '୨ৎ ────────────── ୨ৎ', bot: '୨ৎ ────────────── ୨ৎ', w: 5 },
  { top: '✦ ━━━━━━━━━━━━━━ ✦',   bot: '✦ ━━━━━━━━━━━━━━ ✦',   w: 4 },
  { top: '╭──────────────────╮',  bot: '╰──────────────────╯',  w: 3 },
  { top: '❀ ──────────────── ❀',  bot: '❀ ──────────────── ❀',  w: 3 },
  { top: '┏━━━━━━━━━━━━━━━━━━┓',  bot: '┗━━━━━━━━━━━━━━━━━━┛',  w: 2 },
  { top: '· · · · · · · · · ·',  bot: '· · · · · · · · · ·',  w: 2 },
  { top: '◈ ──────────────── ◈',  bot: '◈ ──────────────── ◈',  w: 1 },
  { top: '╔══════════════════╗',  bot: '╚══════════════════╝',  w: 1 },
];

// ── Titles ────────────────────────────────────────────────────────────────────
const TITLES = {
  anime:              ['🌸 ANIME GIRLS DROP', '🎀 SOFT GIRL COLLECTION', '✨ ANIME PFP PACK', '🌙 HEROINE PORTRAITS', '💫 AESTHETIC ANIME DROP'],
  dark_anime:         ['🖤 DARK AESTHETIC DROP', '🌑 SHADOW COLLECTION', '🕯️ GOTHIC ANIME PACK', '⚡ DARK ENERGY DROP', '🌒 MIDNIGHT AESTHETIC'],
  cute_anime:         ['🌸 KAWAII DROP', '🍬 CUTE ANIME PACK', '🎀 SOFT PASTEL COLLECTION', '☁️ COZY ANIME DROP', '🩷 SWEET AESTHETIC'],
  manhwa:             ['👑 MANHWA COLLECTION', '📖 WEBTOON DROP', '🌹 ROMANCE FANTASY PACK', '✨ KOREAN WEBTOON PICKS', '💎 MANHWA ROYALS'],
  cyberpunk:          ['🌃 CYBERPUNK DROP', '⚡ NEON CITY PACK', '🔮 FUTURISTIC COLLECTION', '💜 NEON AESTHETIC DROP'],
  amoled:             ['⬛ AMOLED DROP', '🖤 PURE BLACK PACK', '🌑 OLED COLLECTION', '⚫ DARK WALLPAPER DROP'],
  fantasy:            ['🪽 FANTASY DROP', '👼 ANGEL & DEMON PACK', '🌟 ROYAL FANTASY COLLECTION', '✨ ETHEREAL DROP'],
  japanese:           ['⛩️ JAPANESE AESTHETIC', '🌸 SAKURA COLLECTION', '🎋 ZEN DROP', '🌙 JAPAN AESTHETIC'],
  aesthetic:          ['✨ TRENDING PFP PACK', '🎨 AESTHETIC DROP', '💅 PINTEREST FINDS', '🌟 SAVE-WORTHY DROP'],
  boys:               ['🗡️ ANIME BOYS DROP', '👑 HUSBANDO PACK', '⚔️ MALE LEAD COLLECTION', '🌙 DARK BOY AESTHETIC'],
  pappy_cute_pfp:     ['🌸 CUTE PFP DROP', '🎀 ADORABLE PACK', '🩷 SOFT PFP COLLECTION'],
  pappy_black_anime:  ['🖤 BLACK ANIME DROP', '🌑 DARK AESTHETIC PACK', '⚫ MOODY COLLECTION'],
  pappy_manhwa_dark:  ['👑 DARK MANHWA DROP', '🌑 VILLAIN AESTHETIC', '⚔️ DARK WEBTOON PACK'],
  pappy_digital_art:  ['🎨 DIGITAL ART DROP', '✨ PIXIV COLLECTION', '🖌️ ART PACK'],
  pappy_girly_pfp:    ['🖤 GIRLY PFP DROP', '💅 AESTHETIC GIRLS PACK', '🌸 GIRLY COLLECTION'],
  pappy_anime_hd:     ['🎌 ANIME HD DROP', '✨ ULTRA HD PACK', '💫 HIGH RES COLLECTION'],
  default:            ['🔥 DAILY DROP', '✨ TODAY\'S COLLECTION', '💫 FRESH PICKS', '🌟 PREMIUM DROP', '📌 PINTEREST FINDS'],
};

// ── Descriptions ──────────────────────────────────────────────────────────────
const DESCS = {
  anime:      ['Pinterest-worthy portraits you\'ll instantly save.', 'The kind of wallpapers that deserve your lockscreen.', 'Soft-glow heroines, curated for saves and shares.'],
  dark_anime: ['Moody shadows and gothic romance. Save-worthy.', 'For those who live in the dark aesthetic.', 'The kind of dark art that stops your scroll.'],
  cute_anime: ['Pastel and cozy — adorable saves for your feed.', 'Maximum cuteness, minimum effort to save.', 'Soft, sweet, and perfectly aesthetic.'],
  manhwa:     ['Romance-fantasy leads and polished webtoon visuals.', 'Manhwa royals and webtoon aesthetics, curated.'],
  cyberpunk:  ['Neon rain, lofi city nights, futuristic edits.', 'For those who live in the neon city.'],
  amoled:     ['Deep blacks, neon edges, OLED-safe contrast.', 'Maximum contrast. Minimum battery drain.'],
  fantasy:    ['Angel wings, demon aura, royal fantasy drama.', 'Where angels and demons collide.'],
  japanese:   ['Sakura, shrine nights, clean Japan-inspired compositions.', 'Zen vibes and Tokyo nights.'],
  default:    ['Fresh aesthetic finds for today\'s collection.', 'Minimal. Clean. Save-worthy.', 'Curated for saves, shares, and profile pictures.'],
};

// ── CTAs ──────────────────────────────────────────────────────────────────────
const CTAS = [
  '📲 Upload this as your WhatsApp PFP — no crop, full quality.',
  '🌐 No crop. No quality loss. Upload in full resolution.',
  '✨ Keep the original quality. Upload full-size. One tap.',
  '💎 Your PFP deserves full quality. No crop. Upload now.',
  '📱 Full-size WhatsApp PFP upload — no crop, HD quality.',
  '🌐 Upload without losing quality. No crop. One tap.',
  '✨ Set this as your PFP without WhatsApp cropping it.',
  '💫 Full resolution. No compression. One tap upload.',
];

// ── Fallback Static Games ─────────────────────────────────────────────────────
const STATIC_GAMES = {
  anime:      ['🎲 *𝗪𝗢𝗨𝗟𝗗 𝗬𝗢𝗨 𝗥𝗔𝗧𝗛𝗘𝗥...?*\n🌸 Have a soft pastel anime aesthetic forever...\nOR\n🖤 Have a dark moody anime aesthetic forever...\nReact 🌸 or 🖤', '💖 *𝗣𝗜𝗖𝗞 𝗢𝗡𝗘*\n🌸 Cute & Soft\n🖤 Cold & Mysterious\n✨ Elegant & Graceful\nReact with one emoji.'],
  dark_anime: ['🎲 *𝗪𝗢𝗨𝗟𝗗 𝗬𝗢𝗨 𝗥𝗔𝗧𝗛𝗘𝗥...?*\n🖤 Have a black-and-red anime room...\nOR\n🌙 Live forever in a rainy anime city at midnight...\nReact 🖤 or 🌙', '⚡ *𝗬𝗢𝗨𝗥 𝗗𝗔𝗥𝗞 𝗔𝗘𝗦𝗧𝗛𝗘𝗧𝗜𝗖?*\n🖤 Black & Red\n💜 Dark Purple\n🌑 Pure Black\nReact with your vibe.'],
  cute_anime: ['🎲 *𝗪𝗢𝗨𝗟𝗗 𝗬𝗢𝗨 𝗥𝗔𝗧𝗛𝗘𝗥...?*\n🌸 Have a kawaii pastel room forever...\nOR\n☕ Have a cozy lofi setup forever...\nReact 🌸 or ☕', '🍬 *𝗣𝗜𝗖𝗞 𝗬𝗢𝗨𝗥 𝗔𝗘𝗦𝗧𝗛𝗘𝗧𝗜𝗖*\n🍬 Candy cute\n🌸 Soft pink\n☁️ Cloud aesthetic\nReact with your pick.'],
  manhwa:     ['🎲 *𝗪𝗢𝗨𝗟𝗗 𝗬𝗢𝗨 𝗥𝗔𝗧𝗛𝗘𝗥...?*\n💕 Be the main lead in a romance manhwa...\nOR\n⚔️ Be the main lead in an action manhwa...\nReact 💕 or ⚔️', '👑 *𝗬𝗢𝗨𝗥 𝗧𝗬𝗣𝗘?*\n⚔️ Cold Duke\n🩶 Green Flag\n❤️ Red Flag\n✨ Golden Retriever\nReact with one emoji.'],
  cyberpunk:  ['🎲 *𝗪𝗢𝗨𝗟𝗗 𝗬𝗢𝗨 𝗥𝗔𝗧𝗛𝗘𝗥...?*\n⚡ Live in a neon cyberpunk city forever...\nOR\n🌿 Live in a peaceful nature village forever...\nReact ⚡ or 🌿'],
  default:    ['🎲 *𝗪𝗢𝗨𝗟𝗗 𝗬𝗢𝗨 𝗥𝗔𝗧𝗛𝗘𝗥...?*\n📱 Have 100 wallpapers you love...\nOR\n💎 Have 1 perfect wallpaper forever...\nReact 📱 or 💎', '⭐ *𝗥𝗔𝗧𝗘 𝗧𝗢𝗗𝗔𝗬\'𝗦 𝗗𝗥𝗢𝗣*\n⭐ Good\n🔥 Fire\n💎 Best drop ever\nReact honestly.', '🔥 *𝗥𝗘𝗔𝗖𝗧 𝗪𝗜𝗧𝗛 𝗬𝗢𝗨𝗥 𝗩𝗜𝗕𝗘*\n🔥 Love it\n😍 Obsessed\n💾 Saving all\n🤷 Not my vibe'],
};

const CLOSINGS = [
  'Follow for daily drops. 🔔',
  'More drops coming. Stay tuned. ✨',
  'Save your faves before they\'re gone. 💾',
  'Share with someone who needs a new wallpaper. 🔁',
  'Drop a 🔥 if you\'re saving any of these.',
  'Tag someone who\'d love this drop. 👇',
  'React to let us know you want more. 🙌',
  'Daily drops, every day. 📲',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function weighted(arr) {
  const total = arr.reduce((s, x) => s + (x.w || 1), 0);
  let r = Math.random() * total;
  for (const x of arr) { r -= (x.w || 1); if (r <= 0) return x; }
  return arr[arr.length - 1];
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function get(map, cat) { return map[cat] || map[cat?.split('_')[0]] || map.default || []; }

// Track last game per category to avoid repeats
const _lastGame = {};

function pickStaticGame(category) {
  const pool = get(STATIC_GAMES, category);
  const last = _lastGame[category];
  const fresh = pool.filter(g => g !== last);
  const chosen = pick(fresh.length ? fresh : pool);
  _lastGame[category] = chosen;
  return chosen;
}

// ── Live AI Game via Prexzy ───────────────────────────────────────────────────
const GAME_TYPES = [
  'Would You Rather (dramatic, make users hesitate)',
  'Pick One (4 emoji options)',
  'Rate the Drop (3 emoji tiers)',
  'This or That (2 dramatic choices)',
  'Main Character Energy (which role are you)',
  'Emoji Poll (react with your vibe)',
];

const _lastAIGameType = {};

async function generateLiveGame(category, categoryName) {
  try {
    // Rotate game types
    const last = _lastAIGameType[category] || '';
    const fresh = GAME_TYPES.filter(g => g !== last);
    const gameType = pick(fresh.length ? fresh : GAME_TYPES);
    _lastAIGameType[category] = gameType;

    const prompt = `You are the editor of a viral anime wallpaper WhatsApp channel.
Today's drop: *${categoryName}* wallpapers.
Create ONE interactive reaction game of type: ${gameType}

Rules:
- Theme MUST be related to ${categoryName}
- Use WhatsApp bold: *bold text* (single asterisk, NOT double)
- Use bold for the game title only
- Include 2-4 emoji reaction options
- Max 6 lines total
- End with "React [emoji] or [emoji]" or "React with one emoji"
- No markdown, no headers, no explanation
- Make it dramatic and fun — stop-scrolling quality

Output ONLY the game text. Nothing else.`;

    const r = await axios.get('https://prexzyapis.com/ai/chatbot', {
      params: { text: prompt },
      timeout: 10000,
    });

    const raw = r.data?.data?.response || '';
    if (!raw || raw.length < 20 || raw.length > 500) return null;

    // Clean up: convert **bold** to *bold* for WhatsApp
    return raw.replace(/\*\*([^*]+)\*\*/g, '*$1*').trim();
  } catch (e) {
    logger.warn('Editorial AI game: ' + e.message);
    return null;
  }
}

// ── Main Caption Builder ──────────────────────────────────────────────────────
async function buildEditorialCaption({ category, categoryName, count, mood, hashtags, webUrl }) {
  const countWord = ['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten'][count] || String(count);

  const ascii   = weighted(ASCII);
  const title   = pick(get(TITLES, category));
  const desc    = pick(get(DESCS, category));
  const cta     = pick(CTAS);
  const closing = pick(CLOSINGS);
  const tags    = hashtags.slice(0, 6).map(t => `#${t}`).join(' ');

  // Live AI game — fall back to static if AI fails
  const aiGame = await generateLiveGame(category, categoryName);
  const game   = aiGame || pickStaticGame(category);

  // 3 rotating layouts so every drop looks different
  const layouts = [
    [
      ascii.top,
      `*${title}*`,
      ascii.bot,
      ``,
      `_${desc}_`,
      `♡ *${countWord} HD Wallpapers* · Fresh today`,
      ``,
      `╭─ 🌐 *Full-Size WhatsApp PFP* ─╮`,
      `│ ${cta}`,
      `│ ${webUrl}`,
      `╰────────────────────╯`,
      ``,
      game,
      ``,
      closing,
      ``,
      tags,
    ],
    [
      `*${title}*`,
      ascii.top,
      `_${desc}_`,
      `✦ *${countWord} HD Wallpapers* · Curated today`,
      ascii.bot,
      ``,
      game,
      ``,
      `🌐 *${cta}*`,
      webUrl,
      ``,
      closing,
      ``,
      tags,
    ],
    [
      ascii.top,
      `*${title}*`,
      `♡ *${countWord} HD Wallpapers*`,
      ascii.bot,
      ``,
      `_${desc}_`,
      ``,
      cta,
      `🌐 ${webUrl}`,
      ``,
      game,
      ``,
      tags,
      ``,
      closing,
    ],
  ];

  return pick(layouts).filter(l => l !== undefined).join('\n');
}

module.exports = { buildEditorialCaption };
