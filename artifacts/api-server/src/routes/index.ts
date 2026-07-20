import { Router, type IRouter } from "express";
import healthRouter from "./health";
import uploadRouter from "./pfp/upload";
import sessionsRouter from "./pfp/sessions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(uploadRouter);
router.use(sessionsRouter);

export default router;
