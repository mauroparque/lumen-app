import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Patient, Appointment } from '../../types';
import { ModalOverlay } from '../ui';
import { toast } from 'sonner';
import { useDataActions } from '../../hooks/useDataActions';

interface AppointmentModalProps {
    onClose: () => void;
    patients: Patient[];
    user: User;
    existingAppointment?: Appointment;
    initialDate?: string;
    initialTime?: string;
}

export const AppointmentModal = ({ onClose, patients, user, existingAppointment, initialDate, initialTime }: AppointmentModalProps) => {
    const getTodayString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [form, setForm] = useState({
        patientId: existingAppointment?.patientId || '',
        date: existingAppointment?.date || initialDate || getTodayString(),
        time: existingAppointment?.time || initialTime || '09:00',
        type: existingAppointment?.type || 'presencial',
        price: existingAppointment?.price || 5000,
        professional: existingAppointment?.professional || user.displayName || ''
    });

    useEffect(() => {
        if (!existingAppointment && form.patientId) {
            const selectedPatient = patients.find(p => p.id === form.patientId);
            if (selectedPatient && selectedPatient.fee) {
                setForm(prev => ({ ...prev, price: selectedPatient.fee ?? 0 }));
            }
        }
    }, [form.patientId, patients, existingAppointment]);

    const { addAppointment, updateAppointment } = useDataActions(user);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const patient = patients.find(p => p.id === form.patientId);
        if (!patient) return;

        try {
            if (existingAppointment) {
                await updateAppointment(existingAppointment.id, {
                    ...form,
                    patientName: patient.name
                });
                toast.success('Turno actualizado correctamente');
            } else {
                await addAppointment({
                    ...form,
                    patientName: patient.name,
                    status: 'programado',
                    isPaid: false,
                    duration: 60
                });
                toast.success(`Turno creado para ${patient.name}`);
            }
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar el turno');
        }
    };

    return (
        <ModalOverlay onClose={onClose}>
            <div className="p-6">
                <h2 className="text-xl font-bold mb-4 text-slate-800">{existingAppointment ? 'Editar Turno' : 'Nuevo Turno'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Paciente</label>
                        <select className="w-full p-2 border rounded-lg bg-white" value={form.patientId} onChange={e => setForm({ ...form, patientId: e.target.value })} required>
                            <option value="">Seleccionar paciente...</option>
                            {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                            <input type="date" className="w-full p-2 border rounded-lg" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Hora</label>
                            <input type="time" className="w-full p-2 border rounded-lg" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} required />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Modalidad</label>
                            <select className="w-full p-2 border rounded-lg bg-white" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })}>
                                <option value="presencial">Presencial</option>
                                <option value="online">Online</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Valor Sesión</label>
                            <input type="number" className="w-full p-2 border rounded-lg" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Profesional (Opcional)</label>
                        <input
                            type="text"
                            className="w-full p-2 border rounded-lg"
                            value={form.professional}
                            onChange={e => setForm({ ...form, professional: e.target.value })}
                            placeholder="Ej: Lic. Martínez"
                        />
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">Cancelar</button>
                        <button type="submit" className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 shadow-sm font-medium">Guardar Turno</button>
                    </div>
                </form>
            </div>
        </ModalOverlay>
    );
};
