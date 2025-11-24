import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Patient } from '../../types';
import { ModalOverlay } from '../ui';
import { useDataActions } from '../../hooks/useDataActions';

interface AppointmentModalProps {
    onClose: () => void;
    patients: Patient[];
    user: User;
}

export const AppointmentModal = ({ onClose, patients, user }: AppointmentModalProps) => {
    const [form, setForm] = useState({
        patientId: '',
        date: new Date().toISOString().split('T')[0],
        time: '09:00',
        type: 'presencial' as const,
        price: '',
        meetLink: ''
    });

    const { addAppointment } = useDataActions(user);

    // Auto-fill price when patient changes
    useEffect(() => {
        const p = patients.find(pat => pat.id === form.patientId);
        if (p && p.fee) {
            setForm(prev => ({ ...prev, price: p.fee!.toString() }));
        }
    }, [form.patientId, patients]);

    // Auto-generate Meet link when type is online
    useEffect(() => {
        if (form.type === 'online' && !form.meetLink) {
            const randomId = Math.random().toString(36).substring(7);
            setForm(prev => ({ ...prev, meetLink: `https://meet.google.com/${randomId}` }));
        } else if (form.type === 'presencial') {
            setForm(prev => ({ ...prev, meetLink: '' }));
        }
    }, [form.type]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const p = patients.find((pat: Patient) => pat.id === form.patientId);
        if (!p) return;

        await addAppointment({
            ...form,
            price: parseFloat(form.price) || 0,
            patientName: p.name,
            patientEmail: p.email,
            status: 'programado',
            isPaid: false,
            duration: 60
        });
        onClose();
    };

    return (
        <ModalOverlay onClose={onClose}>
            <div className="p-6">
                <h2 className="text-xl font-bold mb-4">Agendar Turno</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <select required className="w-full p-2 border rounded-lg" value={form.patientId} onChange={e => setForm({ ...form, patientId: e.target.value })}>
                        <option value="">Seleccionar Paciente...</option>
                        {patients.map((p: Patient) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-xs text-slate-500">Fecha</label><input required type="date" className="w-full p-2 border rounded-lg" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                        <div><label className="text-xs text-slate-500">Hora</label><input required type="time" className="w-full p-2 border rounded-lg" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-slate-500">Costo de Sesión</label>
                            <div className="relative"><span className="absolute left-2 top-2 text-slate-400">$</span><input type="number" className="w-full pl-6 p-2 border rounded-lg" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500">Tipo</label>
                            <select className="w-full p-2 border rounded-lg" value={form.type} onChange={(e: any) => setForm({ ...form, type: e.target.value })}>
                                <option value="presencial">Presencial</option><option value="online">Online</option>
                            </select>
                        </div>
                    </div>
                    {form.type === 'online' && (
                        <div>
                            <label className="text-xs text-slate-500">Link de Reunión</label>
                            <input className="w-full p-2 border rounded-lg bg-slate-50 text-slate-600" value={form.meetLink} readOnly />
                        </div>
                    )}
                    <div className="flex justify-end mt-6"><button type="button" onClick={onClose} className="mr-3 text-slate-500">Cancelar</button><button type="submit" className="bg-teal-600 text-white px-4 py-2 rounded-lg">Guardar</button></div>
                </form>
            </div>
        </ModalOverlay>
    );
};
