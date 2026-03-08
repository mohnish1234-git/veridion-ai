import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../components/ui/GlassCard';
import ScrollReveal from '../components/reactbits/ScrollReveal';
import Diagrams from '../components/charts/Diagrams';
import SkeletonLoader from '../components/ui/SkeletonLoader';
import { useSimulation } from '../hooks/useSimulation';
import { usePortfolio } from '../hooks/usePortfolio';
import { SIMULATION_DEFAULTS } from '../utils/constants';
import { formatCurrency, formatPercent } from '../utils/formatters';

const pageV = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0, transition: { duration: 0.4 } }, exit: { opacity: 0 } };

export default function SimulationLab() {
    const [volMult, setVolMult] = useState(SIMULATION_DEFAULTS.volatilityMultiplier);
    const [crashDepth, setCrashDepth] = useState(SIMULATION_DEFAULTS.crashDepth);
    const [inflation, setInflation] = useState(SIMULATION_DEFAULTS.inflationRate);
    const [rateShock, setRateShock] = useState(SIMULATION_DEFAULTS.interestRateShock);

    const { results, isLoading, error, runSimulation } = useSimulation();
    const { totalValue, holdings } = usePortfolio();

    // ── Debounced API call ────────────────────────────
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const triggerSimulation = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            runSimulation({ volatilityMultiplier: volMult, crashDepth, inflationRate: inflation, interestRateShock: rateShock, holdings });
        }, 500);
    }, [volMult, crashDepth, inflation, rateShock, runSimulation]);

    // Run on mount and when sliders change
    useEffect(() => {
        triggerSimulation();
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [triggerSimulation]);

    // ── Derived display values ────────────────────────
    const portfolioValue = totalValue ?? 0;
    const holdingsCount = holdings.length;
    const largestHolding = holdings.reduce(
        (max, h) => (!max || (h.value ?? 0) > (max.value ?? 0) ? h : max),
        null
    );

    return (
        <motion.div variants={pageV} initial="initial" animate="animate" exit="exit">
            {/* Portfolio Summary */}
            <ScrollReveal>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <GlassCard padding="p-4">
                        <p className="text-caption" style={{ color: 'var(--color-text-muted)' }}>Portfolio Value</p>
                        <p className="text-xl font-bold font-numeric mt-2" style={{ color: 'var(--color-accent-teal)' }}>
                            {formatCurrency(portfolioValue, true)}
                        </p>
                    </GlassCard>
                    <GlassCard padding="p-4">
                        <p className="text-caption" style={{ color: 'var(--color-text-muted)' }}>Number of Assets</p>
                        <p className="text-xl font-bold font-numeric mt-2" style={{ color: 'var(--color-text-primary)' }}>
                            {holdingsCount}
                        </p>
                    </GlassCard>
                    <GlassCard padding="p-4">
                        <p className="text-caption" style={{ color: 'var(--color-text-muted)' }}>Largest Holding</p>
                        <p className="text-xl font-bold font-numeric mt-2" style={{ color: 'var(--color-text-primary)' }}>
                            {largestHolding ? `${largestHolding.ticker} — ${formatCurrency(largestHolding.value, true)}` : '—'}
                        </p>
                    </GlassCard>
                </div>
            </ScrollReveal>

            {/* Stress Test Parameters */}
            <ScrollReveal>
                <GlassCard className="mb-6">
                    <h3 className="text-h3 mb-6">Stress Test Parameters</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { label: 'Volatility Multiplier', value: volMult, set: setVolMult, min: 1, max: 5, step: 0.5, display: `${volMult}x` },
                            { label: 'Market Crash Depth', value: crashDepth, set: setCrashDepth, min: -60, max: -10, step: 5, display: `${crashDepth}%` },
                            { label: 'Inflation Rate', value: inflation, set: setInflation, min: 2, max: 15, step: 1, display: `${inflation}%` },
                            { label: 'Rate Shock', value: rateShock, set: setRateShock, min: 0, max: 5, step: 0.5, display: `+${rateShock}%` },
                        ].map((s) => (
                            <div key={s.label}>
                                <div className="flex justify-between mb-2">
                                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{s.label}</span>
                                    <span className="text-sm font-bold font-numeric" style={{ color: 'var(--color-accent-teal)' }}>{s.display}</span>
                                </div>
                                <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                                    onChange={(e) => s.set(Number(e.target.value))}
                                    className="w-full accent-[var(--color-accent-teal)]"
                                />
                            </div>
                        ))}
                    </div>
                </GlassCard>
            </ScrollReveal>

            {/* Loading / Error states */}
            {isLoading && !results && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <GlassCard key={i} padding="p-4"><SkeletonLoader height={48} /></GlassCard>
                    ))}
                </div>
            )}

            {error && (
                <GlassCard className="mb-6" padding="p-4">
                    <p className="text-sm" style={{ color: 'var(--color-danger)' }}>⚠ {error}</p>
                </GlassCard>
            )}

            {/* Key Metrics */}
            {results && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        {[
                            { label: 'Prob. of Loss', value: `${(results.probLoss * 100).toFixed(1)}%`, color: 'var(--color-danger)' },
                            { label: 'Expected Drawdown', value: `${results.expectedDrawdown.toFixed(1)}%`, color: 'var(--color-warning)' },
                            { label: 'Median Outcome', value: formatCurrency(results.median, true), color: 'var(--color-success)' },
                            { label: 'Mean Outcome', value: formatCurrency(results.mean, true), color: 'var(--color-accent-teal)' },
                        ].map((m) => (
                            <GlassCard key={m.label} padding="p-4">
                                <p className="text-caption" style={{ color: 'var(--color-text-muted)' }}>{m.label}</p>
                                <p className="text-xl font-bold font-numeric mt-2" style={{ color: m.color }}>{m.value}</p>
                            </GlassCard>
                        ))}
                    </div>

                    {/* Probability Cone */}
                    <ScrollReveal>
                        <GlassCard className="mb-6">
                            <h3 className="text-h3 mb-4">Probability Cone (10yr projection)</h3>
                            {isLoading && <div className="absolute inset-0 bg-black/10 rounded-xl z-10 flex items-center justify-center"><span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Recalculating…</span></div>}
                            <Diagrams data={results.coneData} type="area" dataKeys={['p10', 'p25', 'p50', 'p75', 'p90']} xKey="period" height={400} showLegend
                                colors={['rgba(239,68,68,0.3)', 'rgba(245,158,11,0.4)', '#00D4AA', 'rgba(245,158,11,0.4)', 'rgba(239,68,68,0.3)']}
                            />
                        </GlassCard>
                    </ScrollReveal>


                </>
            )}
        </motion.div>
    );
}
