import pino from "pino";
import { loadEnv } from "@tatame/config";

const env = loadEnv();

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : "info",
  ...(env.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  }),
});
