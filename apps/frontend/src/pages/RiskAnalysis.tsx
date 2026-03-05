import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
    Tooltip as ReTooltip, Cell, AreaChart, Area, PieChart, Pie, BarChart, Bar,
    Legend,
} from 'recharts';
import { Shield, TrendingDown, Activity, Target, AlertTriangle, BarChart3, Zap } from 'lucide-react';
import GlassCard from '../components/ui/GlassCard';
import ScrollReveal from '../components/reactbits/ScrollReveal';
import SkeletonLoader from '../components/ui/SkeletonLoader';
import Tooltip from '../components/ui/Tooltip';
import { useRiskMetrics } from '../hooks/useRiskMetrics';
import { formatPercent } from '../utils/formatters';
import { chartColors } from '../utils/colors';
import { GLOSSARY } from '../utils/constants';

// ── Animations ───────────────────────────────────────────────
const pageV = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0, transition: { duration: 0.4 } }, exit: { opacity: 0 } };

// ── Helpers ──────────────────────────────────────────────────
const ASSET_COLORS = ['#00C896', '#5B8AF0', '#C9A84C', '#A855F7', '#E5484D', '#EC4899', '#14B8A6', '#6366F1', '#D4922B', '#1DB876'];

function metricColor(label: string, value: number): string {
    if (label === 'Sharpe Ratio' || label === 'Sortino Ratio') return value >= 1 ? '#00C896' : value >= 0.5 ? '#C9A84C' : '#E5484D';
    if (label === 'Volatility') return value < 0.15 ? '#00C896' : value < 0.25 ? '#C9A84C' : '#E5484D';
    if (label === 'Max Drawdown') return value < 0.10 ? '#00C896' : value < 0.25 ? '#C9A84C' : '#E5484D';
    return '#5B8AF0';
}

// ── Custom Tooltips ──────────────────────────────────────────
const GlassTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    return (
        <div style={{ background: 'rgba(15,20,30,0.92)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 14px', backdropFilter: 'blur(12px)' }}>
            {label && <p style={{ color: '#fff', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{label}</p>}
            {payload.map((e: any, i: number) => (
                <p key={i} style={{ color: e.color || '#aaa', fontSize: 11 }} className="font-numeric">
                    {e.name}: {typeof e.value === 'number' ? e.value.toLocaleString(undefined, { maximumFractionDigits: 4 }) : e.value}
                </p>
            ))}
        </div>
    );
};

const FrontierTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    return (
        <div style={{ background: 'rgba(15,20,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 16px', backdropFilter: 'blur(16px)', maxWidth: 260 }}>
            <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                {d.label === 'Optimal' ? '⭐ Max Sharpe Portfolio' : d.label === 'Current' ? '📍 Your Portfolio' : 'Frontier Portfolio'}
            </p>
            <p style={{ color: '#00C896', fontSize: 11 }} className="font-numeric">Return: {d.y.toFixed(2)}%</p>
            <p style={{ color: '#5B8AF0', fontSize: 11 }} className="font-numeric">Volatility: {d.x.toFixed(2)}%</p>
            {d.weights && Object.keys(d.weights).length > 0 && (
                <div style={{ marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
                    <p style={{ color: '#888', fontSize: 10, marginBottom: 3 }}>Weights:</p>
                    {Object.entries(d.weights).map(([t, w]: any) => (
                        <p key={t} style={{ color: '#ccc', fontSize: 10 }} className="font-numeric">{t}: {(w * 100).toFixed(1)}%</p>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Scenario Definitions ─────────────────────────────────────
const SCENARIOS = [
    { id: 'crash', label: 'Market Crash', icon: '📉', drop: -0.20, desc: 'Broad market decline of 20%', sectors: {} as Record<string, number> },
    { id: 'tech', label: 'Tech Selloff', icon: '💻', drop: -0.15, desc: 'Technology sector drops 15%', sectors: { Technology: -0.25 } },
    { id: 'crypto', label: 'Crypto Winter', icon: '🧊', drop: -0.40, desc: 'Crypto assets drop 40%', sectors: { Crypto: -0.40 } },
    { id: 'mild', label: 'Mild Correction', icon: '📊', drop: -0.10, desc: 'Orderly correction of 10%', sectors: {} as Record<string, number> },
];

// ═════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════

export default function RiskAnalysis() {
    const { metrics, history, contributions, frontier, covariance, isLoading } = useRiskMetrics();
    const [rollingTab, setRollingTab] = useState<'volatility' | 'sharpe' | 'drawdown'>('volatility');
    const [activeScenario, setActiveScenario] = useState<string | null>(null);

    // ── Derived Data ─────────────────────────────────────────

    // Allocation donut data
    const allocationData = useMemo(() =>
        contributions.map((c) => ({
            name: c.ticker,
            value: Math.round(c.weight * 10000) / 100,
        })).sort((a, b) => b.value - a.value)
        , [contributions]);

    // Risk contribution sorted horizontal bars
    const contribData = useMemo(() =>
        contributions.map((c) => ({
            name: c.ticker,
            fullName: c.name,
            contribution: Math.round(c.contribution * 10000) / 100,
            weight: Math.round(c.weight * 10000) / 100,
        })).sort((a, b) => b.contribution - a.contribution)
        , [contributions]);

    // Efficient frontier scatter data
    const frontierData = useMemo(() =>
        frontier.map((f) => ({
            x: +(f.volatility * 100).toFixed(2),
            y: +(f.expectedReturn * 100).toFixed(2),
            label: f.isOptimal ? 'Optimal' : f.isCurrent ? 'Current' : '',
            weights: f.weights ?? {},
            size: f.isOptimal ? 180 : f.isCurrent ? 160 : 60,
        }))
        , [frontier]);

    // Correlation matrix from covariance
    const correlationMatrix = useMemo(() => {
        if (!covariance || covariance.matrix.length === 0) return null;
        const { tickers, matrix } = covariance;
        const n = tickers.length;
        const stds = matrix.map((_, i) => Math.sqrt(Math.max(matrix[i][i], 0)));
        const corr: number[][] = Array.from({ length: n }, (_, i) =>
            Array.from({ length: n }, (_, j) => {
                if (stds[i] === 0 || stds[j] === 0) return 0;
                return matrix[i][j] / (stds[i] * stds[j]);
            })
        );
        return { tickers, corr };
    }, [covariance]);

    // Rolling metrics from history
    const rollingData = useMemo(() =>
        history.map((h) => ({
            date: new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            volatility: +(h.volatility * 100).toFixed(2),
            sharpe: +h.sharpeRatio.toFixed(2),
            drawdown: +(Math.abs(h.maxDrawdown) * 100).toFixed(2),
        }))
        , [history]);

    // Scenario impact computation
    const scenarioResult = useMemo(() => {
        if (!activeScenario || !metrics || contributions.length === 0) return null;
        const scenario = SCENARIOS.find((s) => s.id === activeScenario);
        if (!scenario) return null;

        let portfolioDrop = 0;
        for (const c of contributions) {
            // Check if this asset has a sector-specific shock
            const sectorDrop = Object.entries(scenario.sectors).find(([sector]) =>
                c.name.toLowerCase().includes(sector.toLowerCase()) || c.ticker.toLowerCase().includes(sector.toLowerCase())
            );
            const assetDrop = sectorDrop ? sectorDrop[1] : scenario.drop;
            portfolioDrop += c.weight * assetDrop;
        }

        return {
            estimatedLoss: portfolioDrop,
            newVolatility: metrics.volatility * (1 + Math.abs(scenario.drop) * 1.5),
            newDrawdown: Math.abs(metrics.maxDrawdown) + Math.abs(portfolioDrop) * 0.6,
            newVaR: metrics.var95 * (1 + Math.abs(scenario.drop)),
        };
    }, [activeScenario, metrics, contributions]);

    // ── Metric Cards Config ──────────────────────────────────
    const metricCards = metrics ? [
        { label: 'Volatility', value: metrics.volatility, display: formatPercent(metrics.volatility), icon: Activity, tip: GLOSSARY['Volatility'] },
        { label: 'Sharpe Ratio', value: metrics.sharpeRatio, display: metrics.sharpeRatio.toFixed(2), icon: TrendingDown, tip: GLOSSARY['Sharpe Ratio'] },
        { label: 'Sortino Ratio', value: metrics.sortinoRatio, display: metrics.sortinoRatio.toFixed(2), icon: Shield, tip: GLOSSARY['Sortino Ratio'] },
        { label: 'Max Drawdown', value: Math.abs(metrics.maxDrawdown), display: formatPercent(Math.abs(metrics.maxDrawdown)), icon: AlertTriangle, tip: GLOSSARY['Max Drawdown'] },
        { label: 'VaR (95%)', value: Math.abs(metrics.var95), display: formatPercent(Math.abs(metrics.var95)), icon: Target, tip: GLOSSARY['VaR (95%)'] },
        { label: 'CVaR (95%)', value: Math.abs(metrics.cvar95), display: formatPercent(Math.abs(metrics.cvar95)), icon: BarChart3, tip: GLOSSARY['CVaR'] },
    ] : [];

    return (
        <motion.div variants={pageV} initial="initial" animate="animate" exit="exit" className="space-y-6">

            {/* ═══ Page Header ═══ */}
            <div className="flex items-center gap-3 mb-2">
                <div style={{ background: 'linear-gradient(135deg, #5B8AF0, #00C896)', borderRadius: 12, padding: 10, display: 'flex' }}>
                    <Shield size={22} color="#fff" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Risk Analysis</h1>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Quantitative portfolio risk metrics &amp; analytics</p>
                </div>
            </div>

            {/* ═══ SECTION 1 — Key Risk Metrics ═══ */}
            <ScrollReveal>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {metricCards.length > 0 ? metricCards.map((m) => {
                        const color = metricColor(m.label, m.value);
                        const Icon = m.icon;
                        return (
                            <GlassCard key={m.label} padding="p-4" className="relative overflow-hidden">
                                {/* Background glow */}
                                <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: color, opacity: 0.06, filter: 'blur(20px)' }} />
                                <div className="flex items-center gap-2 mb-2">
                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Icon size={14} color={color} />
                                    </div>
                                    <Tooltip content={m.tip}>
                                        <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>{m.label}</p>
                                    </Tooltip>
                                </div>
                                <p className="text-xl font-bold font-numeric" style={{ color }}>{m.display}</p>
                            </GlassCard>
                        );
                    }) : <SkeletonLoader count={6} height="h-20" />}
                </div>
            </ScrollReveal>

            {/* ═══ SECTION 2 — Portfolio Allocation + Risk Contribution ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Allocation Donut */}
                <ScrollReveal>
                    <GlassCard>
                        <h3 className="text-h3 mb-4 flex items-center gap-2">
                            <span style={{ color: '#C9A84C' }}>◉</span> Portfolio Allocation
                        </h3>
                        {allocationData.length > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <div style={{ width: '55%', minHeight: 260 }}>
                                    <ResponsiveContainer width="100%" height={260}>
                                        <PieChart>
                                            <Pie
                                                data={allocationData}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={100}
                                                innerRadius={60}
                                                paddingAngle={3}
                                                stroke="none"
                                                animationDuration={800}
                                            >
                                                {allocationData.map((_, i) => (
                                                    <Cell key={i} fill={ASSET_COLORS[i % ASSET_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <ReTooltip content={<GlassTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div style={{ width: '45%' }} className="space-y-2">
                                    {allocationData.map((a, i) => (
                                        <div key={a.name} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: ASSET_COLORS[i % ASSET_COLORS.length] }} />
                                                <span style={{ color: 'var(--color-text-secondary)' }}>{a.name}</span>
                                            </div>
                                            <span className="font-numeric font-semibold" style={{ color: 'var(--color-text-primary)' }}>{a.value.toFixed(1)}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : <SkeletonLoader count={4} height="h-6" />}
                    </GlassCard>
                </ScrollReveal>

                {/* Risk Contribution Horizontal Bars */}
                <ScrollReveal delay={0.1}>
                    <GlassCard>
                        <h3 className="text-h3 mb-4 flex items-center gap-2">
                            <span style={{ color: '#E5484D' }}>◉</span> Risk Contribution
                        </h3>
                        {contribData.length > 0 ? (
                            <div className="space-y-3">
                                {contribData.map((c, i) => {
                                    const maxContrib = Math.max(...contribData.map(d => d.contribution));
                                    const widthPct = maxContrib > 0 ? (c.contribution / maxContrib) * 100 : 0;
                                    const color = ASSET_COLORS[contributions.findIndex(x => x.ticker === c.name) % ASSET_COLORS.length] || ASSET_COLORS[i % ASSET_COLORS.length];
                                    return (
                                        <div key={c.name}>
                                            <div className="flex justify-between text-xs mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{c.name}</span>
                                                    <span style={{ color: 'var(--color-text-muted)' }}>w: {c.weight.toFixed(1)}%</span>
                                                </div>
                                                <span className="font-numeric font-bold" style={{ color }}>{c.contribution.toFixed(1)}%</span>
                                            </div>
                                            <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${widthPct}%` }}
                                                    transition={{ duration: 0.8, delay: i * 0.08 }}
                                                    style={{ height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${color}, ${color}99)` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                                <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
                                    Largest risk source: <strong style={{ color: contribData[0] ? '#E5484D' : 'inherit' }}>{contribData[0]?.name}</strong> ({contribData[0]?.contribution.toFixed(1)}%)
                                </p>
                            </div>
                        ) : <SkeletonLoader count={5} height="h-6" />}
                    </GlassCard>
                </ScrollReveal>
            </div>

            {/* ═══ SECTION 3 — Efficient Frontier ═══ */}
            <ScrollReveal>
                <GlassCard>
                    <h3 className="text-h3 mb-1 flex items-center gap-2">
                        <Tooltip content={GLOSSARY['Efficient Frontier']}>
                            <span className="flex items-center gap-2"><span style={{ color: '#5B8AF0' }}>◉</span> Efficient Frontier</span>
                        </Tooltip>
                    </h3>
                    <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>Markowitz mean-variance optimized portfolios</p>
                    {frontierData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={360}>
                            <ScatterChart margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
                                <defs>
                                    <radialGradient id="optimalGlow" cx="50%" cy="50%" r="50%">
                                        <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.6} />
                                        <stop offset="100%" stopColor="#C9A84C" stopOpacity={0} />
                                    </radialGradient>
                                    <radialGradient id="currentGlow" cx="50%" cy="50%" r="50%">
                                        <stop offset="0%" stopColor="#00C896" stopOpacity={0.6} />
                                        <stop offset="100%" stopColor="#00C896" stopOpacity={0} />
                                    </radialGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                <XAxis
                                    dataKey="x" type="number" name="Volatility"
                                    tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                                    axisLine={false} tickLine={false}
                                    label={{ value: 'Volatility (%)', position: 'bottom', offset: 0, style: { fontSize: 11, fill: 'var(--color-text-muted)' } }}
                                />
                                <YAxis
                                    dataKey="y" type="number" name="Expected Return"
                                    tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                                    axisLine={false} tickLine={false}
                                    label={{ value: 'Return (%)', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: 'var(--color-text-muted)' } }}
                                />
                                <ReTooltip content={<FrontierTooltip />} />
                                <Scatter data={frontierData} animationDuration={800}>
                                    {frontierData.map((entry, i) => (
                                        <Cell
                                            key={i}
                                            fill={entry.label === 'Optimal' ? '#C9A84C' : entry.label === 'Current' ? '#00C896' : '#5B8AF0'}
                                            stroke={entry.label ? '#fff' : 'none'}
                                            strokeWidth={entry.label ? 2 : 0}
                                            r={entry.label === 'Optimal' ? 9 : entry.label === 'Current' ? 8 : 4}
                                        />
                                    ))}
                                </Scatter>
                            </ScatterChart>
                        </ResponsiveContainer>
                    ) : <SkeletonLoader count={4} height="h-6" />}
                    {frontierData.length > 0 && (
                        <div className="flex items-center gap-6 mt-3 justify-center text-xs">
                            <span className="flex items-center gap-2"><span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#5B8AF0', display: 'inline-block' }} />Frontier</span>
                            <span className="flex items-center gap-2"><span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#C9A84C', border: '2px solid #fff', display: 'inline-block' }} />Max Sharpe</span>
                            <span className="flex items-center gap-2"><span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#00C896', border: '2px solid #fff', display: 'inline-block' }} />Your Portfolio</span>
                        </div>
                    )}
                </GlassCard>
            </ScrollReveal>

            {/* ═══ SECTION 4 — Correlation Heatmap ═══ */}
            <ScrollReveal>
                <GlassCard>
                    <h3 className="text-h3 mb-1 flex items-center gap-2">
                        <Tooltip content={GLOSSARY['Covariance Matrix']}>
                            <span className="flex items-center gap-2"><span style={{ color: '#A855F7' }}>◉</span> Correlation Heatmap</span>
                        </Tooltip>
                    </h3>
                    <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>Asset return correlations — identify diversification opportunities</p>
                    {correlationMatrix ? (
                        <div className="overflow-x-auto">
                            <div style={{ display: 'inline-block', minWidth: '100%' }}>
                                {/* Header row */}
                                <div style={{ display: 'flex', paddingLeft: 64 }}>
                                    {correlationMatrix.tickers.map((t) => (
                                        <div key={t} style={{ width: 64, textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', padding: '4px 0' }}>{t}</div>
                                    ))}
                                </div>
                                {/* Matrix rows */}
                                {correlationMatrix.tickers.map((rowTicker, i) => (
                                    <div key={rowTicker} style={{ display: 'flex', alignItems: 'center' }}>
                                        <div style={{ width: 64, fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right', paddingRight: 8 }}>{rowTicker}</div>
                                        {correlationMatrix.corr[i].map((val, j) => {
                                            const clamped = Math.max(-1, Math.min(1, val));
                                            const isPositive = clamped >= 0;
                                            const intensity = Math.abs(clamped);
                                            const bg = i === j
                                                ? 'rgba(91, 138, 240, 0.25)'
                                                : isPositive
                                                    ? `rgba(0, 200, 150, ${intensity * 0.45})`
                                                    : `rgba(229, 72, 77, ${intensity * 0.45})`;
                                            const textColor = intensity > 0.5 ? '#fff' : 'var(--color-text-secondary)';
                                            return (
                                                <div
                                                    key={j}
                                                    style={{
                                                        width: 64, height: 44,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-numeric)',
                                                        background: bg, color: textColor,
                                                        borderRadius: 6, margin: 1,
                                                        transition: 'transform 0.15s ease',
                                                        cursor: 'default',
                                                    }}
                                                    title={`${rowTicker} × ${correlationMatrix.tickers[j]}: ${clamped.toFixed(4)}`}
                                                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                                                >
                                                    {clamped.toFixed(2)}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                                {/* Color legend */}
                                <div className="flex items-center justify-center gap-3 mt-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                    <span style={{ color: '#E5484D' }}>−1 (Inverse)</span>
                                    <div style={{ width: 120, height: 8, borderRadius: 4, background: 'linear-gradient(90deg, #E5484D, rgba(255,255,255,0.05), #00C896)' }} />
                                    <span style={{ color: '#00C896' }}>+1 (Correlated)</span>
                                </div>
                            </div>
                        </div>
                    ) : <SkeletonLoader count={6} height="h-6" />}
                </GlassCard>
            </ScrollReveal>

            {/* ═══ SECTION 5 — Rolling Risk Metrics ═══ */}
            <ScrollReveal>
                <GlassCard>
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <h3 className="text-h3 flex items-center gap-2">
                            <span style={{ color: '#14B8A6' }}>◉</span> Risk History &amp; Rolling Metrics
                        </h3>
                        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                            {(['volatility', 'sharpe', 'drawdown'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setRollingTab(tab)}
                                    style={{
                                        padding: '6px 14px', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                                        background: rollingTab === tab ? 'rgba(91,138,240,0.15)' : 'transparent',
                                        color: rollingTab === tab ? '#5B8AF0' : 'var(--color-text-muted)',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    {tab === 'volatility' ? 'Volatility' : tab === 'sharpe' ? 'Sharpe Ratio' : 'Drawdown'}
                                </button>
                            ))}
                        </div>
                    </div>
                    {rollingData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={rollingData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <defs>
                                    <linearGradient id="rollingGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={rollingTab === 'drawdown' ? '#E5484D' : rollingTab === 'sharpe' ? '#C9A84C' : '#5B8AF0'} stopOpacity={0.3} />
                                        <stop offset="100%" stopColor={rollingTab === 'drawdown' ? '#E5484D' : rollingTab === 'sharpe' ? '#C9A84C' : '#5B8AF0'} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false}
                                    tickFormatter={(v) => rollingTab === 'sharpe' ? v.toFixed(1) : `${v}%`}
                                />
                                <ReTooltip content={<GlassTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey={rollingTab === 'sharpe' ? 'sharpe' : rollingTab === 'drawdown' ? 'drawdown' : 'volatility'}
                                    stroke={rollingTab === 'drawdown' ? '#E5484D' : rollingTab === 'sharpe' ? '#C9A84C' : '#5B8AF0'}
                                    fill="url(#rollingGrad)"
                                    strokeWidth={2}
                                    animationDuration={600}
                                    dot={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : <SkeletonLoader count={4} height="h-6" />}
                </GlassCard>
            </ScrollReveal>

            {/* ═══ SECTION 6 — Scenario Stress Testing ═══ */}
            <ScrollReveal>
                <GlassCard>
                    <h3 className="text-h3 mb-1 flex items-center gap-2">
                        <Zap size={18} style={{ color: '#D4922B' }} /> Scenario Stress Testing
                    </h3>
                    <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>Simulate market shocks and estimate portfolio impact</p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                        {SCENARIOS.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => setActiveScenario(activeScenario === s.id ? null : s.id)}
                                style={{
                                    padding: '14px 12px', borderRadius: 12, border: '1px solid',
                                    borderColor: activeScenario === s.id ? '#D4922B' : 'var(--color-border)',
                                    background: activeScenario === s.id ? 'rgba(212,146,43,0.08)' : 'var(--surface-glass)',
                                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease',
                                }}
                            >
                                <div className="text-xl mb-1">{s.icon}</div>
                                <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{s.label}</p>
                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{s.desc}</p>
                            </button>
                        ))}
                    </div>

                    {scenarioResult && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="grid grid-cols-2 md:grid-cols-4 gap-3"
                        >
                            {[
                                { label: 'Est. Portfolio Loss', value: formatPercent(Math.abs(scenarioResult.estimatedLoss)), color: '#E5484D' },
                                { label: 'Projected Volatility', value: formatPercent(scenarioResult.newVolatility), color: '#D4922B' },
                                { label: 'Projected Drawdown', value: formatPercent(scenarioResult.newDrawdown), color: '#E5484D' },
                                { label: 'Projected VaR 95%', value: formatPercent(Math.abs(scenarioResult.newVaR)), color: '#D4922B' },
                            ].map((r) => (
                                <div
                                    key={r.label}
                                    style={{
                                        padding: '12px 14px', borderRadius: 10,
                                        background: `${r.color}08`, border: `1px solid ${r.color}20`,
                                    }}
                                >
                                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{r.label}</p>
                                    <p className="text-lg font-bold font-numeric mt-1" style={{ color: r.color }}>{r.value}</p>
                                </div>
                            ))}
                        </motion.div>
                    )}

                    {!activeScenario && (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-muted)', fontSize: 12 }}>
                            Select a scenario above to simulate its impact on your portfolio
                        </div>
                    )}
                </GlassCard>
            </ScrollReveal>
        </motion.div>
    );
}
