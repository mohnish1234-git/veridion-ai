import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../infrastructure/prisma/client';
import { logger } from '../../infrastructure/logger/logger';

function n(v: any): number {
    if (v == null) return 0;
    return typeof v === 'number' ? v : v.toNumber ? v.toNumber() : Number(v);
}

function clamp(val: number, min = 0, max = 100): number {
    return Math.min(max, Math.max(min, val));
}

export interface BiasDetectionResult {
    adaptiveRiskScore: number;
    panicSellScore: number;
    recencyBiasScore: number;
    riskChasingScore: number;
    liquidityStressScore: number;
    lossAversionRatio: number | null;
    featureSnapshot: Record<string, number>;
    insights: string[];
    calculatedAt: string;
}

export async function detectBiases(userId: number): Promise<BiasDetectionResult> {
    // --- 1. Load all needed data in parallel -----------------------------------
    const [
        holdings,
        rebalancingActions,
        portfolioReturns,
        latestSpending,
        latestPortfolioSnapshot,
        portfolioSnapshots,
    ] = await Promise.all([
        prisma.holding.findMany({
            where: { userId },
            include: { asset: { include: { prices: { orderBy: { priceDate: 'desc' }, take: 60 } } } },
        }),
        prisma.rebalancingAction.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30 }),
        prisma.portfolioReturn.findMany({ where: { userId }, orderBy: { returnDate: 'desc' }, take: 252 }),
        prisma.spendingMetric.findFirst({ where: { userId }, orderBy: { calculatedAt: 'desc' } }),
        prisma.portfolioSnapshot.findFirst({ where: { userId }, orderBy: { snapshotDate: 'desc' } }),
        prisma.portfolioSnapshot.findMany({ where: { userId }, orderBy: { snapshotDate: 'desc' }, take: 10 }),
    ]);

    // ── 2. Panic Sell Score (0-100) ───────────────────────────────────────────
    // Look for sell-type rebalancing actions that coincided with negative returns
    let panicSellScore = 50; // default neutral
    if (portfolioReturns.length >= 5) {
        const negReturnDates = portfolioReturns
            .filter(r => n(r.dailyReturn) < -0.01) // days with >1% loss
            .map(r => r.returnDate.getTime());

        const sellActions = rebalancingActions.filter(a =>
            (a.triggerType ?? '').toLowerCase().includes('sell') ||
            (a.reason ?? '').toLowerCase().includes('sell') ||
            (a.triggerType ?? '').toLowerCase().includes('rebalance')
        );

        if (sellActions.length > 0 && negReturnDates.length > 0) {
            // Count sells within 3 days of a big loss
            const panicSells = sellActions.filter(a => {
                const actionTime = a.createdAt.getTime();
                return negReturnDates.some(dt => Math.abs(actionTime - dt) <= 3 * 86400 * 1000);
            });
            const panicRatio = panicSells.length / Math.max(sellActions.length, 1);
            panicSellScore = clamp(Math.round(panicRatio * 100));
        } else if (portfolioReturns.length >= 20) {
            // Less sell actions = less panic selling
            panicSellScore = 20 + sellActions.length * 2
        }
    }

    // ── 3. Recency Bias Score (0-100) ─────────────────────────────────────────
    // If portfolio holdings are skewed toward recently high-performing assets
    let recencyBiasScore = 50;
    if (holdings.length >= 2) {
        const holdingPerformance = holdings.map(h => {
            const prices = h.asset.prices.map(p => n(p.price));
            if (prices.length < 30) return { weight: n(h.quantity), recent: 0, longterm: 0 };

            const recent30 = prices.slice(0, 30);
            const longTerm = prices.slice(0, prices.length);
            const recentRet = recent30.length > 1 ? (recent30[0] - recent30[recent30.length - 1]) / (recent30[recent30.length - 1] || 1) : 0;
            const ltRet = longTerm.length > 1 ? (longTerm[0] - longTerm[longTerm.length - 1]) / (longTerm[longTerm.length - 1] || 1) : 0;

            return { weight: n(h.quantity) * (h.avgCost ? n(h.avgCost) : 1), recent: recentRet, longterm: ltRet };
        });

        const totalWeight = holdingPerformance.reduce((s, h) => s + h.weight, 0) || 1;
        const weightedRecentRet = holdingPerformance.reduce((s, h) => s + (h.weight / totalWeight) * h.recent, 0);
        const weightedLtRet = holdingPerformance.reduce((s, h) => s + (h.weight / totalWeight) * h.longterm, 0);

        // High recency bias: portfolio skews toward recent winners much more than LT performance
        const bias = weightedRecentRet > weightedLtRet ? (weightedRecentRet - weightedLtRet) : 0;
        recencyBiasScore = clamp(50 + bias * 200); // scale
    }

    // ── 4. Risk Chasing Score (0-100) ─────────────────────────────────────────
    // Compute volatility of each holding's price series and weight by position size
    let riskChasingScore = 50;
    if (holdings.length >= 1) {
        const marketBaselineVol = 0.15; // ~15% annualized baseline

        const holdingVols = holdings.map(h => {
            const prices = h.asset.prices.map(p => n(p.price));
            if (prices.length < 10) return { vol: 0, value: 0 };

            // Daily returns from price history
            const dailyRets = [];
            for (let i = 0; i < prices.length - 1; i++) {
                dailyRets.push((prices[i] - prices[i + 1]) / (prices[i + 1] || 1));
            }
            const mean = dailyRets.reduce((a, b) => a + b, 0) / dailyRets.length;
            const variance = dailyRets.reduce((s, r) => s + (r - mean) ** 2, 0) / (dailyRets.length - 1 || 1);
            const annualizedVol = Math.sqrt(variance * 252);
            const posValue = n(h.quantity) * (h.avgCost ? n(h.avgCost) : 1);
            return { vol: annualizedVol, value: posValue };
        });

        const totalValue = holdingVols.reduce((s, h) => s + h.value, 0) || 1;
        const weightedVol = holdingVols.reduce((s, h) => s + (h.value / totalValue) * h.vol, 0);
        const excessVol = Math.max(0, weightedVol - marketBaselineVol);
        riskChasingScore = clamp(Math.round(excessVol * 400 + 30)); // scale to 0-100
    }

    // ── 5. Liquidity Stress Score (0-100) ─────────────────────────────────────
    let liquidityStressScore = 50;
    const burnRate = latestSpending ? n(latestSpending.monthlyBurnRate) : 0;
    const portfolioValue = latestPortfolioSnapshot ? n(latestPortfolioSnapshot.totalValue) : 0;

    if (burnRate > 0 && portfolioValue > 0) {
        const monthsCovered = portfolioValue / burnRate;
        if (monthsCovered >= 12) {
            liquidityStressScore = clamp(Math.round(20 - (monthsCovered - 12) * 0.5));
        } else if (monthsCovered >= 3) {
            liquidityStressScore = clamp(Math.round(20 + ((12 - monthsCovered) / 9) * 60));
        } else {
            liquidityStressScore = clamp(Math.round(80 + ((3 - monthsCovered) / 3) * 20));
        }
    } else if (burnRate === 0) {
        liquidityStressScore = 20; // No burn rate data = assume low stress
    }

    // ── 6. Loss Aversion Ratio ────────────────────────────────────────────────
    let lossAversionRatio: number | null = null;
    if (holdings.length >= 2) {
        const latestPrice = (h: typeof holdings[0]) => {
            const p = h.asset.prices[0];
            return p ? n(p.price) : n(h.avgCost);
        };
        const winners = holdings.filter(h => latestPrice(h) >= n(h.avgCost));
        const losers = holdings.filter(h => latestPrice(h) < n(h.avgCost));

        if (winners.length > 0 && losers.length > 0) {
            // Approximate holding period by age of lastUpdated
            const avgWinnerAge = winners.reduce((s, h) => {
                const daysSince = (Date.now() - h.lastUpdated.getTime()) / (86400 * 1000);
                return s + daysSince;
            }, 0) / winners.length;

            const avgLoserAge = losers.reduce((s, h) => {
                const daysSince = (Date.now() - h.lastUpdated.getTime()) / (86400 * 1000);
                return s + daysSince;
            }, 0) / losers.length;

            lossAversionRatio = avgWinnerAge > 0 ? parseFloat((avgLoserAge / avgWinnerAge).toFixed(2)) : null;
        }
    }

    // ── 7. Adaptive Risk Score (composite) ────────────────────────────────────
    const adaptiveRiskScore = clamp(Math.round(
        100 - (0.30 * panicSellScore + 0.25 * recencyBiasScore + 0.25 * riskChasingScore + 0.20 * liquidityStressScore)
    ));

    // ── 8. Human-readable insights ────────────────────────────────────────────
    const insights: string[] = [];

    if (panicSellScore < 30)
        insights.push('Your panic sell score is low; you handle downturns with composure.');
    else if (panicSellScore < 60)
        insights.push('You show moderate panic sell tendencies; consider setting stop-loss rules to stay systematic.');
    else
        insights.push('High panic sell score detected; you may be making emotional sell decisions during dips.');

    if (recencyBiasScore < 35)
        insights.push('Minimal recency bias; your allocation decisions reflect long-term thinking.');
    else if (recencyBiasScore < 65)
        insights.push('You show moderate recency bias, tending to overweight recent winners in your portfolio.');
    else
        insights.push('Strong recency bias detected; your holdings are heavily skewed toward recently hot assets.');

    if (liquidityStressScore < 30 && burnRate > 0)
        insights.push(`Your liquidity buffer is solid, covering ${Math.round((portfolioValue || 0) / (burnRate || 1))} months of expenses.`);
    else if (liquidityStressScore < 60)
        insights.push('Your liquidity coverage is moderate; consider building a larger emergency buffer.');
    else
        insights.push('Low liquidity buffer detected; your portfolio may not cover unexpected expenses for very long.');

    if (riskChasingScore > 60)
        insights.push('You gravitate toward high-volatility assets; ensure this aligns with your stated risk profile.');

    // ── 9. Persist BehavioralScore ────────────────────────────────────────────
    const featureSnapshot: Record<string, number> = {
        panicSellScore, recencyBiasScore, riskChasingScore, liquidityStressScore,
        adaptiveRiskScore, holdingsCount: holdings.length,
        burnRate, portfolioValue,
    };
    if (lossAversionRatio !== null) featureSnapshot.lossAversionRatio = lossAversionRatio;

    const modelWeights = { w_panic: 0.30, w_recency: 0.25, w_riskChasing: 0.25, w_liquidity: 0.20 };

    try {
        await prisma.behavioralScore.create({
            data: {
                userId,
                adaptiveRiskScore: new Decimal(adaptiveRiskScore),
                panicSellScore: new Decimal(panicSellScore),
                recencyBiasScore: new Decimal(recencyBiasScore),
                riskChasingScore: new Decimal(riskChasingScore),
                liquidityStressScore: new Decimal(liquidityStressScore),
                featureSnapshot,
                modelWeights,
            },
        });
    } catch (err) {
        logger.warn(`Failed to persist BehavioralScore for user ${userId}: ${err}`);
    }

    return {
        adaptiveRiskScore, panicSellScore, recencyBiasScore,
        riskChasingScore, liquidityStressScore, lossAversionRatio,
        featureSnapshot, insights,
        calculatedAt: new Date().toISOString(),
    };
}
