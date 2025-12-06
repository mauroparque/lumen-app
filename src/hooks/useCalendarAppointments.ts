import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Appointment } from '../types';
import { useService } from '../context/ServiceContext';

export const useCalendarAppointments = (user: User | null, startDate: string, endDate: string) => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(false);
    const service = useService();

    useEffect(() => {
        if (!user || !service) {
            setAppointments([]);
            return;
        }

        setLoading(true);

        const unsubscribe = service.subscribeToAppointments(startDate, endDate, (data) => {
            setAppointments(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, service, startDate, endDate]);

    return { appointments, loading };
};
