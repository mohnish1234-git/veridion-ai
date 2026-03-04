import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../infrastructure/prisma/client";
import { NotFoundError, BadRequestError } from "../../core/errors";
import { cacheDel } from "../../infrastructure/cache/redis";
import { logger } from "../../infrastructure/logger/logger";
import { ensureAssetExists } from "../market-data/asset-discovery.service";
import { ingestAssetPrices } from "../market-data/price-ingestion.service";

// ── Types ────────────────────────────────────────────

export interface CreateHoldingInput {
  ticker: string;
  name?: string;       // Asset display name (e.g. "Apple Inc.")
  assetType?: string;  // 'stock' | 'etf' | 'crypto' | etc.
  sector?: string;     // 'Technology' | 'Healthcare' | etc.
  country?: string;    // 'US' | 'UK' | etc.
  quantity: number;
  avgCost?: number;
}

export interface UpdateHoldingInput {
  quantity?: number;
  avgCost?: number;
}

// ── Service ──────────────────────────────────────────

export async function getUserHoldings(userId: number) {
  const holdings = await prisma.holding.findMany({
    where: { userId },
    include: {
      asset: {
        select: {
          id: true,
          ticker: true,
          name: true,
          assetType: true,
          sector: true,
          country: true,
        },
      },
    },
    orderBy: { lastUpdated: "desc" },
  });

  return holdings.map((h) => ({
    id: h.id,
    asset: h.asset,
    quantity: Number(h.quantity),
    avgCost: h.avgCost ? Number(h.avgCost) : null,
    lastUpdated: h.lastUpdated,
  }));
}

export async function addHolding(userId: number, input: CreateHoldingInput) {
  if (input.quantity <= 0) {
    throw new BadRequestError("Quantity must be greater than 0");
  }

  const ticker = input.ticker.toUpperCase().trim();

  // Upsert the asset — always update name/sector/type/country if provided,
  const asset = await ensureAssetExists(ticker);
  // ensure prices exist
  await ingestAssetPrices(asset.id, asset.ticker);

  logger.info(`Upserted asset: ${asset.ticker}`);

  // Upsert: if the user already holds this asset, ADD to the existing quantity
  // (like buying more shares of the same stock — no 409 ever)
  const existing = await prisma.holding.findUnique({
    where: { userId_assetId: { userId, assetId: asset.id } },
  });

  let holding;

  if (existing) {
    const existingQty = existing.quantity.toNumber();
    const newQty = existingQty + input.quantity;

    // Weighted average cost calculation
    let newAvgCost: number | null = existing.avgCost ? existing.avgCost.toNumber() : null;
    if (input.avgCost && input.avgCost > 0) {
      if (newAvgCost !== null && newAvgCost > 0) {
        newAvgCost = (existingQty * newAvgCost + input.quantity * input.avgCost) / newQty;
      } else {
        newAvgCost = input.avgCost;
      }
    }

    holding = await prisma.holding.update({
      where: { id: existing.id },
      data: {
        quantity: new Decimal(newQty),
        avgCost: newAvgCost !== null && newAvgCost > 0 ? new Decimal(newAvgCost) : undefined,
        lastUpdated: new Date(),
      },
      include: {
        asset: { select: { id: true, ticker: true, name: true, assetType: true, sector: true, country: true } },
      },
    });
  } else {
    holding = await prisma.holding.create({
      data: {
        userId,
        assetId: asset.id,
        quantity: new Decimal(input.quantity),
        avgCost: input.avgCost && input.avgCost > 0 ? new Decimal(input.avgCost) : null,
      },
      include: {
        asset: { select: { id: true, ticker: true, name: true, assetType: true, sector: true, country: true } },
      },
    });
  }

  await cacheDel(`portfolio:${userId}:*`);

  return {
    id: holding.id,
    asset: holding.asset,
    quantity: Number(holding.quantity),
    avgCost: holding.avgCost ? Number(holding.avgCost) : null,
    lastUpdated: holding.lastUpdated,
  };
}

export async function updateHolding(userId: number, holdingId: number, input: UpdateHoldingInput) {
  const holding = await prisma.holding.findFirst({
    where: { id: holdingId, userId },
  });

  if (!holding) {
    throw new NotFoundError("Holding", holdingId);
  }

  if (input.quantity !== undefined && input.quantity <= 0) {
    throw new BadRequestError("Quantity must be greater than 0");
  }

  const updated = await prisma.holding.update({
    where: { id: holdingId },
    data: {
      quantity: input.quantity !== undefined ? new Decimal(input.quantity) : undefined,
      avgCost: input.avgCost !== undefined ? new Decimal(input.avgCost) : undefined,
      lastUpdated: new Date(),
    },
    include: {
      asset: {
        select: { id: true, ticker: true, name: true, assetType: true, sector: true, country: true },
      },
    },
  });

  await cacheDel(`portfolio:${userId}:*`);

  return {
    id: updated.id,
    asset: updated.asset,
    quantity: Number(updated.quantity),
    avgCost: updated.avgCost ? Number(updated.avgCost) : null,
    lastUpdated: updated.lastUpdated,
  };
}

export async function removeHolding(userId: number, holdingId: number) {
  // Scope the lookup to BOTH holdingId AND userId.
  // This prevents a user from deleting another user's holding,
  // and gives a proper 404 if the ID doesn't belong to them.
  const holding = await prisma.holding.findFirst({
    where: { id: holdingId, userId },
  });

  if (!holding) {
    throw new NotFoundError("Holding", holdingId);
  }

  await prisma.holding.delete({ where: { id: holdingId } });
  await cacheDel(`portfolio:${userId}:*`);

  return { deleted: true };
}
