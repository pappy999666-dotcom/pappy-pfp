/**
 * keyboards.js — Centralised inline keyboard factory
 *
 * All buttons use Telegram's 2026 colored button system where appropriate:
 *   primary (blue)  — navigation / view / info
 *   success (green) — confirm / create / apply / pair actions
 *   danger  (red)   — delete / purge / stop / destructive actions
 *   (none)          — neutral / back / passive buttons
 */

const config = require('../config');
const { btn, backBtn, mainMenuBtn, PRIMARY, SUCCESS, DANGER } = require('../utils/buttonStyles');

const K = {
  /* ── Main menu ─────────────────────────────────────────────────────────── */
  mainMenu(owner = false) {
    const b = [
      [btn('🖼️ Pinterest Images',  'pinterest',  PRIMARY)],
      [btn('📱 Pair WhatsApp',     'pair_wa',    SUCCESS),
       btn('👥 Paired Accounts',   'paired',     PRIMARY)],
      [btn('🖼️ Change Group PFP', 'group_pfp',  PRIMARY)],
      [btn('📥 Download Media',    'download',   PRIMARY)],
      [btn('🌄 Wallpapers',        'wallpapers', PRIMARY)],
      [btn('🎨 AI Image Generator','imagegen',   PRIMARY)],
      [btn('💬 Support',           'support',    PRIMARY)],
    ];
    if (owner) b.push([btn('👑 Owner Panel', 'owner', PRIMARY)]);
    return { inline_keyboard: b };
  },

  /* ── Account management ─────────────────────────────────────────────────── */
  accountMenu(num) {
    return { inline_keyboard: [
      [btn('🖼️ Change Profile Picture', `set_pfp:${num}`,   SUCCESS)],
      [btn('🔍 Get Current PFP',        `get_pfp:${num}`,   PRIMARY)],
      [btn('🗑️ Delete Profile Picture', `del_pfp:${num}`,   DANGER)],
      [btn('✏️ Change WA Display Name', `setname:${num}`,   SUCCESS)],
      [btn('🔄 Auto Change PFP',        `auto_pfp:${num}`,  SUCCESS)],
      [btn('⏹️ Stop Auto Change',       `stop_auto:${num}`, DANGER)],
      [btn('🗑️ Purge Session',          `purge:${num}`,     DANGER)],
      [backBtn('paired')],
    ]};
  },

  /* ── After pairing ──────────────────────────────────────────────────────── */
  afterPair(num) {
    return { inline_keyboard: [
      [btn('🖼️ Set Profile Picture',    `set_pfp:${num}`, SUCCESS)],
      [btn('📌 Make Session Permanent', `perm:${num}`,    SUCCESS)],
      [btn('🗑️ Delete Session',         `purge:${num}`,   DANGER)],
      [mainMenuBtn()],
    ]};
  },

  /* ── Auto-change schedule mode ──────────────────────────────────────────── */
  autoMenu(num) {
    return { inline_keyboard: [
      [btn('⏰ Hour Based', `auto_hour:${num}`, SUCCESS),
       btn('📅 Day Based',  `auto_day:${num}`,  SUCCESS)],
      [backBtn(`account:${num}`)],
    ]};
  },

  /* ── Group PFP ──────────────────────────────────────────────────────────── */
  groupPfpMenu() {
    return { inline_keyboard: [
      [btn('⚡ Immediate Change',       'gpfp_immediate', SUCCESS)],
      [btn('📅 Scheduled Daily Change', 'gpfp_scheduled', SUCCESS)],
      [btn('📋 My Active Tasks',        'gpfp_tasks',     PRIMARY)],
      [mainMenuBtn()],
    ]};
  },

  /* ── Download platform picker ───────────────────────────────────────────── */
  downloadMenu() {
    return { inline_keyboard: [
      [btn('📌 Pinterest',  'dl_pinterest', PRIMARY),
       btn('🎵 TikTok',     'dl_tiktok',    PRIMARY)],
      [btn('📸 Instagram',  'dl_instagram', PRIMARY),
       btn('🐦 Twitter/X',  'dl_twitter',   PRIMARY)],
      [btn('▶️ YouTube',    'dl_youtube',   PRIMARY),
       btn('📘 Facebook',   'dl_facebook',  PRIMARY)],
      [btn('🧵 Threads',    'dl_threads',   PRIMARY),
       btn('🤖 Reddit',     'dl_reddit',    PRIMARY)],
      [btn('🔗 Auto Detect (paste any URL)', 'dl_auto', SUCCESS)],
      [mainMenuBtn()],
    ]};
  },

  /* ── Wallpaper category grid ────────────────────────────────────────────── */
  wallpaperCategories() {
    return { inline_keyboard: [
      [btn('🎌 Anime',     'wp_anime',     PRIMARY), btn('📖 Manga',      'wp_manga',      PRIMARY)],
      [btn('📚 Novel Art', 'wp_novel_art', PRIMARY), btn('👧 Girls',       'wp_girls',      PRIMARY)],
      [btn('👦 Boys',      'wp_boys',      PRIMARY), btn('🚗 Cars',        'wp_cars',       PRIMARY)],
      [btn('🌿 Nature',    'wp_nature',    PRIMARY), btn('🎮 Gaming',      'wp_gaming',     PRIMARY)],
      [btn('✨ Aesthetic', 'wp_aesthetic', PRIMARY), btn('🌑 Dark',        'wp_dark',       PRIMARY)],
      [btn('🌌 Space',     'wp_space',     PRIMARY), btn('🌆 City',        'wp_city',       PRIMARY)],
      [btn('🎨 Abstract',  'wp_abstract',  PRIMARY), btn('⚽ Sports',      'wp_sports',     PRIMARY)],
      [btn('🦁 Animals',   'wp_animals',   PRIMARY), btn('🦸 Superheroes', 'wp_superheroes',PRIMARY)],
      [btn('🌸 Flowers',   'wp_flowers',   PRIMARY), btn('💬 Quotes',      'wp_quotes',     PRIMARY)],
      [btn('👗 Fashion',   'wp_fashion',   PRIMARY), btn('🍕 Food',        'wp_food',       PRIMARY)],
      [btn('🧙 Fantasy',   'wp_fantasy',   PRIMARY), btn('🚀 Sci-Fi',      'wp_sci_fi',     PRIMARY)],
      [btn('👻 Horror',    'wp_horror',    PRIMARY), btn('🤖 Cyberpunk',   'wp_cyberpunk',  PRIMARY)],
      [btn('🎵 Lofi',      'wp_lofi',      PRIMARY), btn('⛰ Mountains',   'wp_mountains',  PRIMARY)],
      [btn('🌊 Ocean',     'wp_ocean',     PRIMARY), btn('🌅 Sunset',      'wp_sunset',     PRIMARY)],
      [btn('🌲 Forest',    'wp_forest',    PRIMARY), btn('💧 Waterfall',   'wp_waterfall',  PRIMARY)],
      [btn('🏛 Architecture','wp_architecture',PRIMARY),btn('📷 Vintage',  'wp_vintage',    PRIMARY)],
      [btn('⬜ Minimalist','wp_minimalist', PRIMARY), btn('💡 Neon',        'wp_neon',       PRIMARY)],
      [btn('⚡ Mythology', 'wp_mythology', PRIMARY), btn('🐉 Dragons',     'wp_dragons',    PRIMARY)],
      [btn('✨ Magic',     'wp_magic',     PRIMARY), btn('⚔ Warriors',    'wp_warriors',   PRIMARY)],
      [btn('🎉 Weekend Specials',    'wp_weekend_specials',    PRIMARY)],
      [btn('📅 Monthly Collections', 'wp_monthly_collections', PRIMARY)],
      [mainMenuBtn()],
    ]};
  },

  /* ── Pinterest pagination ───────────────────────────────────────────────── */
  pinterestBottom(q, page) {
    return { inline_keyboard: [[
      btn('➕ View More', `pi_more:${page + 1}:${q}`, SUCCESS),
      mainMenuBtn(),
    ]]};
  },

  /* ── Owner panel ────────────────────────────────────────────────────────── */
  ownerPanel() {
    return { inline_keyboard: [
      [btn('🚀 Drop Wallpapers NOW',  'o_drop_now',  SUCCESS)],
      [btn('📣 Broadcast Message',    'o_broadcast', SUCCESS)],
      [btn('📊 Statistics',           'o_stats',     PRIMARY),
       btn('👥 Users',                'o_users',     PRIMARY)],
      [btn('🔒 Force Join Settings',  'o_fj',        PRIMARY)],
      [btn('📢 Channel Management',   'o_channels',  PRIMARY)],
      [btn('📣 Promotion Manager',     'o_promo',     SUCCESS)],
      [btn('🔍 Get WA JIDs',           'o_jid',       PRIMARY)],
      [btn('📱 Owner WA Status',      'o_wa_status', PRIMARY)],
      [btn('🔧 Set/Change Owner WA',  'o_wa_set',    SUCCESS)],
      [btn('🔗 Pair Owner WA',        'o_wa_pair',   SUCCESS)],
      [btn('🔄 Restart Bot',          'o_restart',   DANGER)],
      [mainMenuBtn()],
    ]};
  },

  /* ── Drop-now confirmation ──────────────────────────────────────────────── */
  dropNowConfirm() {
    return { inline_keyboard: [
      [btn('✅ Yes — Drop All 40 Categories Now', 'o_drop_now_confirm', SUCCESS)],
      [btn('❌ Cancel',                            'owner',              DANGER)],
    ]};
  },

  /* ── DM link button (channel posts) ────────────────────────────────────── */
  dmButton(botUsername) {
    if (!botUsername) return null;
    return { inline_keyboard: [[
      btn('💬 Get More · Chat with Bot', null, PRIMARY, { url: `https://t.me/${botUsername}` }),
    ]]};
  },

  /* ── Generic confirm / cancel pair ─────────────────────────────────────── */
  confirm(yes, no = 'main_menu') {
    return { inline_keyboard: [[
      btn('✅ Confirm', yes, SUCCESS),
      btn('❌ Cancel',  no,  DANGER),
    ]]};
  },

  /* ── Single back button ─────────────────────────────────────────────────── */
  back(to) { return { inline_keyboard: [[backBtn(to)]] }; },

  /* ── Single main-menu button ────────────────────────────────────────────── */
  backMain() { return { inline_keyboard: [[mainMenuBtn()]] }; },
};

module.exports = K;
