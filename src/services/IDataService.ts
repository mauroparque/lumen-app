import type {
    Patient,
    Appointment,
    Payment,
    PatientInput,
    AppointmentInput,
    PaymentInput,
    PatientBillingData,
    ClinicalNote,
    TaskInput,
    PsiquePayment,
} from '../types';

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
    addRecurringAppointments(
        baseAppointment: AppointmentInput,
        dates: string[],
        recurrenceRule?: string,
    ): Promise<void>;
    updateAppointment(id: string, data: Partial<Appointment>): Promise<void>;
    deleteAppointment(id: string): Promise<void>;
    deleteRecurringSeries(recurrenceId: string): Promise<number>;
    deleteRecurringFromDate(recurrenceId: string, fromDate: string): Promise<number>;

    addPayment(payment: PaymentInput, appointmentId?: string): Promise<string>;
    deletePayment(id: string): Promise<void>;
    updatePayment(id: string, data: Partial<Payment>): Promise<void>;

    // Facturación
    requestBatchInvoice(appointments: Appointment[], patientData: PatientBillingData): Promise<string>;

    // --- Clinical Notes ---
    subscribeToClinicalNote(appointmentId: string, onData: (note: ClinicalNote | null) => void): () => void;
    subscribeToPatientNotes(patientId: string, onData: (notes: ClinicalNote[]) => void): () => void;
    saveNote(noteData: Partial<ClinicalNote>, appointmentId: string, existingNoteId?: string): Promise<void>;
    uploadNoteAttachment(file: File, patientId: string): Promise<string>;

    // --- Tasks ---
    subscribeToAllNotes(onData: (notes: ClinicalNote[]) => void): () => void;
    completeTask(noteId: string, taskIndex: number): Promise<void>;
    addTask(task: TaskInput): Promise<string>;

    // --- Psique Payments ---
    subscribeToPsiquePayments(
        professionalName: string | undefined,
        onData: (payments: Record<string, PsiquePayment>) => void,
    ): () => void;
    markPsiquePaymentAsPaid(docKey: string, data: Omit<PsiquePayment, 'id'> & { professional?: string }): Promise<void>;

    // --- Patient-specific data ---
    subscribeToPatientAppointments(patientId: string, onData: (appointments: Appointment[]) => void): () => void;
    subscribeToPatientPayments(patientId: string, onData: (payments: Payment[]) => void): () => void;
}
