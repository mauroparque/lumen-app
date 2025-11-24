import { Patient, Appointment, Payment } from '../types';

export const MOCK_PATIENTS: Patient[] = [
    { id: '1', name: 'Ana García', email: 'ana.garcia@email.com', phone: '555-0101' },
    { id: '2', name: 'Carlos Ruiz', email: 'carlos.ruiz@email.com', phone: '555-0102' },
    { id: '3', name: 'María López', email: 'maria.lopez@email.com', phone: '555-0103' },
    { id: '4', name: 'Juan Pérez', email: 'juan.perez@email.com', phone: '555-0104' },
    { id: '5', name: 'Sofia Torres', email: 'sofia.torres@email.com', phone: '555-0105' },
];

const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

export const MOCK_APPOINTMENTS: Appointment[] = [
    {
        id: '101',
        patientId: '1',
        patientName: 'Ana García',
        date: today,
        time: '09:00',
        duration: 60,
        type: 'presencial',
        status: 'programado',
        isPaid: true,
        price: 5000
    },
    {
        id: '102',
        patientId: '2',
        patientName: 'Carlos Ruiz',
        date: today,
        time: '11:00',
        duration: 60,
        type: 'online',
        status: 'programado',
        isPaid: false,
        price: 5000
    },
    {
        id: '103',
        patientId: '3',
        patientName: 'María López',
        date: yesterday,
        time: '15:00',
        duration: 60,
        type: 'presencial',
        status: 'completado',
        isPaid: false, // Deuda
        price: 5000
    }
];

export const MOCK_PAYMENTS: Payment[] = [
    {
        id: '201',
        appointmentId: '101',
        patientName: 'Ana García',
        amount: 5000,
        date: { toDate: () => new Date() }, // Mock Firestore Timestamp
        concept: 'Sesión Terapia'
    }
];
