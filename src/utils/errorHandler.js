'use strict';
/**
 * errorHandler.js — Comprehensive Error Handling System for PAPPY PFP V3
 *
 * Every error surfaces as a friendly, structured Telegram message.
 * No raw stack traces. Every error has an ID, a fix suggestion,
 * retry/report buttons, and is written to the log.
 */

const crypto = require('crypto');
const logger  = require('./logger');
const ui      = require('./ui');
const { btn, PRIMARY, DANGER } = require('./buttonStyles');

// ── Error catalogue ────────────────────────────────────────────────────────────
const ERROR_MAP = {
  // HTTP / API errors
  400: { title: 'Bad Request',             fix: 'Check your input and try again.' },
  401: { title: 'Not Authorised',          fix: 'Your session may have expired. Re-pair your WhatsApp.' },
  403: { title: 'Access Forbidden',        fix: 'You do not have permission for this action.' },
  404: { title: 'Not Found',               fix: 'The resource no longer exists. Try refreshing.' },
  406: { title: 'Not Acceptable',          fix: 'The server could not process this request format.' },
  408: { title: 'Request Timeout',         fix: 'The server took too long. Try again in a moment.' },
  409: { title: 'Conflict',                fix: 'This action conflicts with an existing operation. Wait a moment and retry.' },
  410: { title: 'Resource Gone',           fix: 'This resource has been permanently removed.' },
  413: { title: 'File Too Large',          fix: 'Send a smaller file. Maximum supported size is 50 MB.' },
  415: { title: 'Unsupported File Type',   fix: 'Send a supported file format (JPEG, PNG, MP4, etc.).' },
  429: { title: 'Too Many Requests',       fix: 'Slow down — you\'re sending requests too fast. Wait 30 seconds.' },
  500: { title: 'Server Error',            fix: 'Something went wrong on our end. Try again shortly.' },
  502: { title: 'Bad Gateway',             fix: 'A downstream service is unreachable. Try again in a minute.' },
  503: { title: 'Service Unavailable',     fix: 'The service is temporarily down. Try again shortly.' },
  504: { title: 'Gateway Timeout',         fix: 'A service timed out. Try again.' },
  505: { title: 'HTTP Version Error',      fix: 'An internal network error occurred. Contact support.' },
  515: { title: 'SSL/TLS Error',           fix: 'A secure connection could not be established.' },

  // Named error types
  timeout:       { title: 'Connection Timeout',     fix: 'The request timed out. Check your connection and retry.' },
  network:       { title: 'Network Error',          fix: 'Network is unreachable. Check your server\'s connectivity.' },
  database:      { title: 'Database Error',         fix: 'Could not read/write data. The issue will resolve automatically.' },
  redis:         { title: 'Cache Error',            fix: 'The task queue is unavailable. Operations will continue without caching.' },
  mongodb:       { title: 'Database Error',         fix: 'MongoDB connection failed. Try again or contact support.' },
  telegram:      { title: 'Telegram API Error',     fix: 'Telegram rejected the request. Check formatting and try again.' },
  baileys:       { title: 'WhatsApp Error',         fix: 'WhatsApp connection issue. Re-pair your account if this persists.' },
  session:       { title: 'Session Error',          fix: 'Your WhatsApp session expired. Pair your account again.' },
  filesystem:    { title: 'File System Error',      fix: 'Could not read or write files. Check disk space.' },
  permission:    { title: 'Permission Denied',      fix: 'This action requires additional permissions.' },
  validation:    { title: 'Invalid Input',          fix: 'Check your input — something doesn\'t look right.' },
  ratelimit:     { title: 'Rate Limit',             fix: 'Too many actions in a short time. Wait a minute and retry.' },
  pairing:       { title: 'Pairing Failed',         fix: 'Could not connect to WhatsApp. Make sure the phone is online and try again.' },
  image:         { title: 'Image Processing Error', fix: 'Could not process the image. Try a different file.' },
  download:      { title: 'Download Failed',        fix: 'Could not download the media. The link may be private or expired.' },
  imagegen:      { title: 'AI Generation Failed',   fix: 'The AI could not generate your image. Try a different prompt.' },
  wallpaper:     { title: 'Wallpaper Error',        fix: 'Could not load wallpapers right now. Try again shortly.' },
  groupjoin:     { title: 'Group Join Failed',      fix: 'Could not join the group. The invite link may be expired.' },
  watermark:     { title: 'Watermark Error',        fix: 'Could not apply watermark. Image will be sent without it.' },
  unexpected:    { title: 'Unexpected Error',       fix: 'Something unexpected happened. This has been logged.' },
};

// ── Error ID generator ────────────────────────────────────────────────────────
function makeErrorId() {
  return 'ERR-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

// ── Classify error ────────────────────────────────────────────────────────────
function classify(err) {
  if (!err) return ERROR_MAP.unexpected;

  const msg   = String(err?.message || '').toLowerCase();
  const code  = err?.response?.statusCode || err?.status || err?.code;

  // HTTP status code
  if (typeof code === 'number' && ERROR_MAP[code]) return ERROR_MAP[code];

  // Named patterns in message
  if (msg.includes('etimedout') || msg.includes('timeout'))         return ERROR_MAP.timeout;
  if (msg.includes('econnrefused') || msg.includes('enotfound'))    return ERROR_MAP.network;
  if (msg.includes('eacces') || msg.includes('permission denied'))  return ERROR_MAP.permission;
  if (msg.includes('enoent') || msg.includes('no such file'))       return ERROR_MAP.filesystem;
  if (msg.includes('mongoose') || msg.includes('mongo'))           return ERROR_MAP.mongodb;
  if (msg.includes('redis') || msg.includes('bullmq'))             return ERROR_MAP.redis;
  if (msg.includes('baileys') || msg.includes('whatsapp'))         return ERROR_MAP.baileys;
  if (msg.includes('session') || msg.includes('creds'))            return ERROR_MAP.session;
  if (msg.includes('pairing') || msg.includes('pair'))             return ERROR_MAP.pairing;
  if (msg.includes('sharp') || msg.includes('image'))              return ERROR_MAP.image;
  if (msg.includes('download') || msg.includes('media'))           return ERROR_MAP.download;
  if (msg.includes('openrouter') || msg.includes('generate'))      return ERROR_MAP.imagegen;
  if (msg.includes('wallpaper') || msg.includes('pinterest'))      return ERROR_MAP.wallpaper;
  if (msg.includes('group') && msg.includes('join'))               return ERROR_MAP.groupjoin;
  if (msg.includes('too many') || msg.includes('rate limit'))      return ERROR_MAP.ratelimit;
  if (msg.includes('validation') || msg.includes('invalid'))       return ERROR_MAP.validation;
  if (msg.includes('telegram'))                                     return ERROR_MAP.telegram;
  if (msg.includes('watermark'))                                    return ERROR_MAP.watermark;

  return ERROR_MAP.unexpected;
}

// ── Build error keyboard ──────────────────────────────────────────────────────
function errorKeyboard(retryAction = null, ownerId = null) {
  const rows = [];
  if (retryAction) {
    rows.push([btn('🔄 Try Again', retryAction, PRIMARY)]);
  }
  rows.push([btn('🏠 Main Menu', 'main_menu', PRIMARY)]);
  return { inline_keyboard: rows };
}

// ── Main handler ──────────────────────────────────────────────────────────────

/**
 * Handle an error in a Telegraf ctx, logging it and replying to the user.
 *
 * @param {Object}  ctx          - Telegraf context
 * @param {Error}   err          - The caught error
 * @param {string}  scope        - Where the error occurred (e.g. 'pairing', 'wallpaper')
 * @param {string}  retryAction  - callback_data for a retry button (optional)
 */
async function handle(ctx, err, scope = 'unknown', retryAction = null) {
  const id   = makeErrorId();
  const info = classify(err);

  logger.error(`[${id}] ${scope}: ${err?.stack || err?.message || String(err)}`);

  const text = ui.error(
    info.title,
    ui.truncate(err?.message || 'An unexpected error occurred.', 140),
    info.fix,
    id,
  );

  const keyboard = errorKeyboard(retryAction);

  try {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(`❌ ${info.title}`, { show_alert: false }).catch(() => {});
    }
    // Try to edit if in a callback, otherwise send new message
    if (ctx.callbackQuery?.message) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard })
        .catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard }));
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  } catch (sendErr) {
    logger.error(`[${id}] Could not send error message: ${sendErr.message}`);
  }
}

/**
 * Wrap an async handler to automatically catch and handle errors.
 *
 * @param {Function} fn          - async (ctx, ...args) => {}
 * @param {string}   scope       - error scope label
 * @param {string}   retryAction - optional retry callback_data
 */
function wrap(fn, scope = 'handler', retryAction = null) {
  return async (ctx, ...args) => {
    try {
      return await fn(ctx, ...args);
    } catch (err) {
      return handle(ctx, err, scope, retryAction);
    }
  };
}

/**
 * Build a user-friendly error text without needing a ctx (for non-interactive errors).
 */
function format(err, scope = 'unknown') {
  const id   = makeErrorId();
  const info = classify(err);
  logger.error(`[${id}] ${scope}: ${err?.stack || err?.message || String(err)}`);
  return ui.error(info.title, ui.truncate(err?.message || '', 140), info.fix, id);
}

/**
 * Silent error logger — for background tasks that should not message the user.
 */
function silent(err, scope = 'background') {
  const id = makeErrorId();
  logger.error(`[${id}] ${scope}: ${err?.stack || err?.message || String(err)}`);
  return id;
}

module.exports = { handle, wrap, format, silent, classify, makeErrorId };
