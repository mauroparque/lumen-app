import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDataActions } from '../useDataActions';

const mockService = {
    addPatient: vi.fn(),
    addAppointment: vi.fn(),
    addRecurringAppointments: vi.fn(),
    addPayment: vi.fn(),
    deletePatient: vi.fn(),
    deleteAppointment: vi.fn(),
    updateAppointment: vi.fn(),
    updatePatient: vi.fn(),
    requestBatchInvoice: vi.fn(),
    deleteRecurringSeries: vi.fn(),
    deleteRecurringFromDate: vi.fn(),
    updatePayment: vi.fn(),
    completeTask: vi.fn(),
    addTask: vi.fn(),
    updateTask: vi.fn(),
    toggleSubtaskCompletion: vi.fn(),
    updateNote: vi.fn(),
    markPsiquePaymentAsPaid: vi.fn(),
};

vi.mock('../../context/ServiceContext', () => ({
    useService: () => mockService,
}));

describe('useDataActions', () => {
    it('retorna el mismo objeto entre renders si service no cambia', () => {
        const { result, rerender } = renderHook(() => useDataActions());

        const first = result.current;
        rerender();
        const second = result.current;

        expect(first.addPatient).toBe(second.addPatient);
        expect(first.updateAppointment).toBe(second.updateAppointment);
        expect(first.deleteItem).toBe(second.deleteItem);
        expect(first.completeTask).toBe(second.completeTask);
    });
});
