import express from "express";
import { NextFunction, Request, Response } from "express";
import healthRoutes from "./routes/health.routes";
import hotelRoutes from "./routes/hotel.routes";
import { createSupplierRouter } from "./routes/supplier.routes";
import { HttpError } from "./controllers/hotel.controller";
import { getSupplierAOffers, getSupplierBOffers } from "../services/supplier.service";
import { env } from "../config/env";
import { logger } from "../utils/logger";

const app = express();

app.use(express.json());

// Request logging (method, path, status, duration)
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

app.use("/health", healthRoutes);
app.use(
  "/supplierA",
  createSupplierRouter({
    name: "A",
    getOffers: getSupplierAOffers,
    simulateFailure: () => env.SIMULATE_SUPPLIER_A_FAILURE,
  })
);
app.use(
  "/supplierB",
  createSupplierRouter({
    name: "B",
    getOffers: getSupplierBOffers,
    simulateFailure: () => env.SIMULATE_SUPPLIER_B_FAILURE,
  })
);
app.use("/api", hotelRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// Centralized error handling
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ error: "Internal server error" });
});

export default app;