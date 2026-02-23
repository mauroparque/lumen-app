import { useState, useMemo } from 'react';
import { User } from 'firebase/auth';
import {
    ArrowLeft,
    FileText,
    ListTodo,
    Calendar,
    Phone,
    Mail,
    MessageCircle,
    Baby,
    Plus,
    Square,
    CheckSquare,
    ChevronDown,
    ChevronUp,
    Paperclip,
} from 'lucide-react';
import { View, ClinicalNote } from '../types';
import { usePatients } from '../hooks/usePatients';
import { useData } from '../context/DataContext';
import { usePendingTasks } from '../hooks/usePendingTasks';
import { usePatientNotes } from '../hooks/useClinicalNotes';
import { StaffProfile } from '../types';
import { formatPhoneNumber } from '../lib/utils';
import { AddTaskModal } from '../components/modals/AddTaskModal';
import { toast } from 'sonner';

interface PatientHistoryViewProps {
    user: User;
    profile: StaffProfile | null;
    patientId: string | null;
    setCurrentView: (view: View) => void;
    initialTab?: 'history' | 'tasks';
}

const calculateAge = (birthDate?: string): number | null => {
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

const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

export const PatientHistoryView = ({
    user,
    profile,
    patientId,
    setCurrentView,
    initialTab = 'history',
}: PatientHistoryViewProps) => {
    const [activeTab, setActiveTab] = useState<'history' | 'tasks'>(initialTab);
    const [showAddTask, setShowAddTask] = useState(false);
    const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
    const { patients } = usePatients(user);
    const { appointments } = useData();

    // Create set with just this patient's ID for task filtering
    const myPatientIds = useMemo(() => (patientId ? new Set([patientId]) : new Set<string>()), [patientId]);
    const { pendingTasks, completeTask } = usePendingTasks(appointments, myPatientIds);

    const { notes: patientNotes, loading: loadingNotes } = usePatientNotes(patientId);

    const patient = useMemo(() => patients.find((p) => p.id === patientId), [patients, patientId]);

    // Get all appointments for this patient
    const patientAppointments = useMemo(
        () => appointments.filter((a) => a.patientId === patientId).sort((a, b) => b.date.localeCompare(a.date)),
        [appointments, patientId],
    );

    // Filter completed appointments (with notes potential)
    const completedAppointments = useMemo(
        () => patientAppointments.filter((a) => a.status === 'completado' || new Date(a.date) < new Date()),
        [patientAppointments],
    );

    // Get tasks for this patient only
    const patientTasks = useMemo(
        () => pendingTasks.filter((t) => t.patientId === patientId),
        [pendingTasks, patientId],
    );

    // Create a map of notes by appointmentId for quick lookup
    const notesByAppointment = useMemo(() => {
        const map: Record<string, ClinicalNote> = {};
        patientNotes.forEach((note) => {
            map[note.appointmentId] = note;
        });
        return map;
    }, [patientNotes]);

    const toggleNoteExpanded = (appointmentId: string) => {
        setExpandedNotes((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(appointmentId)) {
                newSet.delete(appointmentId);
            } else {
                newSet.add(appointmentId);
            }
            return newSet;
        });
    };

    if (!patient) {
        return (
            <div className="p-6 max-w-6xl mx-auto">
                <button
                    onClick={() => setCurrentView('patients')}
                    className="flex items-center gap-2 text-slate-600 hover:text-teal-600 mb-6"
                >
                    <ArrowLeft size={20} />
                    Volver a Pacientes
                </button>
                <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-slate-500">
                    Paciente no encontrado.
                </div>
            </div>
        );
    }

    const age = calculateAge(patient.birthDate);
    const isChild = age !== null && age < 18;

    const handleCompleteTask = async (noteId: string, taskIndex: number) => {
        try {
            await completeTask(noteId, taskIndex);
            toast.success('Tarea completada');
        } catch {
            toast.error('Error al completar tarea');
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <button
                onClick={() => setCurrentView('patients')}
                className="flex items-center gap-2 text-slate-600 hover:text-teal-600 mb-6 transition-colors"
            >
                <ArrowLeft size={20} />
                Volver a Pacientes
            </button>

            {/* Patient Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div
                            className={`h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold ${
                                isChild ? 'bg-amber-100 text-amber-600' : 'bg-teal-100 text-teal-600'
                            }`}
                        >
                            {isChild ? (
                                <Baby size={28} />
                            ) : (
                                patient.name
                                    .split(' ')
                                    .map((n) => n[0])
                                    .slice(0, 2)
                                    .join('')
                                    .toUpperCase()
                            )}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">{patient.name}</h1>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {age !== null && (
                                    <span
                                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                                            isChild ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                        }`}
                                    >
                                        {age} años {isChild && '(Menor)'}
                                    </span>
                                )}
                                {patient.patientSource && (
                                    <span
                                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                                            patient.patientSource === 'psique'
                                                ? 'bg-purple-100 text-purple-700'
                                                : 'bg-teal-100 text-teal-700'
                                        }`}
                                    >
                                        {patient.patientSource === 'psique' ? 'Psique' : 'Particular'}
                                    </span>
                                )}
                                {patient.isActive ? (
                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                        Activo
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                                        {patient.dischargeType === 'clinical'
                                            ? 'Alta Clínica'
                                            : patient.dischargeType === 'dropout'
                                              ? 'Abandono'
                                              : 'Inactivo'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Contact Actions */}
                    <div className="flex items-center gap-2">
                        {patient.phone && (
                            <>
                                <a
                                    href={`tel:${patient.phone}`}
                                    className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
                                >
                                    <Phone size={16} />
                                    <span className="text-sm whitespace-nowrap">{patient.phone}</span>
                                </a>
                                <a
                                    href={`https://wa.me/${formatPhoneNumber(patient.phone)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 bg-green-100 hover:bg-green-200 text-green-600 rounded-lg transition-colors"
                                    title="WhatsApp"
                                >
                                    <MessageCircle size={18} />
                                </a>
                            </>
                        )}
                        {patient.email && (
                            <a
                                href={`mailto:${patient.email}`}
                                className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
                            >
                                <Mail size={16} />
                                <span className="text-sm truncate max-w-[150px]">{patient.email}</span>
                            </a>
                        )}
                    </div>
                </div>

                {/* Child Contact Info */}
                {isChild && patient.contactName && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                        <div className="text-sm text-slate-500">
                            <span className="font-medium">Contacto:</span> {patient.contactName}
                            {patient.contactRelationship && (
                                <span className="ml-2 px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs">
                                    {patient.contactRelationship === 'otro'
                                        ? patient.contactRelationshipOther
                                        : patient.contactRelationship.charAt(0).toUpperCase() +
                                          patient.contactRelationship.slice(1)}
                                </span>
                            )}
                            {patient.contactPhone && <span className="ml-2">· {patient.contactPhone}</span>}
                        </div>
                    </div>
                )}

                {/* Stats */}
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <div className="text-xs text-slate-500">Profesional</div>
                        <div className="font-medium text-slate-700">{patient.professional || '-'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500">Admisión</div>
                        <div className="font-medium text-slate-700">
                            {patient.admissionDate ? formatDate(patient.admissionDate) : '-'}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500">Sesiones Totales</div>
                        <div className="font-medium text-slate-700">{completedAppointments.length}</div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500">Honorarios</div>
                        <div className="font-medium text-slate-700">
                            {patient.fee ? `$${patient.fee.toLocaleString()}` : '-'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === 'history'
                                ? 'bg-white text-teal-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <FileText size={16} />
                        Historia Clínica
                    </button>
                    <button
                        onClick={() => setActiveTab('tasks')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === 'tasks'
                                ? 'bg-white text-amber-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <ListTodo size={16} />
                        Tareas
                        {patientTasks.length > 0 && (
                            <span className="bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full font-bold">
                                {patientTasks.length}
                            </span>
                        )}
                    </button>
                </div>

                {activeTab === 'tasks' && (
                    <button
                        onClick={() => setShowAddTask(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
                    >
                        <Plus size={16} />
                        Nueva Tarea
                    </button>
                )}
            </div>

            {/* Content */}
            {activeTab === 'history' && (
                <div className="space-y-4">
                    {loadingNotes ? (
                        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
                            <div className="text-slate-500 mt-4">Cargando historia clínica...</div>
                        </div>
                    ) : completedAppointments.length === 0 ? (
                        <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-slate-500">
                            <Calendar size={48} className="mx-auto mb-4 text-slate-200" />
                            No hay sesiones registradas para este paciente.
                        </div>
                    ) : (
                        completedAppointments.map((appointment) => {
                            const note = notesByAppointment[appointment.id];
                            const isExpanded = expandedNotes.has(appointment.id);
                            const hasNoteContent =
                                note &&
                                (note.content ||
                                    (note.tasks && note.tasks.length > 0) ||
                                    (note.attachments && note.attachments.length > 0));

                            return (
                                <div
                                    key={appointment.id}
                                    className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:border-teal-200 transition-colors"
                                >
                                    {/* Appointment Header - Always visible */}
                                    <div
                                        className={`p-4 ${hasNoteContent ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                                        onClick={() => hasNoteContent && toggleNoteExpanded(appointment.id)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="text-sm font-medium text-slate-800">
                                                    {formatDate(appointment.date)}
                                                </div>
                                                <span className="text-slate-400">·</span>
                                                <div className="text-sm text-slate-500">{appointment.time}hs</div>
                                                {hasNoteContent && (
                                                    <span className="px-2 py-0.5 bg-teal-50 text-teal-600 rounded text-xs font-medium flex items-center gap-1">
                                                        <FileText size={12} />
                                                        Con notas
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {appointment.isPaid ? (
                                                    <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded text-xs font-medium">
                                                        Pagado
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs font-medium">
                                                        Pendiente
                                                    </span>
                                                )}
                                                {hasNoteContent &&
                                                    (isExpanded ? (
                                                        <ChevronUp size={18} className="text-slate-400" />
                                                    ) : (
                                                        <ChevronDown size={18} className="text-slate-400" />
                                                    ))}
                                            </div>
                                        </div>
                                        <div className="text-sm text-slate-600 mt-1">
                                            {appointment.consultationType || 'Consulta'} ·{' '}
                                            {appointment.type === 'online' ? 'Online' : 'Presencial'}
                                            {appointment.professional && ` · ${appointment.professional}`}
                                        </div>
                                    </div>

                                    {/* Note Content - Expandable */}
                                    {hasNoteContent && isExpanded && (
                                        <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-4">
                                            {/* Evolution Text */}
                                            {note.content && (
                                                <div>
                                                    <div className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
                                                        <FileText size={12} />
                                                        Evolución
                                                    </div>
                                                    <div className="text-sm text-slate-700 whitespace-pre-wrap bg-white p-3 rounded-lg border border-slate-100">
                                                        {note.content}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Tasks from this note */}
                                            {note.tasks && note.tasks.length > 0 && (
                                                <div>
                                                    <div className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
                                                        <ListTodo size={12} />
                                                        Tareas ({note.tasks.filter((t) => !t.completed).length}{' '}
                                                        pendientes)
                                                    </div>
                                                    <div className="space-y-1">
                                                        {note.tasks.map((task, idx) => (
                                                            <div
                                                                key={idx}
                                                                className={`flex items-center gap-2 text-sm p-2 rounded ${task.completed ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}
                                                            >
                                                                {task.completed ? (
                                                                    <CheckSquare size={14} />
                                                                ) : (
                                                                    <Square size={14} />
                                                                )}
                                                                <span className={task.completed ? 'line-through' : ''}>
                                                                    {task.text}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Attachments */}
                                            {note.attachments && note.attachments.length > 0 && (
                                                <div>
                                                    <div className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
                                                        <Paperclip size={12} />
                                                        Adjuntos ({note.attachments.length})
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {note.attachments.map((url, idx) => (
                                                            <a
                                                                key={idx}
                                                                href={url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-sm text-blue-600 hover:underline bg-white px-2 py-1 rounded border border-slate-200"
                                                            >
                                                                Archivo {idx + 1}
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {activeTab === 'tasks' && (
                <div className="space-y-3">
                    {patientTasks.length === 0 ? (
                        <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-slate-500">
                            <ListTodo size={48} className="mx-auto mb-4 text-slate-200" />
                            No hay tareas pendientes para este paciente.
                            <button
                                onClick={() => setShowAddTask(true)}
                                className="block mx-auto mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
                            >
                                Crear primera tarea
                            </button>
                        </div>
                    ) : (
                        patientTasks.map((task) => (
                            <div
                                key={`${task.noteId}-${task.taskIndex}`}
                                className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-start gap-3 hover:border-amber-200 transition-colors"
                            >
                                <button
                                    onClick={() => handleCompleteTask(task.noteId, task.taskIndex)}
                                    className="mt-0.5 text-amber-400 hover:text-green-600 transition-colors flex-shrink-0"
                                    title="Marcar como completada"
                                >
                                    <Square size={20} />
                                </button>
                                <div className="flex-1">
                                    <div className="text-slate-800 font-medium">{task.text}</div>
                                    {task.appointmentDate && (
                                        <div className="text-xs text-slate-400 mt-1">
                                            {task.appointmentDate.startsWith('standalone-')
                                                ? 'Tarea independiente'
                                                : `Sesión: ${formatDate(task.appointmentDate)}`}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Add Task Modal */}
            {showAddTask && patient && (
                <AddTaskModal
                    onClose={() => setShowAddTask(false)}
                    patientId={patient.id}
                    patientName={patient.name}
                    userName={profile?.name || user.displayName || user.email || ''}
                    userUid={user.uid}
                />
            )}
        </div>
    );
};
