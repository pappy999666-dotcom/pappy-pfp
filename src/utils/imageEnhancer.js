'use strict';
/**
 * imageEnhancer.js — AI Image Enhancement Pipeline for PAPPY PFP V3
 *
 * Before sending any wallpaper or generated image:
 *  1. Check quality (dimensions, file size, compression artifacts)
 *  2. Upscale if beneficial (2x for sub-1080p images)
 *  3. Improve sharpness carefully (unsharp mask — not over-sharpened)
 *  4. Reduce JPEG compression artifacts
 *  5. Preserve original colors
 *  6. Never reduce quality
 */

const sharp = require('sharp');
const logger = require('./logger');

// ── Quality thresholds ────────────────────────────────────────────────────────
const QUALITY = {
  minWidth:       400,
  minHeight:      500,
  idealWidth:     1080,
  idealHeight:    1920,
  upscaleThreshold: 720,  // only upscale if width < this
  jpegQuality:    95,     // higher quality output
  webpQuality:    92,
  maxOutputBytes: 15 * 1024 * 1024,
};

// ── Check image quality ───────────────────────────────────────────────────────

/**
 * Analyse a buffer and return metadata + quality verdict.
 * @returns {{ width, height, format, size, needsUpscale, isHD }}
 */
async function analyseImage(buffer) {
  const meta = await sharp(buffer).metadata();
  const { width = 0, height = 0, format = 'unknown' } = meta;
  const size = buffer.length;

  const isHD         = width >= QUALITY.idealWidth && height >= QUALITY.idealHeight;
  const needsUpscale  = width < QUALITY.upscaleThreshold;

  return { width, height, format, size, isHD, needsUpscale };
}

// ── Upscale ───────────────────────────────────────────────────────────────────

/**
 * 2× integer upscale using Lanczos3 (Lanczos). Only done when beneficial.
 */
async function upscaleBuffer(buffer, targetWidth = QUALITY.idealWidth) {
  try {
    const meta = await sharp(buffer).metadata();
    const { width = 0, height = 0 } = meta;

    // Only upscale genuinely small images — don't touch Pinterest originals (736px+)
    if (width >= QUALITY.upscaleThreshold) return buffer;

    const scale = Math.min(3, Math.max(1.5, targetWidth / width));
    const newW = Math.round(width * scale);
    const newH = Math.round(height * scale);

    const result = await sharp(buffer)
      .resize(newW, newH, {
        kernel: sharp.kernel.lanczos3,
        fit: 'fill',
        withoutEnlargement: false,
      })
      .jpeg({ quality: QUALITY.jpegQuality, mozjpeg: true })
      .toBuffer();

    logger.info(`Upscaled: ${width}×${height} → ${newW}×${newH}`);
    return result;
  } catch (err) {
    logger.warn('Upscale failed: ' + err.message);
    return buffer;
  }
}

// ── Sharpen ───────────────────────────────────────────────────────────────────

/**
 * Apply mild unsharp mask — improves perceived sharpness without haloing.
 */
async function sharpenBuffer(buffer) {
  try {
    return await sharp(buffer)
      .sharpen({ sigma: 0.8, m1: 0.5, m2: 0.3, x1: 2, y2: 10, y3: 20 })
      .toBuffer();
  } catch (err) {
    logger.warn('Sharpen failed: ' + err.message);
    return buffer;
  }
}

// ── Artifact reduction ────────────────────────────────────────────────────────

/**
 * Re-encode as high-quality JPEG to reduce compression artifacts.
 * Sharp's mozjpeg encoder significantly improves quality at same file size.
 */
async function reduceArtifacts(buffer) {
  try {
    const meta = await sharp(buffer).metadata();
    if (meta.format === 'png') {
      // Keep PNG lossless
      return await sharp(buffer).png({ compressionLevel: 6 }).toBuffer();
    }
    return await sharp(buffer)
      .jpeg({ quality: QUALITY.jpegQuality, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .toBuffer();
  } catch (err) {
    logger.warn('Artifact reduction failed: ' + err.message);
    return buffer;
  }
}

// ── Full pipeline ─────────────────────────────────────────────────────────────

/**
 * Run the full enhancement pipeline on a buffer.
 *
 * @param {Buffer}  buffer  - Input image buffer
 * @param {Object}  opts    - Options
 * @param {boolean} opts.upscale    - Whether to attempt upscaling (default true)
 * @param {boolean} opts.sharpen    - Whether to apply mild sharpening (default true)
 * @param {boolean} opts.artifacts  - Whether to re-encode for artifact reduction (default true)
 * @returns {Buffer} Enhanced image buffer
 */
async function enhance(buffer, opts = {}) {
  const {
    upscale   = true,
    sharpen   = true,
    artifacts = true,
  } = opts;

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return buffer;

  let result = buffer;

  try {
    const analysis = await analyseImage(result);

    // Skip enhancement for very small images (likely thumbnails / broken)
    if (analysis.width < 200 || analysis.height < 200) return buffer;

    if (upscale && analysis.needsUpscale) {
      result = await upscaleBuffer(result);
    }

    if (artifacts) {
      result = await reduceArtifacts(result);
    }

    if (sharpen) {
      result = await sharpenBuffer(result);
    }

    // Safety: never return a larger-than-allowed buffer
    if (result.length > QUALITY.maxOutputBytes) {
      logger.warn(`Enhanced image too large (${result.length} bytes), using original`);
      return buffer;
    }

    return result;
  } catch (err) {
    logger.warn('Enhancement pipeline failed: ' + err.message);
    return buffer; // Always fall back to original
  }
}

/**
 * Check if a URL is likely high quality based on URL patterns.
 * Helps filter out thumbnails before downloading.
 */
function looksHD(url) {
  const s = (url || '').toLowerCase();
  if (s.includes('thumb') && !s.includes('large')) return false;
  if (s.includes('236x') || s.includes('474x') || s.includes('_small')) return false;
  if (s.includes('originals') || s.includes('1080') || s.includes('4k') || s.includes('2k')) return true;
  return true; // Default optimistic
}

module.exports = { enhance, analyseImage, upscaleBuffer, sharpenBuffer, reduceArtifacts, looksHD, QUALITY };
