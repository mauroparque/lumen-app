import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { ModalOverlay } from '../ui';
import { useDataActions } from '../../hooks/useDataActions';
import { usePatients } from '../../hooks/usePatients';
import { toast } from 'sonner';
import { StaffProfile } from '../../types';

interface PatientModalProps {
    onClose: () => void;
    user: User;
    profile: StaffProfile | null;
    existingPatient?: any;
}

export const PatientModal = ({ onClose, user, profile, existingPatient }: PatientModalProps) => {
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        dni: '',
        email: '',
        phone: '',
        fee: '',
        preference: 'presencial' as 'presencial' | 'online',
        office: '',
        professional: profile?.name || user.displayName || ''
    });

    const { patients } = usePatients(user);
    const [isCustomProfessional, setIsCustomProfessional] = useState(false);
    const { addPatient, updatePatient } = useDataActions();

    useEffect(() => {
        if (existingPatient) {
            setForm({
                firstName: existingPatient.name.split(' ')[0] || '',
                lastName: existingPatient.name.split(' ').slice(1).join(' ') || '',
                dni: existingPatient.dni || '',
                email: existingPatient.email || '',
                phone: existingPatient.phone || '',
                fee: existingPatient.fee?.toString() || '',
                preference: existingPatient.preference || 'presencial',
                office: existingPatient.office || '',
                professional: existingPatient.professional || profile?.name || user.displayName || ''
            });
        }
    }, [existingPatient, profile?.name, user.displayName]);

    // Get unique professionals from existing patients
    const existingProfessionals = useMemo(() => {
        const pros = new Set<string>();
        if (user.displayName) pros.add(user.displayName);
        patients.forEach(p => {
            if (p.professional) pros.add(p.professional);
        });
        return Array.from(pros);
    }, [patients, user.displayName]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const patientData = {
                ...form,
                name: `${form.firstName} ${form.lastName}`.trim(),
                fee: form.fee ? parseFloat(form.fee) : 0
            };

            if (existingPatient) {
                await updatePatient(existingPatient.id, patientData);
                toast.success(`Paciente ${form.firstName} actualizado`);
            } else {
                await addPatient(patientData);
                toast.success(`Paciente ${form.firstName} ${form.lastName} creado`);
            }
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar el paciente');
        }
    };

    return (
        <ModalOverlay onClose={onClose}>
            <div className="p-6">
                <h2 className="text-xl font-bold mb-4 text-slate-800">
                    {existingPatient ? 'Editar Paciente' : 'Nuevo Paciente'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                            <input
                                required
                                className="w-full p-2 border rounded-lg"
                                value={form.firstName}
                                onChange={e => setForm({ ...form, firstName: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Apellido</label>
                            <input
                                required
                                className="w-full p-2 border rounded-lg"
                                value={form.lastName}
                                onChange={e => setForm({ ...form, lastName: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">DNI (Opcional)</label>
                        <input
                            className="w-full p-2 border rounded-lg"
                            value={form.dni}
                            onChange={e => setForm({ ...form, dni: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                            <input
                                type="email"
                                className="w-full p-2 border rounded-lg"
                                value={form.email}
                                onChange={e => setForm({ ...form, email: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                            <input
                                type="tel"
                                className="w-full p-2 border rounded-lg"
                                value={form.phone}
                                onChange={e => setForm({ ...form, phone: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Honorarios</label>
                            <input
                                type="number"
                                className="w-full p-2 border rounded-lg"
                                value={form.fee}
                                onChange={e => setForm({ ...form, fee: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Modalidad Preferida</label>
                            <select
                                className="w-full p-2 border rounded-lg bg-white"
                                value={form.preference}
                                onChange={(e: any) => setForm({ ...form, preference: e.target.value })}
                            >
                                <option value="presencial">Presencial</option>
                                <option value="online">Online</option>
                            </select>
                        </div>
                    </div>

                    {form.preference === 'presencial' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Consultorio</label>
                            <input
                                className="w-full p-2 border rounded-lg"
                                placeholder="Dirección o Nombre"
                                value={form.office}
                                onChange={e => setForm({ ...form, office: e.target.value })}
                            />
                        </div>
                    )}

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-slate-700">Profesional Asignado</label>
                            <button
                                type="button"
                                onClick={() => setIsCustomProfessional(!isCustomProfessional)}
                                className="text-xs text-teal-600 hover:text-teal-700 underline"
                            >
                                {isCustomProfessional ? 'Seleccionar de lista' : '¿No está en la lista?'}
                            </button>
                        </div>

                        {isCustomProfessional ? (
                            <input
                                className="w-full p-2 border rounded-lg"
                                value={form.professional}
                                onChange={e => setForm({ ...form, professional: e.target.value })}
                                placeholder="Escribir nombre del profesional..."
                                autoFocus
                            />
                        ) : (
                            <select
                                className="w-full p-2 border rounded-lg bg-white"
                                value={form.professional}
                                onChange={e => {
                                    if (e.target.value === 'custom') {
                                        setIsCustomProfessional(true);
                                        setForm({ ...form, professional: '' });
                                    } else {
                                        setForm({ ...form, professional: e.target.value });
                                    }
                                }}
                            >
                                {existingProfessionals.map(p => (
                                    <option key={p} value={p}>{p === user.displayName ? `${p} (Yo)` : p}</option>
                                ))}
                                <option value="custom">+ Otro profesional...</option>
                            </select>
                        )}
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 shadow-sm font-medium"
                        >
                            Guardar Paciente
                        </button>
                    </div>
                </form>
            </div>
        </ModalOverlay>
    );
};
