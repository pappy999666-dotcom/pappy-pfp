'use strict';
/**
 * ui.js — Telegram HTML Formatting for PAPPY PFP V3
 *
 * All functions return HTML strings for parse_mode: 'HTML'.
 * Telegram HTML supports:
 *   <b>bold</b>  <i>italic</i>  <u>underline</u>  <s>strike</s>
 *   <code>inline code</code>  <pre>block code</pre>
 *   <a href="url">link</a>
 *   <blockquote>blockquote</blockquote>
 *   <blockquote expandable>expandable (collapsed)</blockquote>
 *   <tg-spoiler>spoiler</tg-spoiler>
 *
 * NEVER use parse_mode: 'HTML' — use parse_mode: 'HTML' everywhere.
 * Use the send() helper from utils/send.js which sets HTML automatically.
 */

'use strict';

/** Escape special HTML chars so user input never breaks formatting */
function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Inline formatters ─────────────────────────────────────────────────────────
const bold   = t => `<b>${esc(t)}</b>`;
const italic = t => `<i>${esc(t)}</i>`;
const under  = t => `<u>${esc(t)}</u>`;
const strike = t => `<s>${esc(t)}</s>`;
const code   = t => `<code>${esc(t)}</code>`;
const pre    = (t, lang = '') => lang ? `<pre><code class="language-${lang}">${esc(t)}</code></pre>` : `<pre>${esc(t)}</pre>`;
const link   = (label, url) => `<a href="${url}">${esc(label)}</a>`;
const spoiler = t => `<tg-spoiler>${esc(t)}</tg-spoiler>`;

// ── Block formatters ──────────────────────────────────────────────────────────

/** Regular blockquote — always visible */
function blockquote(lines) {
  if (!Array.isArray(lines)) lines = [lines];
  return `<blockquote>${lines.map(esc).join('\n')}</blockquote>`;
}

/** Expandable blockquote — collapsed by default in Telegram */
function expandable(lines, title = '') {
  if (!Array.isArray(lines)) lines = [lines];
  const body = lines.map(esc).join('\n');
  return (title ? `${bold(title)}\n` : '') + `<blockquote expandable>${body}</blockquote>`;
}

// ── Layout ────────────────────────────────────────────────────────────────────
function divider() { return `<blockquote>┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄</blockquote>`; }
function spacer()  { return ''; }

function screenHeader(botName, screenName, subtitle = '') {
  const lines = [bold(botName)];
  if (screenName) lines.push(`✦ ${bold(screenName)}`);
  if (subtitle)   lines.push(italic(subtitle));
  return lines.join('\n');
}

function stat(emoji, label, value) {
  return `${emoji} ${esc(label)}: ${bold(String(value))}`;
}

function bullet(emoji, text) { return `${emoji} ${esc(text)}`; }

function statusDot(active, trueLabel = 'Active', falseLabel = 'Inactive') {
  return active ? `🟢 ${bold(trueLabel)}` : `🔴 ${bold(falseLabel)}`;
}

function toggleStatus(enabled) {
  return enabled ? `✅ ${bold('Enabled')}` : `⛔ ${bold('Disabled')}`;
}

function statsBlock(rows) {
  return rows.map(([e, l, v]) => stat(e, l, v)).join('\n');
}

// ── Message templates ─────────────────────────────────────────────────────────

function loading(action = 'Processing') {
  return `⏳ ${bold(action)}\n\n<blockquote>Please wait...</blockquote>`;
}

function success(title, detail = '', extra = '') {
  const parts = [`✅ ${bold(title)}`];
  if (detail) parts.push(`\n<blockquote>${detail}</blockquote>`);
  if (extra)  parts.push(`\n${extra}`);
  return parts.join('');
}

function warn(title, detail = '') {
  const parts = [`⚠️ ${bold(title)}`];
  if (detail) parts.push(`\n<blockquote>${detail}</blockquote>`);
  return parts.join('');
}

function info(title, detail = '') {
  const parts = [`ℹ️ ${bold(title)}`];
  if (detail) parts.push(`\n<blockquote>${detail}</blockquote>`);
  return parts.join('');
}

function error(title, message = '', fix = '', errorId = '') {
  const parts = [
    `❌ ${bold(title)}`,
    `\n<blockquote>${message || 'Something went wrong.'}</blockquote>`,
  ];
  if (fix) parts.push(`\n\n💡 ${bold('Try this:')}\n<blockquote>${fix}</blockquote>`);
  if (errorId) parts.push(`\n\n${code(`Error: ${errorId}`)}`);
  return parts.join('');
}

function confirm(title, detail = '', warning = '') {
  const parts = [`⚠️ ${bold(title)}`];
  if (detail)  parts.push(`\n<blockquote>${detail}</blockquote>`);
  if (warning) parts.push(`\n\n🔴 ${bold(warning)}`);
  parts.push(`\n\n${italic('Are you sure?')}`);
  return parts.join('');
}

// ── Pairing ───────────────────────────────────────────────────────────────────

function pairingCodeMessage(num, pairingCode) {
  return [
    `🔐 ${bold('Pairing Code')}`,
    '',
    `<blockquote>📱 Number: ${code('+' + num)}</blockquote>`,
    '',
    `<b>${code(pairingCode)}</b>`,
    '',
    `<blockquote expandable>${bold('Steps:')}\n1. Open WhatsApp on your phone\n2. Tap ⋮ → ${bold('Linked Devices')}\n3. Tap ${bold('Link a Device')}\n4. Tap ${bold('Link with phone number instead')}\n5. Enter the code above</blockquote>`,
    '',
    italic('⏳ Code expires in ~60 seconds'),
  ].join('\n');
}

function qrCaption(num) {
  return [
    `📷 ${bold('QR Code — Link WhatsApp')}`,
    '',
    `<blockquote>📱 Number: ${code('+' + num)}</blockquote>`,
    '',
    `<blockquote expandable>1. Open WhatsApp → ⋮ → ${bold('Linked Devices')}\n2. Tap ${bold('Link a Device')}\n3. Point your camera at this QR code</blockquote>`,
    '',
    italic('⏳ QR expires in ~60 seconds'),
  ].join('\n');
}

// ── Account ───────────────────────────────────────────────────────────────────

function accountHeader(num, isActive, autoJob = null) {
  const lines = [`📱 ${code('+' + num)}`, statusDot(isActive)];
  if (autoJob) lines.push(`🔄 Auto-change: every ${bold(String(autoJob.interval))} ${autoJob.mode}(s)`);
  return `<blockquote>${lines.join('\n')}</blockquote>`;
}

// ── Support ───────────────────────────────────────────────────────────────────

function ticketHeader(ticketId, status) {
  const dot = status === 'open' ? '🟡' : '✅';
  return [
    `🎫 ${bold('Support Ticket')}`,
    `<blockquote>${dot} Ticket: ${code(ticketId)}\nStatus: ${bold(status.toUpperCase())}</blockquote>`,
  ].join('\n');
}

// ── Progress ──────────────────────────────────────────────────────────────────

function taskProgress(label, current, total) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const filled = Math.round(pct / 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
  return `${esc(label)}\n${code(`[${bar}]`)} ${bold(`${pct}%`)} (${current}/${total})`;
}

// ── Media captions ────────────────────────────────────────────────────────────

function wallpaperCaption({ displayName, count, page, emoji, hashtags = [], botName = 'PAPPY PFP' }) {
  const tags = hashtags.slice(0, 6).map(t => `#${t}`).join(' ');
  const parts = [
    `${emoji} ${bold(displayName)}`,
    `<blockquote>📱 Phone-optimised HD wallpapers\n🖼 ${count} image${count !== 1 ? 's' : ''} · Page ${page}</blockquote>`,
    italic(`by ${botName}`),
  ];
  if (tags) parts.push(`<blockquote expandable>${esc(tags)}</blockquote>`);
  return parts.join('\n');
}

function dropCaption({ displayName, emoji, hashtags = [], botName = 'PAPPY PFP', botUsername = '', count = 10, description = '', webUrl = '', game = '' }) {
  const tags = hashtags.slice(0, 6).map(t => `#${t}`).join(' ');
  const botLink = botUsername ? link(`@${botUsername}`, `https://t.me/${botUsername}`) : bold(botName);
  const url = webUrl || '';
  return [
    `${emoji} ${bold(displayName.toUpperCase() + ' DROP')} ${emoji}`,
    `<blockquote>${bold('✦ ' + count + ' HD Wallpapers')}\n${esc(description || 'Aesthetic & Pinterest-worthy PFPs.')}</blockquote>`,
    `🔥 ${bold('Save your faves')} · 📲 ${bold('Set as wallpaper or PFP')}`,
    url ? `\n🌐 ${bold('Upload Full-Size WhatsApp PFP')}\n<blockquote>No crop • HD • One Tap\n${url}</blockquote>` : '',
    game ? `<blockquote>${esc(game)}</blockquote>` : '',
    `${italic('Powered by')} ${botLink}`,
    tags ? `<blockquote expandable>${esc(tags)}</blockquote>` : '',
  ].filter(Boolean).join('\n');
}

// ── Welcome ───────────────────────────────────────────────────────────────────

function welcomeMessage(botName, firstName) {
  const name = esc(firstName || 'there');
  return [
    `${bold(`Welcome back, ${name}!`)} 👋`,
    `<blockquote>${bold(botName)} — Your premium WhatsApp &amp; media companion</blockquote>`,
    italic('Select an option below to get started.'),
  ].join('\n');
}

// ── Text utils ────────────────────────────────────────────────────────────────

function truncate(str, len = 100, suffix = '…') {
  if (!str) return '';
  str = String(str);
  return str.length > len ? str.slice(0, len - suffix.length) + suffix : str;
}

// codeBlock kept as alias for backward compat
const codeBlock = code;

module.exports = {
  esc, bold, italic, under, strike, code, pre, link, spoiler, codeBlock,
  blockquote, expandable, divider, spacer,
  screenHeader, stat, bullet, statusDot, toggleStatus, statsBlock,
  loading, success, warn, info, error, confirm,
  pairingCodeMessage, qrCaption,
  accountHeader, ticketHeader, taskProgress,
  wallpaperCaption, dropCaption,
  welcomeMessage, truncate,
};
