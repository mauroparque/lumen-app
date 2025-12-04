export type View = 'calendar' | 'patients' | 'finance';

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
    status: 'programado' | 'completado' | 'cancelado';
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
}

export interface Payment {
    id: string;
    appointmentId?: string;
    patientId?: string;
    patientName: string;
    amount: number;
    date: any; // Firebase Timestamp
    concept: string;
}

export interface ClinicalNote {
    id: string;
    patientId: string;
    appointmentId: string;
    content: string;
    attachments: string[];
    createdAt: any;
    createdBy: string;
}

export interface StaffProfile {
    uid: string;
    email: string;
    name: string;
    role: 'admin' | 'professional' | 'secretary';
    specialty?: string;
    color?: string;
    createdAt: any;
}
