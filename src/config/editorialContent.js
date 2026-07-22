'use strict';
// ── Editorial Content Library ─────────────────────────────────────────────────
// All content is stored here. Add new entries freely without touching engine logic.

const ASCII_STYLES = [
  // weight: how often it appears (higher = more frequent)
  { style: 'dash',     top: '━━━━━━━━━━━━━━━━━━━━', bottom: '━━━━━━━━━━━━━━━━━━━━', weight: 3 },
  { style: 'bengali',  top: '୨ৎ ────────────── ୨ৎ', bottom: '୨ৎ ────────────── ୨ৎ', weight: 4 },
  { style: 'star',     top: '✦ ━━━━━━━━━━━━━━━━ ✦', bottom: '✦ ━━━━━━━━━━━━━━━━ ✦', weight: 3 },
  { style: 'flower',   top: '✿ ──────────────── ✿', bottom: '✿ ──────────────── ✿', weight: 2 },
  { style: 'box',      top: '╭──────────────────╮', bottom: '╰──────────────────╯', weight: 2 },
  { style: 'double',   top: '╔══════════════════╗', bottom: '╚══════════════════╝', weight: 1 },
  { style: 'heavy',    top: '┏━━━━━━━━━━━━━━━━━━┓', bottom: '┗━━━━━━━━━━━━━━━━━━┛', weight: 1 },
  { style: 'blossom',  top: '❀ ──────────────── ❀', bottom: '❀ ──────────────── ❀', weight: 2 },
  { style: 'diamond',  top: '◈ ──────────────── ◈', bottom: '◈ ──────────────── ◈', weight: 1 },
  { style: 'minimal',  top: '· · · · · · · · · ·', bottom: '· · · · · · · · · ·', weight: 2 },
];

const TITLE_TEMPLATES = {
  anime:           ['🌸 ANIME GIRLS DROP', '🎀 SOFT GIRL COLLECTION', '✨ ANIME PFP PACK', '🌙 HEROINE PORTRAITS', '💫 AESTHETIC ANIME DROP'],
  dark_anime:      ['🖤 DARK AESTHETIC DROP', '🌑 SHADOW COLLECTION', '🕯️ GOTHIC ANIME PACK', '⚡ DARK ENERGY DROP', '🌒 MIDNIGHT AESTHETIC'],
  cute_anime:      ['🌸 KAWAII DROP', '🍬 CUTE ANIME PACK', '🎀 SOFT PASTEL COLLECTION', '☁️ COZY ANIME DROP', '🌷 ADORABLE PFP PACK'],
  manhwa:          ['👑 MANHWA COLLECTION', '📖 WEBTOON DROP', '🌹 ROMANCE FANTASY PACK', '✨ KOREAN WEBTOON PICKS', '💎 MANHWA ROYALS'],
  cyberpunk:       ['🌃 CYBERPUNK DROP', '⚡ NEON CITY PACK', '🔮 FUTURISTIC COLLECTION', '💜 NEON AESTHETIC DROP', '🌆 CYBER NIGHTS'],
  amoled:          ['⬛ AMOLED DROP', '🖤 PURE BLACK PACK', '🌑 OLED COLLECTION', '⚫ DARK WALLPAPER DROP', '🔲 AMOLED PICKS'],
  fantasy:         ['🪽 FANTASY DROP', '👼 ANGEL & DEMON PACK', '🌟 ROYAL FANTASY COLLECTION', '✨ ETHEREAL DROP', '🔮 MAGIC REALM PICKS'],
  japanese:        ['⛩️ JAPANESE AESTHETIC', '🌸 SAKURA COLLECTION', '🎋 ZEN DROP', '🏯 TOKYO NIGHTS PACK', '🌙 JAPAN AESTHETIC'],
  aesthetic:       ['✨ TRENDING PFP PACK', '🎨 AESTHETIC DROP', '💅 PINTEREST PICKS', '🌈 VIBE COLLECTION', '🌟 SAVE-WORTHY DROP'],
  boys:            ['🗡️ ANIME BOYS DROP', '👑 HUSBANDO PACK', '⚔️ MALE LEAD COLLECTION', '🌙 DARK BOY AESTHETIC', '💙 ANIME BOYS PICKS'],
  default:         ['🔥 DAILY DROP', '✨ TODAY\'S COLLECTION', '💫 FRESH PICKS', '🌟 PREMIUM DROP', '🎯 CURATED PACK'],
};

const DESCRIPTIONS = {
  anime:      ['Pinterest-worthy wallpapers you\'ll instantly save.', 'Soft-glow heroine portraits for your feed.', 'Aesthetic anime girls, curated for saves and shares.', 'Perfect for lockscreen and profile pictures.'],
  dark_anime: ['Moody shadows and gothic romance, premium edit material.', 'Dark aesthetic finds for your collection.', 'For those who live in the shadows.', 'Edgy, dark, and absolutely save-worthy.'],
  cute_anime: ['Pastel and cozy — adorable saves for Gen Z feeds.', 'Kawaii energy, maximum cuteness.', 'Soft, sweet, and perfectly aesthetic.', 'Your daily dose of cute anime goodness.'],
  manhwa:     ['Romance-fantasy leads and polished Korean webtoon visuals.', 'Manhwa royals and webtoon aesthetics.', 'Korean webtoon picks, curated for saves.', 'Premium manhwa art for your collection.'],
  cyberpunk:  ['Neon rain, lofi city nights, futuristic edits.', 'Cyberpunk aesthetics for the digital age.', 'Neon-lit streets and futuristic vibes.', 'For those who live in the neon city.'],
  amoled:     ['Deep blacks, neon edges, OLED-safe contrast.', 'Pure black wallpapers for AMOLED screens.', 'Battery-saving beauty for your phone.', 'Maximum contrast, minimum battery drain.'],
  fantasy:    ['Angel wings, demon aura, royal fantasy drama.', 'Ethereal fantasy art for your collection.', 'Where angels and demons collide.', 'Fantasy worlds, curated for your screen.'],
  japanese:   ['Sakura, shrine nights, clean Japan-inspired compositions.', 'Japanese aesthetic at its finest.', 'Zen vibes and Tokyo nights.', 'Clean, minimal, and deeply aesthetic.'],
  default:    ['Fresh aesthetic finds for today\'s collection.', 'Minimal. Clean. Save-worthy.', 'Curated for saves, shares, and profile pictures.', 'Premium wallpapers, handpicked for you.'],
};

const CTA_TEMPLATES = [
  'Upload this as your WhatsApp profile picture — no crop, full quality.',
  'Set this as your PFP without WhatsApp cropping it. One tap.',
  'Upload in full resolution. No crop. No quality loss.',
  'Keep the original quality. Upload full-size. One tap.',
  'Your PFP deserves full quality. No crop. Upload now.',
  'Full-size WhatsApp PFP upload — no crop, HD quality.',
  'Upload without losing quality. No crop. One tap.',
];

const GAMES = [
  // type, weight, generator function key
  { type: 'wyr',          weight: 5, label: 'Would You Rather' },
  { type: 'pick_one',     weight: 4, label: 'Pick One' },
  { type: 'this_or_that', weight: 4, label: 'This or That' },
  { type: 'rate',         weight: 3, label: 'Rate the Drop' },
  { type: 'save_skip',    weight: 3, label: 'Save or Skip' },
  { type: 'emoji_poll',   weight: 3, label: 'Emoji Poll' },
  { type: 'main_char',    weight: 2, label: 'Main Character' },
  { type: 'caption_this', weight: 2, label: 'Caption This' },
  { type: 'true_false',   weight: 2, label: 'True or False' },
  { type: 'guess_theme',  weight: 1, label: 'Guess the Theme' },
];

// Static game templates per category (used when AI is unavailable)
const STATIC_GAMES = {
  anime: [
    { type: 'wyr',      text: 'Would you rather have a soft pastel anime aesthetic or a dark moody one?\n🌸 = Pastel | 🖤 = Dark' },
    { type: 'pick_one', text: 'Pick one to be your PFP forever:\n🌸 = Cute girl | ⚔️ = Cool warrior | 🌙 = Dark aesthetic' },
    { type: 'rate',     text: 'Rate today\'s drop!\n⭐ = Mid | 🔥 = Fire | 💎 = Saving all of them' },
    { type: 'save_skip',text: 'Save or Skip?\n💾 = Saving at least one | ⏭️ = Not my vibe' },
  ],
  dark_anime: [
    { type: 'wyr',      text: 'Would you rather live in a dark gothic castle or a neon cyberpunk city?\n🏰 = Gothic castle | ⚡ = Neon city' },
    { type: 'emoji_poll',text: 'Which dark aesthetic hits harder?\n🖤 = Black & red | 💜 = Dark purple | 🌑 = Pure black' },
    { type: 'rate',     text: 'How dark is your aesthetic?\n🌙 = Slightly dark | 🖤 = Full dark mode | 💀 = I live in the shadows' },
  ],
  cute_anime: [
    { type: 'wyr',      text: 'Would you rather have a kawaii pastel room or a cozy lofi setup?\n🌸 = Pastel room | ☕ = Lofi setup' },
    { type: 'pick_one', text: 'Pick your aesthetic:\n🍬 = Candy cute | 🌸 = Soft pink | ☁️ = Cloud aesthetic' },
    { type: 'save_skip',text: 'Saving any of these?\n💾 = Yes, all of them | 🤔 = Maybe one | ⏭️ = Not today' },
  ],
  manhwa: [
    { type: 'wyr',      text: 'Would you rather be the main lead in a romance manhwa or an action manhwa?\n💕 = Romance | ⚔️ = Action' },
    { type: 'main_char',text: 'Which manhwa character energy do you have?\n👑 = Cold CEO | 🌹 = Soft romantic | ⚡ = Powerful warrior' },
  ],
  default: [
    { type: 'wyr',      text: 'Would you rather have 100 wallpapers you love or 1 perfect one?\n📱 = 100 wallpapers | 💎 = 1 perfect one' },
    { type: 'rate',     text: 'Rate today\'s drop!\n⭐ = Good | 🔥 = Fire | 💎 = Best drop ever' },
    { type: 'save_skip',text: 'Save or Skip?\n💾 = Saving | ⏭️ = Not my vibe' },
    { type: 'emoji_poll',text: 'React with your vibe:\n🔥 = Love it | 😍 = Obsessed | 💾 = Saving all | 🤷 = Meh' },
  ],
};

const CLOSINGS = [
  'Follow for daily drops. 🔔',
  'More drops coming. Stay tuned. ✨',
  'Daily drops, every day. 📲',
  'Save your faves before they\'re gone. 💾',
  'Share with someone who needs a new wallpaper. 🔁',
  'React to let us know you want more. 🙌',
  'Drop a 🔥 if you\'re saving any of these.',
  'Tag someone who\'d love this drop. 👇',
];

module.exports = {
  ASCII_STYLES,
  TITLE_TEMPLATES,
  DESCRIPTIONS,
  CTA_TEMPLATES,
  GAMES,
  STATIC_GAMES,
  CLOSINGS,
};
