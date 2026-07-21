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
    const r = await axios.get(`${PIN_API}/pins`, {
      params: { query, page_size: Math.min(count, 25), media_type: 'image' },
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
  const cleanQuery = query.replace(/\bdump\b/gi, '').replace(/\s+/g, ' ').trim();
  const words = cleanQuery.split(' ').filter(Boolean);
  const queries = [
    cleanQuery,
    words.slice(0, 4).join(' '),
    words.slice(0, 3).join(' '),
    words.slice(0, 2).join(' '),
    words[0],
  ].filter((q, i, arr) => q && arr.indexOf(q) === i);

  for (const q of queries) {
    try {
      const r = await axios.get(PREXZY, { params: { q }, timeout: 12000 });
      if (r.data?.status === false) continue;
      const urls = r.data?.data || [];
      logger.info(`Pinterest (prexzy) "${q}": ${urls.length} images`);
      if (urls.length > 0) {
        const start = page * count;
        return urls.slice(start, start + count).map(url => ({ url, source: 'pinterest' }));
      }
    } catch (e) {
      logger.warn(`Pinterest prexzy "${q}" failed: ${e.message}`);
    }
  }

  // 3. DuckDuckGo fallback
  return searchDDG(query, page, count);
}

async function searchDDG(query, page = 0, count = 20) {
  try {
    const r1 = await axios.get('https://duckduckgo.com/', {
      params: { q: query, iax: 'images', ia: 'images' },
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000,
    });
    const match = r1.data.match(/vqd=([\d-]+)/);
    if (!match) throw new Error('No vqd');
    const r2 = await axios.get('https://duckduckgo.com/i.js', {
      params: { l: 'us-en', o: 'json', q: query, vqd: match[1], f: ',,,,,', p: '1', s: page * count },
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://duckduckgo.com' },
      timeout: 10000,
    });
    const results = (r2.data?.results || []).slice(0, count);
    logger.info(`DDG fallback "${query}": ${results.length} images`);
    return results.filter(r => r.image).map(r => ({ url: r.image, source: 'duckduckgo', title: r.title || query }));
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
