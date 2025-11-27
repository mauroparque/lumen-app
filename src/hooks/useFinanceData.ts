import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, appId } from '../lib/firebase';
import { Appointment, Payment } from '../types';
import { MOCK_APPOINTMENTS, MOCK_PAYMENTS } from '../lib/mockData';

export const useFinanceData = (user: User | null) => {
    const [debts, setDebts] = useState<Appointment[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!user) {
            setDebts([]);
            setPayments([]);
            return;
        }

        setLoading(true);

        // DEMO MODE
        if (user.uid === 'demo-user') {
            // Debts: Unpaid appointments that are not cancelled
            // Note: In real app we also check date < today, but for debts list we usually want all unpaid
            const unpaid = MOCK_APPOINTMENTS.filter(a => !a.isPaid && a.status !== 'cancelado');
            setDebts(unpaid);
            setPayments(MOCK_PAYMENTS);
            setLoading(false);
            return;
        }

        // REAL FIRESTORE MODE
        const appointmentsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'appointments');
        const paymentsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'payments');

        // Query 1: Debts (Unpaid appointments)
        // Note: This might require a composite index if we add more filters or sorting
        const debtsQuery = query(
            appointmentsRef,
            where('isPaid', '==', false),
            where('status', '!=', 'cancelado')
        );

        // Query 2: Payments (Last 50)
        const paymentsQuery = query(
            paymentsRef,
            orderBy('date', 'desc'),
            limit(50)
        );

        const unsubDebts = onSnapshot(debtsQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
            // Client-side sort by date descending for display
            data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setDebts(data);
        });

        const unsubPayments = onSnapshot(paymentsQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
            setPayments(data);
            setLoading(false); // Assume loading done when payments arrive (or both)
        });

        return () => {
            unsubDebts();
            unsubPayments();
        };
    }, [user]);

    return { debts, payments, loading };
};
