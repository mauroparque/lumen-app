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

    // Helper to ensure service is available
    const ensureService = () => {
        if (!service) throw new Error('Service not available. Is user logged in?');
        return service;
    };

    const addPatient = async (patient: PatientInput) => {
        return ensureService().addPatient(patient);
    };

    const addAppointment = async (appointment: AppointmentInput) => {
        return ensureService().addAppointment(appointment);
    };

    const addRecurringAppointments = async (
        baseAppointment: AppointmentInput,
        dates: string[],
        recurrenceRule: string = 'WEEKLY',
    ) => {
        return ensureService().addRecurringAppointments(baseAppointment, dates, recurrenceRule);
    };

    const addPayment = async (payment: PaymentInput, appointmentId?: string) => {
        return ensureService().addPayment(payment, appointmentId);
    };

    const deleteItem = async (collectionName: 'patients' | 'appointments' | 'payments', id: string) => {
        const s = ensureService();
        if (collectionName === 'patients') {
            return s.deletePatient(id);
        } else if (collectionName === 'appointments') {
            return s.deleteAppointment(id);
        } else if (collectionName === 'payments') {
            return s.deletePayment(id);
        }
        throw new Error(`Unknown collection: ${collectionName}`);
    };

    const updateAppointment = async (id: string, data: Partial<Appointment>) => {
        return ensureService().updateAppointment(id, data);
    };

    const updatePatient = async (id: string, data: Partial<Patient>) => {
        return ensureService().updatePatient(id, data);
    };

    const requestBatchInvoice = async (appointments: Appointment[], patientData: PatientBillingData) => {
        return ensureService().requestBatchInvoice(appointments, patientData);
    };

    const deleteRecurringSeries = async (recurrenceId: string) => {
        return ensureService().deleteRecurringSeries(recurrenceId);
    };

    const deleteRecurringFromDate = async (recurrenceId: string, fromDate: string) => {
        return ensureService().deleteRecurringFromDate(recurrenceId, fromDate);
    };

    const updatePayment = async (id: string, data: Partial<Payment>) => {
        return ensureService().updatePayment(id, data);
    };

    const completeTask = async (noteId: string, taskIndex: number) => {
        return ensureService().completeTask(noteId, taskIndex);
    };

    const addTask = async (task: TaskInput) => {
        return ensureService().addTask(task);
    };

    const updateTask = async (
        noteId: string,
        taskIndex: number,
        data: { text: string; subtasks?: TaskSubitem[] },
    ) => {
        return ensureService().updateTask(noteId, taskIndex, data);
    };

    const toggleSubtaskCompletion = async (
        noteId: string,
        taskIndex: number,
        subtaskIndex: number,
    ) => {
        return ensureService().toggleSubtaskCompletion(noteId, taskIndex, subtaskIndex);
    };

    const updateNote = async (noteId: string, data: Partial<ClinicalNote>) => {
        return ensureService().updateNote(noteId, data);
    };

    const markPsiquePaymentAsPaid = async (
        docKey: string,
        data: Omit<PsiquePayment, 'id'> & { professional?: string },
    ) => {
        return ensureService().markPsiquePaymentAsPaid(docKey, data);
    };

    return {
        addPatient,
        addAppointment,
        addRecurringAppointments,
        updateAppointment,
        updatePatient,
        addPayment,
        updatePayment,
        deleteItem,
        requestBatchInvoice,
        deleteRecurringSeries,
        deleteRecurringFromDate,
        completeTask,
        addTask,
        updateTask,
        toggleSubtaskCompletion,
        updateNote,
        markPsiquePaymentAsPaid,
    };
};
