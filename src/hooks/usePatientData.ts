import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, appId, CLINIC_ID } from '../lib/firebase';
import { Appointment, Payment } from '../types';

interface PatientStats {
    totalDebt: number;
    totalPaid: number;
    lastVisit: Date | null;
}

export const usePatientData = (user: User | null, patientId: string | undefined) => {
    const [history, setHistory] = useState<Appointment[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<PatientStats>({ totalDebt: 0, totalPaid: 0, lastVisit: null });

    useEffect(() => {
        if (!user || !patientId) {
            setLoading(false);
            return;
        }

        setLoading(true);

        // 1. Fetch Appointments History
        const appointmentsQuery = query(
            collection(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'appointments'),
            where('patientId', '==', patientId),
            orderBy('date', 'desc'),
            orderBy('time', 'desc'),
        );

        const unsubscribeAppointments = onSnapshot(appointmentsQuery, (snapshot) => {
            const appts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Appointment);
            setHistory(appts);
        });

        // 2. Fetch Payments
        const paymentsQuery = query(
            collection(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'payments'),
            where('patientId', '==', patientId),
            orderBy('date', 'desc'),
        );

        const unsubscribePayments = onSnapshot(paymentsQuery, (snapshot) => {
            const pays = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Payment);
            setPayments(pays);
        });

        return () => {
            unsubscribeAppointments();
            unsubscribePayments();
        };
    }, [user, patientId]);

    // Calculate Stats whenever history or payments change
    useEffect(() => {
        if (!history.length && !payments.length) {
            setLoading(false);
            return;
        }

        let debt = 0;
        let paid = 0;
        let lastVisitDate: Date | null = null;

        // Calculate Debt from unpaid past appointments
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];

        history.forEach((appt) => {
            const apptDate = new Date(appt.date + 'T' + appt.time);

            // Update last visit
            if (apptDate < now && (!lastVisitDate || apptDate > lastVisitDate)) {
                lastVisitDate = apptDate;
            }

            // Only count debt if:
            // 1. Not paid
            // 2. Date is strictly before today (past)
            // 3. Status is not cancelled (unless chargeOnCancellation is true)
            if (!appt.isPaid && appt.date < today && appt.price) {
                // Cancelados sin cobro no generan deuda
                if (appt.status === 'cancelado' && !appt.chargeOnCancellation) {
                    return; // skip this appointment
                }
                debt += appt.price;
            }
        });

        // Calculate Total Paid
        payments.forEach((pay) => {
            paid += pay.amount;
        });

        setStats({
            totalDebt: debt,
            totalPaid: paid,
            lastVisit: lastVisitDate,
        });
        setLoading(false);
    }, [history, payments]);

    return { history, payments, loading, stats };
};
