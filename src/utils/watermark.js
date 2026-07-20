'use strict';
/**
 * watermark.js — Automatic Branding / Gothic Signature System
 *
 * Applies a configurable semi-transparent gothic watermark to images.
 * Owner can toggle watermark on/off and configure opacity, position,
 * size, and margin from the Owner Settings panel (persisted via Settings model).
 *
 * Default watermark: the PAPPY gothic signature, placed bottom-right.
 */

const sharp  = require('sharp');
const logger = require('./logger');

// ── Default watermark config ──────────────────────────────────────────────────
const DEFAULTS = {
  enabled:  false,          // Off by default; owner enables via panel
  opacity:  0.35,           // 0.0 – 1.0
  position: 'bottom-right', // top-left | top-right | bottom-left | bottom-right
  size:     48,             // Font size equivalent (px in SVG)
  marginX:  24,
  marginY:  24,
  text:     '⸸ P A P P Y',
};

// ── SVG watermark generator ───────────────────────────────────────────────────
function buildWatermarkSvg(text, size, opacity) {
  const safeText = String(text).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Estimate text width (rough: ~0.55 * fontSize per char for monospace)
  const estWidth  = Math.ceil(safeText.length * size * 0.6 + 20);
  const estHeight = Math.ceil(size * 1.5);

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${estWidth}" height="${estHeight}">
       <style>
         .wm {
           font-family: 'Georgia', 'Times New Roman', serif;
           font-size: ${size}px;
           font-style: italic;
           letter-spacing: 4px;
           fill: white;
           opacity: ${opacity};
         }
       </style>
       <text class="wm" x="${estWidth / 2}" y="${estHeight * 0.75}"
             text-anchor="middle">${safeText}</text>
     </svg>`
  );
}

// ── Position calculator ───────────────────────────────────────────────────────
function calcGravity(position) {
  const map = {
    'top-left':     'northwest',
    'top-right':    'northeast',
    'bottom-left':  'southwest',
    'bottom-right': 'southeast',
  };
  return map[position] || 'southeast';
}

// ── Core apply function ───────────────────────────────────────────────────────

/**
 * Apply watermark to an image buffer.
 *
 * @param {Buffer}  inputBuffer - Original image bytes
 * @param {Object}  cfg         - Watermark config (merged with DEFAULTS)
 * @returns {Buffer}             Watermarked image buffer (JPEG)
 */
async function applyWatermark(inputBuffer, cfg = {}) {
  const c = { ...DEFAULTS, ...cfg };

  if (!c.enabled) return inputBuffer; // Pass-through when disabled

  try {
    const watermarkSvg = buildWatermarkSvg(c.text, c.size, c.opacity);
    const gravity = calcGravity(c.position);

    const result = await sharp(inputBuffer)
      .composite([{
        input:   watermarkSvg,
        gravity,
        blend:   'over',
      }])
      .jpeg({ quality: 92 })
      .toBuffer();

    return result;
  } catch (err) {
    logger.warn('Watermark apply failed: ' + err.message);
    return inputBuffer; // Fail silently — return original
  }
}

/**
 * Apply watermark to a file path, returning a new Buffer.
 */
async function applyWatermarkToFile(filePath, cfg = {}) {
  const fs = require('fs');
  const buffer = fs.readFileSync(filePath);
  return applyWatermark(buffer, cfg);
}

// ── Config schema helper (for Owner Settings panel) ───────────────────────────
function defaultConfig() {
  return { ...DEFAULTS };
}

function validateConfig(cfg) {
  const errors = [];
  if ('opacity' in cfg && (cfg.opacity < 0 || cfg.opacity > 1)) {
    errors.push('opacity must be between 0.0 and 1.0');
  }
  if ('size' in cfg && (cfg.size < 10 || cfg.size > 200)) {
    errors.push('size must be between 10 and 200');
  }
  if ('position' in cfg && !['top-left','top-right','bottom-left','bottom-right'].includes(cfg.position)) {
    errors.push('position must be top-left, top-right, bottom-left, or bottom-right');
  }
  return errors;
}

module.exports = { applyWatermark, applyWatermarkToFile, defaultConfig, validateConfig, DEFAULTS };
