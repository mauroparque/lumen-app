import { useState, useEffect, useMemo } from 'react';
import { collection, doc, setDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db, CLINIC_ID, appId } from '../lib/firebase';
import { Appointment, Patient, PsiquePayment } from '../types';

const PSIQUE_RATE = 0.25; // 25% of the fee goes to Psique

interface PsiquePatientBreakdown {
    patientId: string;
    patientName: string;
    sessionCount: number;
    totalFee: number;
    psiqueAmount: number;
}

interface PsiqueMonthData {
    month: string;
    totalAmount: number;
    patientBreakdown: PsiquePatientBreakdown[];
    isPaid: boolean;
    paidDate?: string;
}

const PSIQUE_PAYMENTS_COLLECTION = `artifacts/${appId}/clinics/${CLINIC_ID}/psiquePayments`;

export const usePsiquePayments = (
    appointments: Appointment[],
    patients: Patient[],
    selectedMonth: Date,
    professionalName?: string, // NEW: filter by professional
) => {
    const [psiquePayments, setPsiquePayments] = useState<Record<string, PsiquePayment>>({});
    const [loading, setLoading] = useState(true);

    // Get patient IDs that are from Psique
    const psiquePatientIds = useMemo(() => {
        return new Set(patients.filter((p) => p.patientSource === 'psique').map((p) => p.id));
    }, [patients]);

    // Generate document key including professional name for isolation
    const getDocKey = (month: string, professional?: string) => {
        if (professional) {
            // Sanitize professional name for use as document ID part
            const safeName = professional.replace(/[\/\.#$\[\]]/g, '_');
            return `${month}_${safeName}`;
        }
        return month;
    };

    // Calculate monthly data
    const monthData = useMemo((): PsiqueMonthData => {
        const monthStr = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;

        // Filter paid appointments from Psique patients in selected month (excluding those marked to exclude)
        const psiqueAppointments = appointments.filter((a) => {
            if (!a.isPaid || a.status === 'cancelado') return false;
            if (!psiquePatientIds.has(a.patientId)) return false;
            if (a.excludeFromPsique) return false; // Skip excluded appointments
            return a.date.startsWith(monthStr);
        });

        // Group by patient
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

        const patientBreakdown = Object.values(patientMap).sort((a, b) => a.patientName.localeCompare(b.patientName));

        const totalAmount = patientBreakdown.reduce((sum, p) => sum + p.psiqueAmount, 0);

        // Get payment status from Firestore data (using professional-specific key)
        const docKey = getDocKey(monthStr, professionalName);
        const paymentRecord = psiquePayments[docKey];

        return {
            month: monthStr,
            totalAmount,
            patientBreakdown,
            isPaid: paymentRecord?.isPaid || false,
            paidDate: paymentRecord?.paidDate,
        };
    }, [appointments, psiquePatientIds, selectedMonth, psiquePayments, professionalName]);

    // Subscribe to Psique payments collection (filtered by professional if set)
    useEffect(() => {
        setLoading(true);

        const paymentsRef = collection(db, PSIQUE_PAYMENTS_COLLECTION);

        // If professional name is set, filter by it
        const paymentsQuery = professionalName
            ? query(paymentsRef, where('professional', '==', professionalName))
            : paymentsRef;

        const unsubscribe = onSnapshot(
            paymentsQuery,
            (snapshot) => {
                const data: Record<string, PsiquePayment> = {};
                snapshot.docs.forEach((doc) => {
                    data[doc.id] = { id: doc.id, ...doc.data() } as PsiquePayment;
                });
                setPsiquePayments(data);
                setLoading(false);
            },
            (error) => {
                console.error('Error fetching Psique payments:', error);
                setLoading(false);
            },
        );

        return () => unsubscribe();
    }, [professionalName]);

    // Mark month as paid (with professional isolation)
    const markAsPaid = async (month: string, isPaid: boolean) => {
        const docKey = getDocKey(month, professionalName);
        const docRef = doc(db, PSIQUE_PAYMENTS_COLLECTION, docKey);

        const data: Omit<PsiquePayment, 'id'> & { professional?: string } = {
            month,
            totalAmount: monthData.totalAmount,
            isPaid,
            professional: professionalName, // Store professional for filtering
            ...(isPaid ? { paidDate: new Date().toISOString().split('T')[0] } : {}),
        };

        await setDoc(docRef, data, { merge: true });
    };

    return {
        monthData,
        loading,
        markAsPaid,
        PSIQUE_RATE,
    };
};
