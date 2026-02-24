/**
 * Pure calculation logic for Psique Salud Mental partnership billing.
 *
 * Kept separate from the hook so this business logic can be unit-tested
 * without React / jsdom overhead.
 */
import { Appointment, PsiquePayment } from '../types';

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

export const getDocKey = (month: string, professional?: string): string => {
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
        if (!a.isPaid) return false;
        if (a.status === 'cancelado' && !a.chargeOnCancellation) return false;
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
