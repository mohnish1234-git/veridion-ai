import cron from "node-cron";
import { runPriceUpdateJob } from "./price-update-job";
import { logger } from "../../infrastructure/logger/logger";

export function startPriceScheduler() {

  runPriceUpdateJob().catch((err) =>
    logger.error({ err }, "[PriceScheduler] Initial run failed")
  );

  cron.schedule("0 */4 * * *", async () => {
    logger.info("[PriceScheduler] Running price update job");
    await runPriceUpdateJob();
  });

  logger.info("[PriceScheduler] Started");
}