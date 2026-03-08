import api from './api';
import { isDemoMode, sleep } from '../utils';
import { demoMonteCarloResults } from '../utils/demoData';
import type { MonteCarloResult, StressTestResult } from '../types';

export interface StressTestParams {
    volatilityMultiplier: number;
    crashDepth: number;
    inflationRate: number;
    interestRateShock: number;
    numPaths?: number;
    holdings: any[];
}

export const montecarloService = {
    simulate: async (goalId: number, params?: { drift?: number; volatility?: number }): Promise<MonteCarloResult> => {
        if (isDemoMode()) {
            await sleep(800);
            const result = demoMonteCarloResults.find(r => r.goalId === goalId);
            return result || demoMonteCarloResults[0];
        }
        const { data } = await api.post<MonteCarloResult>('/montecarlo/simulate', { goalId, ...params });
        return data;
    },
    getResults: async (goalId: number): Promise<MonteCarloResult> => {
        if (isDemoMode()) {
            await sleep(300);
            const result = demoMonteCarloResults.find(r => r.goalId === goalId);
            return result || demoMonteCarloResults[0];
        }
        const { data } = await api.get<MonteCarloResult>(`/montecarlo/results/${goalId}`);
        return data;
    },
    runStressTest: async (params: StressTestParams): Promise<StressTestResult> => {
        if (isDemoMode()) {
            await sleep(600);
            // Generate demo fallback locally
            const initialValue = 250000;
            const steps = 120;
            const mu = 0.08; const sigma = 0.15 * params.volatilityMultiplier;
            const dt = 1 / 12;
            const paths: number[][] = [];
            const terminalValues: number[] = [];
            for (let p = 0; p < 200; p++) {
                const path = [initialValue]; let val = initialValue;
                for (let t = 1; t <= steps; t++) {
                    let u = 0, v = 0;
                    while (u === 0) u = Math.random();
                    while (v === 0) v = Math.random();
                    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
                    const ret = (mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z;
                    val *= Math.exp(ret); path.push(Math.round(val));
                }
                paths.push(path); terminalValues.push(Math.round(val));
            }
            terminalValues.sort((a, b) => a - b);
            const pAt = (pct: number) => terminalValues[Math.floor(pct / 100 * (terminalValues.length - 1))];
            const coneData = Array.from({ length: steps + 1 }, (_, i) => {
                const vals = paths.map(p => p[i]).sort((a, b) => a - b);
                const cAt = (pct: number) => vals[Math.floor(pct / 100 * (vals.length - 1))];
                return { period: i, p10: cAt(10), p25: cAt(25), p50: cAt(50), p75: cAt(75), p90: cAt(90) };
            });
            return {
                initialValue, coneData, terminalValues,
                probLoss: terminalValues.filter(v => v < initialValue).length / terminalValues.length,
                median: pAt(50), mean: Math.round(terminalValues.reduce((s, v) => s + v, 0) / terminalValues.length),
                expectedDrawdown: Math.abs(params.crashDepth) * 0.6,
                holdingsCount: 6, largestHolding: { ticker: 'VTI', value: 87500 },
            };
        }
        const { data } = await api.post<StressTestResult>('/montecarlo/run', params);
        return data;
    },
};
