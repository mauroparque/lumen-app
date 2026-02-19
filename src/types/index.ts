import { Timestamp } from 'firebase/firestore';

export type View = 'home' | 'dashboard' | 'calendar' | 'patients' | 'payments' | 'billing' | 'patient-history' | 'tasks' | 'statistics';

// Relationship types for child patient contacts
export type ContactRelationship = 'padre' | 'madre' | 'amigo' | 'pareja' | 'otro';

export interface Patient {
    id: string;
    name: string; // Computed or full name
    firstName?: string;
    lastName?: string;
    dni?: string;
    email: string;
    phone: string;
    fee?: number;
    preference?: 'presencial' | 'online';
    office?: string;
    professional?: string;

    // Status
    isActive: boolean;

    // Important dates
    birthDate?: string;  // YYYY-MM-DD format
    admissionDate?: string;  // YYYY-MM-DD format

    // Discharge info (only if isActive = false)
    dischargeType?: 'clinical' | 'dropout';  // Alta clínica o abandono
    dischargeDate?: string;

    // Patient type
    patientSource?: 'psique' | 'particular';

    // Contact info (for child patients)
    contactName?: string;
    contactPhone?: string;
    contactRelationship?: ContactRelationship;
    contactRelationshipOther?: string;  // If relationship is 'otro'
}

export interface Appointment {
    id: string;
    patientId: string;
    patientName: string;
    patientEmail?: string;
    date: string;
    time: string;
    duration: number; // in minutes
    type: 'presencial' | 'online';
    meetLink?: string;
    status: 'programado' | 'completado' | 'cancelado' | 'ausente' | 'presente';
    chargeOnCancellation?: boolean; // Si es true, el turno cancelado sigue generando cobro
    isPaid?: boolean;
    price?: number;
    professional?: string;
    office?: string;
    hasNotes?: boolean;
    googleEventId?: string;
    googleMeetLink?: string;
    recurrenceId?: string;
    recurrenceIndex?: number;
    recurrenceRule?: string;
    consultationType?: string;
    billingStatus?: 'pending' | 'requested' | 'invoiced';
    invoiceRequestId?: string;
    excludeFromPsique?: boolean; // Exclude from Psique 25% calculation
}

export interface Payment {
    id: string;
    appointmentId?: string;
    patientId?: string;
    patientName: string;
    amount: number;
    date: Timestamp | null;
    concept: string;
}

export type PatientInput = Omit<Patient, 'id'>;
export type AppointmentInput = Omit<Appointment, 'id'>;
export type PaymentInput = Omit<Payment, 'id'>;

export interface TaskSubitem {
    text: string;
    completed: boolean;
}

export interface TaskItem {
    text: string;
    completed: boolean;
    subtasks?: TaskSubitem[];
}

export interface ClinicalNote {
    id: string;
    patientId: string;
    appointmentId: string;
    content: string;
    attachments: string[];
    tasks?: TaskItem[];
    createdAt: Timestamp;
    updatedAt?: Timestamp;
    createdBy: string;
}

export interface StaffProfile {
    uid: string;
    email: string;
    name: string;
    role: 'admin' | 'professional' | 'secretary';
    specialty?: string;
    color?: string;
    createdAt: Timestamp | ReturnType<typeof import('firebase/firestore').serverTimestamp>;
}

// Billing Types
export interface PatientBillingData {
    id: string;
    name: string;
    email?: string;
    dni?: string;
}

export type BillingRequestStatus = 'pending' | 'processing' | 'completed' | 'error' | 'error_sending' | 'error_config';

export interface BillingLineItem {
    description: string;
    amount: number;
}

// Psique Salud Mental Payment Tracking
export interface PsiquePayment {
    id: string;
    month: string; // YYYY-MM format
    totalAmount: number;
    isPaid: boolean;
    paidDate?: string; // YYYY-MM-DD format
}

// Allowlist for onboarding
export interface AllowedEmail {
    email: string;
    role: 'admin' | 'professional';
    professionalName: string;
}
