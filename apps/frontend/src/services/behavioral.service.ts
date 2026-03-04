import api from './api';
import { isDemoMode, sleep } from '../utils';
import { demoBehavioralScore, demoSpendingMetrics, demoBehavioralHistory } from '../utils/demoData';
import type { BehavioralScore, SpendingMetrics } from '../types';

// ── Raw response types from backend ─────────────────────────────────────────
export interface BiasScores {
    adaptiveRiskScore: number;
    panicSellScore: number;
    recencyBiasScore: number;
    riskChasingScore: number;
    liquidityStressScore: number;
    lossAversionRatio: number | null;
    featureSnapshot: Record<string, number>;
    insights: string[];
    updatedAt: string;
    fromCache?: boolean;
}

export interface SpendingAnalysis {
    monthlyBurnRate: number;
    savingsRate: number;
    expenseVolatility: number;
    categoryBreakdown: { category: string; amount: number; percentage: number }[];
    monthlyTrend: { month: string; income: number; expenses: number; savings: number }[];
    anomalies: { month: string; amount: number; deviation: number }[];
    calculatedAt: string;
}

export interface AdaptiveRiskData {
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

export interface ScoreHistoryItem {
    adaptiveRiskScore: number;
    panicSellScore: number;
    recencyBiasScore: number;
    riskChasingScore: number;
    liquidityStressScore: number;
    updatedAt: string;
}

export interface TransactionInput {
    amount: number;
    category?: string;
    transactionType: 'income' | 'expense' | 'investment' | 'withdrawal';
    description?: string;
    transactionDate: string; // YYYY-MM-DD
}

export const behavioralService = {
    // ── New endpoints ────────────────────────────────────────────────────────
    getScores: async (): Promise<BiasScores> => {
        const { data } = await api.get<BiasScores>('/behavioral/scores');
        return data;
    },

    getSpending: async (months = 6): Promise<SpendingAnalysis> => {
        const { data } = await api.get<SpendingAnalysis>(`/behavioral/spending?months=${months}`);
        return data;
    },

    refreshScores: async (): Promise<BiasScores> => {
        const { data } = await api.post<BiasScores>('/behavioral/scores/refresh');
        return data;
    },

    getAdaptiveRisk: async (): Promise<AdaptiveRiskData> => {
        const { data } = await api.get<AdaptiveRiskData>('/behavioral/adaptive-risk');
        return data;
    },

    getHistory: async (limit = 10): Promise<ScoreHistoryItem[]> => {
        const { data } = await api.get<ScoreHistoryItem[]>(`/behavioral/history?limit=${limit}`);
        return data;
    },

    addTransaction: async (input: TransactionInput) => {
        const { data } = await api.post('/behavioral/transactions', input);
        return data;
    },

    bulkAddTransactions: async (transactions: TransactionInput[]) => {
        const { data } = await api.post('/behavioral/transactions/bulk', { transactions });
        return data;
    },

    // ── Legacy (kept for backward compat) ────────────────────────────────────
    getScore: async (): Promise<BehavioralScore> => {
        const { data } = await api.get<any>('/behavioral/score');
        return {
            adaptiveRiskScore: data.adaptiveRiskScore ?? 50,
            panicSellingIndex: (data.panicSellScore ?? 50) / 100,
            recencyBias: (data.recencyBiasScore ?? 50) / 100,
            riskChasing: (data.riskChasingScore ?? 50) / 100,
            liquidityStress: (data.liquidityStressScore ?? 50) / 100,
            date: data.updatedAt ?? new Date().toISOString(),
        };
    },
};
