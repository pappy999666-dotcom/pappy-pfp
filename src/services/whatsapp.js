const fs = require('fs');
const pino = require('pino');
const { getUserSessionDir, isSessionDirValid, cleanCorruptedSession, deleteDir } = require('../utils/storage');
const { Session } = require('../database/models');
const config = require('../config');
const logger = require('../utils/logger');
const { sleep } = require('../utils/helpers');

// Active socket map: "telegramId:whatsappNumber" -> sock
const active = new Map();

let _lib = null;
async function lib() {
  if (_lib) return _lib;
  _lib = require('@crysnovax/baileys');
  return _lib;
}

// ── Core session creator ───────────────────────────────────────────────────
async function createWhatsAppSession(telegramId, whatsappNumber, {
  onCode, onQR, onConnected, onDisconnected,
  isOwnerSession = false,
} = {}) {
  const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
  } = await lib();

  const dir = getUserSessionDir(telegramId, whatsappNumber);
  const isFreshPairing = !!(onCode || onQR);

  if (isFreshPairing) {
    deleteDir(dir);
    fs.mkdirSync(dir, { recursive: true });
  } else {
    cleanCorruptedSession(dir);
  }

  const { state, saveCreds } = await useMultiFileAuthState(dir);
  let { version } = await fetchLatestBaileysVersion().catch(() => ({ version: null }));
  if (!version) version = [2, 3000, 1017531287];

  const browserName = isOwnerSession
    ? (config.bot.browserName || 'PAPPYBOT')
    : (config.bot.pairingName || 'PAPPYBOT');

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    printQRInTerminal: false,
    browser: Browsers ? Browsers.ubuntu('Chrome') : [browserName, 'Chrome', '130.0'],
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    keepAliveIntervalMs: 15_000,
    logger: pino({ level: 'silent' }),
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 60_000,
    retryRequestDelayMs: 500,
    maxMsgRetryCount: 3,
    fireInitQueries: true,
    emitOwnEvents: false,
    transactionOpts: { maxCommitRetries: 3, delayBetweenTriesMs: 1000 },
    getMessage: async (key) => {
      if (global.messageCache && key?.id) {
        const cached = global.messageCache.get(key.id);
        if (cached?.message) return cached.message;
      }
      return { conversation: '' };
    },
  });

  const key = `${telegramId}:${whatsappNumber}`;
  active.set(key, sock);
  sock.ev.on('creds.update', saveCreds);

  const isPairing = isFreshPairing && !state.creds.registered;

  // ── Pairing Code flow ──────────────────────────────────────────────────
  if (isPairing && onCode) {
    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    sock._pairingInProgress = true;

    setTimeout(async () => {
      try {
        let code = null;
        for (let attempt = 1; attempt <= 5; attempt++) {
          try {
            if (attempt > 1) await sleep(3000 * attempt);
            code = await sock.requestPairingCode(cleanNumber, browserName);
            if (code && typeof code === 'string') break;
          } catch (e) {
            const sc = e?.output?.statusCode;
            logger.warn(`[WA] Pair attempt ${attempt}/5 for ${whatsappNumber}: ${e.message} (${sc})`);
            if ([401, 403, 404].includes(sc)) throw e;
            if (attempt === 5) throw e;
          }
        }
        if (!code) throw new Error('No pairing code returned after 5 attempts');

        sock._pairingCodeSent = true;
        sock._pairingCodeSentAt = Date.now();
        logger.info(`[WA] Pairing code for ${whatsappNumber}: ${code}`);
        await onCode(code);
      } catch (err) {
        if (sock._pairingCodeSent) return;
        logger.error(`[WA] Pairing code failed for ${whatsappNumber}: ${err.message}`);
        // Fall back to QR if available
        if (onQR) {
          sock.ev.once('connection.update', u => { if (u.qr) onQR(u.qr).catch(() => {}); });
        } else {
          if (onDisconnected) onDisconnected(false, 0).catch?.(() => {});
        }
      }
    }, 1500);

  } else if (isPairing && onQR) {
    let qrSent = false;
    sock.ev.on('connection.update', u => {
      if (u.qr && !qrSent) {
        qrSent = true;
        Promise.resolve(onQR(u.qr)).catch(e => logger.warn('[WA] onQR error: ' + e.message));
      }
    });
  }

  // ── Connection state handler ───────────────────────────────────────────
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      sock._pairingInProgress = false;
      logger.info(`[WA] Connected: ${whatsappNumber}`);
      await Session.findOneAndUpdate(
        { telegramId: String(telegramId), whatsappNumber },
        { isActive: true, lastConnected: new Date(), failCount: 0, lastError: null },
        { upsert: true }
      ).catch(e => logger.warn('[WA] Session update error: ' + e.message));
      if (onConnected) {
        Promise.resolve(onConnected(sock)).catch(e => logger.warn('[WA] onConnected error: ' + e.message));
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const errMsg = String(lastDisconnect?.error?.message || '').toLowerCase();
      logger.info(`[WA] Closed: ${whatsappNumber} (code=${statusCode})`);

      // Expected 401 right after pairing code sent — silent reconnect
      if (sock._pairingCodeSent) {
        const elapsed = Date.now() - (sock._pairingCodeSentAt || 0);
        if (elapsed < 3 * 60 * 1000) {
          logger.info(`[WA] Post-code reconnect for ${whatsappNumber}`);
          active.delete(key);
          createWhatsAppSession(telegramId, whatsappNumber, { onConnected, onDisconnected, isOwnerSession })
            .catch(e => logger.warn(`[WA] Post-code reconnect error: ${e.message}`));
          return;
        }
      }

      // Pre-code close during pairing — ignore, setTimeout will fire
      if (sock._pairingInProgress && !sock._pairingCodeSent) {
        logger.info(`[WA] Pre-code close for ${whatsappNumber} (code=${statusCode}), ignoring`);
        return;
      }

      active.delete(key);

      const isLoggedOut  = statusCode === DisconnectReason.loggedOut;
      const isBadSession = statusCode === DisconnectReason.badSession
        || errMsg.includes('bad mac') || statusCode === 401;
      const isForbidden  = statusCode === 403;
      const shouldReconnect = !isLoggedOut && !isBadSession && !isForbidden;

      await Session.findOneAndUpdate(
        { telegramId: String(telegramId), whatsappNumber },
        { isActive: false, lastError: `code_${statusCode}`, $inc: { failCount: 1 } }
      ).catch(() => {});

      if (isBadSession) cleanCorruptedSession(dir);

      if (onDisconnected) {
        Promise.resolve(onDisconnected(shouldReconnect, statusCode))
          .catch(e => logger.warn('[WA] onDisconnected error: ' + e.message));
      }
    }
  });

  return sock;
}

// ── Owner-specific session (separate from user sessions) ──────────────────
async function createOwnerSession(ownerNumber, { onCode, onQR, onConnected, onDisconnected } = {}) {
  return createWhatsAppSession('__owner__', ownerNumber, {
    onCode, onQR, onConnected, onDisconnected,
    isOwnerSession: true,
  });
}

function getSock(tid, num) { return active.get(`${tid}:${num}`); }
function getOwnerSockByNum(num) { return active.get(`__owner__:${num}`); }

async function ensureSock(tid, num) {
  let s = getSock(tid, num);
  if (s) return s;
  s = await reconnect(tid, num);
  if (!s) throw new Error('WhatsApp not connected. Please re-pair.');
  return s;
}

async function reconnect(tid, num) {
  const session = await Session.findOne({ telegramId: String(tid), whatsappNumber: num });
  if (!session) return null;

  const dir = getUserSessionDir(tid, num);
  if (!isSessionDirValid(dir)) return null;

  if (session.failCount >= 5) {
    logger.warn(`[WA] Too many failures for ${num}, skipping reconnect`);
    return null;
  }

  return new Promise(res => {
    let done = false;
    const timeout = setTimeout(() => { if (!done) { done = true; res(null); } }, config.limits.reconnectTimeoutMs);

    createWhatsAppSession(tid, num, {
      onConnected: sock => { if (!done) { done = true; clearTimeout(timeout); res(sock); } },
      onDisconnected: () => { if (!done) { done = true; clearTimeout(timeout); res(null); } },
    }).catch(() => { if (!done) { done = true; clearTimeout(timeout); res(null); } });
  });
}

async function setProfilePicture(tid, num, imagePath) {
  const sock = await ensureSock(tid, num);
  const raw = fs.readFileSync(imagePath);
  await sock.updateProfilePicture(sock.user.id, raw, { hd: true });
}

async function setGroupProfilePicture(sock, groupJid, imagePath) {
  const raw = fs.readFileSync(imagePath);
  await sock.updateProfilePicture(groupJid, raw, { hd: true });
}

async function setDisplayName(tid, num, name) {
  const sock = await ensureSock(tid, num);
  await sock.updateProfileName(name);
}

async function getProfilePicture(tid, num) {
  const sock = await ensureSock(tid, num);
  return sock.profilePictureUrl(sock.user.id, 'image');
}

async function deleteProfilePicture(tid, num) {
  const sock = await ensureSock(tid, num);
  await sock.removeProfilePicture(sock.user.id);
}

async function joinGroupViaInvite(sock, inviteCode) {
  return sock.groupAcceptInvite(inviteCode);
}

async function leaveGroup(sock, groupJid) {
  await sock.groupLeave(groupJid);
}

async function getGroupMetadata(sock, groupJid) {
  return sock.groupMetadata(groupJid);
}

async function isAdminInGroup(sock, groupJid) {
  const meta = await getGroupMetadata(sock, groupJid);
  const botJid = sock.user.id;
  const botId = botJid.split(':')[0] + '@s.whatsapp.net';
  const participant = meta.participants.find(p =>
    p.id === botJid || p.id === botId || p.id.split(':')[0] === botJid.split(':')[0]
  );
  return participant?.admin === 'admin' || participant?.admin === 'superadmin';
}

async function disconnect(tid, num) {
  const s = getSock(tid, num);
  if (s) {
    await s.logout().catch(() => {});
    active.delete(`${tid}:${num}`);
  }
}

function getActiveSessions() { return active; }

module.exports = {
  createWhatsAppSession,
  createOwnerSession,
  setProfilePicture, setGroupProfilePicture,
  setDisplayName, getProfilePicture, deleteProfilePicture,
  joinGroupViaInvite, leaveGroup, getGroupMetadata, isAdminInGroup,
  disconnect, reconnect, getSock, getOwnerSockByNum, ensureSock, getActiveSessions,
};
