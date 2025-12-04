import { User } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, updateDoc, writeBatch, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db, appId, CLINIC_ID } from '../lib/firebase';
import { MOCK_PATIENTS, MOCK_APPOINTMENTS, MOCK_PAYMENTS } from '../lib/mockData';

export const useDataActions = (user: User | null) => {
    const isDemo = user?.uid === 'demo-user';

    const addPatient = async (patient: any) => {
        if (isDemo) {
            const newPatient = { id: Math.random().toString(36).substr(2, 9), ...patient };
            MOCK_PATIENTS.push(newPatient);
            return newPatient;
        }
        const patientData = {
            ...patient,
            professional: patient.professional || user?.displayName || user?.email,
            createdByUid: user?.uid
        };
        return addDoc(collection(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'patients'), patientData);
    };

    const addAppointment = async (appointment: any) => {
        if (isDemo) {
            const newAppt = { id: Math.random().toString(36).substr(2, 9), ...appointment };
            MOCK_APPOINTMENTS.push(newAppt);
            return newAppt;
        }
        const appointmentData = {
            ...appointment,
            status: appointment.status || 'programado',
            professional: appointment.professional || user?.displayName || user?.email,
            createdByUid: user?.uid
        };
        return addDoc(collection(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'appointments'), appointmentData);
    };

    const addRecurringAppointments = async (baseAppointment: any, dates: string[], recurrenceRule: string = 'WEEKLY') => {
        if (isDemo) {
            const seriesId = Math.random().toString(36).substr(2, 9);
            dates.forEach((date, index) => {
                MOCK_APPOINTMENTS.push({
                    ...baseAppointment,
                    id: Math.random().toString(36).substr(2, 9),
                    date,
                    recurrenceId: seriesId,
                    recurrenceIndex: index,
                    recurrenceRule
                });
            });
            return;
        }

        const batch = writeBatch(db);
        const seriesId = crypto.randomUUID();

        dates.forEach((date, index) => {
            const docRef = doc(collection(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'appointments'));
            const appointmentData = {
                ...baseAppointment,
                date,
                status: baseAppointment.status || 'programado',
                professional: baseAppointment.professional || user?.displayName || user?.email,
                createdByUid: user?.uid,
                createdAt: serverTimestamp(),
                recurrenceId: seriesId,
                recurrenceIndex: index,
                recurrenceRule
            };
            batch.set(docRef, appointmentData);
        });

        return batch.commit();
    };

    const addPayment = async (payment: any, appointmentId?: string) => {
        if (isDemo) {
            const newPayment = { id: Math.random().toString(36).substr(2, 9), ...payment, date: { toDate: () => new Date() } };
            MOCK_PAYMENTS.push(newPayment);

            if (appointmentId) {
                const appt = MOCK_APPOINTMENTS.find(a => a.id === appointmentId);
                if (appt) appt.isPaid = true;
            }
            return newPayment;
        }

        const batch = writeBatch(db);
        const paymentRef = doc(collection(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'payments'));
        batch.set(paymentRef, { ...payment, date: Timestamp.now(), createdByUid: user?.uid });

        if (appointmentId) {
            const apptRef = doc(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'appointments', appointmentId);
            batch.update(apptRef, { isPaid: true });
        }

        return batch.commit();
    };

    const deleteItem = async (collectionName: string, id: string) => {
        if (isDemo) {
            if (collectionName === 'patients') {
                const idx = MOCK_PATIENTS.findIndex(p => p.id === id);
                if (idx > -1) MOCK_PATIENTS.splice(idx, 1);
            } else if (collectionName === 'appointments') {
                const idx = MOCK_APPOINTMENTS.findIndex(a => a.id === id);
                if (idx > -1) MOCK_APPOINTMENTS.splice(idx, 1);
            } else if (collectionName === 'payments') {
                const idx = MOCK_PAYMENTS.findIndex(p => p.id === id);
                if (idx > -1) MOCK_PAYMENTS.splice(idx, 1);
            }
            return;
        }
        return deleteDoc(doc(db, 'artifacts', appId, 'clinics', CLINIC_ID, collectionName, id));
    };

    const updateAppointment = async (id: string, data: any) => {
        if (isDemo) {
            const idx = MOCK_APPOINTMENTS.findIndex(a => a.id === id);
            if (idx > -1) {
                MOCK_APPOINTMENTS[idx] = { ...MOCK_APPOINTMENTS[idx], ...data };
            }
            return;
        }
        return updateDoc(doc(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'appointments', id), data);
    };

    const updatePatient = async (id: string, data: any) => {
        if (isDemo) {
            const idx = MOCK_PATIENTS.findIndex(p => p.id === id);
            if (idx > -1) {
                MOCK_PATIENTS[idx] = { ...MOCK_PATIENTS[idx], ...data };
            }
            return;
        }
        return updateDoc(doc(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'patients', id), data);
    };

    return { addPatient, addAppointment, addRecurringAppointments, updateAppointment, updatePatient, addPayment, deleteItem };
};
