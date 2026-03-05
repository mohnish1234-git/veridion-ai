// ============================================================
// VERIDION AI — Risk Engine Orchestrator
// ============================================================
// Loads holdings + price data from the database, runs all risk
// calculations, and persists the results.
// ============================================================

import { prisma } from '../../infrastructure/prisma/client';
import { logger } from '../../infrastructure/logger/logger';
import {
    computeDailyReturns,
    computePortfolioWeights,
    computePortfolioReturns,
    annualizedVolatility,
    sharpeRatio,
    sortinoRatio,
    maxDrawdown,
    valueAtRisk95,
    conditionalVaR95,
    covarianceMatrix,
    riskContributions,
    efficientFrontier,
    mean,
} from './risk.calculations';

// ── Types ────────────────────────────────────────────────────

interface RiskResult {
    volatility: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    var95: number;
    cvar95: number;
}

interface AssetData {
    assetId: number;
    ticker: string;
    name: string;
    weight: number;
    prices: number[];       // oldest → newest
    returns: number[];
}

// ── Helper: Decimal → number ─────────────────────────────────

function d(val: any): number {
    if (val == null) return 0;
    if (typeof val === 'number') return val;
    return val.toNumber ? val.toNumber() : Number(val);
}

// ── Internal: load & align price data ────────────────────────

async function loadAssetData(userId: number): Promise<AssetData[]> {
    const holdings = await prisma.holding.findMany({
        where: { userId },
        include: {
            asset: {
                include: {
                    prices: {
                        orderBy: { priceDate: 'asc' },
                        take: 253, // 252 trading days + 1 for returns
                    },
                },
            },
        },
    });

    if (holdings.length === 0) return [];

    // Compute current market values for weight calculation
    const assetValues: { ticker: string; name: string; assetId: number; value: number; prices: number[] }[] = [];

    for (const h of holdings) {
        const priceSeries = h.asset.prices.map((p) => d(p.price));
        if (priceSeries.length < 2) continue; // need at least 2 prices for returns

        const latestPrice = priceSeries[priceSeries.length - 1];
        const qty = d(h.quantity);
        const value = qty * latestPrice;

        assetValues.push({
            ticker: h.asset.ticker,
            name: h.asset.name ?? h.asset.ticker,
            assetId: h.asset.id,
            value,
            prices: priceSeries,
        });
    }

    if (assetValues.length === 0) return [];

    // Align all price series to the same length (shortest common window)
    const minLen = Math.min(...assetValues.map((a) => a.prices.length));
    for (const a of assetValues) {
        // Keep the most recent `minLen` prices
        a.prices = a.prices.slice(a.prices.length - minLen);
    }

    // Compute weights
    const weights = computePortfolioWeights(assetValues.map((a) => a.value));

    return assetValues.map((a, i) => ({
        assetId: a.assetId,
        ticker: a.ticker,
        name: a.name,
        weight: weights[i],
        prices: a.prices,
        returns: computeDailyReturns(a.prices),
    }));
}

// ── Public: compute & persist all metrics ────────────────────

export async function computeRiskForUser(userId: number): Promise<RiskResult | null> {
    const assets = await loadAssetData(userId);
    if (assets.length === 0) {
        logger.warn({ userId }, '[RiskEngine] No usable asset data — skipping');
        return null;
    }

    const weights = assets.map((a) => a.weight);
    const assetReturnsList = assets.map((a) => a.returns);

    // Portfolio-level daily returns
    const portReturns = computePortfolioReturns(assetReturnsList, weights);

    // Compute all risk metrics
    const vol = annualizedVolatility(portReturns);
    const sharpe = sharpeRatio(portReturns, 0.02);
    const sortino = sortinoRatio(portReturns, 0.02);
    const mdd = maxDrawdown(portReturns);
    const var95 = valueAtRisk95(portReturns);
    const cvar95 = conditionalVaR95(portReturns);

    // Persist to RiskMetricsHistory
    await prisma.riskMetricsHistory.create({
        data: {
            userId,
            volatility: vol,
            sharpeRatio: sharpe,
            sortinoRatio: sortino,
            maxDrawdown: mdd,
            var95,
            calculatedAt: new Date(),
        },
    });

    // Compute and persist risk contributions
    const covMat = covarianceMatrix(assetReturnsList);
    const contribs = riskContributions(weights, covMat);

    // Delete old contributions for this user before inserting new ones
    await prisma.riskContribution.deleteMany({ where: { userId } });

    if (contribs.length > 0) {
        await prisma.riskContribution.createMany({
            data: assets.map((a, i) => ({
                userId,
                assetId: a.assetId,
                contributionPercent: contribs[i],
                calculatedAt: new Date(),
            })),
        });
    }

    logger.info({ userId, vol, sharpe, sortino, mdd, var95, cvar95 }, '[RiskEngine] Metrics computed');

    return { volatility: vol, sharpeRatio: sharpe, sortinoRatio: sortino, maxDrawdown: mdd, var95, cvar95 };
}

// ── Public: real-time risk contributions ─────────────────────

export async function getRiskContributionsForUser(
    userId: number,
): Promise<{ ticker: string; name: string; weight: number; contribution: number }[]> {
    const assets = await loadAssetData(userId);
    if (assets.length === 0) return [];

    const weights = assets.map((a) => a.weight);
    const assetReturnsList = assets.map((a) => a.returns);
    const covMat = covarianceMatrix(assetReturnsList);
    const contribs = riskContributions(weights, covMat);

    return assets.map((a, i) => ({
        ticker: a.ticker,
        name: a.name,
        weight: weights[i],
        contribution: contribs[i],
    }));
}

// ── Public: real covariance matrix ───────────────────────────

export async function getCovarianceForUser(
    userId: number,
): Promise<{ tickers: string[]; matrix: number[][] }> {
    const assets = await loadAssetData(userId);
    if (assets.length === 0) return { tickers: [], matrix: [] };

    const assetReturnsList = assets.map((a) => a.returns);
    const covMat = covarianceMatrix(assetReturnsList);

    return {
        tickers: assets.map((a) => a.ticker),
        matrix: covMat,
    };
}

// ── Public: real efficient frontier ──────────────────────────

export async function getEfficientFrontierForUser(
    userId: number,
): Promise<{ volatility: number; expectedReturn: number; isOptimal: boolean; isCurrent: boolean; weights?: Record<string, number> }[]> {
    const assets = await loadAssetData(userId);
    if (assets.length === 0) return [];

    const weights = assets.map((a) => a.weight);
    const assetReturnsList = assets.map((a) => a.returns);
    const meanReturns = assetReturnsList.map((r) => mean(r));
    const covMat = covarianceMatrix(assetReturnsList);
    const tickers = assets.map((a) => a.ticker);

    return efficientFrontier(meanReturns, covMat, tickers, weights, 20, 3000);
}
