import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Brain, TrendingUp, TrendingDown, Zap, Activity, Shield, DollarSign,
    RefreshCw, Info, AlertTriangle, CheckCircle, ChevronRight, Plus, X,
    BarChart2, Target, Wallet,
} from 'lucide-react';
import GlassCard from '../components/ui/GlassCard';
import AnimatedGauge from '../components/ui/AnimatedGauge';
import CountUp from '../components/reactbits/CountUp';
import ScrollReveal from '../components/reactbits/ScrollReveal';
import Diagrams from '../components/charts/Diagrams';
import SkeletonLoader from '../components/ui/SkeletonLoader';
import Tooltip from '../components/ui/Tooltip';
import { useBehavioral } from '../hooks/useBehavioral';
import { useBehavioralStore } from '../state/behavioral.store';
import { formatCurrency } from '../utils/formatters';
import { GLOSSARY } from '../utils/constants';

// ─── helpers ─────────────────────────────────────────────────────────────────
const pageV = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
    exit: { opacity: 0 },
};

function scoreColor(val: number) {
    if (val >= 70) return 'var(--color-success)';
    if (val >= 40) return 'var(--color-warning)';
    return 'var(--color-danger)';
}
function riskColor(val: number) {
    // For risk scores — high = bad
    if (val <= 30) return 'var(--color-success)';
    if (val <= 60) return 'var(--color-warning)';
    return 'var(--color-danger)';
}

function ScoreBar({ label, value, isRisk = false, tip }: { label: string; value: number; isRisk?: boolean; tip?: string }) {
    const col = isRisk ? riskColor(value) : scoreColor(value);
    const content = (
        <div>
            <div className="flex justify-between text-sm mb-1.5">
                <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                <span className="font-bold font-numeric" style={{ color: col }}>{value.toFixed(0)}</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-tertiary)' }}>
                <motion.div className="h-full rounded-full" style={{ background: col }}
                    initial={{ width: 0 }} animate={{ width: `${value}%` }}
                    transition={{ duration: 0.8, delay: 0.2 }} />
            </div>
        </div>
    );
    return tip ? <Tooltip content={tip}>{content}</Tooltip> : content;
}

function InsightRow({ text, type }: { text: string; type: 'good' | 'warn' | 'bad' }) {
    const colors = { good: 'var(--color-success)', warn: 'var(--color-warning)', bad: 'var(--color-danger)' };
    const icons = { good: <CheckCircle size={14} />, warn: <AlertTriangle size={14} />, bad: <AlertTriangle size={14} /> };
    return (
        <div className="flex items-start gap-3 p-3 rounded-xl"
            style={{ background: 'var(--color-bg-tertiary)', borderLeft: `3px solid ${colors[type]}` }}>
            <span style={{ color: colors[type], flexShrink: 0, marginTop: 2 }}>{icons[type]}</span>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{text}</p>
        </div>
    );
}

function classifyInsight(text: string): 'good' | 'warn' | 'bad' {
    const lower = text.toLowerCase();
    if (lower.includes('low') && (lower.includes('panic') || lower.includes('composure'))) return 'good';
    if (lower.includes('strong') || lower.includes('solid') || lower.includes('healthy')) return 'good';
    if (lower.includes('high') || lower.includes('strong recency') || lower.includes('gravitat')) return 'bad';
    return 'warn';
}

// ─── Add Transaction Modal ────────────────────────────────────────────────────
function AddTransactionModal({ onClose, onAdd }: { onClose: () => void; onAdd: (d: any) => Promise<void> }) {
    const [form, setForm] = useState({ amount: '', category: '', transactionType: 'expense', description: '', transactionDate: new Date().toISOString().split('T')[0] });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.amount || isNaN(Number(form.amount))) return setError('Valid amount required');
        setSubmitting(true);
        try {
            await onAdd({ amount: Number(form.amount), category: form.category || undefined, transactionType: form.transactionType, description: form.description || undefined, transactionDate: form.transactionDate });
            onClose();
        } catch (e: any) { setError(e?.response?.data?.message ?? 'Failed to add transaction'); }
        finally { setSubmitting(false); }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                className="w-full max-w-md rounded-2xl overflow-hidden"
                style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                <div className="p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-accent)' }}>
                                <Plus size={16} style={{ color: 'var(--color-bg-primary)' }} />
                            </div>
                            <h3 className="text-h3">Add Transaction</h3>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-bg-tertiary" style={{ color: 'var(--color-text-muted)' }}><X size={16} /></button>
                    </div>
                    <form onSubmit={submit} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-muted)' }}>Amount *</label>
                                <input className="input-field" type="number" step="0.01" placeholder="e.g. 150.00" value={form.amount} onChange={e => update('amount', e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-muted)' }}>Date *</label>
                                <input className="input-field" type="date" value={form.transactionDate} onChange={e => update('transactionDate', e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-muted)' }}>Type *</label>
                            <div className="flex gap-1.5">
                                {['income', 'expense', 'investment', 'withdrawal'].map(t => (
                                    <button key={t} type="button" onClick={() => update('transactionType', t)}
                                        className="flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
                                        style={{ background: form.transactionType === t ? 'var(--color-accent-teal)' : 'var(--color-bg-tertiary)', color: form.transactionType === t ? 'var(--color-bg-primary)' : 'var(--color-text-secondary)' }}>
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-muted)' }}>Category</label>
                                <input className="input-field" placeholder="e.g. Food" value={form.category} onChange={e => update('category', e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-muted)' }}>Description</label>
                                <input className="input-field" placeholder="Optional note" value={form.description} onChange={e => update('description', e.target.value)} />
                            </div>
                        </div>
                        {error && <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>{error}</p>}
                        <div className="flex gap-3 pt-1">
                            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                            <button type="submit" disabled={submitting} className="btn-primary flex-1">{submitting ? 'Adding…' : 'Add Transaction'}</button>
                        </div>
                    </form>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ─── main component ───────────────────────────────────────────────────────────
export default function BehavioralInsights() {
    const { scores, spending, adaptiveRisk, history, isLoading } = useBehavioral();
    const { isRefreshing, refreshScores, addTransaction } = useBehavioralStore();
    const [showAddTxn, setShowAddTxn] = useState(false);

    // Radar data – 0-100 scale
    const radarData = scores ? [
        { name: 'Adaptive', value: Math.round(scores.adaptiveRiskScore) },
        { name: 'Panic Sell', value: Math.round(scores.panicSellScore) },
        { name: 'Recency', value: Math.round(scores.recencyBiasScore) },
        { name: 'Risk Chase', value: Math.round(scores.riskChasingScore) },
        { name: 'Liquidity', value: Math.round(scores.liquidityStressScore) },
    ] : [];

    // History chart
    const historyChartData = history.map(h => ({
        date: new Date(h.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        'Adaptive': Math.round(h.adaptiveRiskScore),
        'Panic': Math.round(h.panicSellScore),
    }));

    // Spending trend chart
    const trendData = (spending?.monthlyTrend ?? []).map(m => ({
        month: m.month,
        Income: Math.round(m.income),
        Expenses: Math.round(m.expenses),
        Savings: Math.round(m.savings),
    }));

    // Category chart
    const catData = (spending?.categoryBreakdown ?? []).slice(0, 6).map(c => ({
        name: c.category,
        value: Math.round(c.percentage),
    }));

    // Regime config
    const regimeConfig = {
        LOW_VOLATILITY: { color: 'var(--color-success)', label: 'Low Volatility', icon: '' },
        NORMAL: { color: 'var(--color-warning)', label: 'Normal', icon: '' },
        HIGH_VOLATILITY: { color: 'var(--color-danger)', label: 'High Volatility', icon: '' },
    };
    const regime = regimeConfig[adaptiveRisk?.marketRegime ?? 'NORMAL'];

    const hasAnyData = !!scores || !!spending;

    return (
        <motion.div variants={pageV} initial="initial" animate="animate" exit="exit" className="space-y-6">

            {/* ─── Header ─────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                    <h1 className="text-h1 flex items-center gap-2">
                        <Brain size={28} style={{ color: 'var(--color-accent-teal)' }} /> Behavioral Insights
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        AI-powered analysis of your financial behaviour, biases, and risk profile
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowAddTxn(true)} className="btn-secondary text-sm flex items-center gap-2">
                        <Plus size={14} /> Add Transaction
                    </button>
                    <button onClick={refreshScores} disabled={isRefreshing}
                        className="btn-primary text-sm flex items-center gap-2"
                        style={{ opacity: isRefreshing ? 0.7 : 1 }}>
                        <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                        {isRefreshing ? 'Analysing…' : 'Run Analysis'}
                    </button>
                </div>
            </div>

            {/* ─── Empty state ─────────────────────────────────────────────── */}
            {!isLoading && !hasAnyData && (
                <GlassCard className="py-16 text-center">
                    <Brain size={48} style={{ color: 'var(--color-text-muted)', opacity: 0.3, margin: '0 auto 16px' }} />
                    <h3 className="text-h3 mb-2">No Behavioral Data Yet</h3>
                    <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
                        Add transactions to build your behavioral profile, then run the analysis.
                    </p>
                    <div className="flex gap-3 justify-center">
                        <button onClick={() => setShowAddTxn(true)} className="btn-secondary text-sm flex items-center gap-2">
                            <Plus size={14} /> Add First Transaction
                        </button>
                        <button onClick={refreshScores} disabled={isRefreshing} className="btn-primary text-sm flex items-center gap-2">
                            <RefreshCw size={14} /> Run First Analysis
                        </button>
                    </div>
                </GlassCard>
            )}

            {/* ─── Section 1: Top Score Cards ───────────────────────────────── */}
            <ScrollReveal>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Adaptive Risk Score */}
                    <GlassCard className="flex flex-col items-center py-6 gap-3">
                        <Tooltip content={GLOSSARY['Adaptive Risk Score'] ?? 'How well you adapt your behaviour to changing risk conditions.'}>
                            <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Adaptive Risk Score</p>
                        </Tooltip>
                        {isLoading ? <SkeletonLoader height="h-32" className="w-32 rounded-full" /> : (
                            <>
                                <AnimatedGauge value={scores?.adaptiveRiskScore ?? 0} size={130} strokeWidth={12} />
                                <div className="text-center">
                                    <CountUp end={scores?.adaptiveRiskScore ?? 0} className="text-3xl font-bold font-numeric"
                                        style={{ color: scoreColor(scores?.adaptiveRiskScore ?? 0) }} />
                                    <span className="text-xl font-bold" style={{ color: 'var(--color-text-muted)' }}>/100</span>
                                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                        {(scores?.adaptiveRiskScore ?? 0) >= 70 ? 'Excellent' : (scores?.adaptiveRiskScore ?? 0) >= 40 ? 'Moderate' : 'Needs Attention'}
                                    </p>
                                </div>
                            </>
                        )}
                    </GlassCard>

                    {/* Panic Sell Risk */}
                    <GlassCard className="flex flex-col justify-center gap-4 py-6">
                        <Tooltip content={GLOSSARY['Panic Selling Index'] ?? 'Likelihood of selling during market dips due to fear.'}>
                            <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Panic Sell Risk</p>
                        </Tooltip>
                        {isLoading ? <SkeletonLoader count={3} /> : (
                            <>
                                <div className="flex items-center gap-3">
                                    <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{ background: `${riskColor(scores?.panicSellScore ?? 50)}22` }}>
                                        <Zap size={22} style={{ color: riskColor(scores?.panicSellScore ?? 50) }} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold font-numeric" style={{ color: riskColor(scores?.panicSellScore ?? 50) }}>
                                            {(scores?.panicSellScore ?? 0).toFixed(0)}
                                        </p>
                                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>out of 100</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <ScoreBar label="Panic Sell" value={scores?.panicSellScore ?? 0} isRisk />
                                    <ScoreBar label="Recency Bias" value={scores?.recencyBiasScore ?? 0} isRisk />
                                </div>
                            </>
                        )}
                    </GlassCard>

                    {/* Liquidity Buffer */}
                    <GlassCard className="flex flex-col justify-center gap-4 py-6">
                        <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Liquidity Status</p>
                        {isLoading ? <SkeletonLoader count={3} /> : (
                            <>
                                <div className="flex items-center gap-3">
                                    <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{ background: `${riskColor(scores?.liquidityStressScore ?? 50)}22` }}>
                                        <Wallet size={22} style={{ color: riskColor(scores?.liquidityStressScore ?? 50) }} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold font-numeric" style={{ color: riskColor(scores?.liquidityStressScore ?? 50) }}>
                                            {(scores?.liquidityStressScore ?? 0) <= 30 ? 'Healthy' : (scores?.liquidityStressScore ?? 0) <= 60 ? 'Moderate' : 'Stressed'}
                                        </p>
                                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                            Stress score: {(scores?.liquidityStressScore ?? 0).toFixed(0)}/100
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <ScoreBar label="Liquidity Stress" value={scores?.liquidityStressScore ?? 0} isRisk />
                                    <ScoreBar label="Risk Chasing" value={scores?.riskChasingScore ?? 0} isRisk />
                                </div>
                            </>
                        )}
                    </GlassCard>
                </div>
            </ScrollReveal>

            {/* ─── Section 2: Radar + AI Insights ──────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ScrollReveal>
                    <GlassCard>
                        <h2 className="text-h3 mb-4 flex items-center gap-2">
                            <Activity size={18} style={{ color: 'var(--color-accent-teal)' }} />
                            Behavioral Profile Radar
                        </h2>
                        {isLoading ? <SkeletonLoader height="h-64" /> :
                            radarData.length > 0 ? (
                                <Diagrams data={radarData} type="radar" dataKeys={['value']} xKey="name" height={280} />
                            ) : (
                                <div className="h-64 flex flex-col items-center justify-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
                                    <Activity size={36} style={{ opacity: 0.3 }} />
                                    <p className="text-sm">Run analysis to see your behavioral profile</p>
                                </div>
                            )}
                    </GlassCard>
                </ScrollReveal>

                <ScrollReveal delay={0.1}>
                    <GlassCard className="h-full">
                        <h2 className="text-h3 mb-4 flex items-center gap-2">
                            <Brain size={18} style={{ color: 'var(--color-accent-teal)' }} />
                            AI Insights
                        </h2>
                        {isLoading ? <SkeletonLoader count={4} /> :
                            (scores?.insights ?? []).length > 0 ? (
                                <div className="space-y-3">
                                    {(scores?.insights ?? []).map((insight, i) => (
                                        <InsightRow key={i} text={insight} type={classifyInsight(insight)} />
                                    ))}
                                    {scores?.lossAversionRatio != null && (
                                        <InsightRow
                                            text={`Loss Aversion Ratio: ${scores.lossAversionRatio.toFixed(2)}× - ${scores.lossAversionRatio > 1.5 ? 'You hold losing positions significantly longer than winners, a classic loss-aversion pattern.' : 'Your holding behaviour is relatively balanced between winners and losers.'}`}
                                            type={scores.lossAversionRatio > 1.5 ? 'warn' : 'good'}
                                        />
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: 'var(--color-text-muted)' }}>
                                    <Info size={36} style={{ opacity: 0.3 }} />
                                    <p className="text-sm text-center">Click "Run Analysis" to generate personalized insights</p>
                                </div>
                            )}
                    </GlassCard>
                </ScrollReveal>
            </div>

            {/* ─── Section 3: All Bias Scores ───────────────────────────────── */}
            <ScrollReveal>
                <GlassCard>
                    <h2 className="text-h3 mb-5 flex items-center gap-2">
                        <Shield size={18} style={{ color: 'var(--color-accent-teal)' }} />
                        Detailed Bias Breakdown
                    </h2>
                    {isLoading ? <SkeletonLoader count={5} /> : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <ScoreBar label="Adaptive Risk Score" value={scores?.adaptiveRiskScore ?? 0}
                                tip={GLOSSARY['Adaptive Risk Score'] ?? 'Higher is better — indicates good behavioural adaptation to risk.'} />
                            <ScoreBar label="Panic Sell Score" value={scores?.panicSellScore ?? 0} isRisk
                                tip={GLOSSARY['Panic Selling Index'] ?? 'Lower is better — high score means you tend to sell in fear during downturns.'} />
                            <ScoreBar label="Recency Bias Score" value={scores?.recencyBiasScore ?? 0} isRisk
                                tip={GLOSSARY['Recency Bias'] ?? 'Lower is better — high score means you over-weight recent events in decisions.'} />
                            <ScoreBar label="Risk Chasing Score" value={scores?.riskChasingScore ?? 0} isRisk
                                tip={GLOSSARY['Risk Chasing'] ?? 'Lower is better — high score means you chase high-volatility assets.'} />
                            <ScoreBar label="Liquidity Stress Score" value={scores?.liquidityStressScore ?? 0} isRisk
                                tip={GLOSSARY['Liquidity Stress'] ?? 'Lower is better — high score means your liquid buffer is insufficient.'} />
                        </div>
                    )}
                </GlassCard>
            </ScrollReveal>

            {/* ─── Section 4: Spending Analysis ─────────────────────────────── */}
            {(spending || isLoading) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Spending metrics */}
                    <ScrollReveal>
                        <div className="space-y-4">
                            <GlassCard>
                                <Tooltip content="Average monthly outflows across all expense categories.">
                                    <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Monthly Burn Rate</p>
                                </Tooltip>
                                {isLoading ? <SkeletonLoader height="h-10" /> : (
                                    <CountUp end={spending?.monthlyBurnRate ?? 0} prefix="$" separator="," className="text-2xl font-bold font-numeric mt-1" />
                                )}
                            </GlassCard>
                            <GlassCard>
                                <Tooltip content="Proportion of income saved each month.">
                                    <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Savings Rate</p>
                                </Tooltip>
                                {isLoading ? <SkeletonLoader height="h-10" /> : (
                                    <CountUp end={(spending?.savingsRate ?? 0) * 100} suffix="%" decimals={1} className="text-2xl font-bold font-numeric mt-1"
                                        style={{ color: (spending?.savingsRate ?? 0) > 0.2 ? 'var(--color-success)' : (spending?.savingsRate ?? 0) > 0.1 ? 'var(--color-warning)' : 'var(--color-danger)' }} />
                                )}
                            </GlassCard>
                            <GlassCard>
                                <Tooltip content="Coefficient of variation of monthly expenses (lower = more consistent).">
                                    <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Expense Volatility</p>
                                </Tooltip>
                                {isLoading ? <SkeletonLoader height="h-10" /> : (
                                    <CountUp end={(spending?.expenseVolatility ?? 0) * 100} suffix="%" decimals={1} className="text-2xl font-bold font-numeric mt-1"
                                        style={{ color: (spending?.expenseVolatility ?? 0) < 0.2 ? 'var(--color-success)' : (spending?.expenseVolatility ?? 0) < 0.4 ? 'var(--color-warning)' : 'var(--color-danger)' }} />
                                )}
                            </GlassCard>
                        </div>
                    </ScrollReveal>

                    {/* Monthly income vs expenses area chart */}
                    <ScrollReveal delay={0.1} className="lg:col-span-2">
                        <GlassCard className="h-full">
                            <h2 className="text-h3 mb-4 flex items-center gap-2">
                                <DollarSign size={18} style={{ color: 'var(--color-accent-teal)' }} />
                                Monthly Cash Flow
                            </h2>
                            {isLoading ? <SkeletonLoader height="h-48" /> :
                                trendData.length > 0 ? (
                                    <Diagrams data={trendData} type="area" dataKeys={['Income', 'Expenses', 'Savings']} xKey="month" height={220} />
                                ) : (
                                    <div className="h-48 flex flex-col items-center justify-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
                                        <DollarSign size={36} style={{ opacity: 0.3 }} />
                                        <p className="text-sm">Add cashflow data to see trends</p>
                                    </div>
                                )}
                        </GlassCard>
                    </ScrollReveal>
                </div>
            )}

            {/* ─── Section 5: Category Breakdown + Anomalies ───────────────── */}
            {(spending || isLoading) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ScrollReveal>
                        <GlassCard>
                            <h2 className="text-h3 mb-4 flex items-center gap-2">
                                <BarChart2 size={18} style={{ color: 'var(--color-accent-teal)' }} />
                                Spending by Category
                            </h2>
                            {isLoading ? <SkeletonLoader count={5} /> :
                                catData.length > 0 ? (
                                    <Diagrams data={catData} type="bar" dataKeys={['value']} xKey="name" height={240} />
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                                        <BarChart2 size={32} style={{ opacity: 0.3 }} />
                                        <p className="text-sm mt-2">No categorized transactions found</p>
                                    </div>
                                )}
                        </GlassCard>
                    </ScrollReveal>

                    <ScrollReveal delay={0.1}>
                        <GlassCard className="h-full">
                            <h2 className="text-h3 mb-4 flex items-center gap-2">
                                <AlertTriangle size={18} style={{ color: 'var(--color-warning)' }} />
                                Spending Anomalies
                            </h2>
                            {isLoading ? <SkeletonLoader count={3} /> :
                                (spending?.anomalies ?? []).length > 0 ? (
                                    <div className="space-y-3">
                                        {(spending?.anomalies ?? []).map((a, i) => (
                                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl"
                                                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                                <AlertTriangle size={14} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold">{a.month}</p>
                                                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                        ${a.amount.toLocaleString()} — {a.deviation.toFixed(1)}σ above normal
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-8 gap-2" style={{ color: 'var(--color-text-muted)' }}>
                                        <CheckCircle size={32} style={{ opacity: 0.5, color: 'var(--color-success)' }} />
                                        <p className="text-sm">No spending anomalies detected - your patterns look consistent!</p>
                                    </div>
                                )}
                        </GlassCard>
                    </ScrollReveal>
                </div>
            )}

            {/* ─── Section 6: Adaptive Risk Recommendation ─────────────────── */}
            <ScrollReveal>
                <GlassCard>
                    <h2 className="text-h3 mb-5 flex items-center gap-2">
                        <Target size={18} style={{ color: 'var(--color-accent-teal)' }} />
                        Adaptive Risk Recommendation
                    </h2>
                    {isLoading ? <SkeletonLoader count={4} /> :
                        adaptiveRisk ? (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Risk tolerance visual */}
                                <div className="flex flex-col items-center gap-4 p-4 rounded-xl" style={{ background: 'var(--color-bg-tertiary)' }}>
                                    <div className="flex items-center gap-6">
                                        <div className="text-center">
                                            <p className="text-3xl font-bold font-numeric" style={{ color: 'var(--color-text-muted)' }}>
                                                {adaptiveRisk.currentRiskTolerance.toFixed(1)}
                                            </p>
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Current</p>
                                        </div>
                                        <ChevronRight size={20} style={{ color: 'var(--color-accent-teal)' }} />
                                        <div className="text-center">
                                            <p className="text-3xl font-bold font-numeric"
                                                style={{ color: adaptiveRisk.adjustmentDelta < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                                {adaptiveRisk.suggestedRiskTolerance.toFixed(1)}
                                            </p>
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Suggested</p>
                                        </div>
                                    </div>
                                    <div className="w-full">
                                        <span className="text-xs px-2 py-1 rounded-full"
                                            style={{ background: `${regime.color}22`, color: regime.color }}>
                                            {regime.icon} {regime.label}
                                        </span>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                            Confidence: <span className="font-bold">{Math.round(adaptiveRisk.confidence * 100)}%</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Adjustment reasons */}
                                <div className="lg:col-span-2 space-y-3">
                                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>Adjustment Rationale</p>
                                    {adaptiveRisk.adjustmentReasons.map((reason, i) => (
                                        <div key={i} className="flex items-start gap-2 text-sm">
                                            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                                                style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-accent-teal)' }}>
                                                <span className="text-xs">{i + 1}</span>
                                            </div>
                                            <p style={{ color: 'var(--color-text-secondary)' }}>{reason}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 gap-2" style={{ color: 'var(--color-text-muted)' }}>
                                <Target size={36} style={{ opacity: 0.3 }} />
                                <p className="text-sm">Run analysis to get your adaptive risk recommendation</p>
                            </div>
                        )}
                </GlassCard>
            </ScrollReveal>

            {/* ─── Section 7: Score History Chart ──────────────────────────── */}
            {(history.length > 1 || isLoading) && (
                <ScrollReveal>
                    <GlassCard>
                        <h2 className="text-h3 mb-4 flex items-center gap-2">
                            <TrendingUp size={18} style={{ color: 'var(--color-accent-teal)' }} />
                            Score Evolution
                        </h2>
                        {isLoading ? <SkeletonLoader height="h-56" /> : (
                            <Diagrams data={historyChartData} type="area" dataKeys={['Adaptive', 'Panic']} xKey="date" height={220} />
                        )}
                    </GlassCard>
                </ScrollReveal>
            )}

            {/* ─── Add Transaction Modal ────────────────────────────────────── */}
            <AnimatePresence>
                {showAddTxn && (
                    <AddTransactionModal
                        onClose={() => setShowAddTxn(false)}
                        onAdd={async (data) => { await addTransaction(data); setShowAddTxn(false); }}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
}
