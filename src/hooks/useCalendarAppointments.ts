import { useMemo } from 'react';
import { User } from 'firebase/auth';
import { useData } from '../context/DataContext';

export const useCalendarAppointments = (user: User | null, startDate: string, endDate: string) => {
    // Use allAppointments for the calendar (shows all professionals)
    // The calendar has its own "Solo mis turnos" / "Todos los profesionales" filter
    const { allAppointments, loading } = useData();

    const filteredAppointments = useMemo(() => {
        return allAppointments.filter(a => a.date >= startDate && a.date <= endDate);
    }, [allAppointments, startDate, endDate]);

    return { appointments: filteredAppointments, loading };
};
