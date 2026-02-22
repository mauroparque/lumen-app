import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { ModalOverlay } from '../ui';
import { useDataActions } from '../../hooks/useDataActions';
import { usePatients } from '../../hooks/usePatients';
import { toast } from 'sonner';
import { StaffProfile, ContactRelationship, Patient, PatientInput } from '../../types';
import { ChevronDown, ChevronUp, Baby } from 'lucide-react';

interface PatientModalProps {
    onClose: () => void;
    user: User;
    profile: StaffProfile | null;
    existingPatient?: Patient;
}

const CONTACT_RELATIONSHIPS: { value: ContactRelationship; label: string }[] = [
    { value: 'padre', label: 'Padre' },
    { value: 'madre', label: 'Madre' },
    { value: 'amigo', label: 'Amigo/a' },
    { value: 'pareja', label: 'Pareja' },
    { value: 'otro', label: 'Otro' },
];

const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const calculateAge = (birthDate: string): number | null => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
};

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
        professional: profile?.name || user.displayName || '',
        // New fields
        birthDate: '',
        admissionDate: getTodayString(),
        isActive: true,
        dischargeType: '' as '' | 'clinical' | 'dropout',
        dischargeDate: '',
        patientSource: 'particular' as 'psique' | 'particular',
        contactName: '',
        contactPhone: '',
        contactRelationship: '' as ContactRelationship | '',
        contactRelationshipOther: '',
    });

    const [showAdvanced, setShowAdvanced] = useState(false);
    const { patients } = usePatients(user);
    const [isCustomProfessional, setIsCustomProfessional] = useState(false);
    const { addPatient, updatePatient } = useDataActions();

    // Calculate if patient is child (< 18)
    const isChild = useMemo(() => {
        const age = calculateAge(form.birthDate);
        return age !== null && age < 18;
    }, [form.birthDate]);

    const age = useMemo(() => calculateAge(form.birthDate), [form.birthDate]);

    useEffect(() => {
        if (existingPatient) {
            setForm({
                firstName: existingPatient.firstName || existingPatient.name.split(' ')[0] || '',
                lastName: existingPatient.lastName || existingPatient.name.split(' ').slice(1).join(' ') || '',
                dni: existingPatient.dni || '',
                email: existingPatient.email || '',
                phone: existingPatient.phone || '',
                fee: existingPatient.fee?.toString() || '',
                preference: existingPatient.preference || 'presencial',
                office: existingPatient.office || '',
                professional: existingPatient.professional || profile?.name || user.displayName || '',
                // New fields
                birthDate: existingPatient.birthDate || '',
                admissionDate: existingPatient.admissionDate || '',
                isActive: existingPatient.isActive ?? true,
                dischargeType: existingPatient.dischargeType || '',
                dischargeDate: existingPatient.dischargeDate || '',
                patientSource: existingPatient.patientSource || 'particular',
                contactName: existingPatient.contactName || '',
                contactPhone: existingPatient.contactPhone || '',
                contactRelationship: existingPatient.contactRelationship || '',
                contactRelationshipOther: existingPatient.contactRelationshipOther || '',
            });
            // Show advanced if any advanced field has data
            if (
                existingPatient.birthDate ||
                existingPatient.admissionDate ||
                existingPatient.contactName ||
                !existingPatient.isActive
            ) {
                setShowAdvanced(true);
            }
        }
    }, [existingPatient, profile?.name, user.displayName]);

    // Get unique professionals from existing patients
    const existingProfessionals = useMemo(() => {
        const pros = new Set<string>();
        if (user.displayName) pros.add(user.displayName);
        patients.forEach((p) => {
            if (p.professional) pros.add(p.professional);
        });
        return Array.from(pros);
    }, [patients, user.displayName]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Build patient data, then filter out undefined values
            // Firebase doesn't accept undefined field values
            const rawPatientData = {
                firstName: form.firstName,
                lastName: form.lastName,
                name: `${form.firstName} ${form.lastName}`.trim(),
                dni: form.dni || '',
                email: form.email || '',
                phone: form.phone || '',
                preference: form.preference,
                office: form.office || '',
                professional: form.professional || '',
                isActive: form.isActive,
                patientSource: form.patientSource,
                fee: form.fee ? parseFloat(form.fee) : undefined,
                birthDate: form.birthDate || undefined,
                admissionDate: form.admissionDate || undefined,
                // Discharge info
                dischargeType: !form.isActive && form.dischargeType ? form.dischargeType : undefined,
                dischargeDate: !form.isActive && form.dischargeDate ? form.dischargeDate : undefined,
                // Contact info
                contactName: form.contactName || undefined,
                contactPhone: form.contactPhone || undefined,
                contactRelationship: form.contactRelationship || undefined,
                contactRelationshipOther:
                    form.contactRelationship === 'otro' && form.contactRelationshipOther
                        ? form.contactRelationshipOther
                        : undefined,
            };

            // Remove undefined fields - Firebase doesn't accept undefined values
            const patientData = Object.fromEntries(
                Object.entries(rawPatientData).filter(([_, value]) => value !== undefined),
            ) as unknown as PatientInput;

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
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4 text-slate-800">
                    {existingPatient ? 'Editar Paciente' : 'Nuevo Paciente'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                            <input
                                required
                                className="w-full p-2 border rounded-lg"
                                value={form.firstName}
                                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Apellido *</label>
                            <input
                                required
                                className="w-full p-2 border rounded-lg"
                                value={form.lastName}
                                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">DNI</label>
                            <input
                                className="w-full p-2 border rounded-lg"
                                value={form.dni}
                                onChange={(e) => setForm({ ...form, dni: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Fecha de Nacimiento
                                {age !== null && (
                                    <span className="ml-2 text-xs text-slate-500">
                                        ({age} años{isChild && ' - Menor'})
                                    </span>
                                )}
                            </label>
                            <input
                                type="date"
                                className="w-full p-2 border rounded-lg"
                                value={form.birthDate}
                                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                            <input
                                type="email"
                                className="w-full p-2 border rounded-lg"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                            <input
                                type="tel"
                                className="w-full p-2 border rounded-lg"
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Patient Source Badge */}
                    <div className="flex items-center gap-4">
                        <label className="block text-sm font-medium text-slate-700">Origen:</label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setForm({ ...form, patientSource: 'psique' })}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                    form.patientSource === 'psique'
                                        ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                                        : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200'
                                }`}
                            >
                                Psique Salud Mental
                            </button>
                            <button
                                type="button"
                                onClick={() => setForm({ ...form, patientSource: 'particular' })}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                    form.patientSource === 'particular'
                                        ? 'bg-teal-100 text-teal-700 border-2 border-teal-300'
                                        : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200'
                                }`}
                            >
                                Particular
                            </button>
                        </div>
                    </div>

                    {/* Child Patient Contact Info */}
                    {isChild && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                            <div className="flex items-center gap-2 text-amber-700 font-medium">
                                <Baby size={18} />
                                <span>Datos del Contacto (Menor de edad)</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Nombre del Contacto
                                    </label>
                                    <input
                                        className="w-full p-2 border rounded-lg"
                                        value={form.contactName}
                                        onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                                        placeholder="Nombre del responsable"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Teléfono Contacto
                                    </label>
                                    <input
                                        type="tel"
                                        className="w-full p-2 border rounded-lg"
                                        value={form.contactPhone}
                                        onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Parentesco</label>
                                    <select
                                        className="w-full p-2 border rounded-lg bg-white"
                                        value={form.contactRelationship}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                contactRelationship: e.target.value as ContactRelationship,
                                            })
                                        }
                                    >
                                        <option value="">Seleccionar...</option>
                                        {CONTACT_RELATIONSHIPS.map((r) => (
                                            <option key={r.value} value={r.value}>
                                                {r.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {form.contactRelationship === 'otro' && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Especificar
                                        </label>
                                        <input
                                            className="w-full p-2 border rounded-lg"
                                            value={form.contactRelationshipOther}
                                            onChange={(e) =>
                                                setForm({ ...form, contactRelationshipOther: e.target.value })
                                            }
                                            placeholder="Ej: Tutor, Abuelo..."
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Clinical Settings */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Honorarios</label>
                            <input
                                type="number"
                                className="w-full p-2 border rounded-lg"
                                value={form.fee}
                                onChange={(e) => setForm({ ...form, fee: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Modalidad Preferida</label>
                            <select
                                className="w-full p-2 border rounded-lg bg-white"
                                value={form.preference}
                                onChange={(e) =>
                                    setForm({ ...form, preference: e.target.value as 'presencial' | 'online' })
                                }
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
                                onChange={(e) => setForm({ ...form, office: e.target.value })}
                            />
                        </div>
                    )}

                    {/* Professional */}
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
                                onChange={(e) => setForm({ ...form, professional: e.target.value })}
                                placeholder="Escribir nombre del profesional..."
                                autoFocus
                            />
                        ) : (
                            <select
                                className="w-full p-2 border rounded-lg bg-white"
                                value={form.professional}
                                onChange={(e) => {
                                    if (e.target.value === 'custom') {
                                        setIsCustomProfessional(true);
                                        setForm({ ...form, professional: '' });
                                    } else {
                                        setForm({ ...form, professional: e.target.value });
                                    }
                                }}
                            >
                                {existingProfessionals.map((p) => (
                                    <option key={p} value={p}>
                                        {p === user.displayName ? `${p} (Yo)` : p}
                                    </option>
                                ))}
                                <option value="custom">+ Otro profesional...</option>
                            </select>
                        )}
                    </div>

                    {/* Advanced Section */}
                    <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
                    >
                        {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        {showAdvanced ? 'Ocultar opciones avanzadas' : 'Mostrar opciones avanzadas'}
                    </button>

                    {showAdvanced && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Fecha de Admisión
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border rounded-lg"
                                        value={form.admissionDate}
                                        onChange={(e) => setForm({ ...form, admissionDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                                    <select
                                        className="w-full p-2 border rounded-lg bg-white"
                                        value={form.isActive ? 'active' : 'inactive'}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                isActive: e.target.value === 'active',
                                                dischargeType: e.target.value === 'active' ? '' : form.dischargeType,
                                                dischargeDate: e.target.value === 'active' ? '' : form.dischargeDate,
                                            })
                                        }
                                    >
                                        <option value="active">Activo</option>
                                        <option value="inactive">Inactivo (Alta)</option>
                                    </select>
                                </div>
                            </div>

                            {!form.isActive && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Tipo de Alta
                                        </label>
                                        <select
                                            className="w-full p-2 border rounded-lg bg-white"
                                            value={form.dischargeType}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    dischargeType: e.target.value as 'clinical' | 'dropout',
                                                })
                                            }
                                        >
                                            <option value="">Seleccionar...</option>
                                            <option value="clinical">Alta Clínica</option>
                                            <option value="dropout">Abandono</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Fecha de Alta
                                        </label>
                                        <input
                                            type="date"
                                            className="w-full p-2 border rounded-lg"
                                            value={form.dischargeDate}
                                            onChange={(e) => setForm({ ...form, dischargeDate: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}
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
                            Guardar Paciente
                        </button>
                    </div>
                </form>
            </div>
        </ModalOverlay>
    );
};
