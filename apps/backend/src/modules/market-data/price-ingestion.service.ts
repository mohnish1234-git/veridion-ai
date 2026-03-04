import { prisma } from "../../infrastructure/prisma/client";
import { fetchHistoricalPrices } from "./price-fetcher";
import { logger } from "../../infrastructure/logger/logger";

export async function ingestAssetPrices(assetId: number, ticker: string) {

  logger.info(`Starting price ingestion for ${ticker}`);

  const prices = await fetchHistoricalPrices(ticker);

  if (!prices.length) {
    logger.warn(`No prices fetched for ${ticker}`);
    return;
  }

  const data = prices.map((p) => ({
    assetId,
    priceDate: p.date,
    price: p.close,
  }));

  await prisma.assetPrice.createMany({
    data,
    skipDuplicates: true,
  });

  logger.info(`Inserted ${data.length} price rows for ${ticker}`);
}