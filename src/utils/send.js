'use strict';
/**
 * send.js — Centralized Telegram message renderer
 *
 * All bot messages MUST go through these helpers.
 * Automatically sets parse_mode: 'HTML'.
 * Falls back to plain text if HTML parsing fails.
 */

const logger = require('./logger');

const HTML = { parse_mode: 'HTML' };

/** Strip all HTML tags for plain-text fallback */
function stripHtml(html) {
  return String(html)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

/** Merge HTML parse_mode into options object */
function htmlOpts(opts = {}) {
  return { ...opts, parse_mode: 'HTML' };
}

/**
 * ctx.reply() with HTML + graceful fallback
 */
async function reply(ctx, text, opts = {}) {
  try {
    return await ctx.reply(text, htmlOpts(opts));
  } catch (e) {
    if (e.description?.includes('parse') || e.description?.includes('Bad Request')) {
      logger.warn('[send.reply] HTML parse failed, falling back to plain text');
      const { parse_mode: _, ...rest } = htmlOpts(opts);
      return await ctx.reply(stripHtml(text), rest).catch(() => {});
    }
    throw e;
  }
}

/**
 * ctx.editMessageText() with HTML + graceful fallback
 */
async function edit(ctx, text, opts = {}) {
  try {
    return await ctx.editMessageText(text, htmlOpts(opts));
  } catch (e) {
    if (e.description?.includes('parse') || e.description?.includes('Bad Request')) {
      logger.warn('[send.edit] HTML parse failed, falling back to plain text');
      const { parse_mode: _, ...rest } = htmlOpts(opts);
      return await ctx.editMessageText(stripHtml(text), rest).catch(() => {});
    }
    // Ignore "message not modified" errors
    if (!e.description?.includes('not modified')) throw e;
  }
}

/**
 * bot.telegram.editMessageText() with HTML + graceful fallback
 */
async function editRaw(telegram, chatId, msgId, text, opts = {}) {
  try {
    return await telegram.editMessageText(chatId, msgId, null, text, htmlOpts(opts));
  } catch (e) {
    if (e.description?.includes('parse') || e.description?.includes('Bad Request')) {
      const { parse_mode: _, ...rest } = htmlOpts(opts);
      return await telegram.editMessageText(chatId, msgId, null, stripHtml(text), rest).catch(() => {});
    }
    if (!e.description?.includes('not modified')) throw e;
  }
}

/**
 * ctx.replyWithPhoto() with HTML caption + graceful fallback
 */
async function photo(ctx, source, opts = {}) {
  try {
    return await ctx.replyWithPhoto(source, htmlOpts(opts));
  } catch (e) {
    if (e.description?.includes('parse') || e.description?.includes('Bad Request')) {
      const { parse_mode: _, caption, ...rest } = htmlOpts(opts);
      return await ctx.replyWithPhoto(source, { ...rest, caption: caption ? stripHtml(caption) : undefined }).catch(() => {});
    }
    throw e;
  }
}

/**
 * bot.telegram.sendMessage() with HTML + graceful fallback
 */
async function sendMessage(telegram, chatId, text, opts = {}) {
  try {
    return await telegram.sendMessage(chatId, text, htmlOpts(opts));
  } catch (e) {
    if (e.description?.includes('parse') || e.description?.includes('Bad Request')) {
      const { parse_mode: _, ...rest } = htmlOpts(opts);
      return await telegram.sendMessage(chatId, stripHtml(text), rest).catch(() => {});
    }
    throw e;
  }
}

/**
 * bot.telegram.sendPhoto() with HTML caption + graceful fallback
 */
async function sendPhoto(telegram, chatId, source, opts = {}) {
  try {
    return await telegram.sendPhoto(chatId, source, htmlOpts(opts));
  } catch (e) {
    if (e.description?.includes('parse') || e.description?.includes('Bad Request')) {
      const { parse_mode: _, caption, ...rest } = htmlOpts(opts);
      return await telegram.sendPhoto(chatId, source, { ...rest, caption: caption ? stripHtml(caption) : undefined }).catch(() => {});
    }
    throw e;
  }
}

module.exports = { reply, edit, editRaw, photo, sendMessage, sendPhoto, htmlOpts, stripHtml };
