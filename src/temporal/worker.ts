import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities/supplier.activities";
import * as redisActivities from "./activities/redis.activities";
import { env } from "../config/env";
import { logger } from "../utils/logger";

async function run(): Promise<void> {
  const connection = await NativeConnection.connect({
    address: env.TEMPORAL_ADDRESS,
  });

  const worker = await Worker.create({
    connection,
    namespace: env.TEMPORAL_NAMESPACE,
    taskQueue: env.TEMPORAL_TASK_QUEUE,
    workflowsPath: require.resolve("./workflows/hotel.workflow"),
    activities: {
      ...activities,
      ...redisActivities,
    },
  });

  logger.info(
    `Temporal worker started (address: ${env.TEMPORAL_ADDRESS}, namespace: ${env.TEMPORAL_NAMESPACE}, taskQueue: ${env.TEMPORAL_TASK_QUEUE})`
  );
  await worker.run();
  logger.info("Temporal worker stopped");
}

run().catch((err) => {
  logger.error(`Temporal worker failed: ${(err as Error).message}`);
  process.exit(1);
});