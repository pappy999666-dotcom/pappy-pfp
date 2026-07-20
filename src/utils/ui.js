/**
 * ui.js — Premium UI Formatting System for PAPPY PFP V3
 *
 * Provides a consistent, premium message formatting layer.
 * Uses Telegram's blockquote (>) and expandable blockquote (>>) syntax,
 * plus rich MarkdownV2-compatible helpers.
 *
 * NOTE: All exported functions return raw strings for use with parse_mode: 'Markdown'.
 * Telegram Markdown (non-V2) supports *bold*, _italic_, `code`, [link](url), and > blockquotes.
 */

'use strict';

// ── Escape helpers ─────────────────────────────────────────────────────────────
function esc(text) {
  return String(text ?? '');
}

// ── Visual primitives ─────────────────────────────────────────────────────────

/** Render a blockquote block. Lines get prefixed with > */
function blockquote(lines) {
  if (!Array.isArray(lines)) lines = [lines];
  return lines.map(l => `> ${l}`).join('\n');
}

/** Expandable blockquote — Telegram collapses these in supported clients */
function expandable(lines) {
  if (!Array.isArray(lines)) lines = [lines];
  const body = lines.map(l => `> ${l}`).join('\n');
  return `${body}\n>>`;
}

// ── Section templates ─────────────────────────────────────────────────────────

/**
 * Header for a named screen/section.
 * Example: screenHeader('PAPPY PFP', 'Main Menu')
 */
function screenHeader(botName, screenName, subtitle = '') {
  let out = `*${esc(botName)}*\n`;
  if (screenName) out += `✦ *${esc(screenName)}*\n`;
  if (subtitle)   out += `_${esc(subtitle)}_\n`;
  return out;
}

/**
 * Rich stat row — emoji + label + value
 * Example: stat('👥', 'Users', '1,042')
 */
function stat(emoji, label, value) {
  return `${emoji} ${esc(label)}: *${esc(value)}*`;
}

/**
 * Bullet list item
 */
function bullet(emoji, text) {
  return `${emoji} ${esc(text)}`;
}

/**
 * Horizontal divider
 */
function divider() {
  return `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`;
}

/**
 * Thin spacer (empty line rendered safely)
 */
function spacer() {
  return '';
}

// ── Status indicators ──────────────────────────────────────────────────────────

function statusDot(active, trueLabel = 'Active', falseLabel = 'Inactive') {
  return active ? `🟢 ${trueLabel}` : `🔴 ${falseLabel}`;
}

function toggleStatus(enabled) {
  return enabled ? `✅ Enabled` : `⛔ Disabled`;
}

// ── Message templates ──────────────────────────────────────────────────────────

/**
 * Loading / in-progress state
 */
function loading(action = 'Processing') {
  return [
    `⏳ *${esc(action)}*`,
    ``,
    `> Please wait a moment...`,
  ].join('\n');
}

/**
 * Success message
 */
function success(title, detail = '', extra = '') {
  const lines = [
    `✅ *${esc(title)}*`,
  ];
  if (detail) lines.push(``, `> ${esc(detail)}`);
  if (extra) lines.push(``, extra);
  return lines.join('\n');
}

/**
 * Warning / notice
 */
function warn(title, detail = '') {
  const lines = [`⚠️ *${esc(title)}*`];
  if (detail) lines.push(``, `> ${esc(detail)}`);
  return lines.join('\n');
}

/**
 * Info box with optional blockquote body
 */
function info(title, detail = '') {
  const lines = [`ℹ️ *${esc(title)}*`];
  if (detail) lines.push(``, `> ${esc(detail)}`);
  return lines.join('\n');
}

/**
 * Error message — friendly, never shows stack traces
 * @param {string} title     - User-facing error name
 * @param {string} message   - What happened
 * @param {string} fix       - Suggested resolution
 * @param {string} errorId   - Short error code for support
 */
function error(title, message = '', fix = '', errorId = '') {
  const lines = [
    `❌ *${esc(title)}*`,
    ``,
    `> ${esc(message) || 'Something went wrong.'}`,
  ];
  if (fix) {
    lines.push(``, `💡 *Try this:*`);
    lines.push(`> ${esc(fix)}`);
  }
  if (errorId) {
    lines.push(``, `\`Error: ${esc(errorId)}\``);
  }
  return lines.join('\n');
}

/**
 * Confirmation prompt — clear ask before destructive actions
 */
function confirm(title, detail = '', warning = '') {
  const lines = [`⚠️ *${esc(title)}*`];
  if (detail) lines.push(``, `> ${esc(detail)}`);
  if (warning) lines.push(``, `🔴 *${esc(warning)}*`);
  lines.push(``, `_Are you sure?_`);
  return lines.join('\n');
}

// ── Wallpaper caption ──────────────────────────────────────────────────────────

/**
 * Premium wallpaper drop caption
 */
function wallpaperCaption({ category, displayName, count, page, emoji, hashtags = [], botName = 'PAPPY PFP' }) {
  const tags = hashtags.slice(0, 5).map(t => `#${t}`).join(' ');
  const lines = [
    `${emoji} *${esc(displayName)}*`,
    ``,
    `> 📱 Phone-optimised HD wallpapers`,
    `> 🖼 ${count} image${count !== 1 ? 's' : ''} · Page ${page}`,
    ``,
    tags ? `${tags}` : '',
    ``,
    `_by ${esc(botName)}_`,
  ].filter(l => l !== undefined);
  return lines.join('\n');
}

/**
 * Auto-drop announcement caption (for Telegram channel posts)
 */
function dropCaption({ category, displayName, emoji, hashtags = [], botName = 'PAPPY PFP', botUsername = '' }) {
  const tags = hashtags.slice(0, 6).map(t => `#${t}`).join(' ');
  const dmLink = botUsername ? `\n\n[🤖 Open ${esc(botName)}](https://t.me/${botUsername})` : '';
  return [
    `${emoji} *${esc(displayName)} Drop*`,
    ``,
    `> Fresh HD wallpapers — curated daily`,
    `> Tap to save · Share with friends`,
    dmLink,
    ``,
    tags,
  ].filter(l => l !== '').join('\n');
}

// ── Account / session ──────────────────────────────────────────────────────────

function accountHeader(num, isActive, autoJob = null) {
  const status = statusDot(isActive);
  const lines = [
    `📱 \`+${esc(num)}\``,
    ``,
    `> ${status}`,
  ];
  if (autoJob) {
    lines.push(`> 🔄 Auto-change: every ${autoJob.interval} ${autoJob.mode}(s)`);
  }
  return lines.join('\n');
}

// ── Support / tickets ──────────────────────────────────────────────────────────

function ticketHeader(ticketId, status) {
  const dot = status === 'open' ? '🟡' : '✅';
  return [
    `🎫 *Support Ticket*`,
    ``,
    `> ${dot} Ticket: \`${esc(ticketId)}\``,
    `> Status: *${esc(status.toUpperCase())}*`,
  ].join('\n');
}

// ── Task / progress ────────────────────────────────────────────────────────────

function taskProgress(label, current, total) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const filled = Math.round(pct / 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
  return `${esc(label)}\n\`[${bar}]\` ${pct}% (${current}/${total})`;
}

// ── Statistics ────────────────────────────────────────────────────────────────

function statsBlock(rows) {
  // rows: array of [emoji, label, value]
  const lines = rows.map(([e, l, v]) => stat(e, l, v));
  return lines.join('\n');
}

// ── Utility ───────────────────────────────────────────────────────────────────

function truncate(str, len = 100, suffix = '…') {
  if (!str) return '';
  str = String(str);
  return str.length > len ? str.slice(0, len - suffix.length) + suffix : str;
}

function codeBlock(text) {
  return `\`${esc(text)}\``;
}

function bold(text) {
  return `*${esc(text)}*`;
}

function italic(text) {
  return `_${esc(text)}_`;
}

function link(label, url) {
  return `[${esc(label)}](${url})`;
}

// ── Main menu welcome ──────────────────────────────────────────────────────────

function welcomeMessage(botName, firstName, features = []) {
  const name = esc(firstName || 'there');
  const featureLines = features.map(f => `  ${f}`).join('\n');
  return [
    `*Welcome back, ${name}!*`,
    ``,
    `> *${esc(botName)}* — Your premium WhatsApp & media companion`,
    ``,
    featureLines ? `${featureLines}\n` : '',
    `_Select an option below to get started._`,
  ].filter(l => l !== '').join('\n');
}

module.exports = {
  // Primitives
  esc, blockquote, expandable,
  // Layout
  screenHeader, divider, spacer,
  // Indicators
  stat, bullet, statusDot, toggleStatus, statsBlock,
  // Templates
  loading, success, warn, info, error, confirm,
  // Feature-specific
  wallpaperCaption, dropCaption, accountHeader, ticketHeader, taskProgress,
  // Text utils
  truncate, codeBlock, bold, italic, link,
  // Welcome
  welcomeMessage,
};
