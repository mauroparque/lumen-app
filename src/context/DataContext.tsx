import React, { createContext, useContext, useState, useEffect } from 'react';
import { Patient, Appointment } from '../types';
import { useService } from './ServiceContext';

interface DataContextType {
    patients: Patient[];
    appointments: Appointment[];
    loading: boolean;
}

const DataContext = createContext<DataContextType>({
    patients: [],
    appointments: [],
    loading: true,
});

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }: { children: React.ReactNode }) => {
    const service = useService();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!service) return;

        // 1. Subscribe to Patients (Initial Load)
        const unsubPatients = service.subscribeToPatients((data) => {
            setPatients(data);
        });

        // 2. Subscribe to Appointments
        // Window: -3 months to +6 months
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 6, 0);

        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        const unsubAppointments = service.subscribeToAppointments(startStr, endStr, (data) => {
            setAppointments(data);
            setLoading(false); // Assume initial load implies mostly both are ready or close enough
        });

        return () => {
            unsubPatients();
            unsubAppointments();
        };
    }, [service]);

    return (
        <DataContext.Provider value={{ patients, appointments, loading }}>
            {children}
        </DataContext.Provider>
    );
};
