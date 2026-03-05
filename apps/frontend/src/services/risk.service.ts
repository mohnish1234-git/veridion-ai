import api from './api';
import type { RiskMetrics, RiskContribution, FrontierPoint, CovarianceData } from '../types';

export const riskService = {
    getMetrics: async (): Promise<RiskMetrics> => {
      
        try {
            const { data } = await api.get<any>('/risk/metrics');
            return {
                volatility: data.volatility ?? 0,
                sharpeRatio: data.sharpeRatio ?? 0,
                sortinoRatio: data.sortinoRatio ?? 0,
                maxDrawdown: data.maxDrawdown ?? 0,
                var95: data.var95 ?? 0,
                cvar95: data.cvar95 ?? 0,
                beta: data.beta ?? 1,
                trackingError: data.trackingError ?? 0,
                date: data.date ?? new Date().toISOString(),
            };
        } catch (err) {
            console.error("Risk metrics API failed:", err);
            throw err;
         }
    },

    getHistory: async (): Promise<RiskMetrics[]> => {
    
        const { data } = await api.get<any[]>('/risk/history');
        return (data ?? []).map((d: any) => ({
            volatility: d.volatility ?? 0,
            sharpeRatio: d.sharpeRatio ?? 0,
            sortinoRatio: d.sortinoRatio ?? 0,
            maxDrawdown: d.maxDrawdown ?? 0,
            var95: d.var95 ?? 0,
            cvar95: d.cvar95 ?? 0,
            beta: d.beta ?? 1,
            trackingError: d.trackingError ?? 0,
            date: d.date ?? '',
        }));
},

    getContributions: async (): Promise<RiskContribution[]> => {
        
        const { data } = await api.get<RiskContribution[]>('/risk/contributions');
        return data;
    },

    getFrontier: async (): Promise<FrontierPoint[]> => {
        
        const { data } = await api.get<FrontierPoint[]>('/risk/frontier');
        return data;
    },

    getCovariance: async (): Promise<CovarianceData> => {
        
        const { data } = await api.get<CovarianceData>('/risk/covariance');
        return data;
    },
};
