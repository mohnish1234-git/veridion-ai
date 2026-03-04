import { prisma } from '../../infrastructure/prisma/client';

function n(v: any): number {
    if (v == null) return 0;
    return typeof v === 'number' ? v : v.toNumber ? v.toNumber() : Number(v);
}

function clamp(val: number, min = 1, max = 10): number {
    return Math.min(max, Math.max(min, val));
}

export interface AdaptiveRiskResult {
    currentRiskTolerance: number;
    suggestedRiskTolerance: number;
    adjustmentDelta: number;
    confidence: number;
    marketRegime: 'LOW_VOLATILITY' | 'NORMAL' | 'HIGH_VOLATILITY';
    adjustmentReasons: string[];
    behavioralScores: {
        adaptiveRiskScore: number;
        panicSellScore: number;
        recencyBiasScore: number;
        riskChasingScore: number;
        liquidityStressScore: number;
    };
}

export async function computeAdaptiveRisk(userId: number): Promise<AdaptiveRiskResult> {
    // --- Load data in parallel ------------------------------------------------
    const [lastOptRun, lastBehavioral, recentReturns, ltReturns, transactionCount, lastSpending] = await Promise.all([
        prisma.optimizationRun.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
        prisma.behavioralScore.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' } }),
        prisma.portfolioReturn.findMany({ where: { userId }, orderBy: { returnDate: 'desc' }, take: 21 }),
        prisma.portfolioReturn.findMany({ where: { userId }, orderBy: { returnDate: 'desc' }, take: 252 }),
        prisma.transaction.count({ where: { userId } }),
        prisma.spendingMetric.findFirst({ where: { userId }, orderBy: { calculatedAt: 'desc' } }),
    ]);

    // --- Current risk tolerance (scale: 1-10) ----------------------------------
    // UserProfile stores riskTolerance as 0-1; OptimizationRun may store it differently
    const rawTolerance = lastOptRun?.riskTolerance ? n(lastOptRun.riskTolerance) : 0.5;
    // Normalise to 1-10 scale: if value is in 0-1 range, multiply by 10
    const currentRiskTolerance = rawTolerance <= 1 ? parseFloat((rawTolerance * 10).toFixed(1)) : parseFloat(rawTolerance.toFixed(1));

    // --- Behavioral scores (defaults if not available) -------------------------
    const bScores = {
        adaptiveRiskScore: lastBehavioral ? n(lastBehavioral.adaptiveRiskScore) : 50,
        panicSellScore: lastBehavioral ? n(lastBehavioral.panicSellScore) : 50,
        recencyBiasScore: lastBehavioral ? n(lastBehavioral.recencyBiasScore) : 50,
        riskChasingScore: lastBehavioral ? n(lastBehavioral.riskChasingScore) : 50,
        liquidityStressScore: lastBehavioral ? n(lastBehavioral.liquidityStressScore) : 50,
    };

    // --- Market regime --------------------------------------------------------
    let marketRegime: 'LOW_VOLATILITY' | 'NORMAL' | 'HIGH_VOLATILITY' = 'NORMAL';
    let recentVolatility = 0;
    let ltVolatility = 0;

    if (recentReturns.length >= 5) {
        const rets = recentReturns.map(r => n(r.dailyReturn));
        const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
        const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length-1);
        recentVolatility = Math.sqrt(variance * 252);
    }
    if (ltReturns.length >= 20) {
        const rets = ltReturns.map(r => n(r.dailyReturn));
        const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
        const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length;
        ltVolatility = Math.sqrt(variance * 252);
    }

    if (ltVolatility > 0) {
        const ratio = recentVolatility / ltVolatility;
        if (ratio > 1.5) marketRegime = 'HIGH_VOLATILITY';
        else if (ratio < 0.6) marketRegime = 'LOW_VOLATILITY';
    } else if (recentVolatility > 0.25) {
        marketRegime = 'HIGH_VOLATILITY';
    } else if (recentVolatility < 0.08) {
        marketRegime = 'LOW_VOLATILITY';
    }

    // --- Adjustment logic ─────────────────────────────────────────────────────
    let suggestedTolerance = clamp(currentRiskTolerance, 1, 10);
    const adjustmentReasons: string[] = [];

    // High panic sell → reduce risk
    if (bScores.panicSellScore > 60) {
        const reduction = parseFloat(((bScores.panicSellScore - 60) / 40 * 2).toFixed(1));
        suggestedTolerance -= reduction;
        adjustmentReasons.push(`Reduced by ${reduction} due to elevated panic sell tendency (score: ${bScores.panicSellScore.toFixed(0)})`);
    }

    // High recency bias → reduce a bit
    if (bScores.recencyBiasScore > 55) {
        const reduction = parseFloat(((bScores.recencyBiasScore - 55) / 45 * 1).toFixed(1));
        suggestedTolerance -= reduction;
        adjustmentReasons.push(`Reduced by ${reduction} due to recency bias (score: ${bScores.recencyBiasScore.toFixed(0)})`);
    }

    // High risk chasing → reduce
    if (bScores.riskChasingScore > 60) {
        const reduction = parseFloat(((bScores.riskChasingScore - 60) / 40 * 1.5).toFixed(1));
        suggestedTolerance -= reduction;
        adjustmentReasons.push(`Reduced by ${reduction} due to risk chasing behavior (score: ${bScores.riskChasingScore.toFixed(0)})`);
    }

    // Good liquidity (low stress) → allow slightly higher risk
    if (bScores.liquidityStressScore < 30) {
        const increase = parseFloat(((30 - bScores.liquidityStressScore) / 30 * 1).toFixed(1));
        suggestedTolerance += increase;
        adjustmentReasons.push(`Increased by ${increase} due to strong liquidity buffer (stress score: ${bScores.liquidityStressScore.toFixed(0)})`);
    }

    // High adaptive risk score → small boost
    if (bScores.adaptiveRiskScore > 70) {
        const increase = parseFloat(((bScores.adaptiveRiskScore - 70) / 30 * 1).toFixed(1));
        suggestedTolerance += increase;
        adjustmentReasons.push(`Increased by ${increase} due to strong adaptive risk behaviour (score: ${bScores.adaptiveRiskScore.toFixed(0)})`);
    }

    // High volatility regime → reduce further
    if (marketRegime === 'HIGH_VOLATILITY') {
        const reduction = 0.75;
        suggestedTolerance -= reduction;
        adjustmentReasons.push(`Reduced by ${reduction} due to high-volatility market conditions`);
    }

    if (adjustmentReasons.length === 0) {
        adjustmentReasons.push('No significant adjustment needed; your behavioral profile aligns with your current risk tolerance.');
    }

    suggestedTolerance = parseFloat(clamp(suggestedTolerance, 1, 10).toFixed(1));
    const adjustmentDelta = parseFloat((suggestedTolerance - currentRiskTolerance).toFixed(1));

    // --- Confidence level ------------------------------------------------------
    let confidence = 0.4; // base
    if (lastBehavioral) confidence += 0.2;
    if (ltReturns.length >= 60) confidence += 0.2;
    if (transactionCount >= 20) confidence += 0.15;
    if (lastSpending) confidence += 0.05;
    confidence = parseFloat(Math.min(0.95, confidence).toFixed(2));

    return {
        currentRiskTolerance,
        suggestedRiskTolerance: suggestedTolerance,
        adjustmentDelta,
        confidence,
        marketRegime,
        adjustmentReasons,
        behavioralScores: bScores,
    };
}
