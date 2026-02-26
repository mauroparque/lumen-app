import { useState, useEffect } from 'react';
import { useService } from '../context/ServiceContext';
import type { BillingStatusData } from '../types';

export interface BillingStatus {
    status: BillingStatusData['status'];
    invoiceUrl: string | null;
    invoiceNumber: string | null;
    loading: boolean;
    error?: string;
}

export const useBillingStatus = (requestId: string | null) => {
    const service = useService();
    const [state, setState] = useState<BillingStatus>({
        status: 'pending',
        invoiceUrl: null,
        invoiceNumber: null,
        loading: false,
        error: undefined,
    });

    useEffect(() => {
        if (!requestId || !service) {
            setState((prev) => ({ ...prev, loading: false }));
            return;
        }

        setState((prev) => ({ ...prev, loading: true }));

        const unsubscribe = service.subscribeToBillingStatus(requestId, (data) => {
            setState({
                status: data.status,
                invoiceUrl: data.invoiceUrl || null,
                invoiceNumber: data.invoiceNumber || null,
                loading: data.status === 'pending' || data.status === 'processing',
                error: data.error,
            });
        });

        return () => unsubscribe();
    }, [requestId, service]);

    return state;
};
