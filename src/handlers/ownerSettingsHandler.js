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
  ].join('\n');

  const btns = [
    [btn('🌄 Daily Drops', 'o_settings_drops', PRIMARY), btn('⸸ Watermark', 'o_settings_wm', PRIMARY)],
    [btn('🔬 Enhancer', 'o_settings_enhance', PRIMARY), btn('🛡 Rate Limits', 'o_settings_rate', PRIMARY)],
    [btn('🔧 Maintenance', 'o_settings_maint', maint.enabled ? DANGER : PRIMARY), btn('📋 Logging', 'o_settings_log', PRIMARY)],
    [btn('📤 Uploads', 'o_settings_uploads', PRIMARY), btn('⏱ Cooldowns', 'o_settings_cooldowns', PRIMARY)],
    [btn('⏰ Scheduler', 'o_settings_scheduler', PRIMARY), btn('💬 WA Channel', 'o_settings_wa', PRIMARY)],
    [btn('📁 Categories', 'o_settings_cats', PRIMARY)],
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
  const text = [
    ui.screenHeader(config.bot.name, 'Daily Drop Forwarding'),
    '',
    ui.blockquote([
      `Forwarding: [${w.forwardingEnabled ? '✅ Enabled' : '⛔ Disabled'}]`,
      `Destinations: [${destinations.length}]`,
      'Posts the same Daily Drop album to selected WhatsApp groups after channel publishing.',
      'Group mentions are attempted when Baileys group metadata is available.'
    ]),
    '',
    destinations.length ? '<blockquote expandable>' + destinations.map((jid, i) => `${i + 1}. ${ui.esc(jid)}`).join('\n') + '</blockquote>' : '<blockquote>No forwarding groups configured.</blockquote>'
  ].join('\n');
  const btns = [
    [btn(w.forwardingEnabled ? '⛔ Disable Forwarding' : '✅ Enable Forwarding', 'o_set_wa_tg:forwardingEnabled', w.forwardingEnabled ? DANGER : SUCCESS)],
    [btn('➕ Add Destination Group', 'o_wa_forward_add', SUCCESS)],
    ...destinations.map((jid, i) => [btn(`🗑 Remove ${i + 1}`, `o_wa_forward_remove:${i}`, DANGER)]),
    [{ text: '‹ Back to WA Channel', callback_data: 'o_settings_wa' }]
  ];
  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } }).catch(()=>{});
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
  
  const K = require('../handlers/keyboards');
  const catBtns = K.wallpaperCategories().inline_keyboard.flat().filter(b => b.callback_data && b.callback_data.startsWith('wp_'));
  
  let text = [
    ui.screenHeader(config.bot.name, 'Categories'),
    '',
    '<blockquote>Toggle wallpaper categories.</blockquote>',
    ''
  ];
  
  const btns = [];
  for (let i = 0; i < catBtns.length; i += 2) {
    const row = [];
    const b1 = catBtns[i];
    if (b1) {
      const isOff1 = disabled.includes(b1.callback_data);
      row.push(btn(`${isOff1 ? '⛔' : '✅'} ${b1.text.replace(/^[^\w\s]+/, '').trim()}`, `o_set_cat:${b1.callback_data}`, isOff1 ? DANGER : SUCCESS));
    }
    const b2 = catBtns[i+1];
    if (b2) {
      const isOff2 = disabled.includes(b2.callback_data);
      row.push(btn(`${isOff2 ? '⛔' : '✅'} ${b2.text.replace(/^[^\w\s]+/, '').trim()}`, `o_set_cat:${b2.callback_data}`, isOff2 ? DANGER : SUCCESS));
    }
    if (row.length) btns.push(row);
  }
  btns.push([{ text: '‹ Back', callback_data: 'o_settings' }]);

  await ctx.editMessageText(text.join('\n'), { parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } }).catch(()=>{});
}
async function categoryToggle(ctx, cat) {
  const c = await settingsManager.getGroup('categories');
  let disabled = c.disabled || [];
  if (disabled.includes(cat)) {
    disabled = disabled.filter(x => x !== cat);
  } else {
    disabled.push(cat);
  }
  await settingsManager.set('categories.disabled', disabled);
  await ctx.answerCbQuery('✅ Updated').catch(()=>{});
  await categoriesPanel(ctx);
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
  if (step === 'o_settings_wa_forward_add') return waForwardAddInput(ctx);
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
  waPanel, waToggle, waAutoToggle, waForwardPanel, waForwardAddPrompt, waForwardAddInput, waForwardRemove, waSetRetries, waRetriesInput, waSetJoinLinkPrompt, waSetJoinLinkInput,
  handleInput,
  categoriesPanel, categoryToggle,
};