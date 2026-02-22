import { useState, useEffect } from 'react';
import { useService } from '../context/ServiceContext';
import type { Appointment, Payment } from '../types';

interface PatientStats {
    totalDebt: number;
    totalPaid: number;
    lastVisit: Date | null;
}

export function usePatientData(patientId: string | null) {
    const service = useService();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<PatientStats>({ totalDebt: 0, totalPaid: 0, lastVisit: null });

    useEffect(() => {
        if (!service || !patientId) {
            setAppointments([]);
            setPayments([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const unsubAppointments = service.subscribeToPatientAppointments(patientId, (data) => {
            setAppointments(data);
        });

        const unsubPayments = service.subscribeToPatientPayments(patientId, (data) => {
            setPayments(data);
        });

        return () => {
            unsubAppointments();
            unsubPayments();
        };
    }, [service, patientId]);

    useEffect(() => {
        if (!appointments.length && !payments.length) {
            setLoading(false);
            return;
        }

        let debt = 0;
        let paid = 0;
        let lastVisitDate: Date | null = null;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];

        appointments.forEach((appt) => {
            const apptDate = new Date(appt.date + 'T' + appt.time);

            if (apptDate < now && (!lastVisitDate || apptDate > lastVisitDate)) {
                lastVisitDate = apptDate;
            }

            if (!appt.isPaid && appt.date < today && appt.price) {
                if (appt.status === 'cancelado' && !appt.chargeOnCancellation) {
                    return;
                }
                debt += appt.price;
            }
        });

        payments.forEach((pay) => {
            paid += pay.amount;
        });

        setStats({
            totalDebt: debt,
            totalPaid: paid,
            lastVisit: lastVisitDate,
        });
        setLoading(false);
    }, [appointments, payments]);

    return { history: appointments, payments, loading, stats };
}
