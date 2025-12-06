import { IDataService } from './IDataService';
import { Patient, Appointment, Payment } from '../types';
import { MOCK_PATIENTS, MOCK_APPOINTMENTS, MOCK_PAYMENTS } from '../lib/mockData';

export class MockService implements IDataService {
    private LATENCY = 300;

    private simulateLatency<T>(data: T): Promise<T> {
        return new Promise(resolve => setTimeout(() => resolve(data), this.LATENCY));
    }

    // Helpers to mimic real-time updates (in a real app, we'd use an event emitter or similar)
    // For this refactor, we'll keep it simple and just return the data once, as the mocks don't change from outside

    subscribeToPatients(onData: (data: Patient[]) => void): () => void {
        setTimeout(() => onData([...MOCK_PATIENTS]), this.LATENCY);
        return () => { };
    }

    subscribeToAppointments(start: string, end: string, onData: (data: Appointment[]) => void): () => void {
        setTimeout(() => {
            const filtered = MOCK_APPOINTMENTS.filter(app => app.date >= start && app.date <= end);
            onData([...filtered]);
        }, this.LATENCY);
        return () => { };
    }

    subscribeToFinance(onUnpaid: (data: Appointment[]) => void, onPayments: (data: Payment[]) => void): () => void {
        setTimeout(() => {
            const unpaid = MOCK_APPOINTMENTS.filter(a => !a.isPaid && a.status !== 'cancelado');
            onUnpaid([...unpaid]);
            onPayments([...MOCK_PAYMENTS]);
        }, this.LATENCY);
        return () => { };
    }

    async addPatient(patient: Omit<Patient, 'id'>): Promise<string> {
        const newPatient = { id: Math.random().toString(36).substr(2, 9), ...patient };
        MOCK_PATIENTS.push(newPatient as Patient);
        return this.simulateLatency(newPatient.id);
    }

    async updatePatient(id: string, data: Partial<Patient>): Promise<void> {
        const idx = MOCK_PATIENTS.findIndex(p => p.id === id);
        if (idx > -1) {
            MOCK_PATIENTS[idx] = { ...MOCK_PATIENTS[idx], ...data } as Patient;
        }
        return this.simulateLatency(undefined);
    }

    async deletePatient(id: string): Promise<void> {
        const idx = MOCK_PATIENTS.findIndex(p => p.id === id);
        if (idx > -1) MOCK_PATIENTS.splice(idx, 1);
        return this.simulateLatency(undefined);
    }

    async addAppointment(appointment: Omit<Appointment, 'id'>): Promise<string> {
        const newAppt = {
            id: Math.random().toString(36).substr(2, 9),
            ...appointment,
            status: appointment.status || 'programado'
        };
        MOCK_APPOINTMENTS.push(newAppt as Appointment);
        return this.simulateLatency(newAppt.id);
    }

    async addRecurringAppointments(baseAppointment: Omit<Appointment, 'id'>, dates: string[], recurrenceRule: string = 'WEEKLY'): Promise<void> {
        const seriesId = Math.random().toString(36).substr(2, 9);
        dates.forEach((date, index) => {
            MOCK_APPOINTMENTS.push({
                ...baseAppointment,
                id: Math.random().toString(36).substr(2, 9),
                date,
                status: baseAppointment.status || 'programado',
                recurrenceId: seriesId,
                recurrenceIndex: index,
                recurrenceRule
            } as Appointment);
        });
        return this.simulateLatency(undefined);
    }

    async updateAppointment(id: string, data: Partial<Appointment>): Promise<void> {
        const idx = MOCK_APPOINTMENTS.findIndex(a => a.id === id);
        if (idx > -1) {
            MOCK_APPOINTMENTS[idx] = { ...MOCK_APPOINTMENTS[idx], ...data } as Appointment;
        }
        return this.simulateLatency(undefined);
    }

    async deleteAppointment(id: string): Promise<void> {
        const idx = MOCK_APPOINTMENTS.findIndex(a => a.id === id);
        if (idx > -1) MOCK_APPOINTMENTS.splice(idx, 1);
        return this.simulateLatency(undefined);
    }

    async addPayment(payment: Omit<Payment, 'id'>, appointmentId?: string): Promise<string> {
        const newPayment = {
            id: Math.random().toString(36).substr(2, 9),
            ...payment,
            date: { toDate: () => new Date() }
        };
        MOCK_PAYMENTS.push(newPayment as any); // Cast as any because of the date structure difference

        if (appointmentId) {
            const appt = MOCK_APPOINTMENTS.find(a => a.id === appointmentId);
            if (appt) appt.isPaid = true;
        }
        return this.simulateLatency(newPayment.id);
    }

    async deletePayment(id: string): Promise<void> {
        const idx = MOCK_PAYMENTS.findIndex(p => p.id === id);
        if (idx > -1) MOCK_PAYMENTS.splice(idx, 1);
        return this.simulateLatency(undefined);
    }
}
