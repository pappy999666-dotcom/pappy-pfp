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
// Telegram default reaction emojis
const TG_REACTIONS = ['🤣','❤️','👍','👎','🔥','🥰','👏','😁','🤔','🤯','😱','🤬','😢','🎉','🤩','🤮','💩','🙏','👌','🕊️','🤡','🤭','😍','🐋','❤️‍🔥','🌚','🌭','💯','⚡','🍌','🏆','💔','😐','😑','🍓','🍾','💋','😈','😴','😭','🤓','👻','👀','🎃','🙈','😇','😨','🤝','✍️','🫠','👉','👴','🎄','⛄','💅','😜','🗿','🆒','🩷','🙊','🦄','😘','💊','😎','👾','🤷','🙆','🙋','😡'];

const STATIC_GAMES = {
  anime: [
    '🎲 *WOULD YOU RATHER...?*\n❤️ Soft pastel anime aesthetic forever\nOR\n🔥 Dark moody anime aesthetic forever\nReact ❤️ or 🔥',
    '🥰 *PICK ONE*\n❤️ Cute & Soft\n🔥 Cold & Mysterious\n😍 Elegant & Graceful\nReact with one emoji.',
    '🏆 *RATE TODAY\'S DROP*\n👍 Good\n🔥 Fire\n🤩 Saving all of them\nReact honestly.',
    '🤔 *MAIN CHARACTER ENERGY?*\n🥰 Soft heroine\n😈 Fierce villain\n😎 Cool loner\nReact with your energy.',
  ],
  dark_anime: [
    '🎲 *WOULD YOU RATHER...?*\n💔 Black-and-red anime room forever\nOR\n🌚 Rainy anime city at midnight forever\nReact 💔 or 🌚',
    '😱 *YOUR DARK AESTHETIC?*\n🔥 Black & Red\n💔 Dark Purple\n🌚 Pure Black\nReact with your vibe.',
    '🤔 *HOW DARK IS YOUR AESTHETIC?*\n👍 Slightly dark\n🔥 Full dark mode\n😈 I live in the shadows\nReact honestly.',
    '😈 *PICK YOUR VILLAIN ERA*\n😈 Cold & Ruthless\n🌚 Mysterious & Silent\n💔 Broken & Dangerous\nReact with one emoji.',
  ],
  cute_anime: [
    '🎲 *WOULD YOU RATHER...?*\n🥰 Kawaii pastel room forever\nOR\n❤️ Cozy lofi setup forever\nReact 🥰 or ❤️',
    '🩷 *PICK YOUR AESTHETIC*\n🥰 Candy cute\n❤️ Soft pink\n😇 Cloud aesthetic\nReact with your pick.',
    '💯 *SAVING ANY?*\n💯 Yes, all of them\n👍 Maybe one\n🤔 Not today\nReact honestly.',
    '🤩 *WHICH VIBE ARE YOU?*\n🥰 Sweet & Soft\n😁 Bubbly & Fun\n😇 Pure & Innocent\nReact with one emoji.',
  ],
  manhwa: [
    '🎲 *WOULD YOU RATHER...?*\n❤️ Main lead in a romance manhwa\nOR\n🔥 Main lead in an action manhwa\nReact ❤️ or 🔥',
    '👑 *YOUR TYPE?*\n🔥 Cold & Powerful\n❤️ Sweet & Caring\n😍 Mysterious\n🤩 All of the above\nReact with one emoji.',
    '😱 *WHICH MANHWA ROLE?*\n😈 The cold CEO\n❤️ The soft romantic\n🔥 The powerful warrior\n🌚 The mysterious villain\nReact with your role.',
  ],
  cyberpunk: [
    '🎲 *WOULD YOU RATHER...?*\n⚡ Neon cyberpunk city forever\nOR\n❤️ Peaceful nature village forever\nReact ⚡ or ❤️',
    '⚡ *YOUR CYBERPUNK VIBE?*\n🔥 Neon & Dangerous\n😍 Aesthetic & Clean\n💯 Both\nReact with your vibe.',
  ],
  amoled: [
    '🎲 *WOULD YOU RATHER...?*\n🌚 Pure black phone forever\nOR\n🔥 Neon dark aesthetic forever\nReact 🌚 or 🔥',
    '🌚 *DARK MODE LEVEL?*\n👍 Always dark mode\n🔥 Dark + neon accents\n💯 Black everything\nReact honestly.',
  ],
  fantasy: [
    '🎲 *WOULD YOU RATHER...?*\n🕊️ Be an angel with wings\nOR\n😈 Be a demon with power\nReact 🕊️ or 😈',
    '🤩 *PICK YOUR FANTASY ROLE*\n🕊️ Angel\n😈 Demon\n🏆 Royal\n🔥 Dragon Rider\nReact with one emoji.',
  ],
  boys: [
    '🎲 *WOULD YOU RATHER...?*\n❤️ Soft & caring anime boy\nOR\n🔥 Cold & powerful anime boy\nReact ❤️ or 🔥',
    '😍 *YOUR HUSBANDO TYPE?*\n❤️ Sweet & Gentle\n🔥 Cold & Intense\n😎 Cool & Mysterious\n🤩 Chaotic & Fun\nReact with one emoji.',
  ],
  default: [
    '🎲 *WOULD YOU RATHER...?*\n👍 Have 100 wallpapers you love\nOR\n😍 Have 1 perfect wallpaper forever\nReact 👍 or 😍',
    '🏆 *RATE TODAY\'S DROP*\n👍 Good\n🔥 Fire\n🤩 Best drop ever\nReact honestly.',
    '🔥 *REACT WITH YOUR VIBE*\n🔥 Love it\n😍 Obsessed\n💯 Saving all\n🤔 Not my vibe',
    '💯 *SAVE OR SKIP?*\n💯 Saving at least one\n🤔 Not today\nReact honestly.',
    '🤩 *FIRST IMPRESSION?*\n🤩 Obsessed\n❤️ Love it\n👍 It\'s good\n😐 Meh\nReact honestly.',
  ],
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

    // Short direct prompt — specify exact Telegram reaction emojis
    const tgEmojis = '❤️ 🔥 👍 👎 🥰 😍 🤩 😱 🤔 🤯 😢 🎉 💯 💔 😈 🌚 ⚡ 🏆 😎 🤷 😁 🙏 👌 😇 🕊️ 😨 😭 🤬 👏';
    const shortPrompt = `${gameType} game for ${categoryName} wallpaper drop. Use ONLY these emojis: ${tgEmojis}. WhatsApp *bold* title, max 5 lines, end with React instructions.`;

    const r = await axios.get('https://prexzyapis.com/ai/chatbot', {
      params: { text: shortPrompt },
      timeout: 10000,
    });

    const raw = r.data?.data?.response || '';
    if (!raw || raw.length < 15 || raw.length > 600) return null;

    // Convert **bold** → *bold*, strip triple backticks
    return raw
      .replace(/\*\*([^*]+)\*\*/g, '*$1*')
      .replace(/```[\s\S]*?```/g, '')
      .trim();
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

module.exports = { buildEditorialCaption, generateLiveGame, pickStaticGame };
