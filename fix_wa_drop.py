import re

path = 'src/services/wallpaper.js'
with open(path) as f:
    src = f.read()

# Find and replace the entire postWallpapersToWA function
new_func = '''async function postWallpapersToWA(category) {
  const { getOwnerSock, isOwnerConnected } = require('./ownerWhatsapp');
  if (!isOwnerConnected()) return [];

  const waChannels = await Channel.find({ isActive: true, platform: 'whatsapp' });
  if (!waChannels.length) return [];

  const wallpapers = await Wallpaper.find({ category, postedToWa: false }).sort({ addedAt: 1 }).limit(10);
  if (!wallpapers.length) return [];

  const sock = getOwnerSock();
  const meta = CATEGORY_META[category] || { emoji: '\\u{1F5BC}\\uFE0F', name: category.replace(/_/g, ' ') };
  const hashtags = (CATEGORY_HASHTAGS[category] || []).map(t => `#${t}`).join(' ');

  // WA caption is plain text — WhatsApp does not render HTML
  const waCaption = [
    `${meta.emoji} *${meta.name} Drop*`,
    '',
    'Fresh HD wallpapers — curated daily',
    'Tap any image to save · Share with friends',
    '',
    hashtags,
  ].filter(Boolean).join('\\n');

  const posted = [];
  const enhancerCfg = await sm.getGroup('enhancer');
  const wmCfg = await sm.getGroup('watermark');

  for (const channel of waChannels) {
    // Resolve real newsletter JID from invite code if not already resolved
    let jid = channel.chatId || channel.link;
    const inviteMatch = String(jid).match(/(?:channel\\/|^)([A-Za-z0-9]{20,})$/);
    if (inviteMatch && !String(jid).includes('@')) {
      try {
        const nlMeta = await sock.newsletterMetadata('invite', inviteMatch[1]);
        if (nlMeta?.id) {
          jid = nlMeta.id;
          await Channel.findByIdAndUpdate(channel._id, { chatId: jid });
          logger.info(`Resolved newsletter JID: ${jid}`);
        }
      } catch (e) {
        logger.warn(`Could not resolve newsletter JID for ${jid}: ${e.message}`);
      }
    }

    const chunks = [];
    for (let i = 0; i < wallpapers.length; i += 3) chunks.push(wallpapers.slice(i, i + 3));

    let sentCount = 0;
    for (const chunk of chunks) {
      await Promise.allSettled(chunk.map(async (wp, idx) => {
        try {
          let buffer;
          if (wp.localPath && fs.existsSync(wp.localPath)) {
            buffer = fs.readFileSync(wp.localPath);
          } else {
            const r = await axios.get(wp.url, { responseType: 'arraybuffer', timeout: 15000 });
            buffer = Buffer.from(r.data);
            if (enhancerCfg?.enabled) {
              buffer = await enhance(buffer, { upscale: true, sharpen: true, artifacts: true }).catch(() => buffer);
            }
            if (wmCfg?.enabled) {
              buffer = await applyWatermark(buffer, wmCfg).catch(() => buffer);
            }
          }
          const isFirst = sentCount === 0 && idx === 0;
          await sock.sendMessage(jid, {
            image: buffer,
            caption: isFirst ? waCaption : undefined,
            mimetype: 'image/jpeg',
          });
          sentCount++;
          posted.push(wp);
        } catch (e) {
          logger.warn(`WA drop ${jid} (${category}): ${e.message}`);
        }
      }));
      await sleep(1500);
    }
    logger.info(`WA drop: sent ${sentCount} ${category} wallpapers to ${jid}`);
  }

  for (const wp of posted) { wp.postedToWa = true; await wp.save().catch(() => {}); }
  return posted;
}'''

# Replace the function using regex
pattern = r'async function postWallpapersToWA\(category\)[\s\S]+?^}'
new_src = re.sub(pattern, new_func, src, flags=re.MULTILINE)

if new_src != src:
    with open(path, 'w') as f:
        f.write(new_src)
    print("FIXED postWallpapersToWA")
else:
    print("Pattern not matched — checking line count")
    # Find the function manually
    start = src.find('async function postWallpapersToWA')
    if start == -1:
        print("Function not found!")
    else:
        print(f"Function found at char {start}")
        print(src[start:start+100])
