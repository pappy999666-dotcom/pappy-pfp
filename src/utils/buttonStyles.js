'use strict';
/**
 * buttonStyles.js — Telegram Bot API v9.4 Colored Inline Buttons
 *
 * style: 'primary'  → Blue
 * style: 'success'  → Green
 * style: 'danger'   → Red
 * (no style)        → Default gray
 */

const PRIMARY = 'primary';
const SUCCESS = 'success';
const DANGER  = 'danger';

/**
 * Build a colored inline keyboard button.
 * @param {string}      text         - Button label
 * @param {string|null} callbackData - callback_data (null for url/copy_text buttons)
 * @param {string|null} style        - PRIMARY / SUCCESS / DANGER or null
 * @param {Object}      extra        - Extra fields: { url }, { copy_text: { text } }, etc.
 */
function btn(text, callbackData, style = null, extra = {}) {
  const button = { text };
  if (callbackData !== null && callbackData !== undefined) {
    button.callback_data = callbackData;
  }
  if (style) button.style = style;
  return Object.assign(button, extra);
}

function backBtn(to, label = '‹ Back') {
  return { text: label, callback_data: to };
}

function mainMenuBtn() {
  return btn('🏠 Main Menu', 'main_menu', PRIMARY);
}

module.exports = { btn, backBtn, mainMenuBtn, PRIMARY, SUCCESS, DANGER };
