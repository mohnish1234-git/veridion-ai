// ============================================================
// VERIDION AI — Pure Risk Calculation Functions
// ============================================================
// No database access — pure math only.  Every function takes
// plain arrays / numbers and returns plain values.
// ============================================================

// ── Helpers ──────────────────────────────────────────────────

/** Arithmetic mean of an array. */
export function mean(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/** Population standard deviation. */
export function std(arr: number[]): number {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
    return Math.sqrt(variance);
}

/** Return the value at a given percentile (0–100) using linear interpolation. */
export function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ── Core Calculations ────────────────────────────────────────

/**
 * Daily simple returns from a price series (oldest → newest).
 * R_t = (P_t − P_{t−1}) / P_{t−1}
 */
export function computeDailyReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
        if (prices[i - 1] === 0) {
            returns.push(0);
        } else {
            returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
        }
    }
    return returns;
}

/**
 * Portfolio weights from current holdings values.
 * w_i = value_i / Σ values
 */
export function computePortfolioWeights(values: number[]): number[] {
    const total = values.reduce((s, v) => s + v, 0);
    if (total === 0) return values.map(() => 0);
    return values.map((v) => v / total);
}

/**
 * Portfolio daily returns as weighted sum of per-asset returns.
 * Each row of `assetReturns` is a single asset's daily return series.
 * All series must have the same length.
 */
export function computePortfolioReturns(
    assetReturns: number[][],
    weights: number[],
): number[] {
    if (assetReturns.length === 0) return [];
    const nDays = assetReturns[0].length;
    const result: number[] = new Array(nDays).fill(0);
    for (let a = 0; a < assetReturns.length; a++) {
        for (let d = 0; d < nDays; d++) {
            result[d] += weights[a] * (assetReturns[a][d] ?? 0);
        }
    }
    return result;
}

/**
 * Annualized volatility.
 * σ_annual = std(dailyReturns) × √252
 */
export function annualizedVolatility(returns: number[]): number {
    return std(returns) * Math.sqrt(252);
}

/**
 * Sharpe ratio.
 * S = (mean(r)×252 − r_f) / σ_annual
 */
export function sharpeRatio(returns: number[], rfRate = 0.02): number {
    const vol = annualizedVolatility(returns);
    if (vol === 0) return 0;
    const annualReturn = mean(returns) * 252;
    return (annualReturn - rfRate) / vol;
}

/**
 * Sortino ratio — uses downside deviation only.
 * Downside deviation considers only returns below the target (daily risk-free).
 */
export function sortinoRatio(returns: number[], rfRate = 0.02): number {
    const dailyTarget = rfRate / 252;
    const downsideReturns = returns.filter((r) => r < dailyTarget);
    if (downsideReturns.length === 0) return 0;

    const downsideVariance =
        downsideReturns.reduce((s, r) => s + (r - dailyTarget) ** 2, 0) /
        returns.length; // denominator is full n for semi-deviation
    const downsideDev = Math.sqrt(downsideVariance) * Math.sqrt(252);

    if (downsideDev === 0) return 0;
    const annualReturn = mean(returns) * 252;
    return (annualReturn - rfRate) / downsideDev;
}

/**
 * Maximum drawdown from a daily returns series.
 * Computed on cumulative wealth (1 + r_1)(1 + r_2)…
 */
export function maxDrawdown(returns: number[]): number {
    if (returns.length === 0) return 0;

    let peak = 1;
    let cumulative = 1;
    let mdd = 0;

    for (const r of returns) {
        cumulative *= 1 + r;
        if (cumulative > peak) peak = cumulative;
        const dd = (peak - cumulative) / peak;
        if (dd > mdd) mdd = dd;
    }
    return mdd;
}

/**
 * Value at Risk (95 %) — the 5th percentile of daily returns.
 * Returns a negative number representing the worst expected daily loss.
 */
export function valueAtRisk95(returns: number[]): number {
    if (returns.length === 0) return 0;
    const sorted = [...returns].sort((a, b) => a - b);
    return percentile(sorted, 5);
}

/**
 * Conditional VaR (CVaR / Expected Shortfall 95 %).
 * Average of returns that are ≤ VaR.
 */
export function conditionalVaR95(returns: number[]): number {
    if (returns.length === 0) return 0;
    const var95 = valueAtRisk95(returns);
    const tail = returns.filter((r) => r <= var95);
    return tail.length > 0 ? mean(tail) : var95;
}

// ── Matrix Operations ────────────────────────────────────────

/**
 * Covariance matrix of asset returns.
 * `assetReturns[i]` is the return series of asset i (all same length).
 */
export function covarianceMatrix(assetReturns: number[][]): number[][] {
    const n = assetReturns.length;
    if (n === 0) return [];
    const nDays = assetReturns[0].length;
    if (nDays < 2) return Array.from({ length: n }, () => new Array(n).fill(0));

    const means = assetReturns.map((r) => mean(r));
    const cov: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let i = 0; i < n; i++) {
        for (let j = i; j < n; j++) {
            let s = 0;
            for (let d = 0; d < nDays; d++) {
                s += (assetReturns[i][d] - means[i]) * (assetReturns[j][d] - means[j]);
            }
            const val = s / nDays;
            cov[i][j] = val;
            cov[j][i] = val;
        }
    }
    return cov;
}

/**
 * Risk contribution per asset.
 * RC_i = w_i × (Σw)_i / (wᵀΣw)
 * Returns array of fractional contributions that sum to ~1.
 */
export function riskContributions(
    weights: number[],
    covMatrix: number[][],
): number[] {
    const n = weights.length;
    if (n === 0) return [];

    // Σw  (matrix × vector)
    const sigmaW: number[] = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            sigmaW[i] += covMatrix[i][j] * weights[j];
        }
    }

    // wᵀΣw  (scalar — portfolio variance)
    let portVar = 0;
    for (let i = 0; i < n; i++) {
        portVar += weights[i] * sigmaW[i];
    }
    if (portVar === 0) return weights.map(() => 0);

    // RC_i = w_i * (Σw)_i / portVar
    return weights.map((w, i) => (w * sigmaW[i]) / portVar);
}

// ── Efficient Frontier (Markowitz) ───────────────────────────

interface FrontierPoint {
    volatility: number;
    expectedReturn: number;
    isOptimal: boolean;
    isCurrent: boolean;
    weights?: Record<string, number>;
}

/**
 * Efficient frontier via constrained random-weight optimisation.
 *
 * For each target return level we generate many random portfolios
 * (weights ≥ 0, sum = 1) and keep the one with minimum volatility
 * whose expected return meets or exceeds the target.
 *
 * This is intentionally a simple numerical approach that avoids
 * external optimisation libraries while still producing a reasonable
 * frontier for moderate numbers of assets.
 */
export function efficientFrontier(
    meanReturns: number[],
    covMatrix: number[][],
    tickers: string[],
    currentWeights: number[],
    numPortfolios = 20,
    samplesPerTarget = 3000,
): FrontierPoint[] {
    const n = meanReturns.length;
    if (n === 0) return [];

    // Annualised expected returns per asset
    const annualReturns = meanReturns.map((r) => r * 252);

    // Range of target returns
    const minRet = Math.min(...annualReturns);
    const maxRet = Math.max(...annualReturns);
    const retStep = (maxRet - minRet) / (numPortfolios - 1 || 1);

    // Helper: portfolio volatility from weights + covariance
    const portVol = (w: number[]): number => {
        let v = 0;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                v += w[i] * w[j] * covMatrix[i][j];
            }
        }
        return Math.sqrt(Math.max(v, 0) * 252);
    };

    // Helper: portfolio annualised return from weights
    const portRet = (w: number[]): number =>
        w.reduce((s, wi, i) => s + wi * annualReturns[i], 0);

    // Generate random Dirichlet-distributed weights (uniform on simplex)
    const randomWeights = (): number[] => {
        const raw = Array.from({ length: n }, () => -Math.log(Math.random() + 1e-12));
        const total = raw.reduce((s, v) => s + v, 0);
        return raw.map((v) => v / total);
    };

    const frontierPoints: FrontierPoint[] = [];

    for (let p = 0; p < numPortfolios; p++) {
        const target = minRet + p * retStep;
        let bestVol = Infinity;
        let bestW: number[] | null = null;
        let bestRet = 0;

        for (let s = 0; s < samplesPerTarget; s++) {
            const w = randomWeights();
            const r = portRet(w);
            if (r >= target) {
                const v = portVol(w);
                if (v < bestVol) {
                    bestVol = v;
                    bestW = w;
                    bestRet = r;
                }
            }
        }

        if (bestW) {
            const wMap: Record<string, number> = {};
            tickers.forEach((t, i) => {
                wMap[t] = Number(bestW![i].toFixed(4));
            });
            frontierPoints.push({
                volatility: Number(bestVol.toFixed(4)),
                expectedReturn: Number(bestRet.toFixed(4)),
                isOptimal: false,
                isCurrent: false,
                weights: wMap,
            });
        }
    }

    // Sort by volatility
    frontierPoints.sort((a, b) => a.volatility - b.volatility);

    // Mark the portfolio with the highest Sharpe ratio as optimal
    let bestSharpeIdx = 0;
    let bestSharpe = -Infinity;
    for (let i = 0; i < frontierPoints.length; i++) {
        const s =
            frontierPoints[i].volatility > 0
                ? (frontierPoints[i].expectedReturn - 0.02) / frontierPoints[i].volatility
                : 0;
        if (s > bestSharpe) {
            bestSharpe = s;
            bestSharpeIdx = i;
        }
    }
    if (frontierPoints.length > 0) {
        frontierPoints[bestSharpeIdx].isOptimal = true;
    }

    // Find the point closest to the user's current portfolio
    if (currentWeights.length === n) {
        const curVol = portVol(currentWeights);
        const curRet = portRet(currentWeights);
        let closestIdx = 0;
        let closestDist = Infinity;
        for (let i = 0; i < frontierPoints.length; i++) {
            const dist =
                (frontierPoints[i].volatility - curVol) ** 2 +
                (frontierPoints[i].expectedReturn - curRet) ** 2;
            if (dist < closestDist) {
                closestDist = dist;
                closestIdx = i;
            }
        }
        if (frontierPoints.length > 0) {
            frontierPoints[closestIdx].isCurrent = true;
        }
    }

    return frontierPoints;
}
