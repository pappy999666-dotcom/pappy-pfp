const fs = require('fs');
const pino = require('pino');
const config = require('../config');
const logger = require('../utils/logger');
const { getUserSessionDir, cleanCorruptedSession, isSessionDirValid, deleteDir } = require('../utils/storage');
const { sleep } = require('../utils/helpers');
const { globalQueue } = require('../utils/taskQueue');

let ownerSock = null;
let ownerConnected = false;
let intentionalDisconnect = false;

const OWNER_TID = '__owner__';

async function connectOwnerWA({ onCode, onQR, onConnected, onDisconnected } = {}) {
  intentionalDisconnect = false;

  if (!config.ownerWaNumber) {
    logger.warn('[OwnerWA] OWNER_WA_NUMBER not set — owner WA features disabled');
    return null;
  }

  const { createWhatsAppSession } = require('./whatsapp');

  const sock = await createWhatsAppSession(OWNER_TID, config.ownerWaNumber, {
    onCode,
    onQR,
    isOwnerSession: true,
    onConnected: (s) => {
      ownerSock = s;
      ownerConnected = true;
      logger.info(`[OwnerWA] Connected: +${config.ownerWaNumber}`);
      if (onConnected) Promise.resolve(onConnected(s)).catch(e => logger.warn('[OwnerWA] onConnected: ' + e.message));
    },
    onDisconnected: (shouldReconnect, code) => {
      ownerConnected = false;
      ownerSock = null;
      logger.info(`[OwnerWA] Disconnected (code=${code}, reconnect=${shouldReconnect})`);

      if (!intentionalDisconnect && shouldReconnect) {
        logger.info('[OwnerWA] Reconnecting in 10s...');
        sleep(10_000).then(() => {
          if (intentionalDisconnect) return;
          connectOwnerWA({ onConnected, onDisconnected }).catch(e =>
            logger.error('[OwnerWA] Reconnect failed: ' + e.message)
          );
        });
      }

      if (onDisconnected) Promise.resolve(onDisconnected(shouldReconnect, code)).catch(() => {});
    },
  });

  ownerSock = sock;
  return sock;
}

function getOwnerSock() { return ownerSock; }
function isOwnerConnected() { return ownerConnected && ownerSock !== null; }

async function disconnectOwner() {
  intentionalDisconnect = true;
  if (ownerSock) {
    try { ownerSock.end(); } catch {}
    ownerSock = null;
    ownerConnected = false;
  }
}

function setOwnerNumber(num) {
  config.ownerWaNumber = num;
}

async function ownerJoinGroup(inviteCode) {
  if (!isOwnerConnected()) throw new Error('Owner WhatsApp not connected');
  return globalQueue.enqueueGroupJoin(async () => ownerSock.groupAcceptInvite(inviteCode));
}

async function ownerSetGroupPfp(groupJid, imagePath) {
  if (!isOwnerConnected()) throw new Error('Owner WhatsApp not connected');
  const raw = fs.readFileSync(imagePath);
  await ownerSock.updateProfilePicture(groupJid, raw, { hd: true });
}

async function ownerLeaveGroup(groupJid) {
  if (!isOwnerConnected()) throw new Error('Owner WhatsApp not connected');
  await ownerSock.groupLeave(groupJid);
}

async function ownerGetGroupMetadata(groupJid) {
  if (!isOwnerConnected()) throw new Error('Owner WhatsApp not connected');
  return ownerSock.groupMetadata(groupJid);
}

async function isOwnerAdminInGroup(groupJid) {
  if (!isOwnerConnected()) return false;
  try {
    const meta = await ownerGetGroupMetadata(groupJid);
    const botJid = ownerSock.user.id;
    const botId = botJid.split(':')[0] + '@s.whatsapp.net';
    const participant = meta.participants.find(p =>
      p.id === botJid || p.id === botId || p.id.split(':')[0] === botJid.split(':')[0]
    );
    return participant?.admin === 'admin' || participant?.admin === 'superadmin';
  } catch {
    return false;
  }
}

function setupGroupEventListeners(bot) {
  if (!ownerSock) return;

  ownerSock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    try {
      const { GroupPfpTask } = require('../database/models');
      const { liveLog } = require('./groupPfp');

      const tasks = await GroupPfpTask.find({
        groupJid: id,
        status: { $in: ['pending_approval', 'pending_admin', 'active'] },
      });

      if (!tasks.length) return;

      const botJid = ownerSock.user.id;
      const botId = botJid.split(':')[0] + '@s.whatsapp.net';
      const isBotAffected = participants.some(p =>
        p === botJid || p === botId || p.split(':')[0] === botJid.split(':')[0]
      );

      if (!isBotAffected) return;

      for (const task of tasks) {
        if (action === 'remove') {
          task.status = 'failed';
          task.errorMsg = 'Bot was removed from the group';
          task.completedAt = new Date();
          await task.save();
          await liveLog(bot, task,
            `❌ *Bot Removed*\nTask: \`${task.taskId}\`\n\nThe assistant was removed from the group.\nTask cancelled.`,
            { inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'main_menu' }]] }
          );
        }

        if (action === 'promote' && task.status === 'pending_admin') {
          task.status = 'active';
          task.adminAt = new Date();
          await task.save();
          await liveLog(bot, task, `✅ *Admin Detected!*\nTask: \`${task.taskId}\`\n\n⚙️ Changing group profile picture now...`);
          const { executeGroupPfpChange } = require('./groupPfp');
          executeGroupPfpChange(task, bot).catch(e => logger.error(`[OwnerWA] Group PFP change: ${e.message}`));
        }

        if (action === 'demote' && task.status === 'active') {
          task.status = 'failed';
          task.errorMsg = 'Admin rights removed';
          task.completedAt = new Date();
          await task.save();
          await liveLog(bot, task,
            `❌ *Admin Rights Removed*\nTask: \`${task.taskId}\`\n\nBot was demoted. Task cancelled.`,
            { inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'main_menu' }]] }
          );
        }
      }
    } catch (e) {
      logger.error('[OwnerWA] group-participants.update: ' + e.message);
    }
  });

  logger.info('[OwnerWA] Group event listeners active');
}

module.exports = {
  connectOwnerWA, getOwnerSock, isOwnerConnected,
  disconnectOwner, setOwnerNumber,
  ownerJoinGroup, ownerSetGroupPfp, ownerLeaveGroup,
  ownerGetGroupMetadata, isOwnerAdminInGroup,
  setupGroupEventListeners,
};
