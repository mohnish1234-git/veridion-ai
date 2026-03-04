import { useEffect } from "react";
import { useBehavioralStore } from "../state/behavioral.store";

export function useBehavioral() {
    const {
        scores,
        spending,
        adaptiveRisk,
        history,
        isLoading,
        fetchAll,
    } = useBehavioralStore();

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    return {
        scores,
        spending,
        adaptiveRisk,
        history,
        isLoading,
    };
}