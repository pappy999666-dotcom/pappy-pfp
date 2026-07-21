const sharp = require('sharp');

function scoreUrl(url) {
  let score = 50;
  if (!url) return 0;
  
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('original') || lowerUrl.includes('4k') || lowerUrl.includes('uhd') || lowerUrl.includes('high_res') || lowerUrl.includes('master')) {
    score += 30;
  }
  if (lowerUrl.includes('large') || lowerUrl.includes('1080p') || lowerUrl.includes('2k')) {
    score += 15;
  }
  if (lowerUrl.includes('1440p') || lowerUrl.includes('wallpaper')) {
    score += 15;
  }
  
  if (lowerUrl.includes('thumb') || lowerUrl.includes('small') || lowerUrl.includes('preview') || lowerUrl.includes('icon') || lowerUrl.includes('avatar')) {
    score -= 30;
  }
  
  if (lowerUrl.endsWith('.png') || lowerUrl.endsWith('.webp')) {
    score += 10;
  }
  
  return Math.max(0, Math.min(100, score));
}

function filterUrls(urls) {
  return urls.filter(u => {
    const urlStr = typeof u === 'string' ? u : u.url;
    return !!urlStr;
  });
}

async function verifyBuffer(buffer) {
  try {
    const metadata = await sharp(buffer).metadata();
    if (!metadata || !metadata.width || !metadata.height) {
      return { ok: false, reason: 'Invalid image metadata' };
    }
    return { ok: true, width: metadata.width, height: metadata.height };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}

module.exports = { scoreUrl, filterUrls, verifyBuffer };
