import { Patient, Appointment, Payment } from '../types';

export interface IDataService {
    // Lectura (Suscripciones en tiempo real)
    subscribeToPatients(onData: (data: Patient[]) => void): () => void;
    subscribeToAppointments(start: string, end: string, onData: (data: Appointment[]) => void): () => void;
    subscribeToFinance(onUnpaid: (data: Appointment[]) => void, onPayments: (data: Payment[]) => void): () => void;

    // Escritura (Promesas)
    addPatient(patient: Omit<Patient, 'id'>): Promise<string>;
    updatePatient(id: string, data: Partial<Patient>): Promise<void>;
    deletePatient(id: string): Promise<void>;

    addAppointment(appointment: Omit<Appointment, 'id'>): Promise<string>;
    addRecurringAppointments(baseAppointment: Omit<Appointment, 'id'>, dates: string[], recurrenceRule?: string): Promise<void>;
    updateAppointment(id: string, data: Partial<Appointment>): Promise<void>;
    deleteAppointment(id: string): Promise<void>;

    addPayment(payment: Omit<Payment, 'id'>, appointmentId?: string): Promise<string>;
    deletePayment(id: string): Promise<void>;
}
