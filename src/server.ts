import app from "./api/app";
import { env } from "./config/env";
import { logger } from "./utils/logger";

const server = app.listen(env.PORT, () => {
  logger.info(`StaySync server running on port ${env.PORT}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    logger.error(`Port ${env.PORT} is already in use`);
  } else {
    logger.error(`Server error: ${err.message}`);
  }
  process.exit(1);
});

function shutdown(signal: string): void {
  logger.info(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
  // Force-exit if connections keep the server open
  setTimeout(() => process.exit(0), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default server;