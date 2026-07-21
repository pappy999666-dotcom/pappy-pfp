'use strict';
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const PREXZY = 'https://prexzyapis.com/search/pinterest';
const PIN_API = 'https://api.pinterest.com/v5';

// Official Pinterest API — used when token is set
async function searchPinterestAPI(query, count = 20) {
  const token = config.apis.pinterestToken;
  if (!token) return null;
  try {
    // Pinterest v5 API uses OAuth2 access token
    const r = await axios.get(`${PIN_API}/search/pins`, {
      params: { query, page_size: Math.min(count, 25) },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 12000,
    });
    const items = r.data?.items || [];
    logger.info(`Pinterest API (official) "${query}": ${items.length} pins`);
    return items
      .map(pin => ({
        url: pin.media?.images?.['1200x']?.url || pin.media?.images?.original?.url || pin.media?.images?.['600x']?.url,
        source: 'pinterest_api',
        title: pin.title || query,
      }))
      .filter(p => p.url);
  } catch (e) {
    logger.warn(`Pinterest official API failed: ${e.response?.status} ${e.message}`);
    return null;
  }
}

async function searchImages(query, page = 0, count = 20) {
  // 1. Official Pinterest API (best quality, when token set)
  if (config.apis.pinterestToken) {
    const results = await searchPinterestAPI(query, count);
    if (results && results.length > 0) {
      return results.slice(page * count, page * count + count);
    }
  }

  // 2. prexzy Pinterest search — strip 'dump', try progressively shorter queries
  // For page > 0, rotate seed to get different results
  const cleanQuery = query.replace(/\bdump\b/gi, '').replace(/\s+/g, ' ').trim();
  const words = cleanQuery.split(' ').filter(Boolean);

  // Build query variants — rotate on page to get fresh results
  const baseVariants = [
    cleanQuery,
    words.slice(0, 4).join(' '),
    words.slice(0, 3).join(' '),
    words.slice(0, 2).join(' '),
    words[0],
  ].filter((q, i, arr) => q && arr.indexOf(q) === i);

  // On page > 0, try appended terms to get different results from prexzy
  const pageVariants = page > 0 ? [
    `${cleanQuery} aesthetic`,
    `${cleanQuery} hd`,
    `${cleanQuery} wallpaper`,
    `${words[0]} pfp`,
    `${words[0]} art`,
  ] : [];

  const queries = page > 0 ? [...pageVariants, ...baseVariants] : baseVariants;

  for (const q of queries) {
    try {
      const r = await axios.get(PREXZY, { params: { q }, timeout: 12000 });
      if (r.data?.status === false) continue;
      const urls = r.data?.data || [];
      logger.info(`Pinterest (prexzy) "${q}" page=${page}: ${urls.length} images`);
      if (urls.length > 0) {
        // Offset into results based on page, wrap around if needed
        const start = (page * count) % urls.length;
        const slice = [...urls.slice(start), ...urls.slice(0, start)].slice(0, count);
        return slice.map(url => ({ url, source: 'pinterest' }));
      }
    } catch (e) {
      logger.warn(`Pinterest prexzy "${q}" failed: ${e.message}`);
    }
  }

  // 3. DuckDuckGo fallback
  return searchDDG(query, page, count);
}

async function searchDDG(query, page = 0, count = 20) {
  // Search Pinterest specifically via DDG
  const pinQuery = `site:pinterest.com ${query}`;
  try {
    const r1 = await axios.get('https://duckduckgo.com/', {
      params: { q: pinQuery, iax: 'images', ia: 'images' },
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000,
    });
    const match = r1.data.match(/vqd=([\d-]+)/);
    if (!match) throw new Error('No vqd');
    const r2 = await axios.get('https://duckduckgo.com/i.js', {
      params: { l: 'us-en', o: 'json', q: pinQuery, vqd: match[1], f: ',,,,,', p: '1', s: page * count },
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://duckduckgo.com' },
      timeout: 10000,
    });
    // Extract only pinimg.com URLs from results
    const results = (r2.data?.results || []).slice(0, count * 2);
    const pinImgs = results
      .filter(r => r.image && r.image.includes('pinimg.com'))
      .map(r => ({ url: r.image, source: 'pinterest_ddg', title: r.title || query }));
    // Also grab any pinimg URLs from thumbnails
    const allImgs = results
      .filter(r => r.image)
      .map(r => ({ url: r.image, source: 'duckduckgo', title: r.title || query }));
    const final = pinImgs.length >= 5 ? pinImgs : allImgs;
    logger.info(`DDG fallback "${query}": ${final.length} images (${pinImgs.length} from Pinterest)`);
    return final.slice(0, count);
  } catch (e) {
    logger.warn(`DDG fallback failed: ${e.message}`);
    return [];
  }
}

async function downloadPinterestPost(url) {
  try {
    const r = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Referer': 'https://www.pinterest.com/',
      },
      timeout: 15000,
      maxRedirects: 5,
    });
    const html = r.data;
    const seen = new Set();
    const images = [];

    // originals
    for (const m of html.matchAll(/https:\/\/i\.pinimg\.com\/originals\/[a-f0-9\/]+\.[a-z]{3,4}/gi)) {
      if (!seen.has(m[0])) { seen.add(m[0]); images.push({ url: m[0], source: 'pinterest' }); }
    }
    // 736x
    for (const m of html.matchAll(/https:\/\/i\.pinimg\.com\/736x\/[a-f0-9\/]+\.[a-z]{3,4}/gi)) {
      if (!seen.has(m[0])) { seen.add(m[0]); images.push({ url: m[0], source: 'pinterest' }); }
    }
    // og:image fallback
    if (!images.length) {
      for (const m of html.matchAll(/property="og:image"\s+content="([^"]+)"/g)) {
        if (!seen.has(m[1])) { seen.add(m[1]); images.push({ url: m[1], source: 'pinterest' }); }
      }
    }

    return images.slice(0, config.limits?.maxDownloadImages || 20);
  } catch (e) {
    logger.error('Pinterest download: ' + e.message);
    return [];
  }
}

module.exports = { searchImages, downloadPinterestPost };
