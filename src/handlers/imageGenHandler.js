const config = require('../config');
const logger = require('../utils/logger');
const { generateImage, saveGeneratedImage } = require('../services/imageGenerator');
const { setState, clearState } = require('../middleware/session');
const { imageQueue } = require('../utils/worker');
const { btn, PRIMARY, SUCCESS, DANGER } = require('../utils/buttonStyles');

async function promptUser(ctx) {
  setState(ctx.from.id, { step: 'imagegen_prompt' });
  await ctx.reply(
    `🎨 *AI Image Generator*\n\n` +
    `Powered by OpenRouter AI\n\n` +
    `Tell me what you want to create! Examples:\n` +
    `• _Make me a wedding invitation card for Daniel weds Titi at Live Venue by 1pm_\n` +
    `• _Create a birthday poster for John turning 25_\n` +
    `• _Generate a fantasy landscape with dragons_\n` +
    `• _Design a graduation flyer for Mary_\n\n` +
    `Just type your idea and I'll bring it to life! ✨`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[btn('❌ Cancel', 'main_menu', DANGER)]],
      },
    }
  );
}

async function handlePrompt(ctx, bot) {
  clearState(ctx.from.id);
  const prompt = ctx.message?.text?.trim();
  if (!prompt || prompt.length < 3) {
    return ctx.reply('Please provide a description of what you want to generate.', {
      reply_markup: { inline_keyboard: [[btn('🎨 Try Again', 'imagegen', SUCCESS)]] },
    });
  }

  const queuePos = imageQueue.pending + imageQueue.active;
  const waitMsg = await ctx.reply(
    `🎨 *Generating your image...*\n\n` +
    `_Prompt:_ ${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}\n\n` +
    (queuePos > 0
      ? `⏳ _${queuePos} image${queuePos > 1 ? 's' : ''} ahead of you — your turn coming up_`
      : `⏳ This usually takes 10-30 seconds`),
    { parse_mode: 'Markdown' }
  );

  // Non-blocking queue — AI gen never blocks downloads or other commands
  imageQueue.run(async () => {
    try {
      const { buffer, model } = await generateImage(prompt);
      await saveGeneratedImage(buffer, ctx.from.id);
      const modelShort = model.split('/').pop();

      await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});

      await ctx.replyWithPhoto(
        { source: buffer },
        {
          caption:
            `✅ *Image Generated!*\n\n` +
            `📝 _${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}_\n\n` +
            `🤖 Model: \`${modelShort}\`\n` +
            `By ${config.bot.name}`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [btn('🎨 Generate Another', 'imagegen',  SUCCESS)],
              [btn('🏠 Main Menu',        'main_menu', PRIMARY)],
            ],
          },
        }
      );
    } catch (e) {
      logger.error(`Image gen: ${e.message}`);
      await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
      await ctx.reply(
        `❌ *Generation failed*\n\n${e.message}\n\nPlease try again with a different prompt.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [btn('🎨 Try Again',  'imagegen',  SUCCESS)],
              [btn('🏠 Main Menu', 'main_menu', PRIMARY)],
            ],
          },
        }
      );
    }
  }).catch(() => {});
}

module.exports = { promptUser, handlePrompt };
