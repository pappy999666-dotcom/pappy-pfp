const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

const PREXZY_DALLE = 'https://prexzyapis.com/ai/dalle';
const OPENROUTER_API = 'https://openrouter.ai/api/v1';
const IMAGE_MODELS = [
  'black-forest-labs/flux-schnell',
  'black-forest-labs/flux-1.1-pro',
  'openai/dall-e-3',
  'stabilityai/stable-diffusion-3-5-large',
];

function enhancePrompt(userPrompt) {
  const lower = userPrompt.toLowerCase();
  if (lower.includes('invitation') || lower.includes('invite') || lower.includes('card') || lower.includes('weds') || lower.includes('wedding')) {
    return `Professional high-quality invitation card design: ${userPrompt}. Ultra HD, 4K resolution, beautiful typography, elegant decorative elements, floral accents, premium print quality, vibrant colors, photorealistic rendering, centered composition, professional graphic design, luxury finish.`;
  }
  if (lower.includes('poster') || lower.includes('flyer') || lower.includes('banner')) {
    return `${userPrompt}, professional poster design, ultra HD 4K, vibrant colors, bold typography, stunning visuals, high resolution, photorealistic, graphic design masterpiece, print-ready quality`;
  }
  return `${userPrompt}, ultra high definition, 4K resolution, highly detailed, photorealistic, professional quality, stunning visuals, vibrant colors, sharp focus`;
}

async function generateImage(prompt, options = {}) {
  const enhancedPrompt = enhancePrompt(prompt);

  // Try 1: prexzy genimage (Flux, Firebase CDN — reliable)
  try {
    logger.info('Image gen: trying prexzy genimage');
    const r = await axios.get('https://prexzyapis.com/ai/genimage', {
      params: { prompt: enhancedPrompt },
      timeout: 60000,
    });
    const imageUrl = r.data?.image_url;
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
      const imgResp = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
      const buffer = Buffer.from(imgResp.data);
      logger.info('Image gen: prexzy genimage success');
      return { url: imageUrl, buffer, model: 'Flux (prexzy)' };
    }
  } catch (e) {
    logger.warn('Image gen prexzy genimage failed: ' + e.message);
  }

  // Try 2: prexzy dalle (DALL-E 3 XL — HuggingFace, may be slow)
  try {
    logger.info('Image gen: trying prexzy dalle');
    const r = await axios.get('https://prexzyapis.com/ai/dalle', {
      params: { prompt: enhancedPrompt },
      timeout: 90000,
    });
    const imageUrl = r.data?.image_url?.[0]?.image?.url;
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
      const imgResp = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
      const buffer = Buffer.from(imgResp.data);
      logger.info('Image gen: prexzy dalle success');
      return { url: imageUrl, buffer, model: 'DALL-E 3 XL (prexzy)' };
    }
  } catch (e) {
    logger.warn('Image gen prexzy dalle failed: ' + e.message);
  }

  // Try 3: OpenRouter (needs API key)
  const apiKey = config.apis.openrouterKey;
  if (apiKey) {
    for (const model of IMAGE_MODELS) {
      try {
        logger.info(`Image gen attempt: model=${model}`);
        const response = await axios.post(
          `${OPENROUTER_API}/images/generations`,
          { model, prompt: enhancedPrompt, n: 1, size: options.size || '1024x1024', quality: 'hd', response_format: 'url' },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': config.webUrl || 'https://pappywapfpchanger.duckdns.org',
              'X-Title': config.bot?.name || 'PAPPYBOT',
            },
            timeout: 60000,
          }
        );
        const imageUrl = response.data?.data?.[0]?.url;
        if (!imageUrl) throw new Error('No image URL in response');
        const imgResp = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
        const buffer = Buffer.from(imgResp.data);
        logger.info(`Image gen: OpenRouter ${model} success`);
        return { url: imageUrl, buffer, model };
      } catch (e) {
        logger.warn(`Image gen failed (${model}): ${e.response?.data?.error?.message || e.message}`);
      }
    }
  }

  throw new Error('Image generation failed. Please try again later.');
}

/**
 * Save generated image to disk
 */
async function saveGeneratedImage(buffer, userId) {
  const dir = path.join(process.cwd(), 'data', 'generated', String(userId));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `gen_${Date.now()}.png`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

module.exports = { generateImage, saveGeneratedImage, enhancePrompt };
