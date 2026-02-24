import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePendingTasks } from '../usePendingTasks';
import type { Appointment, ClinicalNote } from '../../types';

vi.mock('../../context/DataContext', () => ({
    useData: vi.fn(() => ({
        patients: [
            { id: 'p-1', name: 'Patient One', isActive: true, phone: '', email: '', professional: 'Dr. Test', fee: 0, patientSource: 'particular' as const },
            { id: 'p-2', name: 'Patient Two', isActive: true, phone: '', email: '', professional: 'Dr. Test', fee: 0, patientSource: 'particular' as const },
        ],
    })),
}));

const mockNotes: ClinicalNote[] = [
    {
        id: 'note-1',
        patientId: 'p-1',
        appointmentId: 'a-1',
        content: 'Session notes',
        attachments: [],
        createdAt: { toDate: () => new Date('2026-02-01') } as unknown as ClinicalNote['createdAt'],
        createdBy: 'Dr. Test',
        createdByUid: 'uid-1',
        tasks: [
            { text: 'Pending task 1', completed: false },
            { text: 'Completed task', completed: true },
            { text: 'Pending task 2', completed: false, subtasks: [{ text: 'Sub A', completed: false }] },
        ],
    },
    {
        id: 'note-2',
        patientId: 'p-2',
        appointmentId: 'a-2',
        content: 'Other session',
        attachments: [],
        createdAt: { toDate: () => new Date('2026-02-10') } as unknown as ClinicalNote['createdAt'],
        createdBy: 'Dr. Test',
        createdByUid: 'uid-1',
        tasks: [
            { text: 'Another pending task', completed: false },
        ],
    },
];

vi.mock('../../context/ServiceContext', () => ({
    useService: vi.fn(() => ({
        subscribeToAllNotes: vi.fn((cb: (notes: ClinicalNote[]) => void) => {
            cb(mockNotes);
            return vi.fn();
        }),
        completeTask: vi.fn().mockResolvedValue(undefined),
    })),
}));

const makeAppointment = (overrides: Partial<Appointment> = {}): Appointment => ({
    id: 'a-1',
    patientId: 'p-1',
    patientName: 'Patient One',
    professional: 'Dr. Test',
    date: '2026-02-01',
    time: '10:00',
    duration: 50,
    type: 'presencial',
    status: 'completado',
    isPaid: false,
    ...overrides,
});

describe('usePendingTasks', () => {
    it('returns only non-completed tasks', () => {
        const appointments = [
            makeAppointment({ id: 'a-1', date: '2026-02-01' }),
            makeAppointment({ id: 'a-2', patientId: 'p-2', date: '2026-02-10' }),
        ];

        const { result } = renderHook(() => usePendingTasks(appointments));

        expect(result.current.pendingTasks).toHaveLength(3);
        expect(result.current.pendingTasks.every((t) => t.text !== 'Completed task')).toBe(true);
    });

    it('includes patient name in tasks', () => {
        const appointments = [makeAppointment()];
        const { result } = renderHook(() => usePendingTasks(appointments));

        const taskForP1 = result.current.pendingTasks.find((t) => t.patientId === 'p-1');
        expect(taskForP1?.patientName).toBe('Patient One');
    });

    it('filters tasks by myPatientIds when provided', () => {
        const appointments = [makeAppointment()];
        const myPatientIds = new Set(['p-1']);

        const { result } = renderHook(() => usePendingTasks(appointments, myPatientIds));

        expect(result.current.pendingTasks).toHaveLength(2);
        expect(result.current.pendingTasks.every((t) => t.patientId === 'p-1')).toBe(true);
    });

    it('preserves subtasks in pending tasks', () => {
        const appointments = [makeAppointment()];
        const { result } = renderHook(() => usePendingTasks(appointments));

        const taskWithSubs = result.current.pendingTasks.find((t) => t.text === 'Pending task 2');
        expect(taskWithSubs?.subtasks).toHaveLength(1);
        expect(taskWithSubs?.subtasks?.[0].text).toBe('Sub A');
    });

    it('includes appointment date in tasks when matched', () => {
        const appointments = [makeAppointment({ id: 'a-1', date: '2026-02-01' })];
        const { result } = renderHook(() => usePendingTasks(appointments));

        const task = result.current.pendingTasks.find((t) => t.appointmentId === 'a-1');
        expect(task?.appointmentDate).toBe('2026-02-01');
    });

    it('sorts tasks by appointment date', () => {
        const appointments = [
            makeAppointment({ id: 'a-1', date: '2026-02-15' }),
            makeAppointment({ id: 'a-2', patientId: 'p-2', date: '2026-02-01' }),
        ];

        const { result } = renderHook(() => usePendingTasks(appointments));

        const firstTask = result.current.pendingTasks[0];
        expect(firstTask.appointmentDate).toBe('2026-02-01');
    });

    it('returns loading false after subscription callback', () => {
        const { result } = renderHook(() => usePendingTasks([]));
        expect(result.current.loading).toBe(false);
    });

    it('provides a completeTask function', () => {
        const { result } = renderHook(() => usePendingTasks([]));
        expect(typeof result.current.completeTask).toBe('function');
    });
});
