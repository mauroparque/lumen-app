import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, appId } from '../lib/firebase';
import { Appointment } from '../types';
import { MOCK_APPOINTMENTS } from '../lib/mockData';

export const useCalendarAppointments = (user: User | null, startDate: string, endDate: string) => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!user) {
            setAppointments([]);
            return;
        }

        setLoading(true);

        // DEMO MODE
        if (user.uid === 'demo-user') {
            // Filter mock appointments by date range
            const filtered = MOCK_APPOINTMENTS.filter(app =>
                app.date >= startDate && app.date <= endDate
            );
            setAppointments(filtered);
            setLoading(false);
            return;
        }

        // REAL FIRESTORE MODE
        const appointmentsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'appointments');
        const q = query(
            appointmentsRef,
            where('date', '>=', startDate),
            where('date', '<=', endDate)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const appts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Appointment));
            setAppointments(appts);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching appointments:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, startDate, endDate]);

    return { appointments, loading };
};
