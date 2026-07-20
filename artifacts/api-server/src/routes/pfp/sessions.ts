import { Router, type IRouter } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, sessionsTable, uploadsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateSessionBody,
  GetSessionParams,
  GetSessionQRParams,
  ApplyProfilePictureParams,
  GetSessionStatusParams,
  DeleteSessionParams,
} from "@workspace/api-zod";
import {
  initLiveSession,
  getLiveSession,
  deleteLiveSession,
  applyProfilePicture,
  setSessionStatusCallback,
  getStatusInfo,
  type SessionStatus,
} from "../../lib/sessions.js";

const router: IRouter = Router();
const UPLOAD_DIR = "/tmp/pappy-pfp-uploads";

import type { Session } from "@workspace/db";

function sessionRow(s: Session) {
  return {
    id: s.id,
    phoneNumber: s.phoneNumber,
    countryCode: s.countryCode,
    pairingMethod: s.pairingMethod,
    sessionType: s.sessionType,
    status: s.status,
    pairingCode: s.pairingCode ?? null,
    uploadId: s.uploadId ?? null,
    errorMessage: s.errorMessage ?? null,
    completedAt: s.completedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

async function syncLiveToDB(sessionId: string): Promise<void> {
  const live = getLiveSession(sessionId);
  if (!live) return;
  const patch: Record<string, any> = { status: live.status, updatedAt: new Date() };
  if (live.pairingCode) patch.pairingCode = live.pairingCode;
  if (live.status === "completed" || live.status === "logged_out") patch.completedAt = new Date();
  await db.update(sessionsTable).set(patch).where(eq(sessionsTable.id, sessionId)).catch(() => {});
}

async function updateStatus(sessionId: string, status: SessionStatus, extra?: Record<string, any>): Promise<void> {
  const patch: Record<string, any> = { status, updatedAt: new Date(), ...extra };
  if (status === "completed" || status === "logged_out") patch.completedAt = new Date();
  await db.update(sessionsTable).set(patch).where(eq(sessionsTable.id, sessionId)).catch(() => {});
}

// POST /api/pfp/sessions
router.post("/pfp/sessions", async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { phoneNumber, countryCode, pairingMethod, sessionType, uploadId } = parsed.data;

  // Normalize to E.164 digits only
  const ccDigits = countryCode.replace(/\D/g, "");
  const rawDigits = phoneNumber.replace(/\D/g, "");
  const fullNumber = rawDigits.startsWith(ccDigits) ? rawDigits : ccDigits + rawDigits;

  if (fullNumber.length < 7 || fullNumber.length > 15) {
    res.status(400).json({ error: "Invalid phone number. Please check your country code and number." });
    return;
  }

  const id = uuidv4();
  const now = new Date();

  // Insert DB row first so status polling works immediately
  await db.insert(sessionsTable).values({
    id,
    phoneNumber: fullNumber,
    countryCode,
    pairingMethod,
    sessionType,
    status: "connecting",
    pairingCode: null,
    uploadId: uploadId ?? null,
    createdAt: now,
    updatedAt: now,
  });

  // Start real Baileys session
  const live = await initLiveSession(id, pairingMethod as "qr" | "code", fullNumber);

  // Keep DB in sync whenever live state changes
  setSessionStatusCallback(id, async (status, _pct, _label, _msg) => {
    await updateStatus(id, status, live.pairingCode ? { pairingCode: live.pairingCode } : undefined);
  });

  req.log.info({ id, phoneNumber: fullNumber, pairingMethod }, "Session created");

  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, id)).limit(1);
  res.status(201).json(sessionRow(session));
});

// GET /api/pfp/sessions/:sessionId
router.get("/pfp/sessions/:sessionId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const { sessionId } = GetSessionParams.parse({ sessionId: raw });

  // Sync live state (pairingCode may have just arrived)
  await syncLiveToDB(sessionId);

  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId)).limit(1);
  if (!session) {
    res.status(404).json({ error: "Session not found." });
    return;
  }

  res.json(sessionRow(session));
});

// DELETE /api/pfp/sessions/:sessionId
router.delete("/pfp/sessions/:sessionId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const { sessionId } = DeleteSessionParams.parse({ sessionId: raw });

  await deleteLiveSession(sessionId);
  await updateStatus(sessionId, "logged_out");

  req.log.info({ sessionId }, "Session deleted/logged out");
  res.json({ success: true, message: "Session logged out and deleted." });
});

// GET /api/pfp/sessions/:sessionId/qr
router.get("/pfp/sessions/:sessionId/qr", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const { sessionId } = GetSessionQRParams.parse({ sessionId: raw });

  const live = getLiveSession(sessionId);
  if (!live) {
    res.status(404).json({ error: "Session not found or expired." });
    return;
  }

  res.json({
    sessionId,
    qrDataUrl: live.qrDataUrl ?? "",
    expiresAt: live.qrExpiresAt?.toISOString() ?? new Date(Date.now() + 60_000).toISOString(),
    refreshCount: live.qrRefreshCount,
  });
});

// POST /api/pfp/sessions/:sessionId/apply
router.post("/pfp/sessions/:sessionId/apply", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const { sessionId } = ApplyProfilePictureParams.parse({ sessionId: raw });

  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId)).limit(1);
  if (!session) {
    res.status(400).json({ error: "Session not found." });
    return;
  }

  if (session.status !== "paired") {
    res.status(400).json({ error: `Session is not paired yet (status: ${session.status}).` });
    return;
  }

  if (!session.uploadId) {
    res.status(400).json({ error: "No image uploaded for this session." });
    return;
  }

  const [upload] = await db.select().from(uploadsTable).where(eq(uploadsTable.id, session.uploadId)).limit(1);
  if (!upload) {
    res.status(400).json({ error: "Uploaded image not found." });
    return;
  }

  const filePath = `${UPLOAD_DIR}/${upload.filename}`;

  // Read channel URL at request time so owner changes take effect immediately
  const channelUrl = process.env.WA_AUTO_JOIN_CHANNEL || null;

  // Mark uploading immediately so frontend sees progress
  await updateStatus(sessionId, "uploading");

  // Run async — frontend polls /status
  applyProfilePicture(
    sessionId,
    filePath,
    session.phoneNumber,
    session.sessionType,
    channelUrl,
    async (status, _pct, _label, _msg) => {
      await updateStatus(sessionId, status, status === "failed" ? { errorMessage: _msg } : undefined);
    },
  ).catch(async (err) => {
    req.log.error({ err: err.message, sessionId }, "Apply failed");
    await updateStatus(sessionId, "failed", { errorMessage: err.message });
  });

  const [updated] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId)).limit(1);
  res.json(sessionRow(updated));
});

// GET /api/pfp/sessions/:sessionId/status
router.get("/pfp/sessions/:sessionId/status", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const { sessionId } = GetSessionStatusParams.parse({ sessionId: raw });

  // Always sync live → DB before responding
  await syncLiveToDB(sessionId);

  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId)).limit(1);
  if (!session) {
    res.json({ sessionId, status: "pending", step: 1, stepLabel: "Connecting", progress: 5, message: "Starting...", isComplete: false, isFailed: false });
    return;
  }

  const info = getStatusInfo(sessionId, session.status);
  res.json({ sessionId, status: session.status, ...info });
});

export default router;
