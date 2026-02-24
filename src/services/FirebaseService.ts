import {
    collection,
    doc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    serverTimestamp,
    Timestamp,
    getDocs,
    getDoc,
    setDoc,
} from 'firebase/firestore';
import { db, storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
    PATIENTS_COLLECTION,
    APPOINTMENTS_COLLECTION,
    PAYMENTS_COLLECTION,
    BILLING_QUEUE_COLLECTION,
    NOTES_COLLECTION,
    PSIQUE_PAYMENTS_COLLECTION,
    STAFF_COLLECTION,
} from '../lib/routes';
import { IDataService } from './IDataService';
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
    TaskSubitem,
    PsiquePayment,
    StaffProfile,
} from '../types';

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

        return onSnapshot(
            q,
            (snapshot) => {
                const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Patient);
                onData(data);
            },
            (error) => {
                console.error('Error fetching patients:', error);
            },
        );
    }

    // For agenda: all appointments (unfiltered by professional)
    subscribeToAppointments(start: string, end: string, onData: (data: Appointment[]) => void): () => void {
        const q = query(collection(db, APPOINTMENTS_COLLECTION), where('date', '>=', start), where('date', '<=', end));

        return onSnapshot(
            q,
            (snapshot) => {
                const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Appointment);
                onData(data);
            },
            (error) => {
                console.error('Error fetching appointments:', error);
            },
        );
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
            where('professional', '==', this.professionalName),
        );

        return onSnapshot(
            q,
            (snapshot) => {
                const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Appointment);
                onData(data);
            },
            (error) => {
                console.error('Error fetching my appointments:', error);
            },
        );
    }

    subscribeToFinance(onUnpaid: (data: Appointment[]) => void, onPayments: (data: Payment[]) => void): () => void {
        // Query unpaid appointments, filtered by professional if set
        const unpaidQuery = this.professionalName
            ? query(
                  collection(db, APPOINTMENTS_COLLECTION),
                  where('isPaid', '==', false),
                  where('professional', '==', this.professionalName),
              )
            : query(collection(db, APPOINTMENTS_COLLECTION), where('isPaid', '==', false));

        const paymentsQuery = query(collection(db, PAYMENTS_COLLECTION), orderBy('date', 'desc'), limit(50));

        const unsubUnpaid = onSnapshot(
            unpaidQuery,
            (snapshot) => {
                const data = snapshot.docs
                    .map((doc) => ({ id: doc.id, ...doc.data() }) as Appointment)
                    // Filtrar cancelados sin cobro (solo mostrar si NO está cancelado O si tiene chargeOnCancellation)
                    .filter((a) => a.status !== 'cancelado' || a.chargeOnCancellation);
                data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                onUnpaid(data);
            },
            (error) => console.error('Error fetching unpaid:', error),
        );

        const unsubPayments = onSnapshot(
            paymentsQuery,
            (snapshot) => {
                const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Payment);
                onPayments(data);
            },
            (error) => console.error('Error fetching payments:', error),
        );

        return () => {
            unsubUnpaid();
            unsubPayments();
        };
    }

    async addPatient(patient: PatientInput): Promise<string> {
        const data = {
            ...patient,
            createdByUid: this.uid,
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
            createdByUid: this.uid,
        };
        const docRef = await addDoc(collection(db, APPOINTMENTS_COLLECTION), data);
        return docRef.id;
    }

    async addRecurringAppointments(
        baseAppointment: AppointmentInput,
        dates: string[],
        recurrenceRule: string = 'WEEKLY',
    ): Promise<void> {
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
                recurrenceRule,
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
        snapshot.docs.forEach((docSnap) => {
            batch.delete(docSnap.ref);
        });

        await batch.commit();
        return snapshot.docs.length;
    }

    async deleteRecurringFromDate(recurrenceId: string, fromDate: string): Promise<number> {
        const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
        const q = query(appointmentsRef, where('recurrenceId', '==', recurrenceId));
        const snapshot = await getDocs(q);

        const toDelete = snapshot.docs.filter((docSnap) => {
            const data = docSnap.data();
            return data.date >= fromDate;
        });

        if (toDelete.length === 0) return 0;

        const batch = writeBatch(db);
        toDelete.forEach((docSnap) => {
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
            createdByUid: this.uid,
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
        const lineItems = appointments.map((appt) => ({
            description: `${appt.consultationType || 'Consulta'} - ${appt.date}`,
            amount: appt.price || 0,
        }));

        const docRef = await addDoc(queueRef, {
            type: 'batch',
            appointmentIds: appointments.map((a) => a.id),
            patientId: patientData.id,
            patientName: patientData.name,
            patientDni: patientData.dni || '',
            patientEmail: patientData.email,
            totalPrice,
            lineItems,
            status: 'pending',
            createdAt: serverTimestamp(),
            retryCount: 0,
            requestedBy: this.uid,
        });

        return docRef.id;
    }

    // --- Clinical Notes ---
    subscribeToClinicalNote(appointmentId: string, onData: (note: ClinicalNote | null) => void): () => void {
        const q = query(collection(db, NOTES_COLLECTION), where('appointmentId', '==', appointmentId));

        return onSnapshot(
            q,
            (snapshot) => {
                if (!snapshot.empty) {
                    const docData = snapshot.docs[0];
                    onData({ id: docData.id, ...docData.data() } as ClinicalNote);
                } else {
                    onData(null);
                }
            },
            (error) => console.error('Error fetching clinical note:', error),
        );
    }

    subscribeToPatientNotes(patientId: string, onData: (notes: ClinicalNote[]) => void): () => void {
        const q = query(collection(db, NOTES_COLLECTION), where('patientId', '==', patientId));

        return onSnapshot(
            q,
            (snapshot) => {
                const fetchedNotes = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as ClinicalNote[];
                // Sort by createdAt descending
                fetchedNotes.sort((a, b) => {
                    const dateA = a.createdAt?.toDate?.() || new Date(0);
                    const dateB = b.createdAt?.toDate?.() || new Date(0);
                    return dateB.getTime() - dateA.getTime();
                });
                onData(fetchedNotes);
            },
            (error) => console.error('Error fetching patient notes:', error),
        );
    }

    async saveNote(noteData: Partial<ClinicalNote>, appointmentId: string, existingNoteId?: string): Promise<void> {
        const notesCollection = collection(db, NOTES_COLLECTION);

        const basePayload = {
            ...noteData,
            appointmentId,
            updatedAt: Timestamp.now(),
        };

        if (existingNoteId) {
            await updateDoc(doc(notesCollection, existingNoteId), basePayload);
        } else {
            await addDoc(notesCollection, {
                ...basePayload,
                createdAt: Timestamp.now(),
                createdBy: this.uid,
                createdByUid: this.uid,
            });
        }

        // Update appointment to indicate it has notes
        const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
        await updateDoc(appointmentRef, { hasNotes: true });
    }

    async updateNote(noteId: string, data: Partial<ClinicalNote>): Promise<void> {
        const noteRef = doc(db, NOTES_COLLECTION, noteId);
        await updateDoc(noteRef, {
            ...data,
            updatedAt: Timestamp.now(),
        });
    }

    async uploadNoteAttachment(file: File, patientId: string): Promise<string> {
        const timestamp = Date.now();
        const storageRef = ref(storage, `patients/${patientId}/attachments/${timestamp}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        return url;
    }

    // --- Tasks ---
    subscribeToAllNotes(onData: (notes: ClinicalNote[]) => void): () => void {
        const q = query(
            collection(db, NOTES_COLLECTION),
            where('createdByUid', '==', this.uid),
        );

        return onSnapshot(
            q,
            (snapshot) => {
                const notes = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ClinicalNote[];
                onData(notes);
            },
            (error) => console.error('Error fetching all notes:', error),
        );
    }

    async completeTask(noteId: string, taskIndex: number): Promise<void> {
        const noteRef = doc(db, NOTES_COLLECTION, noteId);
        const noteSnap = await getDoc(noteRef);

        if (!noteSnap.exists()) {
            throw new Error('Note not found');
        }

        const noteData = noteSnap.data() as ClinicalNote;
        const updatedTasks = [...(noteData.tasks || [])];

        if (updatedTasks[taskIndex]) {
            updatedTasks[taskIndex].completed = true;
            await updateDoc(noteRef, { tasks: updatedTasks });
        }
    }

    async addTask(task: TaskInput): Promise<string> {
        const colRef = collection(db, NOTES_COLLECTION);
        const docRef = await addDoc(colRef, {
            patientId: task.patientId,
            appointmentId: `standalone-${task.patientId}-${Date.now()}`,
            content: task.content,
            attachments: [],
            tasks: [
                {
                    text: task.content,
                    completed: false,
                    subtasks: task.subtasks || [],
                },
            ],
            createdBy: task.createdBy,
            createdByUid: task.createdByUid,
            professional: task.professional,
            type: 'task',
            createdAt: Timestamp.now(),
        });
        return docRef.id;
    }

    async updateTask(
        noteId: string,
        taskIndex: number,
        data: { text: string; subtasks?: TaskSubitem[] },
    ): Promise<void> {
        const noteRef = doc(db, NOTES_COLLECTION, noteId);
        const noteSnap = await getDoc(noteRef);

        if (!noteSnap.exists()) {
            throw new Error('Note not found');
        }

        const noteData = noteSnap.data() as ClinicalNote;
        const updatedTasks = [...(noteData.tasks || [])];

        if (!updatedTasks[taskIndex]) {
            throw new Error(`Task at index ${taskIndex} not found`);
        }

        updatedTasks[taskIndex] = {
            ...updatedTasks[taskIndex],
            text: data.text,
            subtasks: data.subtasks,
        };

        await updateDoc(noteRef, {
            tasks: updatedTasks,
            updatedAt: Timestamp.now(),
        });
    }

    async toggleSubtaskCompletion(
        noteId: string,
        taskIndex: number,
        subtaskIndex: number,
    ): Promise<void> {
        const noteRef = doc(db, NOTES_COLLECTION, noteId);
        const noteSnap = await getDoc(noteRef);

        if (!noteSnap.exists()) {
            throw new Error('Note not found');
        }

        const noteData = noteSnap.data() as ClinicalNote;
        const updatedTasks = [...(noteData.tasks || [])];

        if (!updatedTasks[taskIndex]?.subtasks?.[subtaskIndex]) {
            throw new Error(`Subtask at index ${subtaskIndex} not found`);
        }

        const subtasks = [...(updatedTasks[taskIndex].subtasks || [])];
        subtasks[subtaskIndex] = {
            ...subtasks[subtaskIndex],
            completed: !subtasks[subtaskIndex].completed,
        };
        updatedTasks[taskIndex] = {
            ...updatedTasks[taskIndex],
            subtasks,
        };

        await updateDoc(noteRef, {
            tasks: updatedTasks,
            updatedAt: Timestamp.now(),
        });
    }

    // --- Psique Payments ---
    subscribeToPsiquePayments(
        professionalName: string | undefined,
        onData: (payments: Record<string, PsiquePayment>) => void,
    ): () => void {
        const paymentsRef = collection(db, PSIQUE_PAYMENTS_COLLECTION);

        const paymentsQuery = professionalName
            ? query(paymentsRef, where('professional', '==', professionalName))
            : paymentsRef;

        return onSnapshot(
            paymentsQuery,
            (snapshot) => {
                const data: Record<string, PsiquePayment> = {};
                snapshot.docs.forEach((doc) => {
                    data[doc.id] = { id: doc.id, ...doc.data() } as PsiquePayment;
                });
                onData(data);
            },
            (error) => console.error('Error fetching Psique payments:', error),
        );
    }

    async markPsiquePaymentAsPaid(
        docKey: string,
        data: Omit<PsiquePayment, 'id'> & { professional?: string },
    ): Promise<void> {
        const docRef = doc(db, PSIQUE_PAYMENTS_COLLECTION, docKey);
        await setDoc(docRef, data, { merge: true });
    }

    // --- Patient-specific data ---
    subscribeToPatientAppointments(patientId: string, onData: (appointments: Appointment[]) => void): () => void {
        const q = query(collection(db, APPOINTMENTS_COLLECTION), where('patientId', '==', patientId), orderBy('date', 'desc'));

        return onSnapshot(
            q,
            (snapshot) => {
                const appointments = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Appointment[];
                onData(appointments);
            },
            (error) => console.error('Error fetching patient appointments:', error),
        );
    }

    subscribeToPatientPayments(patientId: string, onData: (payments: Payment[]) => void): () => void {
        const q = query(collection(db, PAYMENTS_COLLECTION), where('patientId', '==', patientId), orderBy('date', 'desc'));

        return onSnapshot(
            q,
            (snapshot) => {
                const payments = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Payment[];
                onData(payments);
            },
            (error) => console.error('Error fetching patient payments:', error),
        );
    }

    // --- Staff ---
    subscribeToStaffProfile(uid: string, onData: (profile: StaffProfile | null) => void): () => void {
        const docRef = doc(db, STAFF_COLLECTION, uid);
        return onSnapshot(
            docRef,
            (docSnap) => {
                if (docSnap.exists()) {
                    onData(docSnap.data() as StaffProfile);
                } else {
                    onData(null);
                }
            },
            (error) => {
                console.error('Error fetching staff profile:', error);
                onData(null);
            },
        );
    }

    async createStaffProfile(uid: string, profile: StaffProfile): Promise<void> {
        const docRef = doc(db, STAFF_COLLECTION, uid);
        await setDoc(docRef, { ...profile, uid });
    }

    async updateStaffProfile(uid: string, data: Partial<StaffProfile>): Promise<void> {
        const docRef = doc(db, STAFF_COLLECTION, uid);
        await setDoc(docRef, data, { merge: true });
    }
}
