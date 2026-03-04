import { Router } from "express";
import {
  searchAssets,
  ensureAssetExists
} from "./asset-discovery.service";
import { prisma } from "../../infrastructure/prisma/client";
import { ingestAssetPrices } from "./price-ingestion.service";
import { logger } from "../../infrastructure/logger/logger";

const router = Router();

/**
 * Normalize ticker symbols
 */
function normalizeTicker(ticker: string) {
  const t = ticker.toUpperCase().trim();

  if (t === "BTC") return "BTC-USD";
  if (t === "ETH") return "ETH-USD";

  return t;
}

/**
 * GET /market/assets/search?q=AAPL
 */
router.get("/assets/search", async (req, res) => {

  try {

    const query = String(req.query.q || "").trim();

    if (!query || query.length < 2) {
      return res.json([]);
    }

    // 1️⃣ search local DB first (fast)
    const local = await prisma.asset.findMany({
      where: {
        ticker: {
          startsWith: query.toUpperCase()
        }
      },
      take: 5
    });

    // 2️⃣ search Yahoo
    const remote = await searchAssets(query);

    const results = [
      ...local.map(a => ({
        ticker: a.ticker,
        name: a.name,
        assetType: a.assetType
      })),
      ...remote
    ];

    res.json(results.slice(0, 10));

  } catch (err) {

    logger.error({ err }, "Asset search failed");

    res.status(500).json({
      error: "Asset search failed"
    });

  }

});


/**
 * GET /market/assets/:ticker
 * Fetch asset metadata and ensure price history exists
 */
router.get("/assets/:ticker", async (req, res) => {

  try {

    const ticker = normalizeTicker(req.params.ticker);

    let asset = await prisma.asset.findUnique({
      where: { ticker }
    });

    if (!asset) {

      asset = await ensureAssetExists(ticker);

      // fetch historical prices for new asset
      await ingestAssetPrices(asset.id, ticker);

    }

    res.json(asset);

  } catch (err) {

    logger.error({ err }, "Asset lookup failed");

    res.status(500).json({
      error: "Asset lookup failed"
    });

  }

});


/**
 * GET /market/assets/:ticker/history
 */
router.get("/assets/:ticker/history", async (req, res) => {

  try {

    const ticker = normalizeTicker(req.params.ticker);

    const asset = await prisma.asset.findUnique({
      where: { ticker }
    });

    if (!asset) {
      return res.status(404).json({
        error: "Asset not found"
      });
    }

    const history = await prisma.assetPrice.findMany({
      where: { assetId: asset.id },
      orderBy: { priceDate: "asc" },
      take: 2000   // prevents huge responses
    });

    res.json(history);

  } catch (err) {

    logger.error({ err }, "History fetch failed");

    res.status(500).json({
      error: "History fetch failed"
    });

  }

});

export const marketDataController = router;