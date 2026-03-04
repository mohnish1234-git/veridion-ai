import YahooFinance from "yahoo-finance2";
import { prisma } from "../../infrastructure/prisma/client";

const yahooFinance = new YahooFinance();

function normalizeTicker(ticker: string) {
  if (ticker === "BTC") return "BTC-USD";
  if (ticker === "ETH") return "ETH-USD";
  return ticker;
}

export async function fetchHistoricalPrices(ticker: string) {

  const asset = await prisma.asset.findUnique({
    where: { ticker },
    include: {
      prices: {
        orderBy: { priceDate: "desc" },
        take: 1
      }
    }
  });

  let period1 = "2015-01-01";

  if (asset?.prices?.length) {
    const last = asset.prices[0].priceDate;
    period1 = last.toISOString().split("T")[0];
  }

  const results = await yahooFinance.historical(normalizeTicker(ticker), {
    period1,
    period2: new Date(),
    interval: "1d"
  });

  return (results as any[])
    .filter((q) => q.close !== null && q.close !== undefined)
    .map((q) => ({
      date: new Date(q.date),
      close: q.close
    }));
}