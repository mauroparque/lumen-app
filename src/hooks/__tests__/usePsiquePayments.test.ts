import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePsiquePayments } from '../usePsiquePayments';
import type { Appointment, Patient } from '../../types';

vi.mock('../../context/ServiceContext', () => ({
    useService: vi.fn(() => ({
        subscribeToPsiquePayments: vi.fn((_prof: string, cb: (payments: Record<string, unknown>) => void) => {
            cb({});
            return vi.fn();
        }),
        markPsiquePaymentAsPaid: vi.fn(),
    })),
}));

vi.mock('../../context/DataContext', () => ({
    useData: vi.fn(() => ({
        appointments: [],
        patients: [],
    })),
}));

const makePatient = (overrides: Partial<Patient> = {}): Patient => ({
    id: 'p-1',
    name: 'Test Patient',
    phone: '1234567890',
    email: 'test@test.com',
    isActive: true,
    professional: 'Dr. Test',
    fee: 10000,
    patientSource: 'particular',
    ...overrides,
});

const makeAppointment = (overrides: Partial<Appointment> = {}): Appointment => ({
    id: 'a-1',
    patientId: 'p-1',
    patientName: 'Test Patient',
    professional: 'Dr. Test',
    date: '2026-02-15',
    time: '10:00',
    duration: 50,
    type: 'presencial',
    status: 'completado',
    isPaid: true,
    price: 10000,
    ...overrides,
});

describe('usePsiquePayments', () => {
    const selectedMonth = new Date(2026, 1); // February 2026

    it('returns zero totals when no psique patients exist', () => {
        const patients = [makePatient({ patientSource: 'particular' })];
        const appointments = [makeAppointment({ isPaid: true })];

        const { result } = renderHook(() =>
            usePsiquePayments(appointments, patients, selectedMonth),
        );

        expect(result.current.monthData.totalAmount).toBe(0);
        expect(result.current.monthData.patientBreakdown).toEqual([]);
    });

    it('calculates 25% fee for psique patient appointments', () => {
        const patients = [makePatient({ id: 'p-1', patientSource: 'psique' })];
        const appointments = [
            makeAppointment({
                patientId: 'p-1',
                date: '2026-02-10',
                isPaid: true,
                price: 10000,
            }),
        ];

        const { result } = renderHook(() =>
            usePsiquePayments(appointments, patients, selectedMonth),
        );

        expect(result.current.monthData.totalAmount).toBe(2500);
        expect(result.current.monthData.patientBreakdown).toHaveLength(1);
        expect(result.current.monthData.patientBreakdown[0].psiqueAmount).toBe(2500);
    });

    it('excludes unpaid appointments', () => {
        const patients = [makePatient({ id: 'p-1', patientSource: 'psique' })];
        const appointments = [
            makeAppointment({ patientId: 'p-1', date: '2026-02-10', isPaid: false, price: 10000 }),
        ];

        const { result } = renderHook(() =>
            usePsiquePayments(appointments, patients, selectedMonth),
        );

        expect(result.current.monthData.totalAmount).toBe(0);
    });

    it('excludes cancelled appointments', () => {
        const patients = [makePatient({ id: 'p-1', patientSource: 'psique' })];
        const appointments = [
            makeAppointment({
                patientId: 'p-1',
                date: '2026-02-10',
                isPaid: true,
                status: 'cancelado',
                price: 10000,
            }),
        ];

        const { result } = renderHook(() =>
            usePsiquePayments(appointments, patients, selectedMonth),
        );

        expect(result.current.monthData.totalAmount).toBe(0);
    });

    it('respects excludeFromPsique flag on individual appointments', () => {
        const patients = [makePatient({ id: 'p-1', patientSource: 'psique' })];
        const appointments = [
            makeAppointment({
                patientId: 'p-1',
                date: '2026-02-10',
                isPaid: true,
                price: 10000,
                excludeFromPsique: true,
            }),
        ];

        const { result } = renderHook(() =>
            usePsiquePayments(appointments, patients, selectedMonth),
        );

        expect(result.current.monthData.totalAmount).toBe(0);
    });

    it('filters appointments by selected month', () => {
        const patients = [makePatient({ id: 'p-1', patientSource: 'psique' })];
        const appointments = [
            makeAppointment({ patientId: 'p-1', date: '2026-02-10', isPaid: true, price: 10000 }),
            makeAppointment({ id: 'a-2', patientId: 'p-1', date: '2026-03-10', isPaid: true, price: 8000 }),
        ];

        const { result } = renderHook(() =>
            usePsiquePayments(appointments, patients, selectedMonth),
        );

        expect(result.current.monthData.totalAmount).toBe(2500);
    });

    it('aggregates multiple sessions per patient', () => {
        const patients = [makePatient({ id: 'p-1', patientSource: 'psique' })];
        const appointments = [
            makeAppointment({ id: 'a-1', patientId: 'p-1', date: '2026-02-05', isPaid: true, price: 10000 }),
            makeAppointment({ id: 'a-2', patientId: 'p-1', date: '2026-02-12', isPaid: true, price: 10000 }),
            makeAppointment({ id: 'a-3', patientId: 'p-1', date: '2026-02-19', isPaid: true, price: 10000 }),
        ];

        const { result } = renderHook(() =>
            usePsiquePayments(appointments, patients, selectedMonth),
        );

        expect(result.current.monthData.totalAmount).toBe(7500);
        expect(result.current.monthData.patientBreakdown[0].sessionCount).toBe(3);
    });

    it('sorts patient breakdown alphabetically', () => {
        const patients = [
            makePatient({ id: 'p-1', name: 'Zara', patientSource: 'psique' }),
            makePatient({ id: 'p-2', name: 'Ana', patientSource: 'psique' }),
        ];
        const appointments = [
            makeAppointment({ id: 'a-1', patientId: 'p-1', patientName: 'Zara', date: '2026-02-10', isPaid: true, price: 5000 }),
            makeAppointment({ id: 'a-2', patientId: 'p-2', patientName: 'Ana', date: '2026-02-10', isPaid: true, price: 5000 }),
        ];

        const { result } = renderHook(() =>
            usePsiquePayments(appointments, patients, selectedMonth),
        );

        expect(result.current.monthData.patientBreakdown[0].patientName).toBe('Ana');
        expect(result.current.monthData.patientBreakdown[1].patientName).toBe('Zara');
    });

    it('exposes PSIQUE_RATE constant as 0.25', () => {
        const { result } = renderHook(() =>
            usePsiquePayments([], [], selectedMonth),
        );

        expect(result.current.PSIQUE_RATE).toBe(0.25);
    });
});
