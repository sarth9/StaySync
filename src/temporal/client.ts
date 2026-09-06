import { Connection, Client } from "@temporalio/client";
import { env } from "../config/env";
import { logger } from "../utils/logger";

let client: Client | null = null;

export async function getTemporalClient(): Promise<Client> {
  if (!client) {
    const connection = await Connection.connect({
      address: env.TEMPORAL_ADDRESS,
    });
    client = new Client({ connection, namespace: env.TEMPORAL_NAMESPACE });
    logger.info(`Temporal client connected to ${env.TEMPORAL_ADDRESS} (namespace: ${env.TEMPORAL_NAMESPACE})`);
  }
  return client;
}