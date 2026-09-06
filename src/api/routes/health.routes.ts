import { Router, Request, Response } from "express";
import { getHealthStatus } from "../../services/health.service";
import { logger } from "../../utils/logger";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  const status = await getHealthStatus();
  logger.info(`Health check: status=${status.status} services=${JSON.stringify(status.services)}`);
  res.status(status.status === "ok" ? 200 : 503).json(status);
});

export default router;