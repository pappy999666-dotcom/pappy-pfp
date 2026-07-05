/**
 * buttonStyles.js — Telegram 2026 Colored Inline Button Helper
 *
 * Telegram Bot API 8.x introduced colored inline keyboard buttons.
 * Supported colors:
 *   - 'primary'  → Blue  (main navigation / informational actions)
 *   - 'success'  → Green (confirm / create / pair / apply actions)
 *   - 'danger'   → Red   (delete / purge / stop / destructive actions)
 *
 * Usage:
 *   const { btn, PRIMARY, SUCCESS, DANGER } = require('../utils/buttonStyles');
 *
 *   btn('✅ Confirm', 'confirm_action', SUCCESS)
 *   btn('❌ Delete',  'delete_action',  DANGER)
 *   btn('📱 View',   'view_action',    PRIMARY)
 *
 * Buttons without a color use Telegram's default gray/neutral appearance.
 * URL buttons also accept a color:
 *   btn('🔗 Visit', null, PRIMARY, { url: 'https://example.com' })
 */

const PRIMARY = 'primary';   // Blue  — navigation, view, next step
const SUCCESS = 'success';   // Green — confirm, create, pair, apply
const DANGER  = 'danger';    // Red   — delete, purge, stop, cancel

/**
 * Build a colored inline keyboard button.
 *
 * @param {string}      text         - Button label
 * @param {string|null} callbackData - callback_data (null when using url or copy_text)
 * @param {string|null} color        - One of PRIMARY / SUCCESS / DANGER, or null for default
 * @param {Object}      extra        - Extra fields merged in (e.g. { url }, { copy_text })
 * @returns {Object} Telegram InlineKeyboardButton object
 */
function btn(text, callbackData, color = null, extra = {}) {
  const button = { text };
  if (callbackData !== null && callbackData !== undefined) {
    button.callback_data = callbackData;
  }
  if (color) {
    button.color = color;
  }
  return Object.assign(button, extra);
}

/**
 * Convenience: build a "‹ Back" button (no color — neutral navigation).
 */
function backBtn(to, label = '‹ Back') {
  return { text: label, callback_data: to };
}

/**
 * Convenience: build a "🏠 Main Menu" primary button.
 */
function mainMenuBtn() {
  return btn('🏠 Main Menu', 'main_menu', PRIMARY);
}

module.exports = { btn, backBtn, mainMenuBtn, PRIMARY, SUCCESS, DANGER };
