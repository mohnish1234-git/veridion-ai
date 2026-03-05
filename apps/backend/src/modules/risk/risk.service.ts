import { prisma } from '../../infrastructure/prisma/client';
import {
    getRiskContributionsForUser,
    getCovarianceForUser,
    getEfficientFrontierForUser,
} from './risk.engine';

function d(val: any): number {
    if (val == null) return 0;
    if (typeof val === 'number') return val;
    return val.toNumber ? val.toNumber() : Number(val);
}

export const riskService = {
    async getLatestMetrics(userId: number) {
        const metrics = await prisma.riskMetricsHistory.findFirst({
            where: { userId },
            orderBy: { calculatedAt: 'desc' },
        });

        if (!metrics) {
            return {
                volatility: 0, sharpeRatio: 0, sortinoRatio: 0,
                maxDrawdown: 0, var95: 0, cvar95: 0, beta: 1, trackingError: 0,
                date: new Date().toISOString(),
            };
        }

        return {
            volatility: d(metrics.volatility),
            sharpeRatio: d(metrics.sharpeRatio),
            sortinoRatio: d(metrics.sortinoRatio),
            maxDrawdown: d(metrics.maxDrawdown),
            var95: d(metrics.var95),
            cvar95: d(metrics.var95), // schema has no cvar95 column, fallback to var95
            beta: 1,                  // not in schema
            trackingError: 0,         // not in schema
            date: metrics.calculatedAt.toISOString(),
        };
    },

    async getMetricsHistory(userId: number) {
        const history = await prisma.riskMetricsHistory.findMany({
            where: { userId },
            orderBy: { calculatedAt: 'asc' },
            take: 90,
        });

        return history.map(m => ({
            volatility: d(m.volatility),
            sharpeRatio: d(m.sharpeRatio),
            sortinoRatio: d(m.sortinoRatio),
            maxDrawdown: d(m.maxDrawdown),
            var95: d(m.var95),
            cvar95: d(m.var95),
            beta: 1,
            trackingError: 0,
            date: m.calculatedAt.toISOString(),
        }));
    },

    /**
     * Real risk contributions computed from historical asset returns
     * and the covariance matrix. Each asset's contribution sums to ~1.
     */
    async getRiskContributions(userId: number) {
        return getRiskContributionsForUser(userId);
    },

    /**
     * Real efficient frontier via Markowitz mean-variance optimisation.
     * Returns ~20 portfolios with increasing expected return targets.
     */
    async getEfficientFrontier(userId: number) {
        return getEfficientFrontierForUser(userId);
    },

    /**
     * Real covariance matrix computed from historical asset returns.
     */
    async getCovariance(userId: number) {
        return getCovarianceForUser(userId);
    },
};
