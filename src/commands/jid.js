const { isOwnerConnected, getOwnerSock } = require('../services/ownerWhatsapp');
const { getSock, getActiveSessions } = require('../services/whatsapp');
const { Session } = require('../database/models');
const config = require('../config');

// /jid — list all groups/channels the owner WA is in
// /jid <invite_link> — resolve a specific invite link to JID
async function jidCommand(ctx) {
    const isOwner = config.ownerIds.includes(String(ctx.from.id));
    if (!isOwner) return;

    const args = ctx.message.text?.split(' ').slice(1).join(' ').trim();

    // /jid <invite_link> — resolve single link
    if (args) {
        const inviteCode = args.replace('https://chat.whatsapp.com/', '').trim();
        if (!isOwnerConnected()) {
            return ctx.reply('❌ Owner WA not connected. Pair it first via Owner Panel → Pair Owner WA.');
        }
        const sock = getOwnerSock();
        try {
            const info = await sock.groupGetInviteInfo(inviteCode);
            return ctx.reply(
                `*WhatsApp Group Info*\n\n` +
                `📛 Name: *${info.subject}*\n` +
                `🆔 JID: \`${info.id}\`\n` +
                `👥 Participants: *${info.size}*\n` +
                `📝 Description: ${info.desc || 'None'}`,
                { parse_mode: 'HTML' }
            );
        } catch (e) {
            return ctx.reply(`❌ Failed to resolve link: ${e.message}`);
        }
    }

    // /jid — list all groups/channels owner WA is in
    if (!isOwnerConnected()) {
        return ctx.reply(
            `❌ *Owner WA not connected.*\n\nPair it first via Owner Panel → Pair Owner WA.\n\nOnce connected, run /jid to list all groups & channels.`,
            { parse_mode: 'HTML' }
        );
    }

    const sock = getOwnerSock();
    const wait = await ctx.reply('⏳ Fetching all groups & channels...');

    try {
        const chats = await sock.groupFetchAllParticipating();
        const entries = Object.values(chats);

        if (!entries.length) {
            await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null, '📭 No groups or channels found.');
            return;
        }

        const groups   = entries.filter(c => c.id.endsWith('@g.us'));
        const channels = entries.filter(c => c.id.endsWith('@newsletter'));

        let text = `*📋 WhatsApp JID List*\n\n`;

        if (groups.length) {
            text += `*👥 Groups (${groups.length}):*\n`;
            for (const g of groups) {
                text += `• *${g.subject || 'Unnamed'}*\n  \`${g.id}\`\n`;
            }
            text += '\n';
        }

        if (channels.length) {
            text += `*📢 Channels (${channels.length}):*\n`;
            for (const c of channels) {
                text += `• *${c.subject || 'Unnamed'}*\n  \`${c.id}\`\n`;
            }
        }

        text += `\n_Copy any JID above and paste it in Owner Panel → Channel Management_`;

        // Split if too long
        if (text.length > 4000) {
            const chunks = [];
            const lines = text.split('\n');
            let chunk = '';
            for (const line of lines) {
                if ((chunk + line).length > 3800) {
                    chunks.push(chunk);
                    chunk = '';
                }
                chunk += line + '\n';
            }
            if (chunk) chunks.push(chunk);

            await ctx.telegram.deleteMessage(ctx.chat.id, wait.message_id).catch(() => {});
            for (const c of chunks) {
                await ctx.reply(c, { parse_mode: 'HTML' });
            }
        } else {
            await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null, text, { parse_mode: 'HTML' });
        }
    } catch (e) {
        await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null, `❌ Error: ${e.message}`).catch(() => {});
    }
}

// /jiduser <wa_number> — list all groups a specific paired user is in
async function jidUserCommand(ctx) {
    const isOwner = config.ownerIds.includes(String(ctx.from.id));
    if (!isOwner) return;

    const args = ctx.message.text?.split(' ').slice(1).join(' ').trim();
    if (!args) return ctx.reply('Usage: `/jiduser <whatsapp_number>`\nExample: `/jiduser 1234567890`', { parse_mode: 'HTML' });

    const num = args.replace(/\D/g, '');
    const session = await Session.findOne({ whatsappNumber: num, isActive: true });
    if (!session) return ctx.reply(`❌ No active session for \`+${num}\``, { parse_mode: 'HTML' });

    const sock = getSock(session.telegramId, num);
    if (!sock) return ctx.reply(`❌ Session exists but socket not active. User needs to reconnect.`);

    const wait = await ctx.reply(`⏳ Fetching groups for +${num}...`);
    try {
        const chats = await sock.groupFetchAllParticipating();
        const entries = Object.values(chats);
        if (!entries.length) {
            await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null, '📭 No groups found.');
            return;
        }
        let text = `*Groups for +${num} (${entries.length}):*\n\n`;
        for (const g of entries) {
            text += `• *${g.subject || 'Unnamed'}*\n  \`${g.id}\`\n`;
        }
        await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null, text, { parse_mode: 'HTML' });
    } catch (e) {
        await ctx.telegram.editMessageText(ctx.chat.id, wait.message_id, null, `❌ Error: ${e.message}`).catch(() => {});
    }
}

module.exports = { jidCommand, jidUserCommand };
