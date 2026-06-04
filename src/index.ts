import app from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { authService } from "./services/auth.service";
import { catalogService } from "./services/catalog.service";
import { logger } from "./utils/logger";

let server: ReturnType<typeof app.listen>;

const bootstrap = async (): Promise<void> => {
  await catalogService.ensureCatalogSeeded();

  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    await authService.ensureDefaultAdmin(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);
  }
};

const shutdown = async (signal: string): Promise<void> => {
  logger.info("server:shutdown-start", { signal });
  if (!server) {
    await prisma.$disconnect();
    process.exit(0);
    return;
  }

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

import { startKitchenAlertLoop } from "./utils/kitchen-alerts";

const start = async (): Promise<void> => {
  try {
    await bootstrap();

    startKitchenAlertLoop();

    server = app.listen(env.PORT, "0.0.0.0", () => {
      logger.info("server:started", {
        port: env.PORT,
        environment: env.NODE_ENV,
        logLevel: env.LOG_LEVEL
      });
    });
  } catch (error) {
    logger.error("server:bootstrap-failed", { error });
    await prisma.$disconnect();
    process.exit(1);
  }
};

void start();
