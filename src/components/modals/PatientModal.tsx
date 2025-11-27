import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { ModalOverlay } from '../ui';
import { useDataActions } from '../../hooks/useDataActions';
import { toast } from 'sonner';

interface PatientModalProps {
    onClose: () => void;
    user: User;
}

export const PatientModal = ({ onClose, user }: PatientModalProps) => {
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        dni: '',
        email: '',
        phone: '',
        fee: '',
        preference: 'presencial' as 'presencial' | 'online',
        office: '',
        professional: user.displayName || ''
    });

    const { addPatient } = useDataActions(user);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addPatient({
                ...form,
                name: `${form.firstName} ${form.lastName}`.trim(),
                fee: form.fee ? parseFloat(form.fee) : 0
            });
            toast.success(`Paciente ${form.firstName} ${form.lastName} creado`);
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Error al crear el paciente');
        }
    };

    return (
        <ModalOverlay onClose={onClose}>
            <div className="p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4 text-slate-800">Nuevo Paciente</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                            <input required className="w-full p-2 border rounded-lg" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Apellido</label>
                            <input required className="w-full p-2 border rounded-lg" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">DNI (Opcional)</label>
                        <input className="w-full p-2 border rounded-lg" value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                            <input type="email" className="w-full p-2 border rounded-lg" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                            <input type="tel" className="w-full p-2 border rounded-lg" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Honorarios</label>
                            <input type="number" className="w-full p-2 border rounded-lg" value={form.fee} onChange={e => setForm({ ...form, fee: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Modalidad Preferida</label>
                            <select className="w-full p-2 border rounded-lg bg-white" value={form.preference} onChange={(e: any) => setForm({ ...form, preference: e.target.value })}>
                                <option value="presencial">Presencial</option>
                                <option value="online">Online</option>
                            </select>
                        </div>
                    </div>

                    {form.preference === 'presencial' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Consultorio</label>
                            <input className="w-full p-2 border rounded-lg" placeholder="Dirección o Nombre" value={form.office} onChange={e => setForm({ ...form, office: e.target.value })} />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Profesional Asignado</label>
                        <input className="w-full p-2 border rounded-lg" value={form.professional} onChange={e => setForm({ ...form, professional: e.target.value })} />
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">Cancelar</button>
                        <button type="submit" className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 shadow-sm font-medium">Guardar Paciente</button>
                    </div>
                </form>
            </div>
        </ModalOverlay>
    );
};
