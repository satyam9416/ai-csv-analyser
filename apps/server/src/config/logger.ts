import { createLogger, format, transports } from "winston";
import type { TransformableInfo } from "logform";

const { combine, timestamp, errors, json, colorize, printf } = format;

const devFormat = combine(
  colorize(),
  timestamp(),
  errors({ stack: true }),
  printf((info: TransformableInfo & { stack?: string }) => {
    const ts = (info.timestamp as string) || new Date().toISOString();
    const level = String(info.level);
    const message = String(info.message ?? "");
    const base = `[${ts}] ${level}: ${message}`;
    return info.stack ? `${base}\n${info.stack}` : base;
  }),
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

export const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: process.env.NODE_ENV === "production" ? prodFormat : devFormat,
  transports: [new transports.Console()],
});
