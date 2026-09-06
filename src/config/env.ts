import dotenv from "dotenv";
dotenv.config();

function int(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  PORT: int(process.env.PORT, 3000),
  REDIS_HOST: process.env.REDIS_HOST || "localhost",
  REDIS_PORT: int(process.env.REDIS_PORT, 6379),
  TEMPORAL_ADDRESS:
    process.env.TEMPORAL_ADDRESS ||
    (process.env.TEMPORAL_HOST ? `${process.env.TEMPORAL_HOST}:${process.env.TEMPORAL_PORT || "7233"}` : "localhost:7233"),
  TEMPORAL_NAMESPACE: process.env.TEMPORAL_NAMESPACE || "default",
  TEMPORAL_TASK_QUEUE: process.env.TEMPORAL_TASK_QUEUE || "hotel-aggregation",
  SUPPLIER_A_URL: process.env.SUPPLIER_A_URL || "http://localhost:3000",
  SUPPLIER_B_URL: process.env.SUPPLIER_B_URL || "http://localhost:3000",
  SIMULATE_SUPPLIER_A_FAILURE: process.env.SIMULATE_SUPPLIER_A_FAILURE === "true",
  SIMULATE_SUPPLIER_B_FAILURE: process.env.SIMULATE_SUPPLIER_B_FAILURE === "true",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
};