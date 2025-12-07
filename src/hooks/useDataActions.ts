import { useService } from '../context/ServiceContext';

export const useDataActions = () => {
    const service = useService();

    // Helper to ensure service is available
    const ensureService = () => {
        if (!service) throw new Error("Service not available. Is user logged in?");
        return service;
    }

    const addPatient = async (patient: any) => {
        return ensureService().addPatient(patient);
    };

    const addAppointment = async (appointment: any) => {
        return ensureService().addAppointment(appointment);
    };

    const addRecurringAppointments = async (baseAppointment: any, dates: string[], recurrenceRule: string = 'WEEKLY') => {
        return ensureService().addRecurringAppointments(baseAppointment, dates, recurrenceRule);
    };

    const addPayment = async (payment: any, appointmentId?: string) => {
        return ensureService().addPayment(payment, appointmentId);
    };

    const deleteItem = async (collectionName: string, id: string) => {
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

    const updateAppointment = async (id: string, data: any) => {
        return ensureService().updateAppointment(id, data);
    };

    const updatePatient = async (id: string, data: any) => {
        return ensureService().updatePatient(id, data);
    };

    const requestBatchInvoice = async (appointments: any[], patientData: any) => {
        return ensureService().requestBatchInvoice(appointments, patientData);
    };

    return { addPatient, addAppointment, addRecurringAppointments, updateAppointment, updatePatient, addPayment, deleteItem, requestBatchInvoice };
};
