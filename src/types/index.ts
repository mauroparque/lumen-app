export type View = 'calendar' | 'patients' | 'finance';

export interface Patient {
    id: string;
    name: string;
    email: string;
    phone: string;
    fee?: number;
}

export interface Appointment {
    id: string;
    patientId: string;
    patientName: string;
    patientEmail?: string;
    date: string;
    time: string;
    duration: number;
    type: 'presencial' | 'online';
    meetLink?: string;
    status: 'programado' | 'completado' | 'cancelado';
    isPaid?: boolean;
    price?: number;
}

export interface Payment {
    id: string;
    appointmentId?: string;
    patientName: string;
    amount: number;
    date: any; // Firebase Timestamp
    concept: string;
}
