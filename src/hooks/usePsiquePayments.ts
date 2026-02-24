import { useState, useEffect, useMemo, useCallback } from 'react';
import { useService } from '../context/ServiceContext';
import { useData } from '../context/DataContext';
import { Appointment, Patient, PsiquePayment } from '../types';
import {
    PSIQUE_RATE,
    calculatePsiqueMonthData,
    type PsiqueMonthData,
    type PsiquePatientBreakdown,
} from '../lib/psiqueCalculations';

export type { PsiqueMonthData, PsiquePatientBreakdown };
export { PSIQUE_RATE };

const getDocKey = (month: string, professional?: string): string => {
    if (professional) {
        const safeName = professional.replace(/[/.#$[\]]/g, '_');
        return `${month}_${safeName}`;
    }
    return month;
};

export function usePsiquePayments(
    appointments: Appointment[],
    patients: Patient[],
    selectedMonth: Date,
    professionalName?: string,
) {
    const service = useService();
    const { appointments: contextAppointments } = useData();
    const [psiquePayments, setPsiquePayments] = useState<Record<string, PsiquePayment>>({});
    const [loading, setLoading] = useState(true);

    const psiquePatientIds = useMemo(() => {
        return new Set(patients.filter((p) => p.patientSource === 'psique').map((p) => p.id));
    }, [patients]);

    const effectiveAppointments = appointments?.length ? appointments : contextAppointments;

    const monthData = useMemo(
        () =>
            calculatePsiqueMonthData(
                effectiveAppointments,
                psiquePatientIds,
                selectedMonth,
                psiquePayments,
                professionalName,
            ),
        [effectiveAppointments, psiquePatientIds, selectedMonth, psiquePayments, professionalName],
    );

    useEffect(() => {
        if (!service) return;
        setLoading(true);

        const unsub = service.subscribeToPsiquePayments(professionalName, (payments) => {
            setPsiquePayments(payments);
            setLoading(false);
        });

        return unsub;
    }, [service, professionalName]);

    const markAsPaid = useCallback(
        async (month: string, isPaid: boolean) => {
            if (!service) throw new Error('Service not available');
            const docKey = getDocKey(month, professionalName);
            const data: Omit<PsiquePayment, 'id'> & { professional?: string } = {
                month,
                totalAmount: monthData.totalAmount,
                isPaid,
                professional: professionalName,
                ...(isPaid ? { paidDate: new Date().toISOString().split('T')[0] } : {}),
            };
            return service.markPsiquePaymentAsPaid(docKey, data);
        },
        [service, professionalName, monthData],
    );

    return {
        monthData,
        loading,
        markAsPaid,
        PSIQUE_RATE,
    };
}
