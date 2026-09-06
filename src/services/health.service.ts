import axios from "axios";
import { Connection } from "@temporalio/client";
import { env } from "../config/env";
import { ComponentStatus, HealthServices, HealthStatus } from "../types/health";
import { createRedisClient, ensureReady } from "./redis.service";
import { logger } from "../utils/logger";

async function checkRedisHealth(): Promise<ComponentStatus> {
  const redis = createRedisClient({ connectTimeout: 2000, maxRetriesPerRequest: 1 });
  try {
    await ensureReady(redis);
    await redis.ping();
    return "healthy";
  } catch (err) {
    logger.warn(`Health check: Redis unhealthy: ${(err as Error).message}`);
    return "unhealthy";
  } finally {
    redis.disconnect();
  }
}

async function checkTemporalHealth(): Promise<ComponentStatus> {
  try {
    const connection = await Connection.connect({
      address: env.TEMPORAL_ADDRESS,
      connectTimeout: "2 seconds",
    });
    await connection.close();
    return "healthy";
  } catch (err) {
    logger.warn(`Health check: Temporal unhealthy: ${(err as Error).message}`);
    return "unhealthy";
  }
}

async function checkSupplierHealth(url: string, path: string): Promise<ComponentStatus> {
  try {
    const response = await axios.get(`${url}${path}?city=delhi`, { timeout: 2000 });
    return response.status === 200 ? "healthy" : "unhealthy";
  } catch (err) {
    logger.warn(`Health check: supplier ${path} unhealthy: ${(err as Error).message}`);
    return "unhealthy";
  }
}

export function summarizeHealth(services: HealthServices): HealthStatus {
  const values = Object.values(services);
  if (values.every((v) => v === "healthy")) {
    return { status: "ok", services };
  }
  if (values.every((v) => v === "unhealthy")) {
    return { status: "down", services };
  }
  return { status: "degraded", services };
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const [supplierA, supplierB, redis, temporal] = await Promise.all([
    checkSupplierHealth(env.SUPPLIER_A_URL, "/supplierA/hotels"),
    checkSupplierHealth(env.SUPPLIER_B_URL, "/supplierB/hotels"),
    checkRedisHealth(),
    checkTemporalHealth(),
  ]);

  return summarizeHealth({
    app: "healthy",
    supplierA,
    supplierB,
    redis,
    temporal,
  });
}