import { prisma } from "../../infrastructure/prisma/client";
import { ingestAssetPrices } from "../market-data/price-ingestion.service";
import { logger } from "../../infrastructure/logger/logger";

export async function runPriceUpdateJob() {
  logger.info("[PriceJob] Starting");

  const assets = await prisma.asset.findMany({
    select: { id: true, ticker: true },
  });

  if (!assets.length) {
    logger.warn("[PriceJob] No assets found");
    return;
  }

  await Promise.all(
    assets.map(async (asset) => {
      try {
        await ingestAssetPrices(asset.id, asset.ticker);
      } catch (err) {
        logger.error(
          { err, ticker: asset.ticker },
          "[PriceJob] Failed for asset"
        );
      }
    })
  );

  logger.info("[PriceJob] Completed");
}