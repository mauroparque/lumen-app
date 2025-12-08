import { useMemo } from 'react';
import { User } from 'firebase/auth';
import { useData } from '../context/DataContext';

export const useCalendarAppointments = (user: User | null, startDate: string, endDate: string) => {
    const { appointments, loading } = useData();

    const filteredAppointments = useMemo(() => {
        return appointments.filter(a => a.date >= startDate && a.date <= endDate);
    }, [appointments, startDate, endDate]);

    return { appointments: filteredAppointments, loading };
};
