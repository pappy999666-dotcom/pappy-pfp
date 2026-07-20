const axios = require('axios');
const logger = require('../utils/logger');

const PLATFORM_PATTERNS = {
  pinterest: /pinterest\.(com|co\.\w+)|pin\.it/i,
  tiktok:    /tiktok\.com|vm\.tiktok/i,
  instagram: /instagram\.com|instagr\.am/i,
  facebook:  /facebook\.com|fb\.watch|fb\.com/i,
  twitter:   /twitter\.com|x\.com/i,
  youtube:   /youtube\.com|youtu\.be/i,
  threads:   /threads\.net/i,
  reddit:    /reddit\.com|redd\.it/i,
};

function detectPlatform(url) {
  for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
    if (pattern.test(url)) return platform;
  }
  return null;
}

async function downloadMedia(url) {
  const platform = detectPlatform(url);
  if (!platform) return { error: 'Unsupported platform. Supported: Pinterest, TikTok, Instagram, Facebook, Twitter/X, YouTube, Threads, Reddit' };

  try {
    switch (platform) {
      case 'pinterest':  return await downloadPinterest(url);
      case 'tiktok':     return await downloadTikTok(url);
      case 'instagram':  return await downloadInstagram(url);
      case 'facebook':   return await downloadFacebook(url);
      case 'twitter':    return await downloadTwitter(url);
      case 'youtube':    return await downloadYouTube(url);
      case 'threads':    return await downloadThreads(url);
      case 'reddit':     return await downloadReddit(url);
      default: return { error: 'Platform not supported' };
    }
  } catch (e) {
    logger.error(`Download ${platform}: ${e.message}`);
    return { error: `Failed to download from ${platform}: ${e.message}` };
  }
}

async function downloadPinterest(url) {
  const { downloadPinterestPost } = require('../services/pinterest');
  const images = await downloadPinterestPost(url);
  if (!images.length) return { error: 'No images found on this Pinterest page' };
  return {
    platform: 'Pinterest',
    type: 'images',
    media: images.map(img => ({ url: img.url, type: 'photo', title: img.title })),
  };
}

// Updated cobalt API - tries multiple community instances with new API format
async function downloadWithCobalt(url, platform) {
  const COBALT_INSTANCES = [
    'https://cobalt.api.timelessnesses.me',
    'https://cobalt.synth.gay',
    'https://cobalt.tools.sdbots.net',
    'https://co.eepy.cat',
  ];

  for (const base of COBALT_INSTANCES) {
    try {
      const response = await axios.post(`${base}/`, {
        url,
        videoQuality: 'max',
        audioFormat: 'mp3',
        filenameStyle: 'basic',
        downloadMode: 'auto',
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      });

      const data = response.data;

      if (data?.url) {
        return {
          platform,
          type: 'video',
          media: [{ url: data.url, type: 'video', title: `${platform} Video` }],
        };
      }

      if (data?.picker && Array.isArray(data.picker)) {
        const media = data.picker.map(item => ({
          url: item.url,
          type: item.type === 'photo' ? 'photo' : 'video',
          title: `${platform} Media`,
        }));
        if (media.length) return { platform, type: 'mixed', media };
      }
    } catch (e) {
      logger.warn(`Cobalt ${base} failed for ${platform}: ${e.message}`);
    }
  }

  return null;
}

async function downloadWithSaveFrom(url, platform) {
  try {
    const response = await axios.get('https://worker.sf-tools.com/savefrom.php', {
      params: { sf_url: url },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://en.savefrom.net/',
      },
      timeout: 15000,
    });
    const data = response.data;
    if (data?.url && data.url.length > 0) {
      const best = data.url.find(u => u.ext === 'mp4') || data.url[0];
      if (best?.url) {
        return {
          platform,
          type: 'video',
          media: [{ url: best.url, type: 'video', title: data.meta?.title || `${platform} Video` }],
        };
      }
    }
  } catch (e) {
    logger.warn(`SaveFrom failed for ${platform}: ${e.message}`);
  }
  return null;
}

async function downloadTikTok(url) {
  const cobalt = await downloadWithCobalt(url, 'TikTok');
  if (cobalt) return cobalt;

  // TikWM as fallback
  try {
    const tikwmRes = await axios.post('https://www.tikwm.com/api/',
      `url=${encodeURIComponent(url)}&hd=1`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      }
    );
    const d = tikwmRes.data?.data;
    if (d?.play || d?.hdplay) {
      return {
        platform: 'TikTok',
        type: 'video',
        media: [{ url: d.hdplay || d.play, type: 'video', title: d.title || 'TikTok Video' }],
      };
    }
  } catch (e) {
    logger.warn(`TikWM failed: ${e.message}`);
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000,
      maxRedirects: 10,
    });
    const html = response.data;
    const patterns = [
      /"playAddr":"([^"]+)"/,
      /"downloadAddr":"([^"]+)"/,
      /"play_addr":\s*\{[^}]*"url_list":\s*\["([^"]+)"/,
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        return {
          platform: 'TikTok',
          type: 'video',
          media: [{ url: match[1].replace(/\\u002F/g, '/').replace(/\\u0026/g, '&'), type: 'video', title: 'TikTok Video' }],
        };
      }
    }
  } catch {}

  return { error: 'Could not download TikTok video. The video may be private or the link may have expired.' };
}

async function downloadInstagram(url) {
  const cobalt = await downloadWithCobalt(url, 'Instagram');
  if (cobalt) return cobalt;

  try {
    const igdlRes = await axios.post('https://v3.igdownloader.app/api/ajaxSearch',
      `recaptchaToken=&q=${encodeURIComponent(url)}&t=media&lang=en`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 15000,
      }
    );
    const html = igdlRes.data?.data;
    if (html) {
      const videoMatch = html.match(/href="(https:\/\/[^"]+\.mp4[^"]*?)"/);
      const imgMatches = [...html.matchAll(/src="(https:\/\/[^"]+\.(jpg|jpeg|png|webp)[^"]*?)"/g)];
      const media = [];
      if (videoMatch) media.push({ url: videoMatch[1], type: 'video', title: 'Instagram Video' });
      for (const m of imgMatches.slice(0, 10)) {
        if (!m[1].includes('ig_stories') && !m[1].includes('profile')) {
          media.push({ url: m[1], type: 'photo', title: 'Instagram Image' });
        }
      }
      if (media.length) return { platform: 'Instagram', type: 'mixed', media };
    }
  } catch (e) {
    logger.warn(`IGDL fallback failed: ${e.message}`);
  }

  return { error: 'Could not download Instagram content. Instagram links may require login. Try again later.' };
}

async function downloadFacebook(url) {
  const cobalt = await downloadWithCobalt(url, 'Facebook');
  if (cobalt) return cobalt;
  return { error: 'Could not download Facebook content. Try again later.' };
}

async function downloadTwitter(url) {
  const cobalt = await downloadWithCobalt(url, 'Twitter/X');
  if (cobalt) return cobalt;

  try {
    const cleanUrl = url.replace('x.com', 'twitter.com');
    const response = await axios.get(`https://publish.twitter.com/oembed?url=${encodeURIComponent(cleanUrl)}`, {
      timeout: 10000,
    });
    if (response.data?.html) {
      const imgMatches = [...response.data.html.matchAll(/src="(https:\/\/pbs\.twimg\.com\/[^"]+)"/g)];
      if (imgMatches.length) {
        return {
          platform: 'Twitter/X',
          type: 'images',
          media: imgMatches.map(m => ({
            url: m[1].replace(/&amp;/g, '&'),
            type: 'photo',
            title: 'Twitter Image',
          })),
        };
      }
    }
  } catch {}

  return { error: 'Could not download Twitter content. Try again later.' };
}

async function downloadYouTube(url) {
  const cobalt = await downloadWithCobalt(url, 'YouTube');
  if (cobalt) return cobalt;

  const savefrom = await downloadWithSaveFrom(url, 'YouTube');
  if (savefrom) return savefrom;

  return { error: 'Could not download YouTube content. Try again later.' };
}

async function downloadThreads(url) {
  const cobalt = await downloadWithCobalt(url, 'Threads');
  if (cobalt) return cobalt;
  return { error: 'Could not download Threads content. Try again later.' };
}

async function downloadReddit(url) {
  try {
    const jsonUrl = url.endsWith('/') ? url + '.json' : url + '/.json';
    const response = await axios.get(jsonUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PappyBot/2.1)' },
      timeout: 10000,
    });

    const post = response.data?.[0]?.data?.children?.[0]?.data;
    if (!post) return { error: 'Could not parse Reddit post' };

    const media = [];

    if (post.is_video && post.media?.reddit_video?.fallback_url) {
      media.push({ url: post.media.reddit_video.fallback_url, type: 'video', title: post.title || 'Reddit Video' });
    }

    if (post.url_overridden_by_dest && /\.(jpg|jpeg|png|gif|webp)$/i.test(post.url_overridden_by_dest)) {
      media.push({ url: post.url_overridden_by_dest, type: 'photo', title: post.title || 'Reddit Image' });
    }

    if (post.is_gallery && post.media_metadata) {
      for (const [, item] of Object.entries(post.media_metadata)) {
        if (item.s?.u) {
          media.push({ url: item.s.u.replace(/&amp;/g, '&'), type: 'photo', title: post.title || 'Reddit Gallery' });
        }
      }
    }

    if (media.length) {
      return { platform: 'Reddit', type: media.length > 1 ? 'mixed' : media[0].type, media };
    }
  } catch (e) {
    logger.warn(`Reddit download: ${e.message}`);
  }

  const cobalt = await downloadWithCobalt(url, 'Reddit');
  if (cobalt) return cobalt;

  return { error: 'Could not download Reddit content. Try again later.' };
}

module.exports = { downloadMedia, detectPlatform };
