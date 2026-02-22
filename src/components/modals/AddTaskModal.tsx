import { useState } from 'react';
import { ModalOverlay } from '../ui';
import { Plus, X } from 'lucide-react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, appId, CLINIC_ID } from '../../lib/firebase';
import { toast } from 'sonner';

interface AddTaskModalProps {
    onClose: () => void;
    patientId: string;
    patientName: string;
    userName: string;
}

export const AddTaskModal = ({ onClose, patientId, patientName, userName }: AddTaskModalProps) => {
    const [taskText, setTaskText] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!taskText.trim()) return;

        setSaving(true);
        try {
            // Create a standalone note with just tasks (no appointment)
            const notesCollection = collection(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'notes');

            await addDoc(notesCollection, {
                patientId,
                appointmentId: `standalone-${patientId}-${Date.now()}`, // Special prefix for standalone tasks
                content: '',
                attachments: [],
                tasks: [{ text: taskText.trim(), completed: false }],
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                createdBy: userName,
            });

            toast.success('Tarea creada');
            onClose();
        } catch (error) {
            console.error('Error creating task:', error);
            toast.error('Error al crear la tarea');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalOverlay onClose={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-slate-800">Nueva Tarea</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="text-sm text-slate-500 mb-4">
                    Para: <span className="font-medium text-slate-700">{patientName}</span>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Descripción de la tarea</label>
                        <textarea
                            className="w-full p-3 border rounded-lg resize-none focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                            rows={3}
                            placeholder="Ej: Enviar informe, Coordinar con familiar, etc."
                            value={taskText}
                            onChange={(e) => setTaskText(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={!taskText.trim() || saving}
                            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <Plus size={18} />
                            {saving ? 'Guardando...' : 'Crear Tarea'}
                        </button>
                    </div>
                </form>
            </div>
        </ModalOverlay>
    );
};
