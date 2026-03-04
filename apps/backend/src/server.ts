import app from "./app";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./infrastructure/prisma/client";
import { connectRedis } from "./infrastructure/cache/redis";
import { initJobQueue } from "./infrastructure/queue/job-queue";
import { logger } from "./infrastructure/logger/logger";
import { startPriceScheduler } from "./modules/jobs/price-scheduler";
import { startNewsScheduler } from "./modules/jobs/news-scheduler";

async function bootstrap() {
  // 1. Connect infrastructure
  await connectDatabase();
  await connectRedis();
  await initJobQueue();

  // 2. Start HTTP server
  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on http://localhost:${env.PORT}`);
    logger.info(`   Environment: ${env.NODE_ENV}`);
    startPriceScheduler();
    startNewsScheduler();
  });

  // 3. Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await disconnectDatabase();
      logger.info("Server closed");
      process.exit(0);
    });

    // Force exit after 10s
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Catch unhandled errors
  process.on("unhandledRejection", (reason) => {
    logger.error(reason, "Unhandled Rejection:");
  });

  process.on("uncaughtException", (error) => {
    logger.error(error, "Uncaught Exception:");
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});
