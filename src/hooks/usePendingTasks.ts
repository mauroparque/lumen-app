import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, appId, CLINIC_ID } from '../lib/firebase';
import { ClinicalNote, Appointment } from '../types';

export interface Subtask {
    text: string;
    completed: boolean;
}

export interface PendingTask {
    noteId: string;
    appointmentId: string;
    patientId: string;
    patientName?: string;
    taskIndex: number;
    text: string;
    subtasks?: Subtask[];
    createdAt: any;
    appointmentDate?: string;
}

export const usePendingTasks = (appointments: Appointment[] = []) => {
    const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
    const [loading, setLoading] = useState(true);

    // Function to mark a task as completed
    const completeTask = async (noteId: string, taskIndex: number) => {
        try {
            const noteRef = doc(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'notes', noteId);
            const noteSnap = await getDoc(noteRef);

            if (noteSnap.exists()) {
                const noteData = noteSnap.data() as ClinicalNote;
                const updatedTasks = [...(noteData.tasks || [])];

                if (updatedTasks[taskIndex]) {
                    updatedTasks[taskIndex].completed = true;
                    await updateDoc(noteRef, { tasks: updatedTasks });
                }
            }
        } catch (error) {
            console.error('Error completing task:', error);
            throw error;
        }
    };

    useEffect(() => {
        const notesRef = collection(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'notes');

        const unsubscribe = onSnapshot(notesRef, (snapshot) => {
            const allPendingTasks: PendingTask[] = [];

            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data() as ClinicalNote;

                // Check if note has tasks with incomplete items
                if (data.tasks && Array.isArray(data.tasks)) {
                    // Find the appointment to get its date
                    const appointment = appointments.find(a => a.id === data.appointmentId);

                    data.tasks.forEach((task, index) => {
                        if (!task.completed) {
                            allPendingTasks.push({
                                noteId: docSnap.id,
                                appointmentId: data.appointmentId,
                                patientId: data.patientId,
                                taskIndex: index,
                                text: task.text,
                                subtasks: task.subtasks || [],
                                createdAt: data.createdAt,
                                appointmentDate: appointment?.date
                            });
                        }
                    });
                }
            });

            // Sort by appointment date (oldest first for priority)
            allPendingTasks.sort((a, b) => {
                // Try to sort by appointment date first
                if (a.appointmentDate && b.appointmentDate) {
                    return a.appointmentDate.localeCompare(b.appointmentDate);
                }
                // Otherwise sort by creation date
                const dateA = a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(0);
                return dateA.getTime() - dateB.getTime();
            });

            setPendingTasks(allPendingTasks);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [appointments]);

    return { pendingTasks, loading, completeTask };
};


