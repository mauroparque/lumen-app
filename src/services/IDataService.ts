import { Patient, Appointment, Payment, PatientInput, AppointmentInput, PaymentInput, PatientBillingData } from '../types';

export interface IDataService {
    // Lectura (Suscripciones en tiempo real)
    subscribeToPatients(onData: (data: Patient[]) => void): () => void;
    subscribeToAppointments(start: string, end: string, onData: (data: Appointment[]) => void): () => void;
    subscribeToMyAppointments(start: string, end: string, onData: (data: Appointment[]) => void): () => void;
    subscribeToFinance(onUnpaid: (data: Appointment[]) => void, onPayments: (data: Payment[]) => void): () => void;

    // Escritura (Promesas)
    addPatient(patient: PatientInput): Promise<string>;
    updatePatient(id: string, data: Partial<Patient>): Promise<void>;
    deletePatient(id: string): Promise<void>;

    addAppointment(appointment: AppointmentInput): Promise<string>;
    addRecurringAppointments(baseAppointment: AppointmentInput, dates: string[], recurrenceRule?: string): Promise<void>;
    updateAppointment(id: string, data: Partial<Appointment>): Promise<void>;
    deleteAppointment(id: string): Promise<void>;
    deleteRecurringSeries(recurrenceId: string): Promise<number>;
    deleteRecurringFromDate(recurrenceId: string, fromDate: string): Promise<number>;

    addPayment(payment: PaymentInput, appointmentId?: string): Promise<string>;
    deletePayment(id: string): Promise<void>;
    updatePayment(id: string, data: Partial<Payment>): Promise<void>;

    // Facturación
    requestBatchInvoice(appointments: Appointment[], patientData: PatientBillingData): Promise<string>;
}
