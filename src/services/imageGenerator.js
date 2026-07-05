const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

const OPENROUTER_API = 'https://openrouter.ai/api/v1';

// Models to try in order — all support image generation via OpenRouter
const IMAGE_MODELS = [
  'black-forest-labs/flux-schnell',
  'black-forest-labs/flux-1.1-pro',
  'openai/dall-e-3',
  'stabilityai/stable-diffusion-3-5-large',
];

/**
 * Enhance the user's prompt to produce a high-quality image
 */
function enhancePrompt(userPrompt) {
  const lower = userPrompt.toLowerCase();

  // Detect if it's an invitation card
  if (lower.includes('invitation') || lower.includes('invite') || lower.includes('card') || lower.includes('weds') || lower.includes('wedding')) {
    return `Professional high-quality invitation card design: ${userPrompt}. 
    Ultra HD, 4K resolution, beautiful typography, elegant decorative elements, 
    floral accents, premium print quality, vibrant colors, photorealistic rendering, 
    centered composition, professional graphic design, luxury finish. --ar 1:1`;
  }

  // Detect poster/flyer
  if (lower.includes('poster') || lower.includes('flyer') || lower.includes('banner')) {
    return `${userPrompt}, professional poster design, ultra HD 4K, vibrant colors, 
    bold typography, stunning visuals, high resolution, photorealistic, 
    graphic design masterpiece, print-ready quality`;
  }

  // General image enhancement
  return `${userPrompt}, ultra high definition, 4K resolution, highly detailed, 
  photorealistic, professional quality, stunning visuals, vibrant colors, sharp focus`;
}

/**
 * Generate an image using OpenRouter AI
 * Returns { url, buffer, model } or throws
 */
async function generateImage(prompt, options = {}) {
  const apiKey = config.apis.openrouterKey;
  if (!apiKey) throw new Error('OpenRouter API key not configured');

  const enhancedPrompt = enhancePrompt(prompt);
  const size = options.size || '1024x1024';

  for (const model of IMAGE_MODELS) {
    try {
      logger.info(`Image gen attempt: model=${model}`);

      const response = await axios.post(
        `${OPENROUTER_API}/images/generations`,
        {
          model,
          prompt: enhancedPrompt,
          n: 1,
          size,
          quality: 'hd',
          response_format: 'url',
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://pappybot.app',
            'X-Title': 'PAPPYBOT',
          },
          timeout: 60000,
        }
      );

      const imageUrl = response.data?.data?.[0]?.url;
      if (!imageUrl) throw new Error('No image URL in response');

      // Download the image for Telegram
      const imgResp = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
      const buffer = Buffer.from(imgResp.data);

      logger.info(`Image generated successfully with ${model}`);
      return { url: imageUrl, buffer, model };

    } catch (e) {
      logger.warn(`Image gen failed (${model}): ${e.response?.data?.error?.message || e.message}`);
      // Try next model
      continue;
    }
  }

  throw new Error('All image generation models failed. Please try again later.');
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
