'use strict';
const { CustomCategory, CategorySuggestion } = require('../database/models');
const config = require('../config');
const ui = require('../utils/ui');
const { btn, PRIMARY, SUCCESS, DANGER } = require('../utils/buttonStyles');

// /addcat — owner adds a custom wallpaper category
// Usage: /addcat <key> | <name> | <emoji> | <query> | <hashtag1,hashtag2,...>
async function addCatCommand(ctx) {
  if (!config.ownerIds.includes(String(ctx.from.id))) return;

  const raw = ctx.message.text?.split(' ').slice(1).join(' ').trim();
  if (!raw) {
    return ctx.reply([
      `${ui.bold('/addcat — Add Custom Wallpaper Category')}`,
      '',
      '<blockquote>Usage:\n/addcat key | Display Name | 🎨 | search query dump | tag1,tag2,tag3</blockquote>',
      '',
      '<blockquote expandable>Example:\n/addcat my_dark_pfp | My Dark PFP | 🌑 | dark aesthetic pfp dump | DarkPFP,AestheticPFP,DailyDrop</blockquote>',
    ].join('\n'), { parse_mode: 'HTML' });
  }

  const parts = raw.split('|').map(s => s.trim());
  if (parts.length < 4) {
    return ctx.reply(ui.error('Invalid Format', 'Need at least: key | name | emoji | query'), { parse_mode: 'HTML' });
  }

  const [key, name, emoji, query, tagsRaw] = parts;
  const keyClean = key.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40);
  if (!keyClean || !name || !query) {
    return ctx.reply(ui.error('Missing Fields', 'key, name, and query are required.'), { parse_mode: 'HTML' });
  }

  const hashtags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  try {
    await CustomCategory.findOneAndUpdate(
      { key: keyClean },
      { key: keyClean, name, emoji: emoji || '🖼️', query, hashtags, isActive: true },
      { upsert: true, new: true }
    );
    await ctx.reply(ui.success('Category Added', [
      `Key: ${ui.code(keyClean)}`,
      `Name: ${ui.bold(name)}`,
      `Emoji: ${emoji || '🖼️'}`,
      `Query: ${ui.code(query)}`,
      `Tags: ${hashtags.join(', ') || 'none'}`,
    ].join('\n')), { parse_mode: 'HTML' });
  } catch (e) {
    await ctx.reply(ui.error('Failed', e.message), { parse_mode: 'HTML' });
  }
}

// /suggest — any user suggests a new category
async function suggestCommand(ctx) {
  const raw = ctx.message.text?.split(' ').slice(1).join(' ').trim();
  if (!raw) {
    return ctx.reply([
      `${ui.bold('/suggest — Suggest a Wallpaper Category')}`,
      '',
      '<blockquote>Usage: /suggest &lt;your idea&gt;</blockquote>',
      '<blockquote>Example: /suggest dark fantasy anime girls</blockquote>',
    ].join('\n'), { parse_mode: 'HTML' });
  }

  if (raw.length > 200) {
    return ctx.reply(ui.warn('Too Long', 'Keep your suggestion under 200 characters.'), { parse_mode: 'HTML' });
  }

  try {
    await CategorySuggestion.create({
      telegramId: String(ctx.from.id),
      username: ctx.from.username || ctx.from.first_name || 'Unknown',
      suggestion: raw,
    });

    // Notify owner
    for (const ownerId of config.ownerIds) {
      await ctx.telegram.sendMessage(ownerId, [
        `💡 ${ui.bold('New Category Suggestion')}`,
        '',
        `<blockquote>From: @${ui.esc(ctx.from.username || ctx.from.first_name || 'Unknown')} (${ctx.from.id})\nSuggestion: ${ui.esc(raw)}</blockquote>`,
        '',
        `${ui.italic('Use /addcat to add it if you like it.')}`,
      ].join('\n'), { parse_mode: 'HTML' }).catch(() => {});
    }

    await ctx.reply(ui.success('Suggestion Sent!', `Thanks! Your idea "${ui.esc(raw)}" has been sent to the owner.`), { parse_mode: 'HTML' });
  } catch (e) {
    await ctx.reply(ui.error('Failed', e.message), { parse_mode: 'HTML' });
  }
}

// /listcats — owner lists all custom categories
async function listCatsCommand(ctx) {
  if (!config.ownerIds.includes(String(ctx.from.id))) return;

  const cats = await CustomCategory.find({}).sort({ addedAt: -1 });
  if (!cats.length) {
    return ctx.reply(ui.info('No Custom Categories', 'Add one with /addcat'), { parse_mode: 'HTML' });
  }

  const lines = [`${ui.bold(`Custom Categories (${cats.length}):`)}`, ''];
  for (const c of cats) {
    lines.push(`${c.emoji} ${ui.bold(c.name)} — ${ui.code(c.key)} [${c.isActive ? '✅' : '⛔'}]`);
    lines.push(`  Query: ${ui.code(c.query)}`);
  }
  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
}

// /suggestions — owner views pending suggestions
async function viewSuggestionsCommand(ctx) {
  if (!config.ownerIds.includes(String(ctx.from.id))) return;

  const pending = await CategorySuggestion.find({ status: 'pending' }).sort({ addedAt: -1 }).limit(20);
  if (!pending.length) {
    return ctx.reply(ui.info('No Pending Suggestions', 'All caught up!'), { parse_mode: 'HTML' });
  }

  const lines = [`${ui.bold(`Pending Suggestions (${pending.length}):`)}`, ''];
  for (const s of pending) {
    lines.push(`• ${ui.esc(s.suggestion)}`);
    lines.push(`  ${ui.italic(`@${ui.esc(s.username || s.telegramId)} · ${new Date(s.addedAt).toLocaleDateString()}`)}`);
  }
  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
}

module.exports = { addCatCommand, suggestCommand, listCatsCommand, viewSuggestionsCommand };
