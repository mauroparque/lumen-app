import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Patient } from '../types';
import { useService } from '../context/ServiceContext';

export const usePatients = (user: User | null) => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(false);
    const service = useService();

    useEffect(() => {
        if (!user || !service) {
            setPatients([]);
            return;
        }

        setLoading(true);
        // Subscribe
        const unsubscribe = service.subscribeToPatients((data: Patient[]) => {
            setPatients(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, service]);

    return { patients, loading };
};
