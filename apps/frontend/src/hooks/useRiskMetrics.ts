import { useEffect } from 'react';
import { useRiskStore } from '../state/risk.store';
import { useAuthStore } from '../state/auth.store';

export function useRiskMetrics() {
    const store = useRiskStore();
    const userId = useAuthStore((s) => s.user?.id);

    useEffect(() => {
        store.fetchAll();
    }, [userId]); // refetch if user changes

    return store;
}