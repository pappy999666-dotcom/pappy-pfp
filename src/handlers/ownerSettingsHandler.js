'use strict';

const ui = require('../utils/ui');
const config = require('../config');
const settingsManager = require('../config/settingsManager');
const { btn, PRIMARY, SUCCESS, DANGER } = require('../utils/buttonStyles');
const { clearState } = require('../middleware/session');

// ── Main Menu ─────────────────────────────────────────────────────────────
async function settingsMenu(ctx) {
  const [drops, wm, enhancer, maint, wa] = await Promise.all([
    settingsManager.getGroup('drops'),
    settingsManager.getGroup('watermark'),
    settingsManager.getGroup('enhancer'),
    settingsManager.getGroup('maintenance'),
    settingsManager.getGroup('whatsapp')
  ]);

  const text = [
    ui.screenHeader(config.bot.name, 'Settings Center'),
    '',
    '<blockquote>Configure every feature from here.</blockquote>',
    '<blockquote>Changes take effect immediately.</blockquote>',
    '',
    ui.divider(),
    '',
    ui.stat('🌄', 'Daily Drops',    drops.enabled ? '✅ Active' : '⛔ Off'),
    ui.stat('⸸',  'Watermark',      wm.enabled ? '✅ Active' : '⛔ Off'),
    ui.stat('🔬', 'Image Enhancer', enhancer.enabled ? '✅ Active' : '⛔ Off'),
    ui.stat('🔧', 'Maintenance',    maint.enabled ? '🔴 ACTIVE' : '🟢 Normal'),
    ui.stat('💬', 'WA Channel',     wa.channelEnabled ? '✅ Active' : '⛔ Off'),
    ui.stat('📌', 'Pinterest API',  config.apis?.pinterestToken ? '✅ Token set' : '⚠️ Using prexzy fallback'),
  ].join('\n');

  const btns = [
    [btn('🌄 Daily Drops', 'o_settings_drops', PRIMARY), btn('⸸ Watermark', 'o_settings_wm', PRIMARY)],
    [btn('🔬 Enhancer', 'o_settings_enhance', PRIMARY), btn('🛡 Rate Limits', 'o_settings_rate', PRIMARY)],
    [btn('🔧 Maintenance', 'o_settings_maint', maint.enabled ? DANGER : PRIMARY), btn('📋 Logging', 'o_settings_log', PRIMARY)],
    [btn('📤 Uploads', 'o_settings_uploads', PRIMARY), btn('⏱ Cooldowns', 'o_settings_cooldowns', PRIMARY)],
    [btn('⏰ Scheduler', 'o_settings_scheduler', PRIMARY), btn('💬 WA Channel', 'o_settings_wa', PRIMARY)],
    [btn('📱 WA Drop', 'o_settings_wa_drop', PRIMARY), btn('👥 WA Groups', 'o_settings_wa_group', PRIMARY)],
    [btn('📱 WA Drop Settings', 'o_settings_wa_drop', PRIMARY), btn('👥 WA Group Drop', 'o_settings_wa_group', PRIMARY)],
    [btn('📁 Categories', 'o_settings_cats', PRIMARY), btn('➕ Add Category', 'o_addcat_prompt', SUCCESS)],
    [btn('💡 View Suggestions', 'o_suggestions', PRIMARY)],
    [{ text: '‹ Back to Owner Panel', callback_data: 'owner' }]
  ];

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } }).catch(()=>{});
}

// ── Drops Settings ────────────────────────────────────────────────────────
async function dropsPanel(ctx) {
  const drops = await settingsManager.getGroup('drops');
  const text = [
    ui.screenHeader(config.bot.name, 'Daily Drops Settings'),
    '',
    ui.blockquote([
      `Enabled: [${drops.enabled ? '✅' : '⛔'}]`,
      `Auto-Drop: [${drops.autoDropEnabled ? '✅' : '⛔'}]`,
      `Images per drop: [${drops.imagesPerDrop}]`,
      `Interval: [${drops.intervalHours} hours]`,
      `Stagger: [${drops.staggerMinutes} minutes]`,
      `Categories per day: [${drops.categoriesPerDay || 'all'}]`,
      `HD Only: [${drops.maxQuality ? '✅' : '⛔'}]`
    ])
  ].join('\n');

  const btns = [
    [btn(drops.enabled ? '⛔ Disable Drops' : '✅ Enable Drops', 'o_set_drop_tg:enabled', drops.enabled ? DANGER : SUCCESS)],
    [btn(drops.autoDropEnabled ? '⛔ Disable Auto' : '✅ Enable Auto', 'o_set_drop_tg:autoDropEnabled', drops.autoDropEnabled ? DANGER : SUCCESS)],
    [btn(drops.maxQuality ? '⛔ Disable HD Only' : '✅ Enable HD Only', 'o_set_drop_tg:maxQuality', drops.maxQuality ? DANGER : SUCCESS)],
    [btn('🖼 Set Images/Drop', 'o_set_drop_pr:imagesPerDrop', PRIMARY)],
    [btn('⏱ Set Interval', 'o_set_drop_pr:intervalHours', PRIMARY)],
    [btn('⏳ Set Stagger', 'o_set_drop_pr:staggerMinutes', PRIMARY)],
    [btn('📅 Categories Per Day', 'o_set_drop_pr:categoriesPerDay', PRIMARY)],
    [{ text: '‹ Back to Settings', callback_data: 'o_settings' }]
  ];

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } }).catch(()=>{});
}
async function dropToggle(ctx, field) {
  await settingsManager.toggle(`drops.${field}`);
  await ctx.answerCbQuery('✅ Updated').catch(()=>{});
  await dropsPanel(ctx);
}
async function dropSetImagesPrompt(ctx, field) {
  const drops = await settingsManager.getGroup('drops');
  ctx.setState({ step: 'o_settings_set_drop_val', dropField: field });
  await ctx.editMessageText(
    `<b>Set Drops Value</b>\n\nCurrent: ${drops[field]}\n\nSend new numeric value for ${field}:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{text:'❌ Cancel', callback_data:'o_settings_drops'}]] } }
  ).catch(()=>{});
}
async function dropSetImagesInput(ctx) {
  const field = ctx.userState.dropField;
  clearState(ctx.from.id);
  const val = parseInt(ctx.message.text);
  if (isNaN(val)) return ctx.reply('Invalid number.', {reply_markup: {inline_keyboard: [[{text:'‹ Back', callback_data:'o_settings_drops'}]]}});
  await settingsManager.set(`drops.${field}`, val);
  await ctx.reply(`✅ Updated ${field} to ${val}`, {reply_markup: {inline_keyboard: [[{text:'‹ Back', callback_data:'o_settings_drops'}]]}});
}

// ── Watermark Settings ────────────────────────────────────────────────────
async function watermarkPanel(ctx) {
  const wm = await settingsManager.getGroup('watermark');
  const text = [
    ui.screenHeader(config.bot.name, 'Watermark Settings'),
    '',
    ui.blockquote([
      `Enabled: [${wm.enabled ? '✅' : '⛔'}]`,
      `Opacity: [${wm.opacity}]`,
      `Position: [${wm.position}]`,
      `Size: [${wm.size}px]`,
      `Text: [${wm.text}]`,
      `Margin: X[${wm.marginX}] Y[${wm.marginY}]`
    ])
  ].join('\n');
  const btns = [
    [btn(wm.enabled ? '⛔ Disable WM' : '✅ Enable WM', 'o_set_wm_tg', wm.enabled ? DANGER : SUCCESS)],
    [btn('Set Opacity', 'o_set_wm_pr:opacity', PRIMARY), btn('Set Size', 'o_set_wm_pr:size', PRIMARY)],
    [btn('Set Text', 'o_set_wm_text', PRIMARY), btn('Set Position', 'o_set_wm_pos', PRIMARY)],
    [btn('Set Margin X', 'o_set_wm_pr:marginX', PRIMARY), btn('Set Margin Y', 'o_set_wm_pr:marginY', PRIMARY)],
    [btn('🔄 Reset to Defaults', 'o_set_wm_reset', DANGER)],
    [{ text: '‹ Back to Settings', callback_data: 'o_settings' }]
  ];
  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } }).catch(()=>{});
}
async function wmToggle(ctx) {
  await settingsManager.toggle('watermark.enabled');
  await ctx.answerCbQuery('✅ Updated').catch(()=>{});
  await watermarkPanel(ctx);
}
async function wmSetOpacityPrompt(ctx, field) {
  const wm = await settingsManager.getGroup('watermark');
  ctx.setState({ step: 'o_settings_set_wm_val', wmField: field });
  await ctx.editMessageText(
    `<b>Set Watermark Value</b>\n\nCurrent: ${wm[field]}\n\nSend new numeric value for ${field}:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{text:'❌ Cancel', callback_data:'o_settings_wm'}]] } }
  ).catch(()=>{});
}
async function wmSetOpacityInput(ctx) {
  const field = ctx.userState.wmField;
  clearState(ctx.from.id);
  const val = parseFloat(ctx.message.text);
  if (isNaN(val)) return ctx.reply('Invalid number.', {reply_markup: {inline_keyboard: [[{text:'‹ Back', callback_data:'o_settings_wm'}]]}});
  await settingsManager.set(`watermark.${field}`, val);
  await ctx.reply(`✅ Updated ${field} to ${val}`, {reply_markup: {inline_keyboard: [[{text:'‹ Back', callback_data:'o_settings_wm'}]]}});
}
async function wmSetPositionPanel(ctx) {
  const text = `<b>Select Watermark Position</b>`;
  const btns = [
    [btn('Top Left', 'o_set_wm_sel:top-left', PRIMARY), btn('Top Right', 'o_set_wm_sel:top-right', PRIMARY)],
    [btn('Bottom Left', 'o_set_wm_sel:bottom-left', PRIMARY), btn('Bottom Right', 'o_set_wm_sel:bottom-right', PRIMARY)],
    [btn('Center', 'o_set_wm_sel:center', PRIMARY)],
    [{ text: '‹ Back', callback_data: 'o_settings_wm' }]
  ];
  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } }).catch(()=>{});
}
async function wmSetPositionSelect(ctx, pos) {
  await settingsManager.set('watermark.position', pos);
  await ctx.answerCbQuery('✅ Updated').catch(()=>{});
  await watermarkPanel(ctx);
}
async function wmSetTextPrompt(ctx) {
  const wm = await settingsManager.getGroup('watermark');
  ctx.setState({ step: 'o_settings_set_wm_text' });
  await ctx.editMessageText(
    `<b>Set Watermark Text</b>\n\nCurrent: ${wm.text}\n\nSend new text:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{text:'❌ Cancel', callback_data:'o_settings_wm'}]] } }
  ).catch(()=>{});
}
async function wmSetTextInput(ctx) {
  clearState(ctx.from.id);
  const val = ctx.message.text;
  await settingsManager.set('watermark.text', val);
  await ctx.reply(`✅ Updated watermark text to ${val}`, {reply_markup: {inline_keyboard: [[{text:'‹ Back', callback_data:'o_settings_wm'}]]}});
}
async function wmReset(ctx) {
  await settingsManager.resetGroup('watermark');
  await ctx.answerCbQuery('✅ Reset to defaults').catch(()=>{});
  await watermarkPanel(ctx);
}

// ── Enhancer Settings ─────────────────────────────────────────────────────
async function enhancerPanel(ctx) {
  const en = await settingsManager.getGroup('enhancer');
  const text = [
    ui.screenHeader(config.bot.name, 'Enhancer Settings'),
    '',
    ui.blockquote([
      `Enabled: [${en.enabled ? '✅' : '⛔'}]`,
      `Upscale: [${en.upscale ? '✅' : '⛔'}]`,
      `Sharpen: [${en.sharpen ? '✅' : '⛔'}]`,
      `Artifact Removal: [${en.artifacts ? '✅' : '⛔'}]`
    ])
  ].join('\n');
  const btns = [
    [btn(en.enabled ? '⛔ Disable Enhancer' : '✅ Enable Enhancer', 'o_set_en_tg:enabled', en.enabled ? DANGER : SUCCESS)],
    [btn(en.upscale ? '⛔ Disable Upscale' : '✅ Enable Upscale', 'o_set_en_tg:upscale', en.upscale ? DANGER : SUCCESS)],
    [btn(en.sharpen ? '⛔ Disable Sharpen' : '✅ Enable Sharpen', 'o_set_en_tg:sharpen', en.sharpen ? DANGER : SUCCESS)],
    [btn(en.artifacts ? '⛔ Disable Artifacts' : '✅ Enable Artifacts', 'o_set_en_tg:artifacts', en.artifacts ? DANGER : SUCCESS)],
    [{ text: '‹ Back to Settings', callback_data: 'o_settings' }]
  ];
  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } }).catch(()=>{});
}
async function enhancerToggleEnabled(ctx) { await settingsManager.toggle('enhancer.enabled'); await ctx.answerCbQuery('✅ Updated').catch(()=>{}); await enhancerPanel(ctx); }
async function enhancerToggleUpscale(ctx) { await settingsManager.toggle('enhancer.upscale'); await ctx.answerCbQuery('✅ Updated').catch(()=>{}); await enhancerPanel(ctx); }
async function enhancerToggleSharpen(ctx) { await settingsManager.toggle('enhancer.sharpen'); await ctx.answerCbQuery('✅ Updated').catch(()=>{}); await enhancerPanel(ctx); }
async function enhancerToggleArtifacts(ctx) { await settingsManager.toggle('enhancer.artifacts'); await ctx.answerCbQuery('✅ Updated').catch(()=>{}); await enhancerPanel(ctx); }

// ── Rate Limits ───────────────────────────────────────────────────────────
async function ratePanel(ctx) {
  const rl = await settingsManager.getGroup('rateLimit');
  const text = [
    ui.screenHeader(config.bot.name, 'Rate Limiting'),
    '',
    ui.blockquote([
      `Window: [${rl.windowMs}ms]`,
      `Max requests: [${rl.maxRequests}]`
    ])
  ].join('\n');
  const btns = [
    [btn('Set Window Ms', 'o_set_rate:windowMs', PRIMARY)],
    [btn('Set Max Requests', 'o_set_rate:maxRequests', PRIMARY)],
    [{ text: '‹ Back', callback_data: 'o_settings' }]
  ];
  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } }).catch(()=>{});
}
async function rateLimitSet(ctx, field) {
  const rl = await settingsManager.getGroup('rateLimit');
  ctx.setState({ step: 'o_settings_set_rate', rateField: field });
  await ctx.editMessageText(
    `<b>Set Rate Limit</b>\n\nCurrent ${field}: ${rl[field]}\n\nSend new numeric value:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{text:'❌ Cancel', callback_data:'o_settings_rate'}]] } }
  ).catch(()=>{});
}
async function rateLimitInput(ctx) {
  const field = ctx.userState.rateField;
  clearState(ctx.from.id);
  const val = parseInt(ctx.message.text);
  if (isNaN(val)) return ctx.reply('Invalid number.', {reply_markup: {inline_keyboard: [[{text:'‹ Back', callback_data:'o_settings_rate'}]]}});
  await settingsManager.set(`rateLimit.${field}`, val);
  await ctx.reply(`✅ Updated ${field} to ${val}`, {reply_markup: {inline_keyboard: [[{text:'‹ Back', callback_data:'o_settings_rate'}]]}});
}

// ── Maintenance Mode ──────────────────────────────────────────────────────
async function maintPanel(ctx) {
  const m = await settingsManager.getGroup('maintenance');
  const text = [
    ui.screenHeader(config.bot.name, 'Maintenance Mode'),
    '',
    ui.blockquote([
      `[${m.enabled ? '✅' : '⛔'}] Currently ${m.enabled ? 'ACTIVE' : 'INACTIVE'}`,
      `Message: [${m.message}]`
    ])
  ].join('\n');
  const btns = [
    [btn(m.enabled ? '⛔ Turn OFF Maintenance' : '✅ Turn ON Maintenance', 'o_set_maint_tg', m.enabled ? SUCCESS : DANGER)],
    [btn('✏️ Set Message', 'o_set_maint_msg', PRIMARY)],
    [{ text: '‹ Back', callback_data: 'o_settings' }]
  ];
  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } }).catch(()=>{});
}
async function maintToggle(ctx) {
  await settingsManager.toggle('maintenance.enabled');
  await ctx.answerCbQuery('✅ Updated').catch(()=>{});
  await maintPanel(ctx);
}
async function maintMsgPrompt(ctx) {
  const m = await settingsManager.getGroup('maintenance');
  ctx.setState({ step: 'o_settings_set_maint_msg' });
  await ctx.editMessageText(
    `<b>Set Maintenance Message</b>\n\nCurrent: ${m.message}\n\nSend new message:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{text:'❌ Cancel', callback_data:'o_settings_maint'}]] } }
  ).catch(()=>{});
}
async function maintMsgInput(ctx) {
  clearState(ctx.from.id);
  const val = ctx.message.text;
  await settingsManager.set('maintenance.message', val);
  await ctx.reply(`✅ Updated message`, {reply_markup: {inline_keyboard: [[{text:'‹ Back', callback_data:'o_settings_maint'}]]}});
}

// ── Logging / Debug ───────────────────────────────────────────────────────
async function logPanel(ctx) {
  const l = await settingsManager.getGroup('logging');
  const text = [
    ui.screenHeader(config.bot.name, 'Logging Settings'),
    '',
    ui.blockquote([
      `Level: [${l.level}]`,
      `Debug: [${l.debug ? '✅' : '⛔'}]`
    ])
  ].join('\n');
  const btns = [
    [btn('Set Level: Debug', 'o_set_log_lvl:debug', PRIMARY), btn('Set Level: Info', 'o_set_log_lvl:info', PRIMARY)],
    [btn('Set Level: Warn', 'o_set_log_lvl:warn', PRIMARY), btn('Set Level: Error', 'o_set_log_lvl:error', PRIMARY)],
    [btn(l.debug ? '⛔ Disable Debug' : '✅ Enable Debug', 'o_set_log_tg', l.debug ? DANGER : SUCCESS)],
    [{ text: '‹ Back', callback_data: 'o_settings' }]
  ];
  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } }).catch(()=>{});
}
async function logSetLevel(ctx, level) {
  await settingsManager.set('logging.level', level);
  await ctx.answerCbQuery('✅ Updated').catch(()=>{});
  await logPanel(ctx);
}
async function logToggleDebug(ctx) {
  await settingsManager.toggle('logging.debug');
  await ctx.answerCbQuery('✅ Updated').catch(()=>{});
  await logPanel(ctx);
}

// ── Upload Limits ─────────────────────────────────────────────────────────
async function uploadsPanel(ctx) {
  const u = await settingsManager.getGroup('uploads');
  const text = [
    ui.screenHeader(config.bot.name, 'Upload Limits'),
    '',
    ui.blockquote([
      `Max images: [${u.maxImages}]`,
      `Max file size: [${u.maxFileSizeMB} MB]`,
      `Max schedule days: [${u.maxScheduleDays}]`
    ])
  ].join('\n');
  const btns = [
    [btn('Set Max Images', 'o_set_up:maxImages', PRIMARY)],
    [btn('Set Max Size (MB)', 'o_set_up:maxFileSizeMB', PRIMARY)],
    [btn('Set Max Days', 'o_set_up:maxScheduleDays', PRIMARY)],
    [{ text: '‹ Back', callback_data: 'o_settings' }]
  ];
  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } }).catch(()=>{});
}
async function uploadsSet(ctx, field) {
  const u = await settingsManager.getGroup('uploads');
  ctx.setState({ step: 'o_settings_set_up', upField: field });
  await ctx.editMessageText(
    `<b>Set Upload Limit</b>\n\nCurrent ${field}: ${u[field]}\n\nSend new numeric value:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{text:'❌ Cancel', callback_data:'o_settings_uploads'}]] } }
  ).catch(()=>{});
}
async function uploadsInput(ctx) {
  const field = ctx.userState.upField;
  clearState(ctx.from.id);
  const val = parseInt(ctx.message.text);
  if (isNaN(val)) return ctx.reply('Invalid number.', {reply_markup: {inline_keyboard: [[{text:'‹ Back', callback_data:'o_settings_uploads'}]]}});
  await settingsManager.set(`uploads.${field}`, val);
  await ctx.reply(`✅ Updated ${field} to ${val}`, {reply_markup: {inline_keyboard: [[{text:'‹ Back', callback_data:'o_settings_uploads'}]]}});
}

// ── Cooldowns ─────────────────────────────────────────────────────────────
async function cooldownsPanel(ctx) {
  const c = await settingsManager.getGroup('cooldowns');
  const text = [
    ui.screenHeader(config.bot.name, 'Cooldowns'),
    '',
    ui.blockquote([
      `Pairing: [${c.pairingMs}ms]`,
      `Group join: [${c.groupJoinMs}ms]`,
      `Broadcast delay: [${c.broadcastDelayMs}ms]`
    ])
  ].join('\n');
  const btns = [
    [btn('Set Pairing Ms', 'o_set_cool:pairingMs', PRIMARY)],
    [btn('Set Group Join Ms', 'o_set_cool:groupJoinMs', PRIMARY)],
    [btn('Set Broadcast Delay Ms', 'o_set_cool:broadcastDelayMs', PRIMARY)],
    [{ text: '‹ Back', callback_data: 'o_settings' }]
  ];
  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } }).catch(()=>{});
}
async function cooldownsSet(ctx, field) {
  const c = await settingsManager.getGroup('cooldowns');
  ctx.setState({ step: 'o_settings_set_cool', coolField: field });
  await ctx.editMessageText(
    `<b>Set Cooldown</b>\n\nCurrent ${field}: ${c[field]}\n\nSend new numeric value:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{text:'❌ Cancel', callback_data:'o_settings_cooldowns'}]] } }
  ).catch(()=>{});
}
async function cooldownsInput(ctx) {
  const field = ctx.userState.coolField;
  clearState(ctx.from.id);
  const val = parseInt(ctx.message.text);
  if (isNaN(val)) return ctx.reply('Invalid number.', {reply_markup: {inline_keyboard: [[{text:'‹ Back', callback_data:'o_settings_cooldowns'}]]}});
  await settingsManager.set(`cooldowns.${field}`, val);
  await ctx.reply(`✅ Updated ${field} to ${val}`, {reply_markup: {inline_keyboard: [[{text:'‹ Back', callback_data:'o_settings_cooldowns'}]]}});
}

// ── Scheduler ─────────────────────────────────────────────────────────────
async function schedulerPanel(ctx) {
  const s = await settingsManager.getGroup('scheduler');
  const text = [
    ui.screenHeader(config.bot.name, 'Scheduler'),
    '',
    ui.blockquote([
      `Auto-cleanup: [${s.cleanupEnabled ? '✅' : '⛔'}]`,
      `Cleanup after: [${s.autoCleanupDays} days]`
    ])
  ].join('\n');
  const btns = [
    [btn(s.cleanupEnabled ? '⛔ Disable Cleanup' : '✅ Enable Cleanup', 'o_set_sch_tg:cleanupEnabled', s.cleanupEnabled ? DANGER : SUCCESS)],
    [btn('Set Cleanup Days', 'o_set_sch_days', PRIMARY)],
    [{ text: '‹ Back', callback_data: 'o_settings' }]
  ];
  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } }).catch(()=>{});
}
async function schedulerToggle(ctx, field) {
  await settingsManager.toggle(`scheduler.${field}`);
  await ctx.answerCbQuery('✅ Updated').catch(()=>{});
  await schedulerPanel(ctx);
}
async function schedulerSetDays(ctx) {
  const s = await settingsManager.getGroup('scheduler');
  ctx.setState({ step: 'o_settings_set_sch_days' });
  await ctx.editMessageText(
    `<b>Set Cleanup Days</b>\n\nCurrent: ${s.autoCleanupDays}\n\nSend new numeric value:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{text:'❌ Cancel', callback_data:'o_settings_scheduler'}]] } }
  ).catch(()=>{});
}
async function schedulerDaysInput(ctx) {
  clearState(ctx.from.id);
  const val = parseInt(ctx.message.text);
  if (isNaN(val)) return ctx.reply('Invalid number.', {reply_markup: {inline_keyboard: [[{text:'‹ Back', callback_data:'o_settings_scheduler'}]]}});
  await settingsManager.set(`scheduler.autoCleanupDays`, val);
  await ctx.reply(`✅ Updated to ${val} days`, {reply_markup: {inline_keyboard: [[{text:'‹ Back', callback_data:'o_settings_scheduler'}]]}});
}

// ── WhatsApp Channel ──────────────────────────────────────────────────────
async function waPanel(ctx) {
  const w = await settingsManager.getGroup('whatsapp');
  const text = [
    ui.screenHeader(config.bot.name, 'WhatsApp Channel Publishing'),
    '',
    ui.blockquote([
      `Publishing: [${w.channelEnabled ? '✅' : '⛔'}]`,
      `Auto-publish drops: [${w.autoPublishDrops ? '✅' : '⛔'}]`,
      `Auto-join on web pair: [${w.autoJoinEnabled ? '✅' : '⛔'}]`,
      `Join channel: [${w.autoJoinChannel || 'Not set'}]`,
      `Retry on failure: [${w.retryOnFailure ? '✅' : '⛔'}]`,
      `Max retries: [${w.maxRetries}]`,
      `Duplicate prevention: [${w.duplicatePreventionHrs} hours]`,
      `Drop forwarding: [${w.forwardingEnabled ? '✅' : '⛔'}]`,
      `Forward destinations: [${(w.forwardingDestinations || []).length}]`
    ])
  ].join('\n');
  const btns = [
    [btn(w.channelEnabled ? '⛔ Disable Publishing' : '✅ Enable Publishing', 'o_set_wa_tg:channelEnabled', w.channelEnabled ? DANGER : SUCCESS)],
    [btn(w.autoPublishDrops ? '⛔ Disable Auto-publish' : '✅ Enable Auto-publish', 'o_set_wa_tg:autoPublishDrops', w.autoPublishDrops ? DANGER : SUCCESS)],
    [btn(w.autoJoinEnabled ? '⛔ Disable Auto-Join' : '✅ Enable Auto-Join', 'o_set_wa_tg:autoJoinEnabled', w.autoJoinEnabled ? DANGER : SUCCESS)],
    [btn('🔗 Set Auto-Join Channel Link', 'o_set_wa_join_link', PRIMARY)],
    [btn(w.retryOnFailure ? '⛔ Disable Retries' : '✅ Enable Retries', 'o_set_wa_tg:retryOnFailure', w.retryOnFailure ? DANGER : SUCCESS)],
    [btn('Set Max Retries', 'o_set_wa_retries:maxRetries', PRIMARY)],
    [btn('Set Dup Prevention Hrs', 'o_set_wa_retries:duplicatePreventionHrs', PRIMARY)],
    [btn('📣 Daily Drop Forwarding', 'o_settings_wa_forward', PRIMARY)],
    [{ text: '‹ Back', callback_data: 'o_settings' }]
  ];
  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } }).catch(()=>{});
}
async function waToggle(ctx, field) {
  await settingsManager.toggle(`whatsapp.${field}`);
  await ctx.answerCbQuery('✅ Updated').catch(()=>{});
  await waPanel(ctx);
}

async function waForwardPanel(ctx) {
  const w = await settingsManager.getGroup('whatsapp');
  const destinations = w.forwardingDestinations || [];
  const timesPerDay = w.forwardTimesPerDay || 1;
  const btnText = w.forwardButtonText || '📢 Join Our WA Channel';
  const btnUrl = w.forwardButtonUrl || '';
  const text = [
    ui.screenHeader(config.bot.name, 'Daily Drop Forwarding'),
    '',
    ui.blockquote([
      `Forwarding: [${w.forwardingEnabled ? '✅ Enabled' : '⛔ Disabled'}]`,
      `Times per day: [${timesPerDay}x]`,
      `Button text: [${btnText}]`,
      `Button URL: [${btnUrl || 'Not set'}]`,
      `Destinations: [${destinations.length}]`,
      'Sends the Daily Drop album to each group with @mentions + a channel link button.',
    ]),
    '',
    destinations.length
      ? '<blockquote expandable>' + destinations.map((jid, i) => `${i + 1}. ${ui.esc(jid)}`).join('\n') + '</blockquote>'
      : '<blockquote>No forwarding groups configured.</blockquote>',
  ].join('\n');
  const btns = [
    [btn(w.forwardingEnabled ? '⛔ Disable Forwarding' : '✅ Enable Forwarding', 'o_set_wa_tg:forwardingEnabled', w.forwardingEnabled ? DANGER : SUCCESS)],
    [btn('🔢 Set Times Per Day', 'o_wa_fwd_times', PRIMARY)],
    [btn('✏️ Set Button Text', 'o_wa_fwd_btn_text', PRIMARY)],
    [btn('🔗 Set Button URL', 'o_wa_fwd_btn_url', PRIMARY)],
    [btn('➕ Add Destination Group', 'o_wa_forward_add', SUCCESS)],
    ...destinations.map((jid, i) => [btn(`🗑 Remove ${i + 1}: ${jid.slice(0, 20)}...`, `o_wa_forward_remove:${i}`, DANGER)]),
    [{ text: '‹ Back to WA Channel', callback_data: 'o_settings_wa' }],
  ];
  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } }).catch(() => {});
}
async function waForwardAddPrompt(ctx) {
  ctx.setState({ step: 'o_settings_wa_forward_add' });
  await ctx.editMessageText([
    ui.screenHeader(config.bot.name, 'Add Forward Destination'),
    '',
    '<blockquote>Send a WhatsApp group JID ending in <code>@g.us</code>.</blockquote>',
    '<blockquote expandable>Tip: Owner Panel → JID List shows joined WhatsApp groups.</blockquote>'
  ].join('\n'), { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{text:'❌ Cancel', callback_data:'o_settings_wa_forward'}]] } }).catch(()=>{});
}
async function waForwardAddInput(ctx) {
  clearState(ctx.from.id);
  const jid = ctx.message.text?.trim();
  if (!jid || !jid.endsWith('@g.us')) return ctx.reply(ui.error('Invalid Group JID', 'Destination must end with <code>@g.us</code>.'), { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{text:'‹ Back', callback_data:'o_settings_wa_forward'}]] } });
  const w = await settingsManager.getGroup('whatsapp');
  const destinations = Array.from(new Set([...(w.forwardingDestinations || []), jid]));
  await settingsManager.set('whatsapp.forwardingDestinations', destinations);
  await ctx.reply(ui.success('Forward Destination Added', jid), { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{text:'‹ Back', callback_data:'o_settings_wa_forward'}]] } });
}
async function waForwardRemove(ctx, index) {
  const w = await settingsManager.getGroup('whatsapp');
  const destinations = w.forwardingDestinations || [];
  destinations.splice(Number(index), 1);
  await settingsManager.set('whatsapp.forwardingDestinations', destinations);
  await ctx.answerCbQuery('✅ Removed').catch(()=>{});
  return waForwardPanel(ctx);
}

async function waForwardTimesPrompt(ctx) {
  const w = await settingsManager.getGroup('whatsapp');
  ctx.setState({ step: 'o_settings_wa_fwd_times' });
  await ctx.editMessageText(
    `<b>Set Forward Times Per Day</b>\n\nCurrent: ${w.forwardTimesPerDay || 1}x per day\n\nSend a number (1–24):`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'o_settings_wa_forward' }]] } }
  ).catch(() => {});
}
async function waForwardTimesInput(ctx) {
  clearState(ctx.from.id);
  const val = Math.min(24, Math.max(1, parseInt(ctx.message.text) || 1));
  await settingsManager.set('whatsapp.forwardTimesPerDay', val);
  await ctx.reply(`✅ Forward set to ${val}x per day`, { reply_markup: { inline_keyboard: [[{ text: '‹ Back', callback_data: 'o_settings_wa_forward' }]] } });
}
async function waForwardBtnTextPrompt(ctx) {
  const w = await settingsManager.getGroup('whatsapp');
  ctx.setState({ step: 'o_settings_wa_fwd_btn_text' });
  await ctx.editMessageText(
    `<b>Set Forward Button Text</b>\n\nCurrent: ${w.forwardButtonText || '📢 Join Our WA Channel'}\n\nSend new button text (max 30 chars):`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'o_settings_wa_forward' }]] } }
  ).catch(() => {});
}
async function waForwardBtnTextInput(ctx) {
  clearState(ctx.from.id);
  const val = ctx.message.text?.trim().slice(0, 30);
  await settingsManager.set('whatsapp.forwardButtonText', val);
  await ctx.reply(`✅ Button text set to: ${val}`, { reply_markup: { inline_keyboard: [[{ text: '‹ Back', callback_data: 'o_settings_wa_forward' }]] } });
}
async function waForwardBtnUrlPrompt(ctx) {
  const w = await settingsManager.getGroup('whatsapp');
  ctx.setState({ step: 'o_settings_wa_fwd_btn_url' });
  await ctx.editMessageText(
    `<b>Set Forward Button URL</b>\n\nCurrent: ${w.forwardButtonUrl || 'Not set'}\n\nSend the URL (e.g. your WA channel link or Telegram link):`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'o_settings_wa_forward' }]] } }
  ).catch(() => {});
}
async function waForwardBtnUrlInput(ctx) {
  clearState(ctx.from.id);
  const val = ctx.message.text?.trim();
  await settingsManager.set('whatsapp.forwardButtonUrl', val);
  await ctx.reply(`✅ Button URL set to: ${val}`, { reply_markup: { inline_keyboard: [[{ text: '‹ Back', callback_data: 'o_settings_wa_forward' }]] } });
}
async function waSetRetries(ctx, field) {
  const w = await settingsManager.getGroup('whatsapp');
  ctx.setState({ step: 'o_settings_set_wa', waField: field });
  await ctx.editMessageText(
    `<b>Set WA Channel Setting</b>\n\nCurrent ${field}: ${w[field]}\n\nSend new numeric value:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{text:'❌ Cancel', callback_data:'o_settings_wa'}]] } }
  ).catch(()=>{});
}
async function waSetJoinLinkPrompt(ctx) {
  const w = await settingsManager.getGroup('whatsapp');
  ctx.setState({ step: 'o_settings_set_wa_join_link' });
  await ctx.editMessageText(
    [
      ui.screenHeader(config.bot.name, 'Set Auto-Join Channel Link'),
      '',
      ui.blockquote([`Current: ${w.autoJoinChannel || 'Not set'}`]),
      '',
      '<blockquote>Send the full WhatsApp channel invite link:</blockquote>',
      '<blockquote>Example: `https://whatsapp.com/channel/XXXXXXXX`</blockquote>'
    ].join('\n'),
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{text:'❌ Cancel', callback_data:'o_settings_wa'}]] } }
  ).catch(()=>{});
}
async function waSetJoinLinkInput(ctx) {
  clearState(ctx.from.id);
  const val = ctx.message.text?.trim();
  if (!val.startsWith('https://whatsapp.com/channel/') && !val.startsWith('https://chat.whatsapp.com/')) {
    return ctx.reply(ui.error('Invalid link', 'Must be a whatsapp.com/channel or chat.whatsapp.com link.'), { parse_mode: 'HTML' });
  }
  await settingsManager.set('whatsapp.autoJoinChannel', val);
  // Also write to the API server env file so it picks it up on next restart
  const fs = require('fs');
  try {
    let envContent = fs.readFileSync('/root/pappy-pfp/artifacts/api-server/.env', 'utf8');
    if (envContent.includes('WA_AUTO_JOIN_CHANNEL=')) {
      envContent = envContent.replace(/WA_AUTO_JOIN_CHANNEL=.*/g, `WA_AUTO_JOIN_CHANNEL=${val}`);
    } else {
      envContent += `\nWA_AUTO_JOIN_CHANNEL=${val}`;
    }
    fs.writeFileSync('/root/pappy-pfp/artifacts/api-server/.env', envContent);
  } catch(e) { /* non-fatal */ }
  await ctx.reply(ui.success('Auto-Join Channel Set', val), { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{text:'‹ Back', callback_data:'o_settings_wa'}]] } });
}

async function waRetriesInput(ctx) {
  const field = ctx.userState.waField;
  clearState(ctx.from.id);
  const val = parseInt(ctx.message.text);
  if (isNaN(val)) return ctx.reply('Invalid number.', {reply_markup: {inline_keyboard: [[{text:'‹ Back', callback_data:'o_settings_wa'}]]}});
  await settingsManager.set(`whatsapp.${field}`, val);
  await ctx.reply(`✅ Updated ${field} to ${val}`, {reply_markup: {inline_keyboard: [[{text:'‹ Back', callback_data:'o_settings_wa'}]]}});
}

// ── Categories ────────────────────────────────────────────────────────────
async function categoriesPanel(ctx) {
  const c = await settingsManager.getGroup('categories');
  const disabled = c.disabled || [];
  const { CATEGORIES, CATEGORY_META } = require('../services/wallpaper');
  const active = CATEGORIES.filter(cat => !disabled.includes(cat) && !disabled.includes(`wp_${cat}`));

  const text = [
    ui.screenHeader(config.bot.name, 'Category Manager'),
    '',
    `<blockquote>✅ Active: ${active.length} / ${CATEGORIES.length}\n\nTap to toggle on/off. Active categories rotate in daily drop.</blockquote>`,
  ].join('\n');

  const btns = [];
  for (let i = 0; i < CATEGORIES.length; i += 2) {
    const row = [];
    for (const cat of [CATEGORIES[i], CATEGORIES[i+1]].filter(Boolean)) {
      const meta = CATEGORY_META[cat] || { emoji: '🖼️', name: cat };
      const isOff = disabled.includes(cat) || disabled.includes(`wp_${cat}`);
      row.push(btn(`${isOff ? '⛔' : '✅'} ${meta.emoji} ${meta.name}`, `o_set_cat:${cat}`, isOff ? DANGER : SUCCESS));
    }
    btns.push(row);
  }
  btns.push([btn('✅ Enable All', 'o_cats_enable_all', SUCCESS), btn('⛔ Disable All', 'o_cats_disable_all', DANGER)]);
  btns.push([{ text: '‹ Back', callback_data: 'o_settings' }]);
  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } }).catch(() => {});
}
async function categoryToggle(ctx, cat) {
  const c = await settingsManager.getGroup('categories');
  let disabled = c.disabled || [];
  const key = cat.startsWith('wp_') ? cat.slice(3) : cat;
  if (disabled.includes(key) || disabled.includes(`wp_${key}`)) {
    disabled = disabled.filter(x => x !== key && x !== `wp_${key}`);
  } else {
    disabled.push(key);
  }
  await settingsManager.set('categories.disabled', disabled);
  await ctx.answerCbQuery('✅ Updated').catch(() => {});
  await categoriesPanel(ctx);
}
async function categoryEnableAll(ctx) {
  await settingsManager.set('categories.disabled', []);
  await ctx.answerCbQuery('✅ All enabled').catch(() => {});
  await categoriesPanel(ctx);
}
async function categoryDisableAll(ctx) {
  const { CATEGORIES } = require('../services/wallpaper');
  await settingsManager.set('categories.disabled', [...CATEGORIES]);
  await ctx.answerCbQuery('⛔ All disabled').catch(() => {});
  await categoriesPanel(ctx);
}

// ── WA Drop Settings ─────────────────────────────────────────────
async function waDropPanel(ctx) {
  const w = await settingsManager.getGroup('waChannel');
  const { CATEGORIES } = require('../services/wallpaper');
  const cats = (Array.isArray(w.categories) && w.categories.length) ? w.categories : ['all categories'];
  const text = [
    ui.screenHeader(config.bot.name, 'WA Channel Drop Settings'),
    '',
    ui.blockquote([
      `Enabled: [${w.enabled ? '✅' : '⛔'}]`,
      `Times per day: [${w.timesPerDay || 2}x]`,
      `Images per drop: [${w.imagesPerDrop || 10}]`,
      `Categories: [${cats.join(', ').slice(0, 60)}${cats.length > 3 ? '...' : ''}]`,
    ])
  ].join('\n');
  const btns = [
    [btn(w.enabled ? '⛔ Disable WA Drop' : '✅ Enable WA Drop', 'o_wa_drop_toggle', w.enabled ? DANGER : SUCCESS)],
    [btn('🔢 Set Times Per Day', 'o_wa_drop_times', PRIMARY)],
    [btn('🖼 Set Images Per Drop', 'o_wa_drop_images', PRIMARY)],
    [btn('📁 Set Categories', 'o_wa_drop_cats', PRIMARY)],
    [{ text: '‹ Back', callback_data: 'o_settings' }],
  ];
  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } }).catch(() => {});
}
async function waDropToggle(ctx) {
  await settingsManager.toggle('waChannel.enabled');
  await ctx.answerCbQuery('✅ Updated').catch(() => {});
  await waDropPanel(ctx);
}
async function waDropTimesPrompt(ctx) {
  const w = await settingsManager.getGroup('waChannel');
  ctx.setState({ step: 'o_settings_wa_drop_times' });
  await ctx.editMessageText(
    `<b>WA Drop Times Per Day</b>\n\nCurrent: ${w.timesPerDay || 2}x\n\nSend a number (1–24):`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'o_settings_wa_drop' }]] } }
  ).catch(() => {});
}
async function waDropTimesInput(ctx) {
  clearState(ctx.from.id);
  const val = Math.min(24, Math.max(1, parseInt(ctx.message.text) || 2));
  await settingsManager.set('waChannel.timesPerDay', val);
  await ctx.reply(`✅ WA drop set to ${val}x per day`, { reply_markup: { inline_keyboard: [[{ text: '‹ Back', callback_data: 'o_settings_wa_drop' }]] } });
}
async function waDropImagesPrompt(ctx) {
  const w = await settingsManager.getGroup('waChannel');
  ctx.setState({ step: 'o_settings_wa_drop_images' });
  await ctx.editMessageText(
    `<b>WA Images Per Drop</b>\n\nCurrent: ${w.imagesPerDrop || 10}\n\nSend a number (1–10):`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'o_settings_wa_drop' }]] } }
  ).catch(() => {});
}
async function waDropImagesInput(ctx) {
  clearState(ctx.from.id);
  const val = Math.min(10, Math.max(1, parseInt(ctx.message.text) || 10));
  await settingsManager.set('waChannel.imagesPerDrop', val);
  await ctx.reply(`✅ WA images per drop set to ${val}`, { reply_markup: { inline_keyboard: [[{ text: '‹ Back', callback_data: 'o_settings_wa_drop' }]] } });
}
async function waDropCatsPrompt(ctx) {
  ctx.setState({ step: 'o_settings_wa_drop_cats' });
  await ctx.editMessageText([
    ui.screenHeader(config.bot.name, 'WA Drop Categories'),
    '',
    '<blockquote>Send comma-separated category keys, or send <code>all</code> to use all categories.</blockquote>',
    '<blockquote expandable>Examples:\nanime, dark_anime, manhwa, cyberpunk\n\nOr just: all</blockquote>',
  ].join('\n'), { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'o_settings_wa_drop' }]] } }).catch(() => {});
}
async function waDropCatsInput(ctx) {
  clearState(ctx.from.id);
  const raw = ctx.message.text?.trim();
  if (raw.toLowerCase() === 'all') {
    await settingsManager.set('waChannel.categories', []);
    return ctx.reply('✅ WA drop will use all categories', { reply_markup: { inline_keyboard: [[{ text: '‹ Back', callback_data: 'o_settings_wa_drop' }]] } });
  }
  const { CATEGORIES } = require('../services/wallpaper');
  const cats = raw.split(',').map(s => s.trim().toLowerCase()).filter(s => CATEGORIES.includes(s));
  if (!cats.length) return ctx.reply(ui.error('Invalid', 'No valid categories found. Check spelling.'), { parse_mode: 'HTML' });
  await settingsManager.set('waChannel.categories', cats);
  await ctx.reply(`✅ WA categories set: ${cats.join(', ')}`, { reply_markup: { inline_keyboard: [[{ text: '‹ Back', callback_data: 'o_settings_wa_drop' }]] } });
}

// ── WA Group Drop Settings ──────────────────────────────────────
async function waGroupPanel(ctx) {
  const w = await settingsManager.getGroup('waGroup');
  const dests = w.destinations || [];
  const text = [
    ui.screenHeader(config.bot.name, 'WA Group Drop Settings'),
    '',
    ui.blockquote([
      `Enabled: [${w.enabled ? '✅' : '⛔'}]`,
      `Times per day: [${w.timesPerDay || 2}x]`,
      `Mention all: [${w.mentionAll ? '✅' : '⛔'}]`,
      `Button text: [${w.buttonText || '📢 Join Our Channel'}]`,
      `Button URL: [${w.buttonUrl || 'Not set'}]`,
      `Groups: [${dests.length}]`,
    ]),
    '',
    dests.length
      ? '<blockquote expandable>' + dests.map((j, i) => `${i + 1}. ${ui.esc(j)}`).join('\n') + '</blockquote>'
      : '<blockquote>No groups added yet.</blockquote>',
  ].join('\n');
  const btns = [
    [btn(w.enabled ? '⛔ Disable Group Drop' : '✅ Enable Group Drop', 'o_wa_grp_toggle', w.enabled ? DANGER : SUCCESS)],
    [btn(w.mentionAll ? '⛔ Disable @Mentions' : '✅ Enable @Mentions', 'o_wa_grp_mention', w.mentionAll ? DANGER : SUCCESS)],
    [btn('🔢 Times Per Day', 'o_wa_grp_times', PRIMARY)],
    [btn('✏️ Button Text', 'o_wa_grp_btn_text', PRIMARY)],
    [btn('🔗 Button URL', 'o_wa_grp_btn_url', PRIMARY)],
    [btn('➕ Add Group JID', 'o_wa_grp_add', SUCCESS)],
    ...dests.map((j, i) => [btn(`🗑 Remove ${i + 1}: ${j.slice(0, 20)}...`, `o_wa_grp_remove:${i}`, DANGER)]),
    [{ text: '‹ Back', callback_data: 'o_settings' }],
  ];
  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } }).catch(() => {});
}
async function waGroupToggle(ctx) {
  await settingsManager.toggle('waGroup.enabled');
  await ctx.answerCbQuery('✅ Updated').catch(() => {});
  await waGroupPanel(ctx);
}
async function waGroupMentionToggle(ctx) {
  await settingsManager.toggle('waGroup.mentionAll');
  await ctx.answerCbQuery('✅ Updated').catch(() => {});
  await waGroupPanel(ctx);
}
async function waGroupTimesPrompt(ctx) {
  const w = await settingsManager.getGroup('waGroup');
  ctx.setState({ step: 'o_settings_wa_grp_times' });
  await ctx.editMessageText(
    `<b>WA Group Drop Times Per Day</b>\n\nCurrent: ${w.timesPerDay || 2}x\n\nSend a number (1–24):`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'o_settings_wa_group' }]] } }
  ).catch(() => {});
}
async function waGroupTimesInput(ctx) {
  clearState(ctx.from.id);
  const val = Math.min(24, Math.max(1, parseInt(ctx.message.text) || 2));
  await settingsManager.set('waGroup.timesPerDay', val);
  await ctx.reply(`✅ Group drop set to ${val}x per day`, { reply_markup: { inline_keyboard: [[{ text: '‹ Back', callback_data: 'o_settings_wa_group' }]] } });
}
async function waGroupBtnTextPrompt(ctx) {
  const w = await settingsManager.getGroup('waGroup');
  ctx.setState({ step: 'o_settings_wa_grp_btn_text' });
  await ctx.editMessageText(
    `<b>Group Drop Button Text</b>\n\nCurrent: ${w.buttonText || '📢 Join Our Channel'}\n\nSend new button text (max 30 chars):`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'o_settings_wa_group' }]] } }
  ).catch(() => {});
}
async function waGroupBtnTextInput(ctx) {
  clearState(ctx.from.id);
  const val = ctx.message.text?.trim().slice(0, 30);
  await settingsManager.set('waGroup.buttonText', val);
  await ctx.reply(`✅ Button text: ${val}`, { reply_markup: { inline_keyboard: [[{ text: '‹ Back', callback_data: 'o_settings_wa_group' }]] } });
}
async function waGroupBtnUrlPrompt(ctx) {
  const w = await settingsManager.getGroup('waGroup');
  ctx.setState({ step: 'o_settings_wa_grp_btn_url' });
  await ctx.editMessageText(
    `<b>Group Drop Button URL</b>\n\nCurrent: ${w.buttonUrl || 'Not set'}\n\nSend the URL (WA channel link or Telegram link):`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'o_settings_wa_group' }]] } }
  ).catch(() => {});
}
async function waGroupBtnUrlInput(ctx) {
  clearState(ctx.from.id);
  const val = ctx.message.text?.trim();
  await settingsManager.set('waGroup.buttonUrl', val);
  await ctx.reply(`✅ Button URL set`, { reply_markup: { inline_keyboard: [[{ text: '‹ Back', callback_data: 'o_settings_wa_group' }]] } });
}
async function waGroupAddPrompt(ctx) {
  ctx.setState({ step: 'o_settings_wa_grp_add' });
  await ctx.editMessageText([
    ui.screenHeader(config.bot.name, 'Add WA Group'),
    '',
    '<blockquote>Send a WhatsApp group JID ending in <code>@g.us</code>.</blockquote>',
    '<blockquote expandable>Use /jid to list all groups the owner WA is in.</blockquote>',
  ].join('\n'), { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'o_settings_wa_group' }]] } }).catch(() => {});
}
async function waGroupAddInput(ctx) {
  clearState(ctx.from.id);
  const jid = ctx.message.text?.trim();
  if (!jid?.endsWith('@g.us')) return ctx.reply(ui.error('Invalid JID', 'Must end with <code>@g.us</code>'), { parse_mode: 'HTML' });
  const w = await settingsManager.getGroup('waGroup');
  const dests = Array.from(new Set([...(w.destinations || []), jid]));
  await settingsManager.set('waGroup.destinations', dests);
  await ctx.reply(ui.success('Group Added', jid), { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '‹ Back', callback_data: 'o_settings_wa_group' }]] } });
}
async function waGroupRemove(ctx, index) {
  const w = await settingsManager.getGroup('waGroup');
  const dests = w.destinations || [];
  dests.splice(Number(index), 1);
  await settingsManager.set('waGroup.destinations', dests);
  await ctx.answerCbQuery('✅ Removed').catch(() => {});
  return waGroupPanel(ctx);
}

// ── Custom Category (inline) ─────────────────────────────────────────────
async function addCatPrompt(ctx) {
  ctx.setState({ step: 'o_settings_addcat' });
  await ctx.editMessageText([
    ui.screenHeader(config.bot.name, 'Add Custom Category'),
    '',
    '<blockquote>Send in this format:</blockquote>',
    '<blockquote expandable>key | Display Name | 🎨 | search query dump | tag1,tag2,tag3\n\nExample:\nmy_dark_pfp | My Dark PFP | 🌑 | dark aesthetic pfp dump | DarkPFP,AestheticPFP</blockquote>',
  ].join('\n'), { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'o_settings_cats' }]] } }).catch(() => {});
}
async function addCatInput(ctx) {
  clearState(ctx.from.id);
  const { CustomCategory } = require('../database/models');
  const raw = ctx.message.text?.trim();
  const parts = raw.split('|').map(s => s.trim());
  if (parts.length < 4) return ctx.reply(ui.error('Invalid Format', 'Need: key | name | emoji | query'), { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '‹ Back', callback_data: 'o_settings_cats' }]] } });
  const [key, name, emoji, query, tagsRaw] = parts;
  const keyClean = key.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40);
  const hashtags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
  await CustomCategory.findOneAndUpdate({ key: keyClean }, { key: keyClean, name, emoji: emoji || '🖼️', query, hashtags, isActive: true }, { upsert: true });
  await ctx.reply(ui.success('Category Added', `${emoji || '🖼️'} <b>${name}</b> — <code>${keyClean}</code>`), { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '‹ Back', callback_data: 'o_settings_cats' }]] } });
}
async function viewSuggestions(ctx) {
  const { CategorySuggestion } = require('../database/models');
  const pending = await CategorySuggestion.find({ status: 'pending' }).sort({ addedAt: -1 }).limit(20);
  if (!pending.length) return ctx.reply(ui.info('No Pending Suggestions', 'All caught up!'), { parse_mode: 'HTML' });
  const lines = [`${ui.bold(`Pending Suggestions (${pending.length}):`)}`, ''];
  for (const s of pending) lines.push(`• ${ui.esc(s.suggestion)}\n  ${ui.italic(`@${ui.esc(s.username || s.telegramId)} · ${new Date(s.addedAt).toLocaleDateString()}`)}`);
  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
}

// ── Convenience aliases (used by callbackRouter) ──────────────────────────────
async function dropAutoToggle(ctx) { return dropToggle(ctx, 'autoDropEnabled'); }
async function waAutoToggle(ctx)   { return waToggle(ctx, 'autoPublishDrops'); }

// ── Generic input dispatcher (called from messageRouter) ─────────────────
async function handleInput(ctx, _bot) {
  const step = ctx.userState?.step;
  if (!step) return;
  if (step === 'o_settings_set_drop_val')    return dropSetImagesInput(ctx);
  if (step === 'o_settings_set_wm_val')      return wmSetOpacityInput(ctx);
  if (step === 'o_settings_set_wm_text')     return wmSetTextInput(ctx);
  if (step === 'o_settings_set_rate')        return rateLimitInput(ctx);
  if (step === 'o_settings_set_maint_msg')   return maintMsgInput(ctx);
  if (step === 'o_settings_set_up')          return uploadsInput(ctx);
  if (step === 'o_settings_set_cool')        return cooldownsInput(ctx);
  if (step === 'o_settings_set_sch_days')    return schedulerDaysInput(ctx);
  if (step === 'o_settings_set_wa')          return waRetriesInput(ctx);
  if (step === 'o_settings_set_wa_join_link') return waSetJoinLinkInput(ctx);
  if (step === 'o_settings_wa_forward_add')    return waForwardAddInput(ctx);
  if (step === 'o_settings_wa_fwd_times')       return waForwardTimesInput(ctx);
  if (step === 'o_settings_wa_fwd_btn_text')    return waForwardBtnTextInput(ctx);
  if (step === 'o_settings_wa_fwd_btn_url')     return waForwardBtnUrlInput(ctx);
  if (step === 'o_settings_wa_drop_times')      return waDropTimesInput(ctx);
  if (step === 'o_settings_wa_drop_images')     return waDropImagesInput(ctx);
  if (step === 'o_settings_wa_drop_cats')       return waDropCatsInput(ctx);
  if (step === 'o_settings_wa_grp_times')       return waGroupTimesInput(ctx);
  if (step === 'o_settings_wa_grp_btn_text')    return waGroupBtnTextInput(ctx);
  if (step === 'o_settings_wa_grp_btn_url')     return waGroupBtnUrlInput(ctx);
  if (step === 'o_settings_wa_grp_add')         return waGroupAddInput(ctx);
  if (step === 'o_settings_addcat')             return addCatInput(ctx);
}

module.exports = {
  settingsMenu,
  dropsPanel, dropToggle, dropAutoToggle, dropSetImagesPrompt, dropSetImagesInput,
  watermarkPanel, wmToggle, wmSetOpacityPrompt, wmSetOpacityInput, wmSetPositionPanel, wmSetPositionSelect, wmSetTextPrompt, wmSetTextInput, wmReset,
  enhancerPanel, enhancerToggleEnabled, enhancerToggleUpscale, enhancerToggleSharpen, enhancerToggleArtifacts,
  ratePanel, rateLimitSet, rateLimitInput,
  maintPanel, maintToggle, maintMsgPrompt, maintMsgInput,
  logPanel, logSetLevel, logToggleDebug,
  uploadsPanel, uploadsSet, uploadsInput,
  cooldownsPanel, cooldownsSet, cooldownsInput,
  schedulerPanel, schedulerToggle, schedulerSetDays, schedulerDaysInput,
  waPanel, waToggle, waAutoToggle, waForwardPanel, waForwardAddPrompt, waForwardAddInput, waForwardRemove,
  waForwardTimesPrompt, waForwardTimesInput, waForwardBtnTextPrompt, waForwardBtnTextInput, waForwardBtnUrlPrompt, waForwardBtnUrlInput,
  waSetRetries, waRetriesInput, waSetJoinLinkPrompt, waSetJoinLinkInput,
  waDropPanel, waDropToggle, waDropTimesPrompt, waDropTimesInput, waDropImagesPrompt, waDropImagesInput, waDropCatsPrompt, waDropCatsInput,
  waGroupPanel, waGroupToggle, waGroupMentionToggle, waGroupTimesPrompt, waGroupTimesInput,
  waGroupBtnTextPrompt, waGroupBtnTextInput, waGroupBtnUrlPrompt, waGroupBtnUrlInput,
  waGroupAddPrompt, waGroupAddInput, waGroupRemove,
  handleInput,
  categoriesPanel, categoryToggle, categoryEnableAll, categoryDisableAll,
  addCatPrompt, addCatInput, viewSuggestions,
};