import { useState, useEffect, useMemo, useCallback } from 'react';
import { useService } from '../context/ServiceContext';
import { useData } from '../context/DataContext';
import { Appointment, Patient, PsiquePayment } from '../types';

export const PSIQUE_RATE = 0.25;

export interface PsiquePatientBreakdown {
    patientId: string;
    patientName: string;
    sessionCount: number;
    totalFee: number;
    psiqueAmount: number;
}

export interface PsiqueMonthData {
    month: string;
    totalAmount: number;
    patientBreakdown: PsiquePatientBreakdown[];
    isPaid: boolean;
    paidDate?: string;
}

const getDocKey = (month: string, professional?: string) => {
    if (professional) {
        const safeName = professional.replace(/[/.#$[\]]/g, '_');
        return `${month}_${safeName}`;
    }
    return month;
};

export function calculatePsiqueMonthData(
    appointments: Appointment[],
    psiquePatientIds: Set<string>,
    selectedMonth: Date,
    psiquePayments: Record<string, PsiquePayment>,
    professionalName?: string,
): PsiqueMonthData {
    const monthStr = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;

    const psiqueAppointments = appointments.filter((a) => {
        if (!a.isPaid || a.status === 'cancelado') return false;
        if (!psiquePatientIds.has(a.patientId)) return false;
        if (a.excludeFromPsique) return false;
        return a.date.startsWith(monthStr);
    });

    const patientMap: Record<string, PsiquePatientBreakdown> = {};

    psiqueAppointments.forEach((appt) => {
        if (!patientMap[appt.patientId]) {
            patientMap[appt.patientId] = {
                patientId: appt.patientId,
                patientName: appt.patientName,
                sessionCount: 0,
                totalFee: 0,
                psiqueAmount: 0,
            };
        }

        const fee = appt.price || 0;
        patientMap[appt.patientId].sessionCount++;
        patientMap[appt.patientId].totalFee += fee;
        patientMap[appt.patientId].psiqueAmount += fee * PSIQUE_RATE;
    });

    const patientBreakdown = Object.values(patientMap).sort((a, b) =>
        a.patientName.localeCompare(b.patientName),
    );
    const totalAmount = patientBreakdown.reduce((sum, p) => sum + p.psiqueAmount, 0);

    const docKey = getDocKey(monthStr, professionalName);
    const paymentRecord = psiquePayments[docKey];

    return {
        month: monthStr,
        totalAmount,
        patientBreakdown,
        isPaid: paymentRecord?.isPaid || false,
        paidDate: paymentRecord?.paidDate,
    };
}

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
