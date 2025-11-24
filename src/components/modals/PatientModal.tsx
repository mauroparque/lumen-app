import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { ModalOverlay } from '../ui';
import { useDataActions } from '../../hooks/useDataActions';

interface PatientModalProps {
    onClose: () => void;
    user: User;
}

export const PatientModal = ({ onClose, user }: PatientModalProps) => {
    const [form, setForm] = useState({ name: '', email: '', phone: '', fee: '' });
    const { addPatient } = useDataActions(user);

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        await addPatient({
            ...form,
            fee: form.fee ? parseFloat(form.fee) : 0
        });
        onClose();
    };

    return (
        <ModalOverlay onClose={onClose}>
            <form onSubmit={save} className="p-6 space-y-4">
                <h3 className="font-bold">Nuevo Paciente</h3>
                <input className="w-full p-2 border rounded" placeholder="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <input className="w-full p-2 border rounded" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                <input className="w-full p-2 border rounded" placeholder="Teléfono" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                <input className="w-full p-2 border rounded" placeholder="Honorarios Habituales ($)" type="number" value={form.fee} onChange={e => setForm({ ...form, fee: e.target.value })} />
                <button className="w-full bg-teal-600 text-white p-2 rounded">Guardar</button>
            </form>
        </ModalOverlay>
    );
};
