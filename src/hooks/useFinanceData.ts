import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Appointment, Payment } from '../types';
import { useService } from '../context/ServiceContext';

export const useFinanceData = (user: User | null) => {
    const [unpaidAppointments, setUnpaidAppointments] = useState<Appointment[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(false);
    const service = useService();

    useEffect(() => {
        if (!user || !service) {
            setUnpaidAppointments([]);
            setPayments([]);
            return;
        }

        setLoading(true);

        const unsubscribe = service.subscribeToFinance(
            (unpaidData) => setUnpaidAppointments(unpaidData),
            (paymentsData) => {
                setPayments(paymentsData);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user, service]);

    return { unpaidAppointments, payments, loading };
};
