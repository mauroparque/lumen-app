import { describe, it, expect, vi } from 'vitest';
import type { IDataService } from '../IDataService';

const mockClinicalNote = {
    id: 'note-1',
    patientId: 'patient-1',
    appointmentId: 'appointment-1',
    content: 'Test note',
    attachments: [] as string[],
    createdAt: { toDate: () => new Date('2026-01-01') },
    createdBy: 'Dr. Test',
    createdByUid: 'uid-1',
};

const createMockService = (overrides?: Partial<IDataService>): IDataService => ({
    subscribeToPatients: vi.fn(),
    subscribeToAppointments: vi.fn(),
    subscribeToMyAppointments: vi.fn(),
    subscribeToFinance: vi.fn(),
    addPatient: vi.fn(),
    updatePatient: vi.fn(),
    deletePatient: vi.fn(),
    addAppointment: vi.fn(),
    addRecurringAppointments: vi.fn(),
    updateAppointment: vi.fn(),
    deleteAppointment: vi.fn(),
    deleteRecurringSeries: vi.fn(),
    deleteRecurringFromDate: vi.fn(),
    addPayment: vi.fn(),
    deletePayment: vi.fn(),
    updatePayment: vi.fn(),
    requestBatchInvoice: vi.fn(),
    subscribeToClinicalNote: vi.fn(),
    subscribeToPatientNotes: vi.fn(),
    saveNote: vi.fn(),
    uploadNoteAttachment: vi.fn(),
    subscribeToAllNotes: vi.fn(),
    completeTask: vi.fn(),
    addTask: vi.fn(),
    updateTask: vi.fn(),
    toggleSubtaskCompletion: vi.fn(),
    subscribeToPsiquePayments: vi.fn(),
    markPsiquePaymentAsPaid: vi.fn(),
    subscribeToPatientAppointments: vi.fn(),
    subscribeToPatientPayments: vi.fn(),
    updateNote: vi.fn(),
    ...overrides,
});

describe('IDataService Mockability Demo', () => {
    it('demonstrates that IDataService can be mocked for testing', () => {
        const mockService = createMockService({
            subscribeToClinicalNote: vi.fn((_appointmentId, callback) => {
                callback(mockClinicalNote);
                return vi.fn();
            }),
            saveNote: vi.fn().mockResolvedValue(undefined),
        });

        mockService.subscribeToClinicalNote('appointment-1', (note) => {
            expect(note).toEqual(mockClinicalNote);
        });

        expect(mockService.saveNote).toBeDefined();
    });

    it('shows the architecture allows swapping implementations', () => {
        const firebaseService = createMockService();
        const mockService = createMockService({
            subscribeToClinicalNote: vi.fn((_id, cb) => {
                cb(null);
                return vi.fn();
            }),
        });

        expect(typeof firebaseService.subscribeToClinicalNote).toBe('function');
        expect(typeof mockService.subscribeToClinicalNote).toBe('function');

        expect(firebaseService.subscribeToClinicalNote).toBeDefined();
        expect(mockService.subscribeToClinicalNote).toBeDefined();
    });

    it('verifies all required methods are present in IDataService', () => {
        const service = createMockService();

        expect(service.subscribeToPatients).toBeDefined();
        expect(service.subscribeToAppointments).toBeDefined();
        expect(service.subscribeToMyAppointments).toBeDefined();
        expect(service.subscribeToFinance).toBeDefined();
        expect(service.addPatient).toBeDefined();
        expect(service.updatePatient).toBeDefined();
        expect(service.deletePatient).toBeDefined();
        expect(service.addAppointment).toBeDefined();
        expect(service.addRecurringAppointments).toBeDefined();
        expect(service.updateAppointment).toBeDefined();
        expect(service.deleteAppointment).toBeDefined();
        expect(service.deleteRecurringSeries).toBeDefined();
        expect(service.deleteRecurringFromDate).toBeDefined();
        expect(service.addPayment).toBeDefined();
        expect(service.deletePayment).toBeDefined();
        expect(service.updatePayment).toBeDefined();
        expect(service.requestBatchInvoice).toBeDefined();
        expect(service.subscribeToClinicalNote).toBeDefined();
        expect(service.subscribeToPatientNotes).toBeDefined();
        expect(service.saveNote).toBeDefined();
        expect(service.uploadNoteAttachment).toBeDefined();
        expect(service.subscribeToAllNotes).toBeDefined();
        expect(service.completeTask).toBeDefined();
        expect(service.addTask).toBeDefined();
        expect(service.updateTask).toBeDefined();
        expect(service.toggleSubtaskCompletion).toBeDefined();
        expect(service.subscribeToPsiquePayments).toBeDefined();
        expect(service.markPsiquePaymentAsPaid).toBeDefined();
        expect(service.subscribeToPatientAppointments).toBeDefined();
        expect(service.subscribeToPatientPayments).toBeDefined();
        expect(service.updateNote).toBeDefined();
    });

    it('updateTask mock can be configured with specific behavior', () => {
        const mockService = createMockService({
            updateTask: vi.fn().mockResolvedValue(undefined),
        });

        const result = mockService.updateTask('note-1', 0, {
            text: 'Updated task',
            subtasks: [{ text: 'sub', completed: false }],
        });

        expect(mockService.updateTask).toHaveBeenCalledWith('note-1', 0, {
            text: 'Updated task',
            subtasks: [{ text: 'sub', completed: false }],
        });
        expect(result).resolves.toBeUndefined();
    });

    it('toggleSubtaskCompletion mock resolves correctly', () => {
        const mockService = createMockService({
            toggleSubtaskCompletion: vi.fn().mockResolvedValue(undefined),
        });

        const result = mockService.toggleSubtaskCompletion('note-1', 0, 1);

        expect(mockService.toggleSubtaskCompletion).toHaveBeenCalledWith('note-1', 0, 1);
        expect(result).resolves.toBeUndefined();
    });

    it('mock factory includes all IDataService methods', () => {
        const service = createMockService();
        const expectedMethods = [
            'subscribeToPatients', 'subscribeToAppointments', 'subscribeToMyAppointments',
            'subscribeToFinance', 'addPatient', 'updatePatient', 'deletePatient',
            'addAppointment', 'addRecurringAppointments', 'updateAppointment',
            'deleteAppointment', 'deleteRecurringSeries', 'deleteRecurringFromDate',
            'addPayment', 'deletePayment', 'updatePayment', 'requestBatchInvoice',
            'subscribeToClinicalNote', 'subscribeToPatientNotes', 'saveNote',
            'updateNote', 'uploadNoteAttachment', 'subscribeToAllNotes',
            'completeTask', 'addTask', 'updateTask', 'toggleSubtaskCompletion',
            'subscribeToPsiquePayments', 'markPsiquePaymentAsPaid',
            'subscribeToPatientAppointments', 'subscribeToPatientPayments',
        ];
        for (const method of expectedMethods) {
            expect(service).toHaveProperty(method);
            expect(typeof (service as any)[method]).toBe('function');
        }
        expect(Object.keys(service).sort()).toEqual(expectedMethods.sort());
    });
});
