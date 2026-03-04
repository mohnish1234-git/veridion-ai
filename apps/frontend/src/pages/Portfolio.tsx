import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Trash2, Pencil, Search, X, ArrowUpRight, ArrowDownRight,
    Briefcase, DollarSign, BarChart3, Shield, Activity, PieChart as PieIcon,
    TrendingUp, Layers, AlertTriangle, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';
import GlassCard from '../components/ui/GlassCard';
import CountUp from '../components/reactbits/CountUp';
import ScrollReveal from '../components/reactbits/ScrollReveal';
import Diagrams from '../components/charts/Diagrams';
import SkeletonLoader from '../components/ui/SkeletonLoader';
import AddAssetModal, { AddAssetData } from '../components/ui/AddAssetModal';
import { usePortfolio } from '../hooks/usePortfolio';
import { formatCurrency, formatPercent } from '../utils/formatters';


const pageV = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
    exit: { opacity: 0, y: -8 },
};

type SortField = 'ticker' | 'assetClass' | 'sector' | 'shares' | 'avgCost' | 'price' | 'value' | 'weight' | 'unrealizedPnL';
type SortDir = 'asc' | 'desc';

function stateColor(state: string) {
    switch (state) {
        case 'HEALTHY': return 'var(--color-success)';
        case 'DRIFT_WARNING': return 'var(--color-warning)';
        case 'REBALANCE_NEEDED': return '#f97316';
        case 'RISK_ALERT': case 'CRITICAL': return 'var(--color-danger)';
        default: return 'var(--color-text-muted)';
    }
}

function stateBg(state: string) {
    switch (state) {
        case 'HEALTHY': return 'rgba(52, 211, 153, 0.12)';
        case 'DRIFT_WARNING': return 'rgba(251, 191, 36, 0.12)';
        case 'REBALANCE_NEEDED': return 'rgba(249, 115, 22, 0.12)';
        case 'RISK_ALERT': case 'CRITICAL': return 'rgba(239, 68, 68, 0.12)';
        default: return 'var(--color-bg-tertiary)';
    }
}

function stateLabel(state: string) {
    return state.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/\bPnl\b/i, 'P&L');
}

// ─── Confirmation Dialog ────────────────────────────────────────────
function ConfirmDialog({ ticker, name, shares, onConfirm, onCancel }: {
    ticker: string; name: string; shares: number;
    onConfirm: () => void; onCancel: () => void;
}) {
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
            onClick={e => e.target === e.currentTarget && onCancel()}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                className="w-full max-w-sm rounded-2xl overflow-hidden"
                style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.15)' }}>
                            <Trash2 size={18} style={{ color: 'var(--color-danger)' }} />
                        </div>
                        <h3 className="text-h3">Delete {ticker}?</h3>
                    </div>
                    <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
                        This will remove <strong>{shares}</strong> shares of <strong>{name}</strong> from your portfolio.
                        This action cannot be undone.
                    </p>
                    <div className="flex gap-3">
                        <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
                        <button onClick={onConfirm}
                            className="flex-1 px-4 py-2.5 rounded-lg font-medium transition-all text-sm"
                            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                            Delete
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ─── Edit Holding Modal ─────────────────────────────────────────────
function EditHoldingModal({ holding, onClose, onSave }: {
    holding: { id: number; ticker: string; name: string; shares: number; avgCost: number | null };
    onClose: () => void;
    onSave: (id: number, data: { quantity?: number; avgCost?: number }) => Promise<void>;
}) {
    const [qty, setQty] = useState(String(holding.shares));
    const [cost, setCost] = useState(holding.avgCost != null ? String(holding.avgCost) : '');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!qty || Number(qty) <= 0) return setError('Quantity must be > 0');
        setSubmitting(true);
        try {
            await onSave(holding.id, {
                quantity: Number(qty),
                avgCost: cost ? Number(cost) : undefined,
            });
            onClose();
        } catch (err: any) {
            setError(err?.response?.data?.error?.message ?? 'Failed to update holding');
        } finally { setSubmitting(false); }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                className="w-full max-w-sm rounded-2xl overflow-hidden"
                style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                <div className="p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-accent)' }}>
                                <Pencil size={15} style={{ color: 'var(--color-bg-primary)' }} />
                            </div>
                            <div>
                                <h3 className="text-h3">Edit {holding.ticker}</h3>
                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{holding.name}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-lg" style={{ color: 'var(--color-text-muted)' }}><X size={16} /></button>
                    </div>
                    <form onSubmit={submit} className="space-y-4">
                        <div>
                            <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-muted)' }}>Quantity *</label>
                            <input className="input-field" type="number" step="0.01" min="0.01" value={qty} onChange={e => setQty(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-muted)' }}>Average Cost ($)</label>
                            <input className="input-field" type="number" step="0.01" min="0" value={cost} onChange={e => setCost(e.target.value)} placeholder="Optional" />
                        </div>
                        {error && <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>{error}</p>}
                        <div className="flex gap-3 pt-1">
                            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                            <button type="submit" disabled={submitting} className="btn-primary flex-1">{submitting ? 'Saving…' : 'Save'}</button>
                        </div>
                    </form>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ═══════════════════════════════════════════════════════════════════════
// PORTFOLIO PAGE
// ═══════════════════════════════════════════════════════════════════════
export default function Portfolio() {
    const {
        totalValue, totalReturn, holdings, snapshots, allocation, state,
        isLoading, isMutating, error: storeError,
        addHolding, updateHolding, removeHolding, clearError,
    } = usePortfolio();

    const [showAddAsset, setShowAddAsset] = useState(false);
    const [editHolding, setEditHolding] = useState<typeof holdings[0] | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<typeof holdings[0] | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<SortField>('value');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [range, setRange] = useState<'1W' | '1M' | '3M' | '1Y' | 'ALL'>('1M');

    // ─── Derived data ────────────────────────────────────────────────
    const filteredHoldings = useMemo(() => {
        const q = searchQuery.toLowerCase();
        let items = holdings.filter(h =>
            !q || h.ticker.toLowerCase().includes(q) || (h.name ?? '').toLowerCase().includes(q)
        );
        items.sort((a, b) => {
            const av = (a as any)[sortField] ?? 0;
            const bv = (b as any)[sortField] ?? 0;
            if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
            return sortDir === 'asc' ? av - bv : bv - av;
        });
        return items;
    }, [holdings, searchQuery, sortField, sortDir]);

    // Allocation by asset class pie chart
    const assetClassData = useMemo(() => {
        const map: Record<string, number> = {};
        holdings.forEach(h => {
            const cls = h.assetClass ?? 'Other';
            map[cls] = (map[cls] ?? 0) + (h.value ?? 0);
        });
        const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
        return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value / total * 100) })).sort((a, b) => b.value - a.value);
    }, [holdings]);

    // Allocation by sector pie chart
    const sectorData = useMemo(() => {
        const map: Record<string, number> = {};
        holdings.forEach(h => {
            const sec = h.sector ?? 'Other';
            map[sec] = (map[sec] ?? 0) + (h.value ?? 0);
        });
        const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
        return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value / total * 100) })).sort((a, b) => b.value - a.value);
    }, [holdings]);

    // Snapshot chart data
    const perfData = useMemo(() => {

        const history = snapshots.map(s => ({
            date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            value: Math.round(s.totalValue),
        }));
        if (totalValue) {
            history.push({
                date: "Now",
                value: Math.round(totalValue)
            });
        }
        return history;
    }, [snapshots, totalValue]);

    const filteredPerfData = useMemo(() => {

        if (range === "ALL") return perfData;

        const daysMap = {
            "1W": 7,
            "1M": 30,
            "3M": 90,
            "1Y": 365
        };

        const days = daysMap[range];

        return perfData.slice(-days);

    }, [range, perfData]);

    // Current vs target allocation data
    const allocComparisonData = useMemo(() =>
        allocation.map(a => ({
            name: a.ticker,
            Current: Math.round(a.currentWeight * 10000) / 100,
            Target: a.targetWeight != null ? Math.round(a.targetWeight * 10000) / 100 : null,
        }))
        , [allocation]);

    const hasTargets = allocation.some(a => a.targetWeight != null);

    // ─── Handlers ────────────────────────────────────────────────────
    const handleAddAsset = async (data: AddAssetData) => {
        await addHolding({
            ticker: data.ticker,
            name: data.name || undefined,
            assetType: data.assetType,
            sector: data.sector,
            country: data.country,
            quantity: data.quantity,
            avgCost: data.avgCost || undefined,
        });
    };

    const handleDelete = async () => {
        if (!deleteTarget?.id) return;
        await removeHolding(deleteTarget.id);
        setDeleteTarget(null);
    };

    const toggleSort = (field: SortField) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('desc'); }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return null;
        return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
    };

    const portfolioState = state?.state ?? 'HEALTHY';

    return (
        <motion.div variants={pageV} initial="initial" animate="animate" exit="exit" className="space-y-6">

            {/* ─── Error Banner ──────────────────────────────────────────── */}
            <AnimatePresence>
                {storeError && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="flex items-center justify-between px-4 py-3 rounded-xl"
                        style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={16} style={{ color: 'var(--color-danger)' }} />
                            <span className="text-sm" style={{ color: 'var(--color-danger)' }}>{storeError}</span>
                        </div>
                        <button onClick={clearError} className="p-1.5 rounded-lg" style={{ color: 'var(--color-danger)' }}><X size={14} /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── Section 1: Header ──────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                    <h1 className="text-h1 flex items-center gap-2">
                        <Briefcase size={28} style={{ color: 'var(--color-accent-teal)' }} /> Portfolio
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        Manage your holdings and track allocation
                    </p>
                </div>
                <button onClick={() => setShowAddAsset(true)} className="btn-primary text-sm flex items-center gap-2">
                    <Plus size={14} /> Add Holding
                </button>
            </div>

            {/* ─── Section 2: Summary Cards ───────────────────────────────── */}
            <ScrollReveal>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Value */}
                    <GlassCard className="py-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: 'rgba(45, 212, 191, 0.12)' }}>
                                <DollarSign size={18} style={{ color: 'var(--color-accent-teal)' }} />
                            </div>
                            <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Total Value</p>
                        </div>
                        {isLoading ? <SkeletonLoader height="h-10" /> : (
                            <CountUp end={totalValue ?? 0} prefix="$" separator="," decimals={2} className="text-3xl font-bold font-numeric" />
                        )}
                    </GlassCard>

                    {/* Total Return */}
                    <GlassCard className="py-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: (totalReturn ?? 0) >= 0 ? 'rgba(52, 211, 153, 0.12)' : 'rgba(239, 68, 68, 0.12)' }}>
                                {(totalReturn ?? 0) >= 0
                                    ? <TrendingUp size={18} style={{ color: 'var(--color-success)' }} />
                                    : <ArrowDownRight size={18} style={{ color: 'var(--color-danger)' }} />
                                }
                            </div>
                            <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Total Return</p>
                        </div>
                        {isLoading ? <SkeletonLoader height="h-10" /> : (
                            <p className="text-3xl font-bold font-numeric"
                                style={{ color: (totalReturn ?? 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                {(totalReturn ?? 0) >= 0 ? '+' : ''}{(totalReturn ?? 0).toFixed(2)}%
                            </p>
                        )}
                    </GlassCard>

                    {/* Holdings Count */}
                    <GlassCard className="py-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: 'rgba(139, 92, 246, 0.12)' }}>
                                <Layers size={18} style={{ color: '#8B5CF6' }} />
                            </div>
                            <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Total Holdings</p>
                        </div>
                        {isLoading ? <SkeletonLoader height="h-10" /> : (
                            <CountUp end={holdings.length} className="text-3xl font-bold font-numeric" />
                        )}
                    </GlassCard>

                    {/* Portfolio State */}
                    <GlassCard className="py-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: stateBg(portfolioState) }}>
                                <Shield size={18} style={{ color: stateColor(portfolioState) }} />
                            </div>
                            <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Portfolio State</p>
                        </div>
                        {isLoading ? <SkeletonLoader height="h-10" /> : (
                            <div>
                                <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold"
                                    style={{ background: stateBg(portfolioState), color: stateColor(portfolioState) }}>
                                    {stateLabel(portfolioState)}
                                </span>
                                {state?.healthIndex != null && (
                                    <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
                                        Health: {state.healthIndex}/100
                                    </p>
                                )}
                            </div>
                        )}
                    </GlassCard>
                </div>
            </ScrollReveal>

            {/* ─── Section 3: Holdings Table ──────────────────────────────── */}
            <ScrollReveal>
                <GlassCard>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                            <h2 className="text-h3 flex items-center gap-2">
                                <BarChart3 size={18} style={{ color: 'var(--color-accent-teal)' }} />
                                Holdings
                            </h2>
                            <span className="text-xs font-medium px-2 py-1 rounded-lg"
                                style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-muted)' }}>
                                {holdings.length} asset{holdings.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        {/* Search */}
                        <div className="relative w-full sm:w-64">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                            <input
                                className="input-field pl-9 text-sm"
                                placeholder="Search ticker or name…"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {isLoading ? (
                        <SkeletonLoader count={6} height="h-12" />
                    ) : filteredHoldings.length === 0 && holdings.length === 0 ? (
                        /* Empty state */
                        <div className="py-16 text-center">
                            <Briefcase size={48} style={{ color: 'var(--color-text-muted)', opacity: 0.25, margin: '0 auto 16px' }} />
                            <h3 className="text-h3 mb-2">Your portfolio is empty</h3>
                            <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
                                Add your first holding to get started.
                            </p>
                            <button onClick={() => setShowAddAsset(true)} className="btn-primary text-sm inline-flex items-center gap-2">
                                <Plus size={14} /> Add Holding
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto -mx-6 px-6">
                            <table className="w-full text-sm min-w-[900px]">
                                <thead>
                                    <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                                        {[
                                            { key: 'ticker', label: 'Asset', align: 'left' },
                                            { key: 'assetClass', label: 'Type', align: 'left' },
                                            { key: 'sector', label: 'Sector', align: 'left' },
                                            { key: 'shares', label: 'Qty', align: 'right' },
                                            { key: 'avgCost', label: 'Avg Cost', align: 'right' },
                                            { key: 'price', label: 'Price', align: 'right' },
                                            { key: 'value', label: 'Market Value', align: 'right' },
                                            { key: 'weight', label: 'Weight', align: 'right' },
                                            { key: 'unrealizedPnL', label: 'P&L', align: 'right' },
                                        ].map(col => (
                                            <th key={col.key}
                                                onClick={() => toggleSort(col.key as SortField)}
                                                className={`py-3 text-caption cursor-pointer select-none ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                                                style={{ color: 'var(--color-text-muted)' }}>
                                                <span className="inline-flex items-center gap-1">{col.label} <SortIcon field={col.key as SortField} /></span>
                                            </th>
                                        ))}
                                        <th className="py-3 text-right text-caption" style={{ color: 'var(--color-text-muted)' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredHoldings.map(h => {
                                        const pnl = h.unrealizedPnL ?? 0;
                                        const pnlPct = h.unrealizedPnLPercent ?? 0;
                                        const isPositive = pnl >= 0;
                                        return (
                                            <tr key={h.id ?? h.ticker} className="border-b group transition-colors"
                                                style={{ borderColor: 'var(--color-border)' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-tertiary)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                                {/* Asset */}
                                                <td className="py-3.5">
                                                    <p className="font-semibold">{h.ticker}</p>
                                                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{h.name}</p>
                                                </td>
                                                {/* Type badge */}
                                                <td className="py-3.5">
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                                                        style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                                                        {h.assetClass ?? '—'}
                                                    </span>
                                                </td>
                                                {/* Sector */}
                                                <td className="py-3.5" style={{ color: 'var(--color-text-secondary)' }}>{h.sector ?? '—'}</td>
                                                {/* Quantity */}
                                                <td className="py-3.5 text-right font-numeric">{h.shares}</td>
                                                {/* Avg Cost */}
                                                <td className="py-3.5 text-right font-numeric">{h.avgCost != null ? formatCurrency(h.avgCost) : '—'}</td>
                                                {/* Price */}
                                                <td className="py-3.5 text-right font-numeric">{h.price != null ? formatCurrency(h.price) : '—'}</td>
                                                {/* Market Value */}
                                                <td className="py-3.5 text-right font-numeric font-semibold">{formatCurrency(h.value ?? 0)}</td>
                                                {/* Weight */}
                                                <td className="py-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-primary)' }}>
                                                            <div className="h-full rounded-full" style={{ width: `${(h.weight ?? 0) * 100}%`, background: 'var(--color-accent-teal)' }} />
                                                        </div>
                                                        <span className="font-numeric text-xs w-10 text-right">{((h.weight ?? 0) * 100).toFixed(1)}%</span>
                                                    </div>
                                                </td>
                                                {/* P&L */}
                                                <td className="py-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {isPositive ? <ArrowUpRight size={12} style={{ color: 'var(--color-success)' }} /> : <ArrowDownRight size={12} style={{ color: 'var(--color-danger)' }} />}
                                                        <span className="font-numeric font-semibold" style={{ color: isPositive ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                                            {isPositive ? '+' : ''}{formatCurrency(pnl)}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs font-numeric" style={{ color: isPositive ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                                        {isPositive ? '+' : ''}{pnlPct.toFixed(2)}%
                                                    </p>
                                                </td>
                                                {/* Actions */}
                                                <td className="py-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => setEditHolding(h)}
                                                            className="p-1.5 rounded-lg transition-colors"
                                                            style={{ color: 'var(--color-text-muted)' }}
                                                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-accent-teal)')}
                                                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}>
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button onClick={() => setDeleteTarget(h)}
                                                            className="p-1.5 rounded-lg transition-colors"
                                                            style={{ color: 'var(--color-text-muted)' }}
                                                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
                                                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </GlassCard>
            </ScrollReveal>

            {/* ─── Section 4: Allocation Charts ───────────────────────────── */}
            {holdings.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Asset Class Pie */}
                    <ScrollReveal>
                        <GlassCard>
                            <h2 className="text-h3 mb-4 flex items-center gap-2">
                                <PieIcon size={18} style={{ color: 'var(--color-accent-teal)' }} />
                                Allocation by Asset Type
                            </h2>
                            {assetClassData.length > 0 ? (
                                <Diagrams data={assetClassData} type="pie" dataKeys={['value']} xKey="name" height={280} showLegend />
                            ) : <SkeletonLoader height="h-64" />}
                        </GlassCard>
                    </ScrollReveal>

                    {/* Sector Pie */}
                    <ScrollReveal delay={0.1}>
                        <GlassCard>
                            <h2 className="text-h3 mb-4 flex items-center gap-2">
                                <Layers size={18} style={{ color: '#8B5CF6' }} />
                                Allocation by Sector
                            </h2>
                            {sectorData.length > 0 ? (
                                <Diagrams data={sectorData} type="pie" dataKeys={['value']} xKey="name" height={280} showLegend />
                            ) : <SkeletonLoader height="h-64" />}
                        </GlassCard>
                    </ScrollReveal>
                </div>
            )}

            {/* Hidden for time being until work on it can be continued later */}

            {/* ─── Section 5: Current vs Target Allocation ────────────────── */}
            {allocation.length > 0 && false && (
                <ScrollReveal>
                    <GlassCard>
                        <h2 className="text-h3 mb-4 flex items-center gap-2">
                            <Activity size={18} style={{ color: 'var(--color-accent-teal)' }} />
                            Current vs Target Allocation
                        </h2>
                        {hasTargets ? (
                            <Diagrams
                                data={allocComparisonData}
                                type="bar"
                                dataKeys={['Current', 'Target']}
                                xKey="name"
                                height={300}
                                showLegend
                            />
                        ) : (
                            <div className="py-10 text-center">
                                <Activity size={36} style={{ color: 'var(--color-text-muted)', opacity: 0.3, margin: '0 auto 12px' }} />
                                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                    No target allocation set. Run a portfolio optimization to generate targets.
                                </p>
                            </div>
                        )}
                    </GlassCard>
                </ScrollReveal>
            )}

            {/* ─── Section 6: Performance Chart ───────────────────────────── */}
            {(perfData.length > 0 || isLoading) && (
                <ScrollReveal>
                    <GlassCard>
                        <h2 className="text-h3 mb-4 flex items-center gap-2">
                            <div className="flex items-center gap-1 text-xs">
                                {["1W","1M","3M","1Y","ALL"].map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setRange(r as any)}
                                        className="px-2 py-1 rounded-md transition"
                                        style={{
                                            background: range === r ? "var(--color-accent-teal)" : "var(--color-bg-tertiary)",
                                            color: range === r ? "var(--color-bg-primary)" : "var(--color-text-secondary)"
                                        }}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                            <TrendingUp size={18} style={{ color: 'var(--color-accent-teal)' }} />
                            Portfolio Value Over Time
                        </h2>
                        {isLoading ? <SkeletonLoader height="h-56" /> : (
                            <Diagrams data={filteredPerfData} type="area" dataKeys={['value']} xKey="date" height={280} />
                        )}
                    </GlassCard>
                </ScrollReveal>
            )}

            {/* ─── Modals ─────────────────────────────────────────────────── */}
            <AddAssetModal isOpen={showAddAsset} onClose={() => setShowAddAsset(false)} onAdd={handleAddAsset} />

            <AnimatePresence>
                {editHolding && (
                    <EditHoldingModal
                        holding={editHolding}
                        onClose={() => setEditHolding(null)}
                        onSave={updateHolding}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {deleteTarget && (
                    <ConfirmDialog
                        ticker={deleteTarget.ticker}
                        name={deleteTarget.name ?? deleteTarget.ticker}
                        shares={deleteTarget.shares}
                        onConfirm={handleDelete}
                        onCancel={() => setDeleteTarget(null)}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
}
