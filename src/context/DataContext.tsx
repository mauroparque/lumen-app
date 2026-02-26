import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Patient, Appointment, Payment } from '../types';
import { useService } from './ServiceContext';

interface DataContextType {
    patients: Patient[];
    appointments: Appointment[]; // Filtered by professional (for most views)
    allAppointments: Appointment[]; // All appointments (for agenda "Todos")
    payments: Payment[];
    loading: boolean;
}

function getDateWindow(): { start: string; end: string } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 6, 0);

    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
    };
}

const DataContext = createContext<DataContextType>({
    patients: [],
    appointments: [],
    allAppointments: [],
    payments: [],
    loading: true,
});

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }: { children: React.ReactNode }) => {
    const service = useService();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
    const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateWindow, setDateWindow] = useState(getDateWindow);

    useEffect(() => {
        const checkWindow = () => {
            const nextWindow = getDateWindow();

            setDateWindow((prevWindow) => {
                if (prevWindow.start !== nextWindow.start || prevWindow.end !== nextWindow.end) {
                    return nextWindow;
                }

                return prevWindow;
            });
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                checkWindow();
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);

        const interval = setInterval(checkWindow, 4 * 60 * 60 * 1000);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        if (!service) return;

        // 1. Subscribe to Patients (filtered by professional)
        const unsubPatients = service.subscribeToPatients((data) => {
            setPatients(data);
        });

        // All appointments (for agenda with "Todos los profesionales")
        const unsubAllAppointments = service.subscribeToAppointments(dateWindow.start, dateWindow.end, (data) => {
            setAllAppointments(data);
        });

        // My appointments only (filtered by professional)
        const unsubMyAppointments = service.subscribeToMyAppointments(dateWindow.start, dateWindow.end, (data) => {
            setMyAppointments(data);
            setLoading(false);
        });

        // 3. Subscribe to Finance (filtered by professional)
        const unsubFinance = service.subscribeToFinance(
            () => {}, // We don't need unpaid appointments here
            (paymentData) => {
                setPayments(paymentData);
            },
        );

        return () => {
            unsubPatients();
            unsubAllAppointments();
            unsubMyAppointments();
            unsubFinance();
        };
    }, [service, dateWindow]);

    // Memoize the context value to prevent unnecessary re-renders
    const value = useMemo(
        () => ({
            patients,
            appointments: myAppointments, // Default = filtered for backward compatibility
            allAppointments, // All appointments for agenda
            payments,
            loading,
        }),
        [patients, myAppointments, allAppointments, payments, loading],
    );

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
