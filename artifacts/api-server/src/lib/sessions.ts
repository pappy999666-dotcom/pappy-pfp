/**
 * In-memory session simulation layer.
 * Manages QR codes, pairing codes, and simulated WhatsApp lifecycle.
 * Real Baileys integration can replace this module without touching routes.
 */
import { v4 as uuidv4 } from "uuid";
import QRCode from "qrcode";
import { logger } from "./logger";

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
  qrDataUrl?: string;
  qrExpiresAt?: Date;
  qrRefreshCount: number;
  pairingCode?: string;
  progressStep: number;
  progressPct: number;
  progressLabel: string;
  progressMessage: string;
  simulationTimer?: ReturnType<typeof setTimeout>;
}

// In-memory map: sessionId → live state
const liveSessions = new Map<string, LiveSession>();

export async function initLiveSession(
  sessionId: string,
  pairingMethod: "qr" | "code",
): Promise<LiveSession> {
  const live: LiveSession = {
    sessionId,
    qrRefreshCount: 0,
    progressStep: 1,
    progressPct: 10,
    progressLabel: "Connecting",
    progressMessage: "Establishing secure connection...",
  };

  if (pairingMethod === "qr") {
    live.qrDataUrl = await generateQRDataUrl(sessionId);
    live.qrExpiresAt = new Date(Date.now() + 60_000);
    live.progressLabel = "Awaiting Scan";
    live.progressMessage = "Scan the QR code with your WhatsApp app.";
    live.progressStep = 2;
    live.progressPct = 20;
  } else {
    live.pairingCode = generatePairingCode();
    live.progressLabel = "Awaiting Code Entry";
    live.progressMessage = "Enter the 8-digit code on your WhatsApp app.";
    live.progressStep = 2;
    live.progressPct = 20;
  }

  liveSessions.set(sessionId, live);
  logger.info({ sessionId, pairingMethod }, "Live session initialized");
  return live;
}

export function getLiveSession(sessionId: string): LiveSession | undefined {
  return liveSessions.get(sessionId);
}

export function deleteLiveSession(sessionId: string): void {
  const live = liveSessions.get(sessionId);
  if (live?.simulationTimer) {
    clearTimeout(live.simulationTimer);
  }
  liveSessions.delete(sessionId);
}

export async function refreshQR(sessionId: string): Promise<LiveSession | undefined> {
  const live = liveSessions.get(sessionId);
  if (!live) return undefined;

  live.qrDataUrl = await generateQRDataUrl(`${sessionId}-refresh-${live.qrRefreshCount + 1}`);
  live.qrExpiresAt = new Date(Date.now() + 60_000);
  live.qrRefreshCount += 1;
  return live;
}

/**
 * Advance session through the pairing → applying → completed lifecycle.
 * In production, this would be driven by Baileys events.
 */
export function advanceSessionToApplying(
  sessionId: string,
  onUpdate: (status: SessionStatus, progress: number, label: string, message: string) => void,
): void {
  const live = liveSessions.get(sessionId);
  if (!live) return;

  const steps: Array<[SessionStatus, number, string, string, number]> = [
    ["paired", 50, "Paired", "WhatsApp linked successfully!", 800],
    ["uploading", 60, "Uploading", "Sending your photo to WhatsApp...", 1200],
    ["applying", 75, "Applying", "Changing your profile picture...", 1500],
    ["completed", 100, "Completed", "Your profile picture has been updated!", 0],
  ];

  let delay = 0;
  for (const [status, pct, label, message, wait] of steps) {
    const d = delay;
    const timer = setTimeout(() => {
      const l = liveSessions.get(sessionId);
      if (!l) return;
      l.progressStep = status === "completed" ? 6 : status === "applying" ? 5 : status === "uploading" ? 4 : 3;
      l.progressPct = pct;
      l.progressLabel = label;
      l.progressMessage = message;
      onUpdate(status, pct, label, message);
    }, d);

    live.simulationTimer = timer;
    delay += wait;
  }
}

async function generateQRDataUrl(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    width: 256,
    margin: 2,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

function generatePairingCode(): string {
  // 8-digit alphanumeric pairing code
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code.slice(0, 4) + "-" + code.slice(4);
}

export function getStatusInfo(
  sessionId: string,
  dbStatus: string,
): {
  step: number;
  stepLabel: string;
  progress: number;
  message: string;
  isComplete: boolean;
  isFailed: boolean;
} {
  const live = liveSessions.get(sessionId);

  if (live) {
    return {
      step: live.progressStep,
      stepLabel: live.progressLabel,
      progress: live.progressPct,
      message: live.progressMessage,
      isComplete: dbStatus === "completed",
      isFailed: dbStatus === "failed",
    };
  }

  // Fallback from DB status
  const statusMap: Record<string, { step: number; stepLabel: string; progress: number; message: string }> = {
    pending: { step: 1, stepLabel: "Connecting", progress: 5, message: "Starting session..." },
    connecting: { step: 1, stepLabel: "Connecting", progress: 15, message: "Establishing connection..." },
    awaiting_scan: { step: 2, stepLabel: "Scan QR", progress: 25, message: "Waiting for QR scan..." },
    awaiting_code_entry: { step: 2, stepLabel: "Enter Code", progress: 25, message: "Waiting for code entry..." },
    paired: { step: 3, stepLabel: "Paired", progress: 50, message: "WhatsApp linked!" },
    uploading: { step: 4, stepLabel: "Uploading", progress: 65, message: "Sending your photo..." },
    applying: { step: 5, stepLabel: "Applying", progress: 80, message: "Changing profile picture..." },
    completed: { step: 6, stepLabel: "Done", progress: 100, message: "Profile picture updated!" },
    failed: { step: 1, stepLabel: "Failed", progress: 0, message: "Something went wrong." },
    logged_out: { step: 6, stepLabel: "Logged Out", progress: 100, message: "Session ended securely." },
  };

  const info = statusMap[dbStatus] ?? statusMap.pending;
  return {
    ...info,
    isComplete: dbStatus === "completed" || dbStatus === "logged_out",
    isFailed: dbStatus === "failed",
  };
}
