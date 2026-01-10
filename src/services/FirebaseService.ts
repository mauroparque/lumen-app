import { collection, doc, query, where, orderBy, limit, onSnapshot, addDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PATIENTS_COLLECTION, APPOINTMENTS_COLLECTION, PAYMENTS_COLLECTION, BILLING_QUEUE_COLLECTION } from '../lib/routes';
import { IDataService } from './IDataService';
import { Patient, Appointment, Payment, PatientInput, AppointmentInput, PaymentInput, PatientBillingData } from '../types';

export class FirebaseService implements IDataService {
    private uid: string;
    private professionalName: string | null;

    constructor(uid: string, professionalName?: string) {
        this.uid = uid;
        this.professionalName = professionalName || null;
    }

    subscribeToPatients(onData: (data: Patient[]) => void): () => void {
        // Filter by professional if set
        const q = this.professionalName
            ? query(collection(db, PATIENTS_COLLECTION), where('professional', '==', this.professionalName))
            : query(collection(db, PATIENTS_COLLECTION));

        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
            onData(data);
        }, (error) => {
            console.error("Error fetching patients:", error);
        });
    }

    // For agenda: all appointments (unfiltered by professional)
    subscribeToAppointments(start: string, end: string, onData: (data: Appointment[]) => void): () => void {
        const q = query(
            collection(db, APPOINTMENTS_COLLECTION),
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

    // For other views: only my appointments (filtered by professional)
    subscribeToMyAppointments(start: string, end: string, onData: (data: Appointment[]) => void): () => void {
        // If no professional set, return all (shouldn't happen in practice)
        if (!this.professionalName) {
            return this.subscribeToAppointments(start, end, onData);
        }

        const q = query(
            collection(db, APPOINTMENTS_COLLECTION),
            where('date', '>=', start),
            where('date', '<=', end),
            where('professional', '==', this.professionalName)
        );

        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
            onData(data);
        }, (error) => {
            console.error("Error fetching my appointments:", error);
        });
    }

    subscribeToFinance(onUnpaid: (data: Appointment[]) => void, onPayments: (data: Payment[]) => void): () => void {
        // Query unpaid appointments, filtered by professional if set
        const unpaidQuery = this.professionalName
            ? query(
                collection(db, APPOINTMENTS_COLLECTION),
                where('isPaid', '==', false),
                where('professional', '==', this.professionalName)
            )
            : query(
                collection(db, APPOINTMENTS_COLLECTION),
                where('isPaid', '==', false)
            );

        const paymentsQuery = query(
            collection(db, PAYMENTS_COLLECTION),
            orderBy('date', 'desc'),
            limit(50)
        );

        const unsubUnpaid = onSnapshot(unpaidQuery, (snapshot) => {
            const data = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Appointment))
                // Filtrar cancelados sin cobro (solo mostrar si NO está cancelado O si tiene chargeOnCancellation)
                .filter(a => a.status !== 'cancelado' || a.chargeOnCancellation);
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

    async addPatient(patient: PatientInput): Promise<string> {
        const data = {
            ...patient,
            createdByUid: this.uid
        };
        const docRef = await addDoc(collection(db, PATIENTS_COLLECTION), data);
        return docRef.id;
    }

    async updatePatient(id: string, data: Partial<Patient>): Promise<void> {
        const docRef = doc(db, PATIENTS_COLLECTION, id);
        await updateDoc(docRef, data);
    }

    async deletePatient(id: string): Promise<void> {
        const docRef = doc(db, PATIENTS_COLLECTION, id);
        await deleteDoc(docRef);
    }

    async addAppointment(appointment: AppointmentInput): Promise<string> {
        const data = {
            ...appointment,
            status: appointment.status || 'programado',
            createdByUid: this.uid
        };
        const docRef = await addDoc(collection(db, APPOINTMENTS_COLLECTION), data);
        return docRef.id;
    }

    async addRecurringAppointments(baseAppointment: AppointmentInput, dates: string[], recurrenceRule: string = 'WEEKLY'): Promise<void> {
        const batch = writeBatch(db);
        const seriesId = crypto.randomUUID();

        dates.forEach((date, index) => {
            const docRef = doc(collection(db, APPOINTMENTS_COLLECTION));
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
        const docRef = doc(db, APPOINTMENTS_COLLECTION, id);
        await updateDoc(docRef, data);
    }

    async deleteAppointment(id: string): Promise<void> {
        const docRef = doc(db, APPOINTMENTS_COLLECTION, id);
        await deleteDoc(docRef);
    }

    async deleteRecurringSeries(recurrenceId: string): Promise<number> {
        const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
        const q = query(appointmentsRef, where('recurrenceId', '==', recurrenceId));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return 0;

        const batch = writeBatch(db);
        snapshot.docs.forEach(docSnap => {
            batch.delete(docSnap.ref);
        });

        await batch.commit();
        return snapshot.docs.length;
    }

    async deleteRecurringFromDate(recurrenceId: string, fromDate: string): Promise<number> {
        const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
        const q = query(appointmentsRef, where('recurrenceId', '==', recurrenceId));
        const snapshot = await getDocs(q);

        const toDelete = snapshot.docs.filter(docSnap => {
            const data = docSnap.data();
            return data.date >= fromDate;
        });

        if (toDelete.length === 0) return 0;

        const batch = writeBatch(db);
        toDelete.forEach(docSnap => {
            batch.delete(docSnap.ref);
        });

        await batch.commit();
        return toDelete.length;
    }

    async addPayment(payment: PaymentInput, appointmentId?: string): Promise<string> {
        const batch = writeBatch(db);
        const paymentRef = doc(collection(db, PAYMENTS_COLLECTION));

        batch.set(paymentRef, {
            ...payment,
            date: Timestamp.now(),
            createdByUid: this.uid
        });

        if (appointmentId) {
            const apptRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
            batch.update(apptRef, { isPaid: true });
        }

        await batch.commit();
        return paymentRef.id;
    }

    async deletePayment(id: string): Promise<void> {
        const docRef = doc(db, PAYMENTS_COLLECTION, id);
        await deleteDoc(docRef);
    }

    async updatePayment(id: string, data: Partial<Payment>): Promise<void> {
        const docRef = doc(db, PAYMENTS_COLLECTION, id);
        await updateDoc(docRef, data);
    }

    async requestBatchInvoice(appointments: Appointment[], patientData: PatientBillingData): Promise<string> {
        const queueRef = collection(db, BILLING_QUEUE_COLLECTION);

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
