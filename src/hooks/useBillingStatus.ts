import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, appId, CLINIC_ID } from '../lib/firebase';

export interface BillingStatus {
    status: 'pending' | 'processing' | 'completed' | 'error' | 'error_sending' | 'error_config';
    invoiceUrl: string | null;
    invoiceNumber: string | null;
    loading: boolean;
    error?: string;
}

export const useBillingStatus = (requestId: string | null) => {
    const [state, setState] = useState<BillingStatus>({
        status: 'pending',
        invoiceUrl: null,
        invoiceNumber: null,
        loading: false,
        error: undefined,
    });

    useEffect(() => {
        if (!requestId) {
            setState((prev) => ({ ...prev, loading: false }));
            return;
        }

        setState((prev) => ({ ...prev, loading: true }));

        const docRef = doc(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'integrations', 'billing', 'queue', requestId);

        const unsubscribe = onSnapshot(
            docRef,
            (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setState({
                        status: data.status,
                        invoiceUrl: data.invoiceUrl || null,
                        invoiceNumber: data.invoiceNumber || null,
                        loading: data.status === 'pending' || data.status === 'processing',
                        error: data.error,
                    });
                } else {
                    // Handle case where doc doesn't exist yet or was deleted
                    setState((prev) => ({ ...prev, loading: true }));
                }
            },
            (error) => {
                console.error('Error listening to billing status:', error);
                setState({
                    status: 'error',
                    invoiceUrl: null,
                    invoiceNumber: null,
                    loading: false,
                    error: error.message,
                });
            },
        );

        return () => unsubscribe();
    }, [requestId]);

    return state;
};
