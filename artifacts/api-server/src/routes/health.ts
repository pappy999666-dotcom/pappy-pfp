import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db, sessionsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Live stats — total successful pairs
router.get("/stats", async (_req, res) => {
  try {
    const [row] = await db
      .select({ total: count() })
      .from(sessionsTable)
      .where(eq(sessionsTable.status, "completed"));
    res.json({ totalPairs: row?.total ?? 0 });
  } catch {
    res.json({ totalPairs: 0 });
  }
});

export default router;
