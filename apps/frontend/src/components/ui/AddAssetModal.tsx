import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Search, DollarSign, Hash, Building2, Globe, BarChart3 } from 'lucide-react';
import { searchAssets, getAssetMetadata } from '../../services/assets.service';

interface AddAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (data: AddAssetData) => Promise<void>;
}

export interface AddAssetData {
    ticker: string;
    name: string;
    assetType: string;
    sector: string;
    country: string;
    quantity: number;
    avgCost: number;
}

const ASSET_TYPES = ['stock', 'etf', 'crypto', 'bond', 'currency', 'commodity', 'reit'];

const SECTORS = [
    'Technology', 'Healthcare', 'Financials', 'Consumer Discretionary',
    'Consumer Staples', 'Energy', 'Industrials', 'Materials',
    'Real Estate', 'Utilities', 'Communication Services', 'Crypto', 'Other',
];

const COUNTRIES = ['US', 'UK', 'EU', 'JP', 'CN', 'IN', 'CA', 'AU', 'Global'];

const backdrop = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

const modal = {
    initial: { opacity: 0, scale: 0.95, y: 20 },
    animate: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: { type: 'spring', damping: 25, stiffness: 300 },
    },
    exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2 } },
};

export default function AddAssetModal({ isOpen, onClose, onAdd }: AddAssetModalProps) {

    const [form, setForm] = useState<AddAssetData>({
        ticker: '',
        name: '',
        assetType: 'stock',
        sector: 'Technology',
        country: 'US',
        quantity: 0,
        avgCost: 0,
    });

    const [assetSelected, setAssetSelected] = useState(false);
    const [loadingAsset, setLoadingAsset] = useState(false);

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [showResults, setShowResults] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const update = (field: keyof AddAssetData, value: string | number) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setError('');
    };

    // Debounced search
    useEffect(() => {

        const timer = setTimeout(async () => {

            if (query.length < 2 || assetSelected) {
                setResults([]);
                return;
            }

            try {
                const assets = await searchAssets(query);
                setResults(assets);
                setShowResults(true);
            } catch {
                setResults([]);
            }

        }, 300);

        return () => clearTimeout(timer);

    }, [query, assetSelected]);

    // Reset when modal closes
    useEffect(() => {
        if (!isOpen) {

            setAssetSelected(false);
            setQuery('');
            setResults([]);
            setShowResults(false);

        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {

        e.preventDefault();

        if (!form.ticker.trim())
            return setError('Ticker symbol is required');

        if (form.quantity <= 0)
            return setError('Quantity must be greater than 0');

        if (form.avgCost < 0)
            return setError('Average cost cannot be negative');

        setIsSubmitting(true);

        try {

            await onAdd(form);

            setForm({
                ticker: '',
                name: '',
                assetType: 'stock',
                sector: 'Technology',
                country: 'US',
                quantity: 0,
                avgCost: 0,
            });

            setAssetSelected(false);
            setQuery('');

            onClose();

        } catch (err: any) {

            setError(err?.response?.data?.message || 'Failed to add asset');

        } finally {

            setIsSubmitting(false);

        }
    };

    return (
        <AnimatePresence>
            {isOpen && (

                <motion.div
                    {...backdrop}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={(e) => e.target === e.currentTarget && onClose()}
                >

                    <motion.div
                        {...modal}
                        className="w-full max-w-lg rounded-2xl overflow-hidden"
                        style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
                    >

                        {/* Header */}
                        <div className="flex items-center justify-between p-6 pb-0">

                            <div className="flex items-center gap-3">

                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ background: 'var(--gradient-accent)' }}
                                >
                                    <Plus size={20} style={{ color: 'var(--color-bg-primary)' }} />
                                </div>

                                <div>
                                    <h2 className="text-h3">Add New Asset</h2>
                                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                        Search for an asset and add it to your portfolio
                                    </p>
                                </div>

                            </div>

                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors"
                                style={{ color: 'var(--color-text-muted)' }}
                            >
                                <X size={18} />
                            </button>

                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">

                            {/* Search */}
                            <div className="relative">

                                <label className="text-caption block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                                    <Search size={12} className="inline mr-1" />
                                    Ticker Symbol *
                                </label>

                                <input
                                    className="input-field"
                                    placeholder="Search asset (Apple, AAPL...)"
                                    value={query}
                                    onChange={(e) => {

                                        setQuery(e.target.value);

                                        // allow switching assets
                                        if (assetSelected) {
                                        setAssetSelected(false);

                                        setForm(prev => ({
                                            ...prev,
                                            ticker: '',
                                            name: '',
                                            assetType: 'stock',
                                            sector: 'Other',
                                            country: 'Global'
                                        }));
                                        }
                                    }}
                                />

                                {!assetSelected && (
                                    <p className="text-xs mt-1 text-muted">
                                        Select an asset from search results to autofill details
                                    </p>
                                )}

                                {loadingAsset && (
                                    <p className="text-xs mt-1 text-muted">
                                        Fetching asset details...
                                    </p>
                                )}

                                {showResults && results.length > 0 && (

                                    <div
                                        className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden z-50"
                                        style={{
                                            background: 'var(--color-bg-secondary)',
                                            border: '1px solid var(--color-border)',
                                        }}
                                    >

                                        {results.map((asset, index) => (

                                            <button
                                                key={`${asset.ticker}-${index}`}
                                                type="button"
                                                className="w-full text-left px-3 py-2 hover:bg-bg-tertiary text-sm"
                                                onClick={async () => {

                                                    try {

                                                        if (loadingAsset) return;

                                                        setLoadingAsset(true);

                                                        const metadata = await getAssetMetadata(asset.ticker);

                                                        console.log("metadata", metadata);

                                                        const normalizeType = (t?: string) => {

                                                        if (!t) return "stock";

                                                        const map: Record<string,string> = {
                                                            EQUITY: "stock",
                                                            ETF: "etf",
                                                            CRYPTOCURRENCY: "crypto",
                                                            CRYPTO: "crypto",
                                                            BOND: "bond",
                                                            CURRENCY: "currency",
                                                            FOREX: "currency",
                                                            MUTUALFUND: "fund"
                                                        };

                                                        return map[t.toUpperCase()] || "stock";

                                                        };

                                                        const normalizeSector = (s?: string) => {

                                                        if (!s) return "Other";

                                                        return SECTORS.includes(s) ? s : "Other";

                                                        };

                                                        const normalizeCountry = (c?: string) => {

                                                        if (!c) return "Global";

                                                        return COUNTRIES.includes(c) ? c : "Global";

                                                        };

                                                        setForm(prev => ({
                                                        ...prev,
                                                        ticker: metadata.ticker,
                                                        name: metadata.name || "",
                                                        assetType: normalizeType(metadata.assetType),
                                                        sector: normalizeSector(metadata.sector),
                                                        country: normalizeCountry(metadata.country)
                                                        }));

                                                        setAssetSelected(true);
                                                        setQuery(metadata.ticker);

                                                    } catch (err) {

                                                        console.error("Metadata fetch failed", err);

                                                    } finally {

                                                        setLoadingAsset(false);

                                                    }

                                                    setResults([]);
                                                    setShowResults(false);

                                                    }}
                                            >

                                                <div className="font-semibold">{asset.ticker}</div>
                                                <div className="text-xs text-muted">{asset.name}</div>

                                            </button>

                                        ))}

                                    </div>

                                )}

                            </div>

                            {/* Asset Name */}
                            <div>

                                <label className="text-caption block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                                    <Building2 size={12} className="inline mr-1" />
                                    Asset Name
                                </label>

                                <input
                                    className="input-field"
                                    value={form.name}
                                    disabled
                                />

                            </div>

                            {/* Asset Type */}
                            <div>

                                <label className="text-caption block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                                    <BarChart3 size={12} className="inline mr-1" />
                                    Asset Type
                                </label>

                                <div className="flex flex-wrap gap-1.5">

                                    {ASSET_TYPES.map((t) => (

                                        <button
                                            key={t}
                                            disabled
                                            type="button"
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize"
                                            style={{
                                                background: form.assetType === t ? 'var(--color-accent-teal)' : 'var(--color-bg-tertiary)',
                                                color: form.assetType === t ? 'var(--color-bg-primary)' : 'var(--color-text-secondary)',
                                            }}
                                        >
                                            {t}
                                        </button>

                                    ))}

                                </div>

                            </div>

                            {/* Sector + Country */}
                            <div className="grid grid-cols-2 gap-3">

                                <select className="input-field" value={form.sector} disabled>
                                    {SECTORS.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>

                                <select className="input-field" value={form.country} disabled>
                                    {COUNTRIES.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>

                            </div>

                            {/* Quantity + Cost */}
                            <div className="grid grid-cols-2 gap-3">

                                <input
                                    className="input-field"
                                    type="number"
                                    placeholder="Quantity"
                                    value={form.quantity || ''}
                                    onChange={(e) => update('quantity', parseFloat(e.target.value) || 0)}
                                />

                                <input
                                    className="input-field"
                                    type="number"
                                    placeholder="Avg Cost"
                                    value={form.avgCost || ''}
                                    onChange={(e) => update('avgCost', parseFloat(e.target.value) || 0)}
                                />

                            </div>

                            {error && (
                                <p className="text-xs font-medium px-3 py-2 rounded-lg"
                                   style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
                                    {error}
                                </p>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">

                                <button type="button" onClick={onClose} className="btn-secondary flex-1">
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                                >
                                    <Plus size={16} />
                                    {isSubmitting ? 'Adding...' : 'Add Asset'}
                                </button>

                            </div>

                        </form>

                    </motion.div>

                </motion.div>
            )}
        </AnimatePresence>
    );
}