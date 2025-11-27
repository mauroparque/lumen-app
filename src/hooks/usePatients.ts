import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, appId, CLINIC_ID } from '../lib/firebase';
import { Patient } from '../types';
import { MOCK_PATIENTS } from '../lib/mockData';

export const usePatients = (user: User | null) => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!user) {
            setPatients([]);
            return;
        }

        setLoading(true);

        // DEMO MODE
        if (user.uid === 'demo-user') {
            setPatients(MOCK_PATIENTS);
            setLoading(false);
            return;
        }

        // REAL FIRESTORE MODE
        const patientsRef = collection(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'patients');

        const unsubscribe = onSnapshot(patientsRef, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
            setPatients(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching patients:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    return { patients, loading };
};
