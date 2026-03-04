import YahooFinance from "yahoo-finance2";
import { prisma } from "../../infrastructure/prisma/client";
import { logger } from "../../infrastructure/logger/logger";

const yahooFinance = new YahooFinance();

/**
 * Search tickers using Yahoo Finance
 */
export async function searchAssets(query: string) {

  if (!query || query.length < 2) return [];

  try {

    const result: any = await yahooFinance.search(query);

    const quotes = Array.isArray(result?.quotes)
      ? result.quotes
      : [];

    return normalizeQuotes(quotes);

  } catch (err: any) {

    // Yahoo often throws validation errors but still returns partial data
    if (err?.result?.quotes) {
      return normalizeQuotes(err.result.quotes);
    }

    if (err?.aggregateErrors?.length) {

      const recoveredQuotes = err.aggregateErrors
        .map((e: any) => e?.result?.quotes || e?.data)
        .flat()
        .filter((q: any) => q?.symbol);

      if (recoveredQuotes.length) {
        return normalizeQuotes(recoveredQuotes);
      }
    }

    logger.warn(
      { query, message: err?.message },
      "[MarketData] Yahoo validation error"
    );

    return [];
  }
}


/**
 * Ensure asset exists in DB
 */
export async function ensureAssetExists(ticker: string) {

  const normalized = ticker.toUpperCase();

  let asset = await prisma.asset.findUnique({
    where: { ticker: normalized }
  });

  if (asset) return asset;

  logger.info({ ticker: normalized }, "[MarketData] Fetching asset metadata");

  try {

    const quote: any = await yahooFinance.quote(normalized);

    asset = await prisma.asset.create({
      data: {
        ticker: normalized,
        name: quote.longName || quote.shortName || normalized,
        assetType: quote.quoteType || null,
        sector: quote.sector || null,
        country: quote.country || null
      }
    });

  } catch {

    // fallback if Yahoo quote fails
    asset = await prisma.asset.create({
      data: {
        ticker: normalized,
        name: normalized
      }
    });

  }

  return asset;

}


/**
 * Normalize Yahoo quote objects
 */
function normalizeQuotes(quotes: any[]) {

  const results = quotes
    .filter(q => q?.symbol)
    .slice(0, 10)
    .map(q => {

      const assetTypeRaw = (q.quoteType || "").toLowerCase();

      const assetTypeMap: Record<string, string> = {
        equity: "stock",
        etf: "etf",
        cryptocurrency: "crypto",
        crypto: "crypto"
      };

      return {
        ticker: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        assetType: assetTypeMap[assetTypeRaw] || "stock",
        sector: q.sector || "Other",
        country: q.region || "US"
      };

    });

  return results;
}