import { useMemo } from 'react';
import { useService } from '../context/ServiceContext';
import {
    PatientInput,
    AppointmentInput,
    PaymentInput,
    Patient,
    Appointment,
    Payment,
    PatientBillingData,
    TaskInput,
    TaskSubitem,
    ClinicalNote,
    PsiquePayment,
} from '../types';

export const useDataActions = () => {
    const service = useService();

    return useMemo(() => {
        const ensureService = () => {
            if (!service) throw new Error('Service not available. Is user logged in?');
            return service;
        };

        return {
            addPatient: async (patient: PatientInput) => ensureService().addPatient(patient),
            addAppointment: async (appointment: AppointmentInput) => ensureService().addAppointment(appointment),
            addRecurringAppointments: async (
                baseAppointment: AppointmentInput,
                dates: string[],
                recurrenceRule: string = 'WEEKLY',
            ) => ensureService().addRecurringAppointments(baseAppointment, dates, recurrenceRule),
            addPayment: async (payment: PaymentInput, appointmentId?: string) =>
                ensureService().addPayment(payment, appointmentId),
            deleteItem: async (collectionName: 'patients' | 'appointments', id: string) => {
                const s = ensureService();
                if (collectionName === 'patients') return s.deletePatient(id);
                if (collectionName === 'appointments') return s.deleteAppointment(id);
                throw new Error(`Unknown collection: ${collectionName}`);
            },
            updateAppointment: async (id: string, data: Partial<Appointment>) =>
                ensureService().updateAppointment(id, data),
            updatePatient: async (id: string, data: Partial<Patient>) => ensureService().updatePatient(id, data),
            requestBatchInvoice: async (appointments: Appointment[], patientData: PatientBillingData) =>
                ensureService().requestBatchInvoice(appointments, patientData),
            deleteRecurringSeries: async (recurrenceId: string) => ensureService().deleteRecurringSeries(recurrenceId),
            deleteRecurringFromDate: async (recurrenceId: string, fromDate: string) =>
                ensureService().deleteRecurringFromDate(recurrenceId, fromDate),
            updatePayment: async (id: string, data: Partial<Payment>) => ensureService().updatePayment(id, data),
            completeTask: async (noteId: string, taskIndex: number) => ensureService().completeTask(noteId, taskIndex),
            addTask: async (task: TaskInput) => ensureService().addTask(task),
            updateTask: async (noteId: string, taskIndex: number, data: { text: string; subtasks?: TaskSubitem[] }) =>
                ensureService().updateTask(noteId, taskIndex, data),
            toggleSubtaskCompletion: async (noteId: string, taskIndex: number, subtaskIndex: number) =>
                ensureService().toggleSubtaskCompletion(noteId, taskIndex, subtaskIndex),
            updateNote: async (noteId: string, data: Partial<ClinicalNote>) => ensureService().updateNote(noteId, data),
            markPsiquePaymentAsPaid: async (
                docKey: string,
                data: Omit<PsiquePayment, 'id'> & { professional?: string },
            ) => ensureService().markPsiquePaymentAsPaid(docKey, data),
        };
    }, [service]);
};
