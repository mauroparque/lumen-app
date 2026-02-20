import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    updateDoc,
    doc,
    Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, appId, CLINIC_ID } from '../lib/firebase';
import { ClinicalNote } from '../types';

export const useClinicalNotes = (user: User | null) => {
    const [loading, setLoading] = useState(false);

    const useClinicalNote = (appointmentId: string) => {
        const [note, setNote] = useState<ClinicalNote | null>(null);
        const [loadingNote, setLoadingNote] = useState(true);

        useEffect(() => {
            if (!appointmentId) {
                setLoadingNote(false);
                return;
            }

            const q = query(
                collection(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'notes'),
                where('appointmentId', '==', appointmentId)
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                if (!snapshot.empty) {
                    const docData = snapshot.docs[0];
                    setNote({ id: docData.id, ...docData.data() } as ClinicalNote);
                } else {
                    setNote(null);
                }
                setLoadingNote(false);
            });

            return () => unsubscribe();
        }, [appointmentId]);

        return { note, loadingNote };
    };

    const saveNote = async (noteData: Partial<ClinicalNote>, appointmentId: string, existingNoteId?: string) => {
        if (!user) return;
        setLoading(true);
        try {
            const notesCollection = collection(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'notes');

            // Base payload without ownership fields — those are set only on creation
            const basePayload = {
                ...noteData,
                appointmentId,
                updatedAt: Timestamp.now(),
            };

            if (existingNoteId) {
                // On update: preserve existing createdBy/createdByUid to avoid
                // admin edits accidentally changing note ownership
                await updateDoc(doc(notesCollection, existingNoteId), basePayload);
            } else {
                // On create: set ownership with a guaranteed non-null author string
                await addDoc(notesCollection, {
                    ...basePayload,
                    createdAt: Timestamp.now(),
                    createdBy: user.email ?? user.uid,
                    createdByUid: user.uid,
                });
            }

            // Update appointment to indicate it has notes
            const appointmentRef = doc(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'appointments', appointmentId);
            await updateDoc(appointmentRef, { hasNotes: true });

        } catch (error) {
            console.error('Error saving note:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const uploadAttachment = async (file: File, patientId: string) => {
        if (!user) throw new Error('User not authenticated');
        setLoading(true);
        try {
            const timestamp = Date.now();
            const storageRef = ref(storage, `patients/${patientId}/attachments/${timestamp}_${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            return url;
        } catch (error) {
            console.error('Error uploading attachment:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    // Hook to get all notes for a specific patient
    const usePatientNotes = (patientId: string | null) => {
        const [notes, setNotes] = useState<ClinicalNote[]>([]);
        const [loadingNotes, setLoadingNotes] = useState(true);

        useEffect(() => {
            if (!patientId) {
                setLoadingNotes(false);
                return;
            }

            const q = query(
                collection(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'notes'),
                where('patientId', '==', patientId)
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedNotes = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as ClinicalNote));
                // Sort by createdAt descending
                fetchedNotes.sort((a, b) => {
                    const dateA = a.createdAt?.toDate?.() || new Date(0);
                    const dateB = b.createdAt?.toDate?.() || new Date(0);
                    return dateB.getTime() - dateA.getTime();
                });
                setNotes(fetchedNotes);
                setLoadingNotes(false);
            });

            return () => unsubscribe();
        }, [patientId]);

        return { notes, loadingNotes };
    };

    return { useClinicalNote, usePatientNotes, saveNote, uploadAttachment, loading };
};
