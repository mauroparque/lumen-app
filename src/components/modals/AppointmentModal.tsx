import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Patient, Appointment, StaffProfile } from '../../types';
import { ModalOverlay } from '../ui';
import { toast } from 'sonner';
import { useDataActions } from '../../hooks/useDataActions';
import { CONSULTATION_TYPES } from '../../lib/constants';

interface AppointmentModalProps {
    onClose: () => void;
    patients: Patient[];
    user: User;
    profile: StaffProfile | null;
    existingAppointment?: Appointment;
    initialDate?: string;
    initialTime?: string;
}

export const AppointmentModal = ({
    onClose,
    patients,
    profile,
    existingAppointment,
    initialDate,
    initialTime,
}: AppointmentModalProps) => {
    const { addAppointment, updateAppointment, addRecurringAppointments } = useDataActions();

    const getTodayString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const professionalName = existingAppointment?.professional || profile?.name || '';

    const [form, setForm] = useState({
        patientId: existingAppointment?.patientId || '',
        date: existingAppointment?.date || initialDate || getTodayString(),
        time: existingAppointment?.time || initialTime || '09:00',
        duration: existingAppointment?.duration || 45,
        type: existingAppointment?.type || 'presencial',
        price: existingAppointment?.price || 5000,
        isPaid: existingAppointment?.isPaid || false,
        professional: professionalName,
        office: existingAppointment?.office || '',
        consultationType: existingAppointment?.consultationType || CONSULTATION_TYPES[0],
        excludeFromPsique: existingAppointment?.excludeFromPsique || false,
    });

    // Check if selected patient is from Psique
    const selectedPatient = patients.find((p) => p.id === form.patientId);
    const isPsiquePatient = selectedPatient?.patientSource === 'psique';

    const [isRecurrent, setIsRecurrent] = useState(false);
    const [recurrenceCount, setRecurrenceCount] = useState(4);
    const [recurrenceFrequency, setRecurrenceFrequency] = useState<'WEEKLY' | 'BIWEEKLY'>('WEEKLY');

    // Restaurar autocompletado de datos del paciente
    useEffect(() => {
        if (!existingAppointment && form.patientId) {
            const selectedPatient = patients.find((p) => p.id === form.patientId);
            if (selectedPatient) {
                setForm((prev) => ({
                    ...prev,
                    // Si el paciente tiene honorarios, usarlos. Si no, mantener el default.
                    price: selectedPatient.fee || prev.price,
                    // Si el paciente tiene preferencia, usarla.
                    type: selectedPatient.preference || prev.type,
                    // Si es presencial y tiene oficina, usarla.
                    office: selectedPatient.office || prev.office,
                }));
            }
        }
    }, [form.patientId, patients, existingAppointment]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const patient = patients.find((p) => p.id === form.patientId);
            const appointmentData = {
                ...form,
                patientName: patient?.name || 'Unknown',
                patientEmail: patient?.email,
                status: existingAppointment?.status || ('programado' as const),
            };

            if (existingAppointment) {
                await updateAppointment(existingAppointment.id, appointmentData);
                toast.success('Turno actualizado');
            } else {
                if (isRecurrent) {
                    // Generate dates
                    const dates: string[] = [];
                    const baseDate = new Date(form.date + 'T' + form.time);
                    const daysToAdd = recurrenceFrequency === 'WEEKLY' ? 7 : 14;

                    for (let i = 0; i < recurrenceCount; i++) {
                        const d = new Date(baseDate);
                        d.setDate(d.getDate() + i * daysToAdd);
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        dates.push(`${year}-${month}-${day}`);
                    }
                    await addRecurringAppointments(appointmentData, dates, recurrenceFrequency);
                    toast.success('Turnos recurrentes creados');
                } else {
                    await addAppointment(appointmentData);
                    toast.success('Turno creado');
                }
            }
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar el turno');
        }
    };

    return (
        <ModalOverlay onClose={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-3 text-slate-800">
                    {existingAppointment ? 'Editar Turno' : 'Nuevo Turno'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Paciente</label>
                        <select
                            className="w-full p-2 border rounded-lg bg-white"
                            value={form.patientId}
                            onChange={(e) => setForm({ ...form, patientId: e.target.value })}
                            required
                        >
                            <option value="">Seleccionar paciente...</option>
                            {[...patients]
                                .filter((p) => p.isActive !== false)
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                            <input
                                type="date"
                                className="w-full p-2 border rounded-lg"
                                value={form.date}
                                onChange={(e) => setForm({ ...form, date: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Hora y Duración</label>
                            <div className="flex space-x-2">
                                <input
                                    type="time"
                                    className="w-full p-2 border rounded-lg"
                                    value={form.time}
                                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                                    required
                                />
                                <input
                                    type="number"
                                    className="w-24 p-2 border rounded-lg"
                                    value={form.duration}
                                    onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                                    placeholder="Min"
                                    title="Duración en minutos"
                                />
                            </div>
                        </div>
                    </div>

                    {!existingAppointment && (
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4">
                            <div className="flex items-center space-x-2 mb-2">
                                <input
                                    type="checkbox"
                                    id="isRecurrent"
                                    className="rounded text-teal-600 focus:ring-teal-500"
                                    checked={isRecurrent}
                                    onChange={(e) => setIsRecurrent(e.target.checked)}
                                />
                                <label htmlFor="isRecurrent" className="text-sm text-slate-700">
                                    Repetir turno
                                </label>
                            </div>
                            {isRecurrent && (
                                <div className="grid grid-cols-2 gap-4 mb-2">
                                    <div>
                                        <label className="block text-sm text-slate-600 mb-1">Frecuencia</label>
                                        <select
                                            className="w-full p-2 border rounded-lg bg-white"
                                            value={recurrenceFrequency}
                                            onChange={(e) =>
                                                setRecurrenceFrequency(e.target.value as 'WEEKLY' | 'BIWEEKLY')
                                            }
                                        >
                                            <option value="WEEKLY">Semanal</option>
                                            <option value="BIWEEKLY">Quincenal</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-slate-600 mb-1">
                                            Cantidad de sesiones
                                        </label>
                                        <input
                                            type="number"
                                            className="w-full p-2 border rounded-lg"
                                            value={recurrenceCount}
                                            onChange={(e) => setRecurrenceCount(Number(e.target.value))}
                                            min="2"
                                            max="52"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                            <select
                                className="w-full p-2 border rounded-lg bg-white"
                                value={form.type}
                                onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                            >
                                <option value="presencial">Presencial</option>
                                <option value="online">Online</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Valor Sesión</label>
                            <input
                                type="number"
                                className="w-full p-2 border rounded-lg"
                                value={form.price}
                                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Consulta</label>
                        <select
                            className="w-full p-2 border rounded-lg bg-white"
                            value={CONSULTATION_TYPES.includes(form.consultationType) ? form.consultationType : 'Otro'}
                            onChange={(e) => {
                                if (e.target.value === 'Otro') {
                                    setForm({ ...form, consultationType: '' });
                                } else {
                                    setForm({ ...form, consultationType: e.target.value });
                                }
                            }}
                        >
                            {CONSULTATION_TYPES.map((type) => (
                                <option key={type} value={type}>
                                    {type}
                                </option>
                            ))}
                        </select>
                        {(!CONSULTATION_TYPES.includes(form.consultationType) ||
                            form.consultationType === 'Otro' ||
                            form.consultationType === '') && (
                            <input
                                type="text"
                                className="w-full p-2 border rounded-lg mt-2"
                                placeholder="Especificar tipo de consulta..."
                                value={form.consultationType === 'Otro' ? '' : form.consultationType}
                                onChange={(e) => setForm({ ...form, consultationType: e.target.value })}
                            />
                        )}
                    </div>

                    {form.type === 'presencial' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Consultorio / Ubicación
                            </label>
                            <input
                                type="text"
                                className="w-full p-2 border rounded-lg"
                                value={form.office}
                                onChange={(e) => setForm({ ...form, office: e.target.value })}
                                placeholder="Ej: Consultorio 1, Piso 2"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Profesional (Opcional)</label>
                        <input
                            type="text"
                            className="w-full p-2 border rounded-lg"
                            value={form.professional}
                            onChange={(e) => setForm({ ...form, professional: e.target.value })}
                            placeholder="Ej: Lic. Martínez"
                        />
                    </div>

                    {/* Psique exclusion checkbox - only for Psique patients */}
                    {isPsiquePatient && (
                        <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="excludeFromPsique"
                                    className="rounded text-purple-600 focus:ring-purple-500"
                                    checked={form.excludeFromPsique}
                                    onChange={(e) => setForm({ ...form, excludeFromPsique: e.target.checked })}
                                />
                                <label htmlFor="excludeFromPsique" className="text-sm text-purple-700">
                                    No descontar porcentaje para Psique
                                </label>
                            </div>
                        </div>
                    )}

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
                            Guardar Turno
                        </button>
                    </div>
                </form>
            </div>
        </ModalOverlay>
    );
};
