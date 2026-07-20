const { addUserMsg, addOwnerReply, closeTicket, forwardToOwner, replyToUser } = require('../services/support');
const K = require('./keyboards');
const config = require('../config');
const { clearState } = require('../middleware/session');
const ui = require('../utils/ui');
const eh = require('../utils/errorHandler');
const logger = require('../utils/logger');

async function start(ctx) {
  try {
    ctx.setState({ step: 'support_msg' });
    const text = [
      ui.screenHeader(config.bot.name, 'Support Center'),
      '',
      '> Send your message, question, or issue.',
      '',
      'You can send: text, photo, document, or video.',
      'Our team will reply as soon as possible.'
    ].join('\n');
    
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: K.back('main_menu') })
      .catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: K.back('main_menu') }));
  } catch (err) {
    return eh.handle(ctx, err, 'support_start', 'main_menu');
  }
}

async function handleMsg(ctx, bot) {
  try {
    clearState(ctx.from.id);
    const tid = String(ctx.from.id);
    const username = ctx.from.username || ctx.from.first_name || 'User';

    let text = ctx.message.text || ctx.message.caption || '';
    let fid = null, ftype = null;
    if (ctx.message.photo) { fid = ctx.message.photo[ctx.message.photo.length - 1].file_id; ftype = 'photo'; }
    if (ctx.message.document) { fid = ctx.message.document.file_id; ftype = 'document'; }
    if (ctx.message.video) { fid = ctx.message.video.file_id; ftype = 'video'; }

    const ticket = await addUserMsg(tid, username, text, fid, ftype);
    await forwardToOwner(bot, ticket, { text, fileId: fid, fileType: ftype });
    
    const replyText = [
      ui.success('Message Sent!'),
      '',
      `> Ticket ID: \`${ticket.ticketId}\``,
      '',
      'You will receive our reply here in chat.'
    ].join('\n');
    
    await ctx.reply(replyText, { parse_mode: 'Markdown', reply_markup: K.backMain() });
  } catch (err) {
    return eh.handle(ctx, err, 'support_msg', 'main_menu');
  }
}

async function ownerReplyPrompt(ctx, ticketId) {
  try {
    ctx.setState({ step: 'owner_reply', ticketId });
    const text = [
      ui.ticketHeader(ticketId, 'open'),
      '',
      '> Send your reply to the user:'
    ].join('\n');
    
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: K.back('owner') })
      .catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: K.back('owner') }));
  } catch (err) {
    return eh.handle(ctx, err, 'owner_reply_prompt', 'owner');
  }
}

async function ownerReplyDo(ctx, bot) {
  try {
    const { ticketId } = ctx.userState;
    clearState(ctx.from.id);
    
    const ticket = await addOwnerReply(ticketId, ctx.message.text);
    if (!ticket) return ctx.reply(ui.error('Ticket Not Found', `ID: ${ticketId}`), { parse_mode: 'Markdown' });
    
    await replyToUser(bot, ticket.telegramId, ctx.message.text);
    await ctx.reply(ui.success('Reply Sent', `Ticket ${ticketId}`), { parse_mode: 'Markdown' });
  } catch (err) {
    return eh.handle(ctx, err, 'owner_reply', 'owner');
  }
}

async function closeDo(ctx, ticketId) {
  try {
    await closeTicket(ticketId);
    await ctx.answerCbQuery('Ticket closed').catch(() => {});
    await ctx.editMessageText(ui.info('Ticket Closed', `#${ticketId}`), { parse_mode: 'Markdown' }).catch(() => {});
  } catch (err) {
    return eh.handle(ctx, err, 'close_ticket', 'owner');
  }
}

module.exports = { start, handleMsg, ownerReplyPrompt, ownerReplyDo, closeDo };
