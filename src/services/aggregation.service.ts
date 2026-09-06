import { randomUUID } from "crypto";
import { getTemporalClient } from "../temporal/client";
import { HotelWorkflowInput, HotelWorkflowResult } from "../types/hotel";
import { env } from "../config/env";

export async function executeHotelAggregation(input: HotelWorkflowInput): Promise<HotelWorkflowResult> {
  const client = await getTemporalClient();
  // Normalize the city so "Delhi", "delhi", "DELHI" map to the same identity.
  const city = input.city.trim().toLowerCase();
  // randomUUID guarantees a unique workflow id per request so every request runs
  // its own aggregation and gets a fresh, correctly-filtered result. Concurrent
  // same-city aggregations are serialized at the Redis level via a city-scoped
  // lock (see redis.service.ts) rather than by sharing workflow ids.
  const workflowId = `hotel-aggregation-${city}-${randomUUID()}`;
  const handle = await client.workflow.start("hotelAggregationWorkflow", {
    args: [input],
    taskQueue: env.TEMPORAL_TASK_QUEUE,
    workflowId,
  });
  return await handle.result();
}