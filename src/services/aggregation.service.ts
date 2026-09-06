import { randomUUID } from "crypto";
import { getTemporalClient } from "../temporal/client";
import { HotelWorkflowInput, HotelWorkflowResult } from "../types/hotel";
import { env } from "../config/env";

export async function executeHotelAggregation(input: HotelWorkflowInput): Promise<HotelWorkflowResult> {
  const client = await getTemporalClient();
  // randomUUID guarantees a unique workflow id per request, avoiding accidental
  // reuse/deduplication of completed workflows for the same city within a millisecond.
  const workflowId = `hotel-aggregation-${input.city.toLowerCase()}-${randomUUID()}`;
  const handle = await client.workflow.start("hotelAggregationWorkflow", {
    args: [input],
    taskQueue: env.TEMPORAL_TASK_QUEUE,
    workflowId,
  });
  return await handle.result();
}