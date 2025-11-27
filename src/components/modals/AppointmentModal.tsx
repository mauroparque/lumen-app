import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Patient, Appointment } from '../../types';
import { ModalOverlay } from '../ui';
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

    const [form, setForm] = useState<{
        patientId: string;
        date: string;
        time: string;
        duration: number;
        type: 'presencial' | 'online';
        price: string;
        meetLink: string;
        professional: string;
    }>({
        patientId: existingAppointment?.patientId || '',
        date: existingAppointment?.date || initialDate || getTodayString(),
        time: existingAppointment?.time || initialTime || '09:00',
        duration: existingAppointment?.duration || 45,
        type: existingAppointment?.type || 'presencial',
        price: existingAppointment?.price?.toString() || '',
        meetLink: existingAppointment?.meetLink || '',
        professional: existingAppointment?.professional || ''
    });

    const { addAppointment, updateAppointment } = useDataActions(user);

    // Auto-fill price when patient changes (only if not editing or if patient changed)
    useEffect(() => {
        if (!existingAppointment && form.patientId) {
            const p = patients.find(pat => pat.id === form.patientId);
            if (p && p.fee) {
                setForm(prev => ({ ...prev, price: p.fee!.toString() }));
            }
        }
    }, [form.patientId, patients, existingAppointment]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const p = patients.find((pat: Patient) => pat.id === form.patientId);
        if (!p) return;

        const appointmentData = {
            ...form,
            price: parseFloat(form.price) || 0,
            patientName: p.name,
            patientEmail: p.email,
            status: existingAppointment?.status || 'programado',
            isPaid: existingAppointment?.isPaid || false,
        };

        if (existingAppointment) {
            await updateAppointment(existingAppointment.id, appointmentData);
        } else {
            await addAppointment(appointmentData);
        }
        onClose();
    };

    return (
        <ModalOverlay onClose={onClose}>
            <div className="p-6">
                <h2 className="text-xl font-bold mb-4">{existingAppointment ? 'Editar Turno' : 'Agendar Turno'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <select required className="w-full p-2 border rounded-lg" value={form.patientId} onChange={e => setForm({ ...form, patientId: e.target.value })}>
                        <option value="">Seleccionar Paciente...</option>
                        {patients.map((p: Patient) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1"><label className="text-xs text-slate-500">Fecha</label><input required type="date" className="w-full p-2 border rounded-lg" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                        <div className="col-span-1"><label className="text-xs text-slate-500">Hora</label><input required type="time" className="w-full p-2 border rounded-lg" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></div>
                        <div className="col-span-1"><label className="text-xs text-slate-500">Duración (min)</label><input required type="number" className="w-full p-2 border rounded-lg" value={form.duration} onChange={e => setForm({ ...form, duration: parseInt(e.target.value) })} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-slate-500">Costo de Sesión</label>
                            <div className="relative"><span className="absolute left-2 top-2 text-slate-400">$</span><input type="number" className="w-full pl-6 p-2 border rounded-lg" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500">Tipo</label>
                            <select className="w-full p-2 border rounded-lg" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'presencial' | 'online' })}>
                                <option value="presencial">Presencial</option><option value="online">Online</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500">Profesional (Opcional)</label>
                        <input type="text" placeholder="Nombre del profesional" className="w-full p-2 border rounded-lg" value={form.professional} onChange={e => setForm({ ...form, professional: e.target.value })} />
                    </div>
                    {form.type === 'online' && (
                        <div>
                            <label className="text-xs text-slate-500">Link de Reunión (Opcional)</label>
                            <input placeholder="https://meet.google.com/..." className="w-full p-2 border rounded-lg" value={form.meetLink} onChange={e => setForm({ ...form, meetLink: e.target.value })} />
                        </div>
                    )}
                    <div className="flex justify-end mt-6"><button type="button" onClick={onClose} className="mr-3 text-slate-500">Cancelar</button><button type="submit" className="bg-teal-600 text-white px-4 py-2 rounded-lg">Guardar</button></div>
                </form>
            </div>
        </ModalOverlay>
    );
};
