import { collection, doc, query, where, orderBy, limit, onSnapshot, addDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, appId, CLINIC_ID } from '../lib/firebase';
import { IDataService } from './IDataService';
import { Patient, Appointment, Payment } from '../types';

export class FirebaseService implements IDataService {
    private uid: string;
    private baseUrl: string;

    constructor(uid: string) {
        this.uid = uid;
        this.baseUrl = `artifacts/${appId}/clinics/${CLINIC_ID}`;
    }

    private getCollectionRef(name: string) {
        return collection(db, this.baseUrl, name);
    }

    subscribeToPatients(onData: (data: Patient[]) => void): () => void {
        const q = query(this.getCollectionRef('patients'));

        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
            onData(data);
        }, (error) => {
            console.error("Error fetching patients:", error);
        });
    }

    subscribeToAppointments(start: string, end: string, onData: (data: Appointment[]) => void): () => void {
        const q = query(
            this.getCollectionRef('appointments'),
            where('date', '>=', start),
            where('date', '<=', end)
        );

        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
            onData(data);
        }, (error) => {
            console.error("Error fetching appointments:", error);
        });
    }

    subscribeToFinance(onUnpaid: (data: Appointment[]) => void, onPayments: (data: Payment[]) => void): () => void {
        const unpaidQuery = query(
            this.getCollectionRef('appointments'),
            where('isPaid', '==', false),
            where('status', '!=', 'cancelado')
        );

        const paymentsQuery = query(
            this.getCollectionRef('payments'),
            orderBy('date', 'desc'),
            limit(50)
        );

        const unsubUnpaid = onSnapshot(unpaidQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
            data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            onUnpaid(data);
        }, (error) => console.error("Error fetching unpaid:", error));

        const unsubPayments = onSnapshot(paymentsQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
            onPayments(data);
        }, (error) => console.error("Error fetching payments:", error));

        return () => {
            unsubUnpaid();
            unsubPayments();
        };
    }

    async addPatient(patient: Omit<Patient, 'id'>): Promise<string> {
        const data = {
            ...patient,
            createdByUid: this.uid
        };
        const docRef = await addDoc(this.getCollectionRef('patients'), data);
        return docRef.id;
    }

    async updatePatient(id: string, data: Partial<Patient>): Promise<void> {
        const docRef = doc(db, this.baseUrl, 'patients', id);
        await updateDoc(docRef, data);
    }

    async deletePatient(id: string): Promise<void> {
        const docRef = doc(db, this.baseUrl, 'patients', id);
        await deleteDoc(docRef);
    }

    async addAppointment(appointment: Omit<Appointment, 'id'>): Promise<string> {
        const data = {
            ...appointment,
            status: appointment.status || 'programado',
            createdByUid: this.uid
        };
        const docRef = await addDoc(this.getCollectionRef('appointments'), data);
        return docRef.id;
    }

    async addRecurringAppointments(baseAppointment: Omit<Appointment, 'id'>, dates: string[], recurrenceRule: string = 'WEEKLY'): Promise<void> {
        const batch = writeBatch(db);
        const seriesId = crypto.randomUUID();

        dates.forEach((date, index) => {
            const docRef = doc(this.getCollectionRef('appointments'));
            const appointmentData = {
                ...baseAppointment,
                date,
                status: baseAppointment.status || 'programado',
                createdByUid: this.uid,
                createdAt: serverTimestamp(),
                recurrenceId: seriesId,
                recurrenceIndex: index,
                recurrenceRule
            };
            batch.set(docRef, appointmentData);
        });

        await batch.commit();
    }

    async updateAppointment(id: string, data: Partial<Appointment>): Promise<void> {
        const docRef = doc(db, this.baseUrl, 'appointments', id);
        await updateDoc(docRef, data);
    }

    async deleteAppointment(id: string): Promise<void> {
        const docRef = doc(db, this.baseUrl, 'appointments', id);
        await deleteDoc(docRef);
    }

    async addPayment(payment: Omit<Payment, 'id'>, appointmentId?: string): Promise<string> {
        const batch = writeBatch(db);
        const paymentRef = doc(this.getCollectionRef('payments'));

        batch.set(paymentRef, {
            ...payment,
            date: Timestamp.now(),
            createdByUid: this.uid
        });

        if (appointmentId) {
            const apptRef = doc(db, this.baseUrl, 'appointments', appointmentId);
            batch.update(apptRef, { isPaid: true });
        }

        await batch.commit();
        return paymentRef.id;
    }

    async deletePayment(id: string): Promise<void> {
        const docRef = doc(db, this.baseUrl, 'payments', id);
        await deleteDoc(docRef);
    }

    async requestBatchInvoice(appointments: any[], patientData: any): Promise<string> {
        const queueRef = collection(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'integrations', 'billing', 'queue');

        const totalPrice = appointments.reduce((sum, appt) => sum + (appt.price || 0), 0);
        const lineItems = appointments.map(appt => ({
            description: `${appt.consultationType || 'Consulta'} - ${appt.date}`,
            amount: appt.price || 0
        }));

        const docRef = await addDoc(queueRef, {
            type: 'batch',
            appointmentIds: appointments.map(a => a.id),
            patientId: patientData.id,
            patientName: patientData.name,
            patientDni: patientData.dni || '',
            patientEmail: patientData.email,
            totalPrice,
            lineItems,
            status: 'pending',
            createdAt: serverTimestamp(),
            retryCount: 0,
            requestedBy: this.uid
        });

        return docRef.id;
    }
}
