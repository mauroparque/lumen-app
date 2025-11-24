import { User } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, updateDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { MOCK_PATIENTS, MOCK_APPOINTMENTS, MOCK_PAYMENTS } from '../lib/mockData';

export const useDataActions = (user: User | null) => {
    const isDemo = user?.uid === 'demo-user';

    const addPatient = async (patient: any) => {
        if (isDemo) {
            const newPatient = { id: Math.random().toString(36).substr(2, 9), ...patient };
            MOCK_PATIENTS.push(newPatient);
            return newPatient;
        }
        return addDoc(collection(db, 'artifacts', appId, 'users', user!.uid, 'patients'), patient);
    };

    const addAppointment = async (appointment: any) => {
        if (isDemo) {
            const newAppt = { id: Math.random().toString(36).substr(2, 9), ...appointment };
            MOCK_APPOINTMENTS.push(newAppt);
            return newAppt;
        }
        return addDoc(collection(db, 'artifacts', appId, 'users', user!.uid, 'appointments'), appointment);
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
        const paymentRef = doc(collection(db, 'artifacts', appId, 'users', user!.uid, 'payments'));
        batch.set(paymentRef, { ...payment, date: Timestamp.now() });

        if (appointmentId) {
            const apptRef = doc(db, 'artifacts', appId, 'users', user!.uid, 'appointments', appointmentId);
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
        return deleteDoc(doc(db, 'artifacts', appId, 'users', user!.uid, collectionName, id));
    };

    return { addPatient, addAppointment, addPayment, deleteItem };
};
