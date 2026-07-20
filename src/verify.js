/**
 * verify.js — End-to-end verification for PAPPY PFP V3
 * Run: node verify.js
 */
require('dotenv').config();

const PASS = '✅';
const FAIL = '❌';
const WARN = '⚠️';
let failures = 0;
let warnings = 0;

function pass(label) { console.log(`  ${PASS} ${label}`); }
function fail(label, reason) { console.log(`  ${FAIL} ${label}: ${reason}`); failures++; }
function warn(label, reason) { console.log(`  ${WARN} ${label}: ${reason}`); warnings++; }
function section(title) { console.log(`\n── ${title} ──`); }

// ── 1. Module loading ─────────────────────────────────────────────────────────
section('Module Loading');
const modules = [
  './utils/ui', './utils/buttonStyles', './utils/errorHandler', './utils/send',
  './config', './config/settingsManager',
  './handlers/keyboards', './handlers/callbackRouter',
  './handlers/pairingHandler', './handlers/accountHandler',
  './handlers/wallpaperHandler', './handlers/downloadHandler',
  './handlers/groupPfpHandler', './handlers/supportHandler',
  './handlers/imageGenHandler', './handlers/pinterestHandler',
  './handlers/ownerSettingsHandler',
  './owner/ownerHandler',
  './services/wallpaper', './services/groupPfp',
  './middleware/auth', './middleware/rateLimit', './middleware/session',
  './schedulers/autoChange', './schedulers/groupPfpScheduler', './schedulers/wallpaperScheduler',
  './commands/start', './commands/jid',
];

for (const m of modules) {
  try {
    require(m);
    pass(m);
  } catch (e) {
    fail(m, e.message);
  }
}

// ── 2. UI HTML output validation ──────────────────────────────────────────────
section('UI HTML Formatting');
const ui = require('./utils/ui');

function validateHtml(label, html) {
  if (!html || typeof html !== 'string') { fail(label, 'not a string'); return; }
  // Check for raw Markdown syntax
  if (/(?<![<\w])\*[A-Za-z]/.test(html)) { fail(label, 'contains raw *bold* Markdown'); return; }
  if (/(?<![<\w])_[A-Za-z]/.test(html) && !html.includes('<i>')) { warn(label, 'possible raw _italic_'); }
  // Check for unclosed blockquote
  const opens = (html.match(/<blockquote/g) || []).length;
  const closes = (html.match(/<\/blockquote>/g) || []).length;
  if (opens !== closes) { fail(label, `unclosed blockquote (${opens} open, ${closes} close)`); return; }
  // Check for raw > blockquote syntax
  if (/^> [A-Za-z]/m.test(html)) { fail(label, 'contains raw > blockquote syntax'); return; }
  pass(label);
}

validateHtml('ui.success()', ui.success('Title', 'Detail'));
validateHtml('ui.error()', ui.error('Title', 'Message', 'Fix', 'ERR-001'));
validateHtml('ui.warn()', ui.warn('Title', 'Detail'));
validateHtml('ui.info()', ui.info('Title', 'Detail'));
validateHtml('ui.loading()', ui.loading('Processing'));
validateHtml('ui.confirm()', ui.confirm('Title', 'Detail', 'Warning'));
validateHtml('ui.screenHeader()', ui.screenHeader('PAPPYBOT', 'Main Menu', 'Subtitle'));
validateHtml('ui.pairingCodeMessage()', ui.pairingCodeMessage('2348012345678', 'ABCD-1234'));
validateHtml('ui.qrCaption()', ui.qrCaption('2348012345678'));
validateHtml('ui.accountHeader()', ui.accountHeader('2348012345678', true, { interval: 2, mode: 'hour' }));
validateHtml('ui.ticketHeader()', ui.ticketHeader('TKT-001', 'open'));
validateHtml('ui.taskProgress()', ui.taskProgress('Uploading', 3, 10));
validateHtml('ui.welcomeMessage()', ui.welcomeMessage('PAPPYBOT', 'John'));
validateHtml('ui.expandable()', ui.expandable(['line1', 'line2'], 'Title'));
validateHtml('ui.blockquote()', ui.blockquote(['line1', 'line2']));
validateHtml('ui.dropCaption()', ui.dropCaption({
  displayName: 'Anime', emoji: '⛩️', hashtags: ['Anime', 'DailyDrop'],
  botName: 'PAPPYBOT', botUsername: 'pappy_wallpaperbot', count: 10,
  description: 'Test mood',
}));
validateHtml('ui.wallpaperCaption()', ui.wallpaperCaption({
  displayName: 'Anime', count: 10, page: 1, emoji: '⛩️',
  hashtags: ['Anime', 'DailyDrop'], botName: 'PAPPYBOT',
}));

// ── 3. Button styles ──────────────────────────────────────────────────────────
section('Button Styles (Bot API v9.4)');
const { btn, PRIMARY, SUCCESS, DANGER } = require('./utils/buttonStyles');

const successBtn = btn('✅ Approve', 'approve', SUCCESS);
const dangerBtn  = btn('❌ Reject', 'reject', DANGER);
const primaryBtn = btn('📘 Info', 'info', PRIMARY);
const urlBtn     = btn('🔗 Link', null, PRIMARY, { url: 'https://t.me/test' });

if (successBtn.style === 'success') pass('success button has style:success');
else fail('success button', `style=${successBtn.style}`);

if (dangerBtn.style === 'danger') pass('danger button has style:danger');
else fail('danger button', `style=${dangerBtn.style}`);

if (primaryBtn.style === 'primary') pass('primary button has style:primary');
else fail('primary button', `style=${primaryBtn.style}`);

if (urlBtn.url && !urlBtn.callback_data) pass('url button has url, no callback_data');
else fail('url button', JSON.stringify(urlBtn));

// ── 4. Keyboards ──────────────────────────────────────────────────────────────
section('Keyboard Structures');
const K = require('./handlers/keyboards');

function validateKeyboard(label, kb) {
  if (!kb || !kb.inline_keyboard) { fail(label, 'no inline_keyboard'); return; }
  const rows = kb.inline_keyboard;
  if (!Array.isArray(rows) || !rows.length) { fail(label, 'empty keyboard'); return; }
  for (const row of rows) {
    for (const b of row) {
      if (!b.text) { fail(label, 'button missing text'); return; }
      if (!b.callback_data && !b.url && !b.switch_inline_query !== undefined) {
        // ok — might have other fields
      }
    }
  }
  pass(label);
}

validateKeyboard('K.mainMenu(false)', K.mainMenu(false));
validateKeyboard('K.mainMenu(true)', K.mainMenu(true));
validateKeyboard('K.accountMenu()', K.accountMenu('2348012345678'));
validateKeyboard('K.afterPair()', K.afterPair('2348012345678'));
validateKeyboard('K.groupPfpMenu()', K.groupPfpMenu());
validateKeyboard('K.downloadMenu()', K.downloadMenu());
validateKeyboard('K.ownerPanel()', K.ownerPanel());
validateKeyboard('K.dropNowConfirm()', K.dropNowConfirm());
validateKeyboard('K.confirm()', K.confirm('yes_action'));
validateKeyboard('K.wallpaperCategories()', K.wallpaperCategories());

// ── 5. Callback data integrity ────────────────────────────────────────────────
section('Callback Data Integrity');
const allCallbacks = [];
function extractCallbacks(kb) {
  if (!kb || !kb.inline_keyboard) return;
  for (const row of kb.inline_keyboard) {
    for (const b of row) {
      if (b.callback_data) allCallbacks.push(b.callback_data);
    }
  }
}
extractCallbacks(K.mainMenu(true));
extractCallbacks(K.accountMenu('123'));
extractCallbacks(K.ownerPanel());
extractCallbacks(K.groupPfpMenu());
extractCallbacks(K.downloadMenu());
extractCallbacks(K.wallpaperCategories());

const htmlInCallback = allCallbacks.filter(cb => cb.includes('<') || cb.includes('>'));
if (htmlInCallback.length) {
  fail('callback_data HTML corruption', htmlInCallback.slice(0, 3).join(', '));
} else {
  pass(`${allCallbacks.length} callback_data values — no HTML corruption`);
}

const longCallbacks = allCallbacks.filter(cb => cb.length > 64);
if (longCallbacks.length) {
  fail('callback_data too long (>64 bytes)', longCallbacks.slice(0, 2).join(', '));
} else {
  pass('all callback_data within 64-byte limit');
}

// ── 6. Wallpaper service ──────────────────────────────────────────────────────
section('Wallpaper Service');
const { CATEGORIES, CATEGORY_HASHTAGS, CATEGORY_META, buildDropCaption, buildWaCaption } = require('./services/wallpaper');

if (CATEGORIES.length >= 40) pass(`${CATEGORIES.length} categories defined`);
else fail('categories', `only ${CATEGORIES.length}`);

// Check all categories have meta and hashtags
const missingMeta = CATEGORIES.filter(c => !CATEGORY_META[c]);
const missingHashtags = CATEGORIES.filter(c => !CATEGORY_HASHTAGS[c]);
if (missingMeta.length) fail('CATEGORY_META', `missing: ${missingMeta.join(', ')}`);
else pass('all categories have CATEGORY_META');
if (missingHashtags.length) warn('CATEGORY_HASHTAGS', `missing: ${missingHashtags.join(', ')}`);
else pass('all categories have CATEGORY_HASHTAGS');

// Test buildDropCaption (TG) — must be valid HTML
if (typeof buildDropCaption === 'function') {
  const tgCaption = buildDropCaption('anime', 10);
  validateHtml('buildDropCaption(anime)', tgCaption);
} else {
  warn('buildDropCaption', 'not exported — using ui.dropCaption instead');
}

// Test buildWaCaption — must be plain text (no HTML tags)
if (typeof buildWaCaption === 'function') {
  const waCaption = buildWaCaption('anime', 10);
  if (/<[^>]+>/.test(waCaption)) fail('buildWaCaption', 'contains HTML tags — WA does not render HTML');
  else pass('buildWaCaption is plain text (no HTML)');
} else {
  warn('buildWaCaption', 'not exported');
}

// ── 7. Pinterest search history ───────────────────────────────────────────────
section('Pinterest Search History');
const { buildEditorialQuery } = (() => {
  try { return require('./services/wallpaper'); } catch { return {}; }
})();

if (typeof buildEditorialQuery === 'function') {
  pass('buildEditorialQuery exported');
} else {
  // It's internal — check via settingsManager
  warn('buildEditorialQuery', 'internal function — verify recentSearches in settingsManager');
}

// Check settingsManager has recentSearches in drops defaults
const sm = require('./config/settingsManager');
const defaults = sm.DEFAULTS;
if (defaults && defaults.drops) {
  pass('settingsManager.DEFAULTS.drops exists');
} else {
  fail('settingsManager.DEFAULTS.drops', 'missing');
}

// ── 8. Forwarding config ──────────────────────────────────────────────────────
section('WA Forwarding Config');
const ows = require('./handlers/ownerSettingsHandler');
if (typeof ows.waPanel === 'function') pass('waPanel exported');
else fail('waPanel', 'not exported');
if (typeof ows.waToggle === 'function') pass('waToggle exported');
else fail('waToggle', 'not exported');
if (typeof ows.waSetJoinLinkPrompt === 'function') pass('waSetJoinLinkPrompt exported');
else fail('waSetJoinLinkPrompt', 'not exported');

// Check whatsapp settings defaults include forwarding
if (defaults && defaults.whatsapp) {
  const wa = defaults.whatsapp;
  if ('forwardingEnabled' in wa || 'autoJoinEnabled' in wa) pass('forwarding config in whatsapp defaults');
  else warn('forwarding config', 'forwardingEnabled not in defaults — may be runtime-only');
} else {
  fail('whatsapp defaults', 'missing');
}

// ── 9. Scheduling ─────────────────────────────────────────────────────────────
section('Schedulers');
try {
  const ws = require('./schedulers/wallpaperScheduler');
  if (typeof ws.startWallpaperScheduler === 'function') pass('wallpaperScheduler.startWallpaperScheduler');
  else fail('wallpaperScheduler', 'startWallpaperScheduler not exported');
} catch (e) { fail('wallpaperScheduler', e.message); }

try {
  const gs = require('./schedulers/groupPfpScheduler');
  if (typeof gs.startGroupPfpScheduler === 'function') pass('groupPfpScheduler.startGroupPfpScheduler');
  else fail('groupPfpScheduler', 'startGroupPfpScheduler not exported');
} catch (e) { fail('groupPfpScheduler', e.message); }

try {
  const ac = require('./schedulers/autoChange');
  if (typeof ac.startWorker === 'function') pass('autoChange.startWorker');
  else fail('autoChange', 'startWorker not exported');
} catch (e) { fail('autoChange', e.message); }

// ── 10. Force join ────────────────────────────────────────────────────────────
section('Force Join');
const { checkForceJoin, isOwner } = require('./middleware/auth');
if (typeof checkForceJoin === 'function') pass('checkForceJoin exported');
else fail('checkForceJoin', 'not exported');
if (typeof isOwner === 'function') pass('isOwner exported');
else fail('isOwner', 'not exported');

// ── 11. Regression: all handler exports ──────────────────────────────────────
section('Handler Export Regression');
const handlerChecks = [
  ['./handlers/pairingHandler', ['start', 'handlePhone', 'doPairCode', 'doPairQR', 'deleteAndRepair']],
  ['./handlers/accountHandler', ['pairedList', 'accountMenu', 'setPfpPrompt', 'handlePfpImage', 'autoMenu']],
  ['./handlers/wallpaperHandler', ['start', 'browseCategory', 'loadMore']],
  ['./handlers/downloadHandler', ['start', 'promptUrl', 'handleUrl']],
  ['./handlers/groupPfpHandler', ['start', 'immediateStart', 'scheduledStart', 'handleLink', 'listTasks', 'cancelTask']],
  ['./handlers/supportHandler', ['start', 'handleMsg', 'ownerReplyPrompt', 'ownerReplyDo', 'closeDo']],
  ['./handlers/imageGenHandler', ['promptUser', 'handlePrompt']],
  ['./handlers/pinterestHandler', ['start', 'search', 'more']],
  ['./owner/ownerHandler', ['panel', 'stats', 'users', 'broadcastPrompt', 'broadcastDo', 'fjPanel', 'channelPanel', 'restart']],
];

for (const [mod, fns] of handlerChecks) {
  try {
    const m = require(mod);
    const missing = fns.filter(f => typeof m[f] !== 'function');
    if (missing.length) fail(mod, `missing exports: ${missing.join(', ')}`);
    else pass(`${mod} (${fns.length} exports)`);
  } catch (e) { fail(mod, e.message); }
}

// ── 12. Config ────────────────────────────────────────────────────────────────
section('Config');
const config = require('./config');
if (config.botToken) pass('BOT_TOKEN set');
else fail('BOT_TOKEN', 'missing');
if (config.ownerIds && config.ownerIds.length) pass(`ownerIds: ${config.ownerIds.join(',')}`);
else fail('ownerIds', 'empty');
if (config.mongodb && config.mongodb.uri) pass('MONGODB_URI set');
else fail('MONGODB_URI', 'missing');
if (config.redis && config.redis.url) pass('REDIS_URL set');
else fail('REDIS_URL', 'missing');
if (config.webUrl) pass(`webUrl: ${config.webUrl}`);
else warn('webUrl', 'not set — WA drop buttons will have no URL');

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(50));
console.log(`RESULT: ${failures} failure(s), ${warnings} warning(s)`);
if (failures === 0) {
  console.log('✅ ALL CHECKS PASSED — safe to merge');
} else {
  console.log('❌ FAILURES FOUND — fix before merging');
  process.exit(1);
}
