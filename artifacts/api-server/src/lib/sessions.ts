/**
 * sessions.ts — Real Baileys integration for the web API.
 * Each web session gets a unique tid = "__web__<sessionId>" so multiple
 * concurrent users never collide in the Baileys active-sessions map.
 */

import { createRequire } from "module";
import QRCode from "qrcode";
import { logger } from "./logger.js";

const require = createRequire(import.meta.url);
const waService = require("/root/pappy-pfp/src/services/whatsapp.js");

export type SessionStatus =
  | "pending"
  | "connecting"
  | "awaiting_scan"
  | "awaiting_code_entry"
  | "paired"
  | "uploading"
  | "applying"
  | "completed"
  | "failed"
  | "logged_out";

interface LiveSession {
  sessionId: string;
  phoneNumber: string;
  pairingMethod: "qr" | "code";
  qrDataUrl?: string;
  qrExpiresAt?: Date;
  qrRefreshCount: number;
  pairingCode?: string;
  status: SessionStatus;
  progressStep: number;
  progressPct: number;
  progressLabel: string;
  progressMessage: string;
  onStatusChange?: (status: SessionStatus, pct: number, label: string, msg: string) => void;
}

const liveSessions = new Map<string, LiveSession>();

/** Unique Baileys tid per web session — prevents active-map collisions */
function webTid(sessionId: string): string {
  return `__web__${sessionId}`;
}

function setLive(
  l: LiveSession,
  status: SessionStatus,
  step: number,
  pct: number,
  label: string,
  msg: string,
) {
  l.status = status;
  l.progressStep = step;
  l.progressPct = pct;
  l.progressLabel = label;
  l.progressMessage = msg;
  l.onStatusChange?.(status, pct, label, msg);
}

// ── Init ──────────────────────────────────────────────────────────────────────

export async function initLiveSession(
  sessionId: string,
  pairingMethod: "qr" | "code",
  phoneNumber: string,
): Promise<LiveSession> {
  // Clean up any existing session for this exact sessionId
  const existing = liveSessions.get(sessionId);
  if (existing) {
    try { await waService.disconnect(webTid(sessionId), existing.phoneNumber); } catch {}
    liveSessions.delete(sessionId);
  }

  const live: LiveSession = {
    sessionId,
    phoneNumber,
    pairingMethod,
    qrRefreshCount: 0,
    status: "connecting",
    progressStep: 1,
    progressPct: 10,
    progressLabel: "Connecting",
    progressMessage: "Establishing secure connection to WhatsApp...",
  };

  liveSessions.set(sessionId, live);

  waService.createWhatsAppSession(webTid(sessionId), phoneNumber, {
    onCode: async (code: string) => {
      const l = liveSessions.get(sessionId);
      if (!l) return;
      const clean = code.replace(/-/g, "").toUpperCase().slice(0, 8);
      l.pairingCode = clean.slice(0, 4) + "-" + clean.slice(4);
      setLive(l, "awaiting_code_entry", 2, 25, "Enter Code",
        "Enter the code in WhatsApp → Linked Devices → Link with phone number.");
      logger.info({ sessionId, code: l.pairingCode }, "Pairing code ready");
    },
    onQR: async (qr: string) => {
      const l = liveSessions.get(sessionId);
      if (!l) return;
      try {
        l.qrDataUrl = await QRCode.toDataURL(qr, {
          width: 300, margin: 2,
          color: { dark: "#000000", light: "#FFFFFF" },
        });
      } catch { l.qrDataUrl = ""; }
      l.qrExpiresAt = new Date(Date.now() + 55_000);
      l.qrRefreshCount += 1;
      setLive(l, "awaiting_scan", 2, 25, "Scan QR",
        "Scan the QR code with your WhatsApp app.");
      logger.info({ sessionId, refresh: l.qrRefreshCount }, "QR ready");
    },
    onConnected: async (_sock: any) => {
      const l = liveSessions.get(sessionId);
      if (!l) return;
      setLive(l, "paired", 3, 50, "Paired", "WhatsApp linked successfully!");
      logger.info({ sessionId, phoneNumber }, "Session paired");
    },
    onDisconnected: async (shouldReconnect: boolean, code: number) => {
      const l = liveSessions.get(sessionId);
      if (!l) return;
      if (l.status === "completed" || l.status === "logged_out" || l.status === "applying") return;
      if (!shouldReconnect) {
        const msg =
          code === 401 ? "Session expired or rejected. Please try again." :
          code === 403 ? "WhatsApp blocked this connection. Try a different method." :
          `Connection closed (code ${code}). Please try again.`;
        setLive(l, "failed", 1, 0, "Failed", msg);
        logger.warn({ sessionId, code }, "Session disconnected");
      }
    },
  }).catch((err: Error) => {
    const l = liveSessions.get(sessionId);
    if (!l || l.status === "completed" || l.status === "logged_out") return;
    setLive(l, "failed", 1, 0, "Failed", err.message || "Failed to connect.");
    logger.error({ sessionId, err: err.message }, "Session init error");
  });

  return live;
}

// ── Accessors ─────────────────────────────────────────────────────────────────

export function getLiveSession(sessionId: string): LiveSession | undefined {
  return liveSessions.get(sessionId);
}

export async function deleteLiveSession(sessionId: string): Promise<void> {
  const l = liveSessions.get(sessionId);
  if (l) {
    try {
      const sock = waService.getSock(webTid(sessionId), l.phoneNumber);
      if (sock) await sock.logout().catch(() => {});
      await waService.disconnect(webTid(sessionId), l.phoneNumber).catch(() => {});
    } catch {}
  }
  liveSessions.delete(sessionId);
}

export function setSessionStatusCallback(
  sessionId: string,
  cb: (status: SessionStatus, pct: number, label: string, msg: string) => void,
): void {
  const l = liveSessions.get(sessionId);
  if (l) l.onStatusChange = cb;
}

// ── Channel join with full fallbacks ──────────────────────────────────────────

function isAlreadyMember(e: any): boolean {
  const sc = e?.output?.statusCode ?? e?.status ?? 0;
  const msg = String(e?.message ?? "").toLowerCase();
  return sc === 409 || msg.includes("already") || msg.includes("subscribed") || msg.includes("member");
}

async function tryJoinChannel(sock: any, channelUrl: string, sessionId: string): Promise<void> {
  if (!channelUrl || !sock) return;

  // Extract invite code from WA channel URL
  // https://whatsapp.com/channel/XXXX  or  https://chat.whatsapp.com/XXXX
  const match = channelUrl.match(/(?:channel\/|chat\.whatsapp\.com\/)([A-Za-z0-9]+)/);
  if (!match) {
    logger.warn({ sessionId, channelUrl }, "Could not extract invite code from channel URL");
    return;
  }
  const inviteCode = match[1];

  // ── Attempt 1: Resolve invite → get real newsletter JID → newsletterFollow ──
  // This is the correct flow for WA Channels (newsletters)
  if (typeof sock.newsletterMetadata === "function" && typeof sock.newsletterFollow === "function") {
    try {
      const meta = await sock.newsletterMetadata("invite", inviteCode);
      const jid = meta?.id;
      if (jid) {
        try {
          await sock.newsletterFollow(jid);
          logger.info({ sessionId, jid }, "Joined WA channel via newsletterFollow");
          return;
        } catch (ef: any) {
          if (isAlreadyMember(ef)) {
            logger.info({ sessionId, jid }, "Already following WA channel");
            return;
          }
          logger.warn({ sessionId, err: ef.message }, "newsletterFollow failed");
        }
      }
    } catch (em: any) {
      if (isAlreadyMember(em)) {
        logger.info({ sessionId }, "Already a channel member (metadata check)");
        return;
      }
      logger.warn({ sessionId, err: em.message }, "newsletterMetadata failed → trying groupAcceptInvite");
    }
  }

  // ── Attempt 2: groupAcceptInvite (WA groups + older channel invites) ─────────
  try {
    await sock.groupAcceptInvite(inviteCode);
    logger.info({ sessionId, inviteCode }, "Joined via groupAcceptInvite");
    return;
  } catch (e2: any) {
    if (isAlreadyMember(e2)) {
      logger.info({ sessionId }, "Already a member (groupAcceptInvite)");
      return;
    }
    logger.warn({ sessionId, err: e2.message }, "groupAcceptInvite failed → trying direct newsletterFollow");
  }

  // ── Attempt 3: Direct newsletterFollow with constructed JID ──────────────────
  // Some channels expose their JID in the invite code directly
  if (typeof sock.newsletterFollow === "function") {
    try {
      // Try treating the invite code as a newsletter JID suffix
      await sock.newsletterFollow(`${inviteCode}@newsletter`);
      logger.info({ sessionId }, "Joined via direct newsletterFollow with constructed JID");
      return;
    } catch (e3: any) {
      if (isAlreadyMember(e3)) {
        logger.info({ sessionId }, "Already following (direct newsletterFollow)");
        return;
      }
      logger.warn({ sessionId, err: e3.message }, "All channel join attempts failed — non-fatal, continuing");
    }
  }
}

// ── Apply profile picture ─────────────────────────────────────────────────────

export async function applyProfilePicture(
  sessionId: string,
  uploadFilePath: string,
  phoneNumber: string,
  sessionType: string,
  waChannelUrl: string | null,
  onUpdate: (status: SessionStatus, pct: number, label: string, msg: string) => void,
): Promise<void> {
  const l = liveSessions.get(sessionId);
  if (!l) throw new Error("Session not found");

  const tid = webTid(sessionId);

  try {
    // Step 1: Set profile picture
    setLive(l, "uploading", 4, 60, "Uploading", "Sending your photo to WhatsApp...");
    onUpdate(l.status, l.progressPct, l.progressLabel, l.progressMessage);

    await waService.setProfilePicture(tid, phoneNumber, uploadFilePath);
    logger.info({ sessionId, phoneNumber }, "Profile picture set");

    // Step 2: Join channel BEFORE logout (with all fallbacks)
    setLive(l, "applying", 5, 78, "Joining Channel", "Joining your WhatsApp channel...");
    onUpdate(l.status, l.progressPct, l.progressLabel, l.progressMessage);

    if (waChannelUrl) {
      const sock = waService.getSock(tid, phoneNumber);
      await tryJoinChannel(sock, waChannelUrl, sessionId);
    }

    // Step 3: Logout cleanly BEFORE marking complete — no ghost sessions
    setLive(l, "applying", 5, 90, "Finishing", "Securing and closing session...");
    onUpdate(l.status, l.progressPct, l.progressLabel, l.progressMessage);

    if (sessionType === "temporary") {
      try {
        const sock = waService.getSock(tid, phoneNumber);
        if (sock) await sock.logout().catch(() => {});
        await waService.disconnect(tid, phoneNumber).catch(() => {});
      } catch {}
    }

    // Step 4: Complete
    setLive(l, "completed", 6, 100, "Done",
      "Your WhatsApp profile picture has been updated! 🎉");
    onUpdate(l.status, l.progressPct, l.progressLabel, l.progressMessage);

    // Clean up live map after delay
    setTimeout(() => { liveSessions.delete(sessionId); }, 15_000);

  } catch (err: any) {
    // Always logout on failure — no leaked sessions
    try {
      const sock = waService.getSock(tid, phoneNumber);
      if (sock) await sock.logout().catch(() => {});
      await waService.disconnect(tid, phoneNumber).catch(() => {});
    } catch {}

    setLive(l, "failed", 1, 0, "Failed",
      err.message || "Failed to apply profile picture.");
    onUpdate(l.status, l.progressPct, l.progressLabel, l.progressMessage);
    liveSessions.delete(sessionId);
    throw err;
  }
}

// ── Status info ───────────────────────────────────────────────────────────────

export function getStatusInfo(
  sessionId: string,
  dbStatus: string,
): {
  step: number; stepLabel: string; progress: number;
  message: string; isComplete: boolean; isFailed: boolean;
} {
  const live = liveSessions.get(sessionId);
  if (live) {
    return {
      step: live.progressStep,
      stepLabel: live.progressLabel,
      progress: live.progressPct,
      message: live.progressMessage,
      isComplete: live.status === "completed",
      isFailed: live.status === "failed",
    };
  }

  const statusMap: Record<string, { step: number; stepLabel: string; progress: number; message: string }> = {
    pending:             { step: 1, stepLabel: "Connecting",  progress: 5,   message: "Starting session..." },
    connecting:          { step: 1, stepLabel: "Connecting",  progress: 15,  message: "Establishing connection..." },
    awaiting_scan:       { step: 2, stepLabel: "Scan QR",     progress: 25,  message: "Waiting for QR scan..." },
    awaiting_code_entry: { step: 2, stepLabel: "Enter Code",  progress: 25,  message: "Waiting for code entry..." },
    paired:              { step: 3, stepLabel: "Paired",      progress: 50,  message: "WhatsApp linked!" },
    uploading:           { step: 4, stepLabel: "Uploading",   progress: 65,  message: "Sending your photo..." },
    applying:            { step: 5, stepLabel: "Applying",    progress: 85,  message: "Changing profile picture..." },
    completed:           { step: 6, stepLabel: "Done",        progress: 100, message: "Profile picture updated!" },
    failed:              { step: 1, stepLabel: "Failed",      progress: 0,   message: "Something went wrong." },
    logged_out:          { step: 6, stepLabel: "Logged Out",  progress: 100, message: "Session ended securely." },
  };

  const info = statusMap[dbStatus] ?? statusMap.pending;
  return {
    ...info,
    isComplete: dbStatus === "completed" || dbStatus === "logged_out",
    isFailed: dbStatus === "failed",
  };
}
