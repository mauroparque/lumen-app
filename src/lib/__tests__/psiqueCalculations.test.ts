import { describe, it, expect } from 'vitest';

import {
    calculatePsiqueMonthData,
    PSIQUE_RATE,
} from '../psiqueCalculations';
import type { Appointment, PsiquePayment } from '../../types';

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

const selectedMonth = new Date(2026, 1); // February 2026
const emptyPayments: Record<string, PsiquePayment> = {};

describe('calculatePsiqueMonthData', () => {
    it('returns zero totals when no psique patients exist', () => {
        const psiqueIds = new Set<string>(); // no psique patients
        const appointments = [makeAppointment({ isPaid: true })];

        const result = calculatePsiqueMonthData(
            appointments, psiqueIds, selectedMonth, emptyPayments,
        );

        expect(result.totalAmount).toBe(0);
        expect(result.patientBreakdown).toEqual([]);
    });

    it('calculates 25% fee for psique patient appointments', () => {
        const psiqueIds = new Set(['p-1']);
        const appointments = [
            makeAppointment({ patientId: 'p-1', date: '2026-02-10', isPaid: true, price: 10000 }),
        ];

        const result = calculatePsiqueMonthData(
            appointments, psiqueIds, selectedMonth, emptyPayments,
        );

        expect(result.totalAmount).toBe(2500);
        expect(result.patientBreakdown).toHaveLength(1);
        expect(result.patientBreakdown[0].psiqueAmount).toBe(2500);
    });

    it('excludes unpaid appointments', () => {
        const psiqueIds = new Set(['p-1']);
        const appointments = [
            makeAppointment({ patientId: 'p-1', date: '2026-02-10', isPaid: false, price: 10000 }),
        ];

        const result = calculatePsiqueMonthData(
            appointments, psiqueIds, selectedMonth, emptyPayments,
        );

        expect(result.totalAmount).toBe(0);
    });

    it('excludes cancelled appointments without chargeOnCancellation', () => {
        const psiqueIds = new Set(['p-1']);
        const appointments = [
            makeAppointment({
                patientId: 'p-1', date: '2026-02-10', isPaid: true,
                status: 'cancelado', price: 10000,
            }),
        ];

        const result = calculatePsiqueMonthData(
            appointments, psiqueIds, selectedMonth, emptyPayments,
        );

        expect(result.totalAmount).toBe(0);
    });

    it('includes cancelled appointments with chargeOnCancellation when paid', () => {
        const psiqueIds = new Set(['p-1']);
        const appointments = [
            makeAppointment({
                patientId: 'p-1', date: '2026-02-10', isPaid: true,
                status: 'cancelado', chargeOnCancellation: true, price: 10000,
            }),
        ];

        const result = calculatePsiqueMonthData(
            appointments, psiqueIds, selectedMonth, emptyPayments,
        );

        expect(result.totalAmount).toBe(2500);
        expect(result.patientBreakdown).toHaveLength(1);
    });

    it('respects excludeFromPsique flag on individual appointments', () => {
        const psiqueIds = new Set(['p-1']);
        const appointments = [
            makeAppointment({
                patientId: 'p-1', date: '2026-02-10', isPaid: true,
                price: 10000, excludeFromPsique: true,
            }),
        ];

        const result = calculatePsiqueMonthData(
            appointments, psiqueIds, selectedMonth, emptyPayments,
        );

        expect(result.totalAmount).toBe(0);
    });

    it('filters appointments by selected month', () => {
        const psiqueIds = new Set(['p-1']);
        const appointments = [
            makeAppointment({ patientId: 'p-1', date: '2026-02-10', isPaid: true, price: 10000 }),
            makeAppointment({ id: 'a-2', patientId: 'p-1', date: '2026-03-10', isPaid: true, price: 8000 }),
        ];

        const result = calculatePsiqueMonthData(
            appointments, psiqueIds, selectedMonth, emptyPayments,
        );

        expect(result.totalAmount).toBe(2500);
    });

    it('aggregates multiple sessions per patient', () => {
        const psiqueIds = new Set(['p-1']);
        const appointments = [
            makeAppointment({ id: 'a-1', patientId: 'p-1', date: '2026-02-05', isPaid: true, price: 10000 }),
            makeAppointment({ id: 'a-2', patientId: 'p-1', date: '2026-02-12', isPaid: true, price: 10000 }),
            makeAppointment({ id: 'a-3', patientId: 'p-1', date: '2026-02-19', isPaid: true, price: 10000 }),
        ];

        const result = calculatePsiqueMonthData(
            appointments, psiqueIds, selectedMonth, emptyPayments,
        );

        expect(result.totalAmount).toBe(7500);
        expect(result.patientBreakdown[0].sessionCount).toBe(3);
    });

    it('sorts patient breakdown alphabetically', () => {
        const psiqueIds = new Set(['p-1', 'p-2']);
        const appointments = [
            makeAppointment({ id: 'a-1', patientId: 'p-1', patientName: 'Zara', date: '2026-02-10', isPaid: true, price: 5000 }),
            makeAppointment({ id: 'a-2', patientId: 'p-2', patientName: 'Ana', date: '2026-02-10', isPaid: true, price: 5000 }),
        ];

        const result = calculatePsiqueMonthData(
            appointments, psiqueIds, selectedMonth, emptyPayments,
        );

        expect(result.patientBreakdown[0].patientName).toBe('Ana');
        expect(result.patientBreakdown[1].patientName).toBe('Zara');
    });

    it('resolves isPaid from payment records using docKey', () => {
        const psiqueIds = new Set(['p-1']);
        const appointments = [
            makeAppointment({ patientId: 'p-1', date: '2026-02-10', isPaid: true, price: 10000 }),
        ];
        
        const monthStr = '2026-02';
        const safeName = 'Dr. Test'.replace(/[/.#$[\]]/g, '_');
        const docKey = `${monthStr}_${safeName}`;
        
        const payments: Record<string, PsiquePayment> = {
            [docKey]: {
                id: docKey,
                month: '2026-02',
                totalAmount: 2500,
                isPaid: true,
                paidDate: '2026-02-28',
            },
        };

        const result = calculatePsiqueMonthData(
            appointments, psiqueIds, selectedMonth, payments, 'Dr. Test',
        );

        expect(result.isPaid).toBe(true);
        expect(result.paidDate).toBe('2026-02-28');
    });
});

describe('PSIQUE_RATE', () => {
    it('equals 0.25', () => {
        expect(PSIQUE_RATE).toBe(0.25);
    });
});
