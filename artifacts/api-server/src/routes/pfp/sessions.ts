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
  refreshQR,
  advanceSessionToApplying,
  getStatusInfo,
  type SessionStatus,
} from "../../lib/sessions";

const router: IRouter = Router();

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

// POST /api/pfp/sessions — create session
router.post("/pfp/sessions", async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { phoneNumber, countryCode, pairingMethod, sessionType, uploadId } = parsed.data;

  const id = uuidv4();
  const now = new Date();

  // Init live session (generates QR or pairing code)
  const live = await initLiveSession(id, pairingMethod as "qr" | "code");

  const initialStatus =
    pairingMethod === "qr" ? "awaiting_scan" : "awaiting_code_entry";

  await db.insert(sessionsTable).values({
    id,
    phoneNumber,
    countryCode,
    pairingMethod,
    sessionType,
    status: initialStatus,
    pairingCode: live.pairingCode ?? null,
    uploadId: uploadId ?? null,
    createdAt: now,
    updatedAt: now,
  });

  req.log.info({ id, phoneNumber, pairingMethod }, "Session created");

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, id))
    .limit(1);

  res.status(201).json(sessionRow(session));
});

// GET /api/pfp/sessions/:sessionId
router.get("/pfp/sessions/:sessionId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const { sessionId } = GetSessionParams.parse({ sessionId: raw });

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId))
    .limit(1);

  if (!session) {
    res.status(404).json({ error: "Session not found." });
    return;
  }

  res.json(sessionRow(session));
});

// DELETE /api/pfp/sessions/:sessionId — logout + cleanup
router.delete("/pfp/sessions/:sessionId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const { sessionId } = DeleteSessionParams.parse({ sessionId: raw });

  deleteLiveSession(sessionId);

  await db
    .update(sessionsTable)
    .set({ status: "logged_out", updatedAt: new Date() })
    .where(eq(sessionsTable.id, sessionId));

  req.log.info({ sessionId }, "Session deleted/logged out");
  res.json({ success: true, message: "Session logged out and deleted." });
});

// GET /api/pfp/sessions/:sessionId/qr
router.get("/pfp/sessions/:sessionId/qr", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const { sessionId } = GetSessionQRParams.parse({ sessionId: raw });

  let live = getLiveSession(sessionId);

  if (!live) {
    res.status(404).json({ error: "Session not found or expired." });
    return;
  }

  // Auto-refresh QR if expired
  if (live.qrExpiresAt && live.qrExpiresAt < new Date()) {
    live = (await refreshQR(sessionId)) ?? live;
  }

  res.json({
    sessionId,
    qrDataUrl: live.qrDataUrl ?? "",
    expiresAt: live.qrExpiresAt?.toISOString() ?? new Date(Date.now() + 60_000).toISOString(),
    refreshCount: live.qrRefreshCount,
  });
});

// POST /api/pfp/sessions/:sessionId/apply — trigger profile picture update
router.post("/pfp/sessions/:sessionId/apply", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const { sessionId } = ApplyProfilePictureParams.parse({ sessionId: raw });

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId))
    .limit(1);

  if (!session) {
    res.status(400).json({ error: "Session not found." });
    return;
  }

  // Mark as uploading
  await db
    .update(sessionsTable)
    .set({ status: "uploading", updatedAt: new Date() })
    .where(eq(sessionsTable.id, sessionId));

  // Simulate asynchronous profile picture update lifecycle
  advanceSessionToApplying(sessionId, async (status, _pct, _label, _message) => {
    const dbStatus = status as SessionStatus;

    const completedAt =
      dbStatus === "completed" || dbStatus === "logged_out" ? new Date() : undefined;

    await db
      .update(sessionsTable)
      .set({
        status: dbStatus,
        updatedAt: new Date(),
        ...(completedAt ? { completedAt } : {}),
      })
      .where(eq(sessionsTable.id, sessionId));

    // If temporary session and completed → auto logout
    if (dbStatus === "completed" && session.sessionType === "temporary") {
      setTimeout(async () => {
        deleteLiveSession(sessionId);
        await db
          .update(sessionsTable)
          .set({ status: "logged_out", updatedAt: new Date() })
          .where(eq(sessionsTable.id, sessionId));
      }, 2000);
    }
  });

  const [updated] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId))
    .limit(1);

  res.json(sessionRow(updated));
});

// GET /api/pfp/sessions/:sessionId/status — live progress info (polled by frontend)
router.get("/pfp/sessions/:sessionId/status", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const { sessionId } = GetSessionStatusParams.parse({ sessionId: raw });

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId))
    .limit(1);

  if (!session) {
    // Return safe defaults instead of 404 for polling clients
    res.json({
      sessionId,
      status: "pending",
      step: 1,
      stepLabel: "Connecting",
      progress: 5,
      message: "Starting...",
      isComplete: false,
      isFailed: false,
    });
    return;
  }

  const info = getStatusInfo(sessionId, session.status);

  res.json({
    sessionId,
    status: session.status,
    ...info,
  });
});

export default router;
