import { useMemo } from 'react';
import { Appointment, Patient } from '../types';

const PERIOD_MONTHS = 3;
const PSIQUE_RATE = 0.25;

export interface PatientStats {
    patientId: string;
    patientName: string;
    avgSessions: number; // Promedio sesiones por mes
    totalSessions: number; // Total sesiones en período
    fee: number; // Honorario actual
    isPsique: boolean;
}

export interface AgendaStats {
    // Por paciente
    patientStats: PatientStats[];

    // Globales
    avgSessionsPerPatient: number; // Promedio general de sesiones por mes
    avgFee: number; // Promedio honorarios
    avgSessionValue: number; // Valor real por sesión cobrada
    noShowRate: number; // Tasa ausentismo (0-1)
    cancellationRate: number; // Tasa cancelación (0-1)

    // Metadata
    periodMonths: number; // Período analizado (3)
    totalPatients: number;
    totalCompletedSessions: number;
    totalScheduledAppointments: number;

    // Debug info
    periodStart: string;
    periodEnd: string;
}

export const useAgendaStats = (appointments: Appointment[], patients: Patient[]): AgendaStats => {
    return useMemo(() => {
        // Calculate date range: from 3 months ago to today
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        // Start from 3 months ago, first day of that month
        const periodStart = new Date(now.getFullYear(), now.getMonth() - PERIOD_MONTHS, 1);
        const periodStartStr = periodStart.toISOString().split('T')[0];

        // End is today (include current month data)
        const periodEndStr = today;

        // Filter appointments in the period that are completed (not future)
        const periodAppointments = appointments.filter((a) => {
            // Only include appointments in the date range
            if (a.date < periodStartStr || a.date > periodEndStr) return false;
            return true;
        });

        // Create a map of active patients
        const activePatients = patients.filter((p) => p.isActive);
        const psiquePatientIds = new Set(patients.filter((p) => p.patientSource === 'psique').map((p) => p.id));

        // Count appointments by status
        let totalScheduled = 0;
        let totalCompleted = 0; // completado, presente, or isPaid
        let totalNoShow = 0; // ausente
        let totalCancelled = 0; // cancelado
        let totalRevenue = 0;

        // Group sessions by patient
        const sessionsByPatient: Record<string, { count: number; revenue: number }> = {};

        periodAppointments.forEach((appt) => {
            totalScheduled++;

            // Consider an appointment as "completed" if status is completado/presente OR if it's paid
            const isCompleted = appt.status === 'completado' || appt.status === 'presente' || appt.isPaid;

            if (isCompleted) {
                totalCompleted++;
                const revenue = appt.price || 0;
                totalRevenue += revenue;

                if (!sessionsByPatient[appt.patientId]) {
                    sessionsByPatient[appt.patientId] = { count: 0, revenue: 0 };
                }
                sessionsByPatient[appt.patientId].count++;
                sessionsByPatient[appt.patientId].revenue += revenue;
            } else if (appt.status === 'ausente') {
                totalNoShow++;
            } else if (appt.status === 'cancelado') {
                totalCancelled++;
            }
        });

        // Calculate per-patient stats for active patients
        const patientStats: PatientStats[] = activePatients
            .map((patient) => {
                const sessions = sessionsByPatient[patient.id] || { count: 0, revenue: 0 };
                const avgSessions = sessions.count / PERIOD_MONTHS;

                return {
                    patientId: patient.id,
                    patientName: patient.name,
                    avgSessions: Math.round(avgSessions * 10) / 10, // 1 decimal
                    totalSessions: sessions.count,
                    fee: patient.fee || 0,
                    isPsique: psiquePatientIds.has(patient.id),
                };
            })
            .sort((a, b) => a.patientName.localeCompare(b.patientName));

        // Calculate global averages
        // Only count patients who actually had sessions
        const patientsWithSessions = Object.keys(sessionsByPatient).length;

        // Average sessions per patient per month
        const avgSessionsPerPatient =
            patientsWithSessions > 0
                ? Math.round((totalCompleted / patientsWithSessions / PERIOD_MONTHS) * 10) / 10
                : 4; // Default to 4 if no data

        // Average fee from active patients with fees
        const patientsWithFees = activePatients.filter((p) => (p.fee || 0) > 0);
        const totalFees = patientsWithFees.reduce((sum, p) => sum + (p.fee || 0), 0);
        const avgFee = patientsWithFees.length > 0 ? Math.round(totalFees / patientsWithFees.length) : 0;

        // Average value per session (actual revenue)
        const avgSessionValue = totalCompleted > 0 ? Math.round(totalRevenue / totalCompleted) : avgFee;

        // Rates (exclude programado from calculations since those are future)
        const relevantTotal = totalCompleted + totalNoShow + totalCancelled;

        const noShowRate = relevantTotal > 0 ? Math.round((totalNoShow / relevantTotal) * 1000) / 1000 : 0;

        const cancellationRate = relevantTotal > 0 ? Math.round((totalCancelled / relevantTotal) * 1000) / 1000 : 0;

        return {
            patientStats,
            avgSessionsPerPatient,
            avgFee,
            avgSessionValue,
            noShowRate,
            cancellationRate,
            periodMonths: PERIOD_MONTHS,
            totalPatients: activePatients.length,
            totalCompletedSessions: totalCompleted,
            totalScheduledAppointments: relevantTotal,
            periodStart: periodStartStr,
            periodEnd: periodEndStr,
        };
    }, [appointments, patients]);
};

// Helper to calculate projected income for a patient
export const calculateProjectedIncome = (
    fee: number,
    sessions: number,
    isPsique: boolean,
    excludeFromPsique: boolean = false,
): { gross: number; net: number; psiqueDiscount: number } => {
    const gross = fee * sessions;
    const applyDiscount = isPsique && !excludeFromPsique;
    const psiqueDiscount = applyDiscount ? gross * PSIQUE_RATE : 0;
    const net = gross - psiqueDiscount;

    return { gross, net, psiqueDiscount };
};
