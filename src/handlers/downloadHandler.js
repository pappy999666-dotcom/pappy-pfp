const K = require('./keyboards');
const config = require('../config');
const { clearState } = require('../middleware/session');
const { downloadMedia, detectPlatform } = require('../downloaders');
const { downloadFile, getDownloadDir } = require('../utils/storage');
const { downloadQueue } = require('../utils/worker');
const path = require('path');
const fs = require('fs');
const ui = require('../utils/ui');
const eh = require('../utils/errorHandler');
const logger = require('../utils/logger');

async function sendMediaItem(ctx, item, platform, dir) {
  const ext = item.type === 'video' ? '.mp4' : '.jpg';
  const localPath = path.join(dir, `dl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}${ext}`);

  if (item.type === 'video') {
    try {
      await downloadFile(item.url, localPath);
      await ctx.replyWithVideo({ source: localPath }, { caption: item.title || `${platform} Video` });
      fs.unlinkSync(localPath);
      return true;
    } catch (e) {
      logger.warn(`Video local send: ${e.message}`);
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
      return false;
    }
  }

  try {
    await ctx.replyWithPhoto(item.url, { caption: item.title || `${platform} Image` });
    return true;
  } catch {
    try {
      await downloadFile(item.url, localPath);
      await ctx.replyWithPhoto({ source: localPath }, { caption: item.title || '' });
      fs.unlinkSync(localPath);
      return true;
    } catch (e2) {
      logger.warn(`Photo local send fallback: ${e2.message}`);
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
      return false;
    }
  }
}

async function start(ctx) {
  try {
    const text = [
      ui.screenHeader(config.bot.name, 'Media Downloader'),
      '',
      '<blockquote>Choose a platform or use <b>Auto Detect</b> to paste any URL.</blockquote>',
      '',
      '*Supported Platforms:*',
      'Pinterest, TikTok, Instagram, Facebook, Twitter/X, YouTube, Threads, Reddit',
      '',
      ui.italic('Tip: You can also use /download <url>')
    ].join('\n');
    
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: K.downloadMenu() })
      .catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: K.downloadMenu() }));
  } catch (err) {
    return eh.handle(ctx, err, 'download_start', 'main_menu');
  }
}

async function promptUrl(ctx, platform) {
  try {
    ctx.setState({ step: 'dl_url', platform: platform || 'auto' });
    const text = platform
      ? [ui.screenHeader('Download', platform), '', '<blockquote>Send the URL you want to download.</blockquote>'].join('\n')
      : [ui.screenHeader('Download', 'Auto Detect'), '', '<blockquote>Paste any media URL to download.</blockquote>'].join('\n');
      
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: K.back('download') })
      .catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: K.back('download') }));
  } catch (err) {
    return eh.handle(ctx, err, 'download_prompt', 'download');
  }
}

async function handleUrl(ctx, url, bot) {
  let msg;
  try {
    clearState(ctx.from.id);

    if (!url || !url.startsWith('http')) {
      return ctx.reply(ui.warn('Invalid URL', 'Please send a valid URL starting with http:// or https://'), { parse_mode: 'HTML', reply_markup: K.backMain() });
    }

    const platform = detectPlatform(url);
    const queuePos = downloadQueue.pending + downloadQueue.active;
    const progressLabel = queuePos > 0 ? `Waiting in queue (${queuePos} ahead)` : 'Fetching media...';
    
    msg = await ctx.reply(ui.taskProgress(progressLabel, 0, 100), { parse_mode: 'HTML' });

    downloadQueue.run(async () => {
      try {
        const result = await downloadMedia(url);

        if (result.error) {
          if (msg) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null,
              ui.error('Download Failed', result.error),
              { parse_mode: 'HTML', reply_markup: K.back('download') }
            );
          }
          return;
        }

        if (msg) await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});

        const media = result.media || [];
        if (!media.length) {
          return ctx.reply(ui.info('No Media', 'No media found at this URL.'), { parse_mode: 'HTML', reply_markup: K.back('download') });
        }

        let sent = 0;
        const maxSend = Math.min(media.length, config.limits.maxDownloadImages);
        const sentIndices = new Set();
        const dir = getDownloadDir(String(ctx.from.id));

        if (maxSend > 1) {
          const photos = [];
          const videos = [];
          for (let i = 0; i < maxSend; i++) {
            const item = media[i];
            if (item.type === 'video') videos.push({ idx: i, item });
            else photos.push({ idx: i, item });
          }

          if (photos.length > 1) {
            const mediaGroup = photos.slice(0, 10).map(({ item }, gi) => ({
              type: 'photo',
              media: item.url,
              ...(gi === 0 ? { caption: `*${result.platform}* - ${media.length} item(s)`, parse_mode: 'HTML' } : {}),
            }));
            try {
              await ctx.replyWithMediaGroup(mediaGroup);
              photos.slice(0, 10).forEach(({ idx }) => sentIndices.add(idx));
              sent = sentIndices.size;
            } catch {}
          }

          for (let i = 0; i < maxSend; i++) {
            if (sentIndices.has(i)) continue;
            const item = media[i];
            const ok = await sendMediaItem(ctx, item, result.platform, dir);
            if (ok) { sentIndices.add(i); sent++; }
          }
        } else {
          const item = media[0];
          const ok = await sendMediaItem(ctx, item, result.platform, dir);
          if (ok) {
            sent = 1;
          } else {
            await ctx.reply(ui.error('Download Failed', 'Could not send the media.', 'Try again later.'), { parse_mode: 'HTML', reply_markup: K.back('download') });
          }
        }

        if (sent > 0) {
          await ctx.reply(ui.success('Download Complete', `Downloaded ${sent} item(s) from ${result.platform}`), { parse_mode: 'HTML', reply_markup: K.back('download') });
        }
      } catch (e) {
        logger.error('Download handler: ' + e.message);
        if (msg) {
          await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null,
            ui.error('Download Error', e.message),
            { parse_mode: 'HTML', reply_markup: K.back('download') }
          ).catch(() => {});
        }
      }
    }).catch(e => {
      logger.error('Download queue: ' + e.message);
      ctx.reply(ui.error('Download Failed', 'Internal error occurred.'), { parse_mode: 'HTML', reply_markup: K.back('download') }).catch(() => {});
    });
  } catch (err) {
    if (msg) await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
    return eh.handle(ctx, err, 'download_url', 'download');
  }
}

module.exports = { start, promptUrl, handleUrl };
