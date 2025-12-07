import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Appointment } from '../types';
import { useService } from '../context/ServiceContext';

export interface PatientBillingSummary {
    patientId: string;
    patientName: string;
    patientEmail?: string;
    sessionCount: number;
    totalAmount: number;
    status: 'ready_to_bill' | 'partial' | 'completed';
    appointmentIds: string[];
    appointments: Appointment[];
}

export const useFinanceData = (user: User | null, selectedDate: Date = new Date()) => {
    const [summary, setSummary] = useState<PatientBillingSummary[]>([]);
    const [allUnpaidAppointments, setAllUnpaidAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(false);
    const service = useService();

    // Logic for Dashboard Summary (Monthly)
    useEffect(() => {
        if (!user || !service) return;

        setLoading(true);

        const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        const unsubscribe = service.subscribeToAppointments(startStr, endStr, (appointments) => {
            const activeAppointments = appointments.filter(a => a.status !== 'cancelado');

            // Group by patient
            const grouped = activeAppointments.reduce((acc, appt) => {
                if (!acc[appt.patientId]) {
                    acc[appt.patientId] = {
                        patientId: appt.patientId,
                        patientName: appt.patientName,
                        patientEmail: appt.patientEmail,
                        sessionCount: 0,
                        totalAmount: 0,
                        status: 'ready_to_bill',
                        appointmentIds: [],
                        appointments: []
                    };
                }

                acc[appt.patientId].sessionCount++;
                acc[appt.patientId].totalAmount += (appt.price || 0);
                acc[appt.patientId].appointmentIds.push(appt.id);
                acc[appt.patientId].appointments.push(appt);

                return acc;
            }, {} as Record<string, PatientBillingSummary>);

            // Calculate overall status per patient
            const result = Object.values(grouped).map(summary => {
                const totalAppts = summary.appointments.length;
                const invoicedCount = summary.appointments.filter(a => a.billingStatus === 'invoiced').length;

                if (invoicedCount === totalAppts && totalAppts > 0) {
                    summary.status = 'completed';
                } else if (invoicedCount > 0) {
                    summary.status = 'partial';
                } else {
                    summary.status = 'ready_to_bill';
                }

                return summary;
            });

            setSummary(result);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, service, selectedDate]);

    // Logic for Global Debts (Sidebar Notification)
    useEffect(() => {
        if (!user || !service) return;

        const unsubscribe = service.subscribeToFinance(
            (unpaidData) => setAllUnpaidAppointments(unpaidData),
            () => { } // We don't need payments here for now
        );

        return () => unsubscribe();
    }, [user, service]);

    return { summary, loading, allUnpaidAppointments };
};
