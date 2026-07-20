const config = require('../config');
const logger = require('../utils/logger');
const { generateImage, saveGeneratedImage } = require('../services/imageGenerator');
const { clearState } = require('../middleware/session');
const { imageQueue } = require('../utils/worker');
const { btn, PRIMARY, SUCCESS, DANGER } = require('../utils/buttonStyles');
const ui = require('../utils/ui');
const eh = require('../utils/errorHandler');

async function promptUser(ctx) {
  try {
    ctx.setState({ step: 'imagegen_prompt' });
    const text = [
      ui.screenHeader(config.bot.name, 'AI Image Generator', 'Powered by OpenRouter AI'),
      '',
      '> Tell me what you want to create! Just type your idea and I\'ll bring it to life! ✨',
      '',
      '*Examples:*',
      '• _Make me a wedding invitation card for Daniel weds Titi at Live Venue by 1pm_',
      '• _Create a birthday poster for John turning 25_',
      '• <i>Generate a fantasy landscape with dragons</i>',
      '• <i>Design a graduation flyer for Mary</i>'
    ].join('\n');
    
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[btn('❌ Cancel', 'main_menu', DANGER)]],
      },
    });
  } catch (err) {
    return eh.handle(ctx, err, 'imagegen_prompt', 'main_menu');
  }
}

async function handlePrompt(ctx, bot) {
  let waitMsg;
  try {
    clearState(ctx.from.id);
    const prompt = ctx.message?.text?.trim();
    if (!prompt || prompt.length < 3) {
      return ctx.reply(ui.warn('Invalid Prompt', 'Please provide a longer description.'), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[btn('🎨 Try Again', 'imagegen', SUCCESS)]] },
      });
    }

    const queuePos = imageQueue.pending + imageQueue.active;
    const progressLabel = queuePos > 0 
      ? `Waiting in queue (${queuePos} ahead)` 
      : 'Generating image (10-30s)';
      
    const waitText = [
      ui.screenHeader('AI Generation', 'In Progress'),
      ui.stat('📝', 'Prompt', ui.truncate(prompt, 80)),
      '',
      ui.taskProgress(progressLabel, 0, 100)
    ].join('\n');

    waitMsg = await ctx.reply(waitText, { parse_mode: 'HTML' });

    imageQueue.run(async () => {
      try {
        const { buffer, model } = await generateImage(prompt);
        await saveGeneratedImage(buffer, ctx.from.id);
        const modelShort = model.split('/').pop();

        if (waitMsg) await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});

        const caption = [
          ui.success('Image Generated!'),
          '',
          `> ${ui.truncate(prompt, 100)}`,
          '',
          ui.stat('🤖', 'Model', ui.codeBlock(modelShort)),
          ui.stat('✨', 'By', config.bot.name)
        ].join('\n');

        await ctx.replyWithPhoto(
          { source: buffer },
          {
            caption,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [btn('🎨 Generate Another', 'imagegen',  SUCCESS)],
                [btn('🏠 Main Menu',        'main_menu', PRIMARY)],
              ],
            },
          }
        );
      } catch (err) {
        if (waitMsg) await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
        logger.error(`Image gen: ${err.message}`);
        
        await ctx.reply(
          ui.error('Generation Failed', err.message, 'Please try again with a different prompt.'),
          {
            parse_mode: 'HTML',
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
  } catch (err) {
    if (waitMsg) await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
    return eh.handle(ctx, err, 'imagegen_handle', 'main_menu');
  }
}

module.exports = { promptUser, handlePrompt };
