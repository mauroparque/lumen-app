import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, appId, CLINIC_ID } from './firebase';
import { User } from 'firebase/auth';

export const requestInvoice = async (appointmentId: string, user: User): Promise<string> => {
    const queueRef = collection(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'integrations', 'billing', 'queue');

    const docRef = await addDoc(queueRef, {
        appointmentId,
        status: 'pending',
        createdAt: serverTimestamp(),
        retryCount: 0,
        requestedBy: user.uid
    });

    return docRef.id;
};

export const requestBatchInvoice = async (appointments: any[], user: User, patientData: any): Promise<string> => {
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
        requestedBy: user.uid
    });

    return docRef.id;
};
