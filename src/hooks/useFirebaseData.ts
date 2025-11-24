import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, appId } from '../lib/firebase';
import { Patient, Appointment, Payment } from '../types';

export const useFirebaseData = (user: User | null) => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loadingData, setLoadingData] = useState(false);

    useEffect(() => {
        if (!user) {
            setPatients([]);
            setAppointments([]);
            setPayments([]);
            return;
        }

        // MODO DEMO
        if (user.uid === 'demo-user') {
            setLoadingData(true);
            import('../lib/mockData').then(mock => {
                setPatients(mock.MOCK_PATIENTS);
                setAppointments(mock.MOCK_APPOINTMENTS);
                setPayments(mock.MOCK_PAYMENTS);
                setLoadingData(false);
            });
            return;
        }

        setLoadingData(true);
        const basePath = (c: string) => collection(db, 'artifacts', appId, 'users', user.uid, c);

        const unsubP = onSnapshot(basePath('patients'), s =>
            setPatients(s.docs.map(d => ({ id: d.id, ...d.data() } as Patient)))
        );
        const unsubA = onSnapshot(basePath('appointments'), s =>
            setAppointments(s.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)))
        );
        const unsubM = onSnapshot(basePath('payments'), s => {
            setPayments(s.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
            setLoadingData(false);
        });

        return () => { unsubP(); unsubA(); unsubM(); };
    }, [user]);

    return { patients, appointments, payments, loadingData };
};
