import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAgendaStats } from '../useAgendaStats';
import type { Appointment, Patient } from '../../types';

const makePatient = (overrides: Partial<Patient> = {}): Patient => ({
    id: 'p-1',
    name: 'Test Patient',
    phone: '1234567890',
    email: 'test@test.com',
    isActive: true,
    professional: 'Dr. Test',
    fee: 5000,
    patientSource: 'particular',
    ...overrides,
});

const makeAppointment = (overrides: Partial<Appointment> = {}): Appointment => ({
    id: 'a-1',
    patientId: 'p-1',
    patientName: 'Test Patient',
    professional: 'Dr. Test',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    duration: 50,
    type: 'presencial',
    status: 'completado',
    isPaid: false,
    ...overrides,
});

describe('useAgendaStats', () => {
    it('returns zero stats for empty data', () => {
        const { result } = renderHook(() => useAgendaStats([], []));

        expect(result.current.totalPatients).toBe(0);
        expect(result.current.totalCompletedSessions).toBe(0);
        expect(result.current.patientStats).toEqual([]);
    });

    it('counts active patients correctly', () => {
        const patients = [
            makePatient({ id: 'p-1', isActive: true }),
            makePatient({ id: 'p-2', isActive: true }),
            makePatient({ id: 'p-3', isActive: false }),
        ];

        const { result } = renderHook(() => useAgendaStats([], patients));
        expect(result.current.totalPatients).toBe(2);
    });

    it('calculates completed sessions from appointments', () => {
        const appointments = [
            makeAppointment({ id: 'a-1', status: 'completado' }),
            makeAppointment({ id: 'a-2', status: 'presente' }),
            makeAppointment({ id: 'a-3', status: 'ausente' }),
            makeAppointment({ id: 'a-4', status: 'cancelado' }),
            makeAppointment({ id: 'a-5', status: 'programado' }),
        ];

        const { result } = renderHook(() => useAgendaStats(appointments, []));
        expect(result.current.totalCompletedSessions).toBe(2);
        expect(result.current.totalScheduledAppointments).toBe(4);
    });

    it('calculates no-show and cancellation rates', () => {
        const appointments = [
            makeAppointment({ id: 'a-1', status: 'completado' }),
            makeAppointment({ id: 'a-2', status: 'ausente' }),
            makeAppointment({ id: 'a-3', status: 'ausente' }),
            makeAppointment({ id: 'a-4', status: 'cancelado' }),
        ];

        const { result } = renderHook(() => useAgendaStats(appointments, []));
        expect(result.current.noShowRate).toBe(0.5);
        expect(result.current.cancellationRate).toBe(0.25);
    });

    it('calculates patient stats for active patients', () => {
        const patients = [
            makePatient({ id: 'p-1', name: 'Alice', fee: 5000, patientSource: 'particular' }),
            makePatient({ id: 'p-2', name: 'Bob', fee: 6000, patientSource: 'psique' }),
        ];
        const appointments = [
            makeAppointment({ patientId: 'p-1', status: 'completado', price: 5000 }),
            makeAppointment({ patientId: 'p-1', status: 'completado', price: 5000 }),
            makeAppointment({ patientId: 'p-2', status: 'completado', price: 6000 }),
        ];

        const { result } = renderHook(() => useAgendaStats(appointments, patients));
        expect(result.current.patientStats).toHaveLength(2);
        expect(result.current.avgFee).toBe(5500);
    });

    it('identifies psique patients correctly', () => {
        const patients = [
            makePatient({ id: 'p-1', name: 'Alice', patientSource: 'psique' }),
            makePatient({ id: 'p-2', name: 'Bob', patientSource: 'particular' }),
        ];

        const { result } = renderHook(() => useAgendaStats([], patients));
        const alice = result.current.patientStats.find((p) => p.patientId === 'p-1');
        const bob = result.current.patientStats.find((p) => p.patientId === 'p-2');

        expect(alice?.isPsique).toBe(true);
        expect(bob?.isPsique).toBe(false);
    });
});
