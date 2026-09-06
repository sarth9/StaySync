import winston from "winston";
import { env } from "../config/env";

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
      return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
    })
  ),
  transports: [new winston.transports.Console()],
});
