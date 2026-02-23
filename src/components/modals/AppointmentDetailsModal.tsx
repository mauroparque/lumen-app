import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { Appointment } from '../../types';
import { ModalOverlay } from '../ui';
import {
    Edit2,
    Trash2,
    Video,
    MapPin,
    CheckCircle,
    FileText,
    User as UserIcon,
    DollarSign,
    Calendar as CalendarIcon,
    Paperclip,
    Save,
    X,
    Download,
    RefreshCw,
    Loader2,
    Plus,
    ListTodo,
    Square,
    CheckSquare,
    UserX,
    XCircle,
    Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBillingStatus } from '../../hooks/useBillingStatus';
import { useDataActions } from '../../hooks/useDataActions';
import { useClinicalNote } from '../../hooks/useClinicalNotes';

interface AppointmentDetailsModalProps {
    appointment: Appointment;
    onClose: () => void;
    onEdit: () => void;
    user: User;
}

export const AppointmentDetailsModal = ({ appointment, onClose, onEdit }: AppointmentDetailsModalProps) => {
    const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
    const { note, loading: loadingNote, saveNote, uploadAttachment } = useClinicalNote(appointment.id);
    const { requestBatchInvoice, deleteItem, deleteRecurringSeries, deleteRecurringFromDate, updateAppointment } =
        useDataActions();

    const [content, setContent] = useState('');
    const [attachments, setAttachments] = useState<string[]>([]);
    const [tasks, setTasks] = useState<{ text: string; completed: boolean }[]>([]);
    const [newTask, setNewTask] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [trackingId, setTrackingId] = useState<string | null>(null);
    const [isRequesting, setIsRequesting] = useState(false);
    const invoiceStatus = useBillingStatus(trackingId);

    // Estado para el diálogo de confirmación de borrado
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Estado para el diálogo de cancelación
    const [showCancelDialog, setShowCancelDialog] = useState(false);

    useEffect(() => {
        if (note) {
            setContent(note.content);
            setAttachments(note.attachments || []);
            setTasks(note.tasks || []);
        }
    }, [note]);

    const handleDeleteSingle = async () => {
        setIsDeleting(true);
        try {
            await deleteItem('appointments', appointment.id);
            toast.success('Turno eliminado');
            onClose();
        } catch (error: unknown) {
            console.error(error);
            if (error && typeof error === 'object' && 'code' in error && error.code === 'permission-denied') {
                toast.error('No se puede eliminar un turno facturado');
            } else {
                toast.error('Error al eliminar el turno');
            }
        } finally {
            setIsDeleting(false);
            setShowDeleteDialog(false);
        }
    };

    const handleDeleteThisAndFollowing = async () => {
        if (!appointment.recurrenceId) return;

        setIsDeleting(true);
        try {
            const count = await deleteRecurringFromDate(appointment.recurrenceId, appointment.date);
            if (count === 0) {
                toast.info('No hay turnos para eliminar');
                return;
            }
            toast.success(`${count} turno(s) eliminado(s)`);
            onClose();
        } catch (error: unknown) {
            console.error(error);
            if (error && typeof error === 'object' && 'code' in error && error.code === 'permission-denied') {
                toast.error('No se pueden eliminar turnos facturados');
            } else {
                toast.error('Error al eliminar los turnos');
            }
        } finally {
            setIsDeleting(false);
            setShowDeleteDialog(false);
        }
    };

    const handleDeleteSeries = async () => {
        if (!appointment.recurrenceId) return;

        setIsDeleting(true);
        try {
            const count = await deleteRecurringSeries(appointment.recurrenceId);
            toast.success(`${count} turnos de la serie eliminados`);
            onClose();
        } catch (error: unknown) {
            console.error(error);
            if (error && typeof error === 'object' && 'code' in error && error.code === 'permission-denied') {
                toast.error('No se pueden eliminar turnos facturados');
            } else {
                toast.error('Error al eliminar la serie');
            }
        } finally {
            setIsDeleting(false);
            setShowDeleteDialog(false);
        }
    };

    const handleDelete = () => {
        if (appointment.recurrenceId) {
            // Es un turno recurrente, mostrar diálogo con opciones
            setShowDeleteDialog(true);
        } else {
            // Turno simple, confirmar directamente
            if (confirm('¿Estás seguro de que deseas eliminar este turno?')) {
                handleDeleteSingle();
            }
        }
    };

    const handleRequestInvoice = async () => {
        setIsRequesting(true);
        try {
            // Adapt patient data from appointment
            const patientData = {
                id: appointment.patientId,
                name: appointment.patientName,
                email: appointment.patientEmail,
                dni: '', // Not available in appointment object directly
            };

            const id = await requestBatchInvoice([appointment], patientData);
            setTrackingId(id);
        } catch (error) {
            console.error(error);
            toast.error('Error al solicitar factura');
        } finally {
            setIsRequesting(false);
        }
    };

    const handleSaveNote = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            await saveNote(
                {
                    content,
                    attachments,
                    tasks,
                    patientId: appointment.patientId,
                },
                note?.id,
            );
            toast.success('Evolución guardada correctamente');
        } catch (error) {
            toast.error('Error al guardar la evolución');
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const url = await uploadAttachment(file, appointment.patientId);
            setAttachments((prev) => [...prev, url]);
            toast.success('Archivo adjuntado');
        } catch (error) {
            toast.error('Error al subir archivo');
        }
    };

    const handleStatusChange = async (newStatus: 'ausente' | 'cancelado', chargeOnCancellation?: boolean) => {
        setIsUpdatingStatus(true);
        try {
            const updateData: Partial<Pick<Appointment, 'status' | 'chargeOnCancellation'>> = { status: newStatus };

            // Si es cancelación, agregar el campo de cobro
            if (newStatus === 'cancelado') {
                updateData.chargeOnCancellation = chargeOnCancellation ?? false;
            }

            await updateAppointment(appointment.id, updateData);

            if (newStatus === 'ausente') {
                toast.success('Turno marcado como ausente');
            } else if (chargeOnCancellation) {
                toast.success('Turno cancelado (se mantiene el cobro)');
            } else {
                toast.success('Turno cancelado (sin cobro)');
            }

            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Error al actualizar el estado');
        } finally {
            setIsUpdatingStatus(false);
            setShowCancelDialog(false);
        }
    };

    // Get status display info
    const getStatusInfo = () => {
        switch (appointment.status) {
            case 'ausente':
                return { label: 'Ausente', color: 'bg-orange-100 text-orange-700', icon: UserX };
            case 'cancelado':
                if (appointment.chargeOnCancellation) {
                    return { label: 'Cancelado (con cobro)', color: 'bg-amber-100 text-amber-700', icon: XCircle };
                }
                return { label: 'Cancelado', color: 'bg-red-100 text-red-700', icon: XCircle };
            case 'presente':
                return { label: 'Presente', color: 'bg-green-100 text-green-700', icon: CheckCircle };
            case 'completado':
                return { label: 'Completado', color: 'bg-green-100 text-green-700', icon: CheckCircle };
            default:
                return { label: 'Programado', color: 'bg-blue-100 text-blue-700', icon: Clock };
        }
    };

    const statusInfo = getStatusInfo();

    return (
        <ModalOverlay onClose={onClose}>
            <div className="p-0 w-full max-w-2xl bg-white rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{appointment.patientName}</h2>
                        <p className="text-slate-500 text-sm">{appointment.patientEmail}</p>
                    </div>
                    <div className="flex space-x-2">
                        <button
                            onClick={onEdit}
                            className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                            title="Editar"
                        >
                            <Edit2 size={20} />
                        </button>
                        <button
                            onClick={handleDelete}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                        >
                            <Trash2 size={20} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'details'
                                ? 'border-teal-600 text-teal-700'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Detalles del Turno
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'history'
                                ? 'border-teal-600 text-teal-700'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Historia Clínica
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {activeTab === 'details' ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="flex items-start space-x-3 text-slate-600">
                                    <CalendarIcon size={20} className="text-slate-400 mt-1" />
                                    <div>
                                        <div className="font-medium text-slate-900">Fecha y Hora</div>
                                        <div className="text-sm text-slate-500">
                                            {new Date(appointment.date + 'T00:00:00').toLocaleDateString('es-ES', {
                                                weekday: 'long',
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                            })}
                                            <div className="mt-1 font-medium text-slate-700">
                                                {appointment.time} hs ({appointment.duration} min)
                                            </div>
                                            {appointment.recurrenceId && (
                                                <div className="mt-1 text-xs text-purple-600 font-medium bg-purple-50 px-2 py-0.5 rounded-full inline-block">
                                                    Parte de una serie (Sesión{' '}
                                                    {appointment.recurrenceIndex !== undefined
                                                        ? appointment.recurrenceIndex + 1
                                                        : '?'}
                                                    )
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-start space-x-3 text-slate-600">
                                    {appointment.type === 'online' ? (
                                        <Video size={20} className="text-slate-400 mt-1" />
                                    ) : (
                                        <MapPin size={20} className="text-slate-400 mt-1" />
                                    )}
                                    <div>
                                        <div className="font-medium text-slate-900">Modalidad</div>
                                        <div className="text-sm text-slate-500 capitalize">{appointment.type}</div>
                                        {appointment.type === 'online' &&
                                            (appointment.googleMeetLink || appointment.meetLink) && (
                                                <a
                                                    href={appointment.googleMeetLink || appointment.meetLink}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-sm text-blue-600 hover:underline block mt-1 flex items-center"
                                                >
                                                    <Video size={14} className="mr-1" />
                                                    {appointment.googleMeetLink
                                                        ? 'Unirse con Google Meet'
                                                        : 'Unirse a la reunión'}
                                                </a>
                                            )}
                                        {appointment.googleEventId && (
                                            <div
                                                className="flex items-center mt-1 text-xs text-green-600 font-medium"
                                                title="Sincronizado con Google Calendar"
                                            >
                                                <CheckCircle size={12} className="mr-1" /> Sincronizado con Google
                                            </div>
                                        )}
                                        {appointment.type === 'presencial' && appointment.office && (
                                            <div className="text-sm text-slate-500 mt-1">{appointment.office}</div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-start space-x-3 text-slate-600">
                                    <UserIcon size={20} className="text-slate-400 mt-1" />
                                    <div>
                                        <div className="font-medium text-slate-900">Profesional</div>
                                        <div className="text-sm text-slate-500">
                                            {appointment.professional || 'No asignado'}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-start space-x-3 text-slate-600">
                                    <DollarSign size={20} className="text-slate-400 mt-1" />
                                    <div>
                                        <div className="font-medium text-slate-900">Honorarios</div>
                                        <div className="flex items-center space-x-2 mt-1">
                                            <span className="font-bold text-lg text-slate-700">
                                                ${appointment.price}
                                            </span>
                                            {appointment.isPaid ? (
                                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold flex items-center">
                                                    <CheckCircle size={12} className="mr-1" /> PAGADO
                                                </span>
                                            ) : (
                                                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">
                                                    PENDIENTE
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Status Section */}
                            <div className="pt-4 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-medium text-slate-700">Estado del turno:</span>
                                    <span
                                        className={`px-3 py-1 rounded-full text-xs font-bold flex items-center ${statusInfo.color}`}
                                    >
                                        <statusInfo.icon size={12} className="mr-1" />
                                        {statusInfo.label}
                                    </span>
                                </div>

                                {appointment.status === 'programado' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleStatusChange('ausente')}
                                            disabled={isUpdatingStatus}
                                            className="flex-1 py-2 px-3 border border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50 font-medium flex items-center justify-center transition-colors disabled:opacity-50 text-sm"
                                        >
                                            <UserX size={16} className="mr-2" />
                                            Marcar Ausente
                                        </button>
                                        <button
                                            onClick={() => setShowCancelDialog(true)}
                                            disabled={isUpdatingStatus}
                                            className="flex-1 py-2 px-3 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-medium flex items-center justify-center transition-colors disabled:opacity-50 text-sm"
                                        >
                                            <XCircle size={16} className="mr-2" />
                                            Cancelar Turno
                                        </button>
                                    </div>
                                )}
                            </div>

                            {appointment.isPaid && (
                                <div className="pt-4 border-t border-slate-100">
                                    {invoiceStatus.status === 'completed' && invoiceStatus.invoiceUrl ? (
                                        <a
                                            href={invoiceStatus.invoiceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full py-2.5 bg-green-50 border border-green-200 text-green-700 rounded-xl hover:bg-green-100 font-medium flex items-center justify-center transition-colors"
                                        >
                                            <Download size={18} className="mr-2" /> Ver Factura
                                        </a>
                                    ) : (trackingId || isRequesting) &&
                                      (invoiceStatus.status === 'pending' || invoiceStatus.status === 'processing') ? (
                                        <div className="w-full py-2.5 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl font-medium flex items-center justify-center cursor-wait">
                                            <Loader2 size={18} className="mr-2 animate-spin" /> Procesando factura...
                                        </div>
                                    ) : trackingId &&
                                      (invoiceStatus.status === 'error' ||
                                          invoiceStatus.status === 'error_sending' ||
                                          invoiceStatus.status === 'error_config') ? (
                                        <div className="flex flex-col space-y-2">
                                            <div className="text-sm text-red-600 text-center bg-red-50 p-2 rounded-lg">
                                                Error: {invoiceStatus.error || 'No se pudo generar la factura'}
                                            </div>
                                            <button
                                                onClick={() => setTrackingId(null)}
                                                className="w-full py-2.5 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 font-medium flex items-center justify-center transition-colors"
                                            >
                                                <RefreshCw size={18} className="mr-2" /> Reintentar
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleRequestInvoice}
                                            disabled={isRequesting}
                                            className="w-full py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-medium flex items-center justify-center transition-colors disabled:opacity-50"
                                        >
                                            <FileText size={18} className="mr-2" /> Solicitar Factura
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col">
                            {loadingNote ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    {/* Layout horizontal de 2 columnas */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Evolución / Notas - Área principal */}
                                        <div className="flex-1 min-h-0">
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-sm font-bold text-slate-800 flex items-center">
                                                    <FileText size={16} className="mr-2 text-teal-600" />
                                                    Evolución de la Sesión
                                                </label>
                                                <span className="text-xs text-slate-400">
                                                    {content.length} caracteres
                                                </span>
                                            </div>
                                            <textarea
                                                className="w-full h-64 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none text-slate-700 bg-white shadow-sm text-sm leading-relaxed"
                                                placeholder="Documenta aquí la evolución del paciente, observaciones clínicas, intervenciones realizadas, estado emocional, temas trabajados..."
                                                value={content}
                                                onChange={(e) => setContent(e.target.value)}
                                            />
                                        </div>

                                        {/* Columna derecha: Tareas + Adjuntos */}
                                        <div className="space-y-4">
                                            {/* Tareas Pendientes */}
                                            <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <label className="text-sm font-bold text-slate-800 flex items-center">
                                                        <ListTodo size={16} className="mr-2 text-amber-600" />
                                                        Tareas Pendientes
                                                    </label>
                                                    <span className="text-xs text-amber-600 font-medium">
                                                        {tasks.filter((t) => !t.completed).length} pendiente(s)
                                                    </span>
                                                </div>

                                                <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
                                                    {tasks.length === 0 ? (
                                                        <div className="text-sm text-amber-500/60 italic text-center py-2">
                                                            Sin tareas
                                                        </div>
                                                    ) : (
                                                        tasks.map((task, index) => (
                                                            <div
                                                                key={index}
                                                                className={`flex items-center p-2 rounded-lg transition-colors ${task.completed ? 'bg-green-50 border border-green-100' : 'bg-white border border-amber-100'}`}
                                                            >
                                                                <button
                                                                    onClick={() => {
                                                                        const newTasks = [...tasks];
                                                                        newTasks[index].completed =
                                                                            !newTasks[index].completed;
                                                                        setTasks(newTasks);
                                                                    }}
                                                                    className={`mr-2 flex-shrink-0 ${task.completed ? 'text-green-600' : 'text-amber-400 hover:text-amber-600'}`}
                                                                >
                                                                    {task.completed ? (
                                                                        <CheckSquare size={18} />
                                                                    ) : (
                                                                        <Square size={18} />
                                                                    )}
                                                                </button>
                                                                <span
                                                                    className={`flex-1 text-sm ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                                                                >
                                                                    {task.text}
                                                                </span>
                                                                <button
                                                                    onClick={() =>
                                                                        setTasks(tasks.filter((_, i) => i !== index))
                                                                    }
                                                                    className="text-slate-300 hover:text-red-500 ml-1"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>

                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        className="flex-1 px-3 py-2 text-sm border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                                                        placeholder="Nueva tarea..."
                                                        value={newTask}
                                                        onChange={(e) => setNewTask(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && newTask.trim()) {
                                                                setTasks([
                                                                    ...tasks,
                                                                    { text: newTask.trim(), completed: false },
                                                                ]);
                                                                setNewTask('');
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            if (newTask.trim()) {
                                                                setTasks([
                                                                    ...tasks,
                                                                    { text: newTask.trim(), completed: false },
                                                                ]);
                                                                setNewTask('');
                                                            }
                                                        }}
                                                        className="px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                                                    >
                                                        <Plus size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Archivos Adjuntos */}
                                            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                                                <div className="flex justify-between items-center mb-3">
                                                    <label className="text-sm font-bold text-slate-800 flex items-center">
                                                        <Paperclip size={16} className="mr-2 text-slate-500" />
                                                        Adjuntos ({attachments.length})
                                                    </label>
                                                    <button
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center px-2 py-1 hover:bg-teal-50 rounded"
                                                    >
                                                        <Plus size={14} className="mr-1" /> Adjuntar
                                                    </button>
                                                    <input
                                                        type="file"
                                                        ref={fileInputRef}
                                                        className="hidden"
                                                        onChange={handleFileUpload}
                                                    />
                                                </div>

                                                {attachments.length > 0 ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {attachments.map((url, index) => (
                                                            <div
                                                                key={index}
                                                                className="flex items-center bg-white px-2 py-1 rounded border border-slate-200 text-xs"
                                                            >
                                                                <a
                                                                    href={url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-blue-600 hover:underline mr-2"
                                                                >
                                                                    Archivo {index + 1}
                                                                </a>
                                                                <button
                                                                    onClick={() =>
                                                                        setAttachments((prev) =>
                                                                            prev.filter((_, i) => i !== index),
                                                                        )
                                                                    }
                                                                    className="text-slate-300 hover:text-red-500"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-slate-400 italic text-center py-2">
                                                        Sin adjuntos
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Botón Guardar */}
                                    <div className="flex justify-end border-t border-slate-100 pt-4">
                                        <button
                                            onClick={handleSaveNote}
                                            disabled={loadingNote || isSaving}
                                            className="px-6 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 shadow-sm font-medium flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {isSaving ? (
                                                <>
                                                    <Loader2 size={18} className="mr-2 animate-spin" /> Guardando...
                                                </>
                                            ) : (
                                                <>
                                                    <Save size={18} className="mr-2" /> Guardar Evolución
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Diálogo de confirmación para borrar turnos recurrentes */}
            {showDeleteDialog && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Este turno es parte de una serie</h3>
                        <p className="text-sm text-slate-500 mb-6">
                            Este turno pertenece a una serie de{' '}
                            {appointment.recurrenceIndex !== undefined ? `turnos recurrentes` : 'turnos vinculados'}.
                            ¿Qué deseas eliminar?
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={handleDeleteSingle}
                                disabled={isDeleting}
                                className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors disabled:opacity-50 text-left"
                            >
                                <div className="font-semibold">Solo este turno</div>
                                <div className="text-xs text-slate-500">Los demás turnos de la serie se mantendrán</div>
                            </button>

                            <button
                                onClick={handleDeleteThisAndFollowing}
                                disabled={isDeleting}
                                className="w-full py-3 px-4 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-medium transition-colors disabled:opacity-50 text-left border border-amber-200"
                            >
                                <div className="font-semibold">Este y los siguientes</div>
                                <div className="text-xs text-amber-600">
                                    Se eliminarán este turno y todos los futuros de la serie
                                </div>
                            </button>

                            <button
                                onClick={handleDeleteSeries}
                                disabled={isDeleting}
                                className="w-full py-3 px-4 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-medium transition-colors disabled:opacity-50 text-left border border-red-200"
                            >
                                <div className="font-semibold">Toda la serie</div>
                                <div className="text-xs text-red-500">
                                    Se eliminarán todos los turnos (pasados y futuros)
                                </div>
                            </button>
                        </div>

                        <button
                            onClick={() => setShowDeleteDialog(false)}
                            disabled={isDeleting}
                            className="w-full mt-4 py-2 text-slate-500 hover:text-slate-700 font-medium disabled:opacity-50"
                        >
                            Cancelar
                        </button>

                        {isDeleting && (
                            <div className="mt-4 text-center text-sm text-slate-500 flex items-center justify-center">
                                <Loader2 size={16} className="animate-spin mr-2" /> Eliminando...
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Diálogo de cancelación con opción de cobro */}
            {showCancelDialog && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-2">¿Cómo deseas cancelar el turno?</h3>
                        <p className="text-sm text-slate-500 mb-6">
                            Elige si deseas mantener el cobro de los honorarios o cancelar sin cobro.
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={() => handleStatusChange('cancelado', false)}
                                disabled={isUpdatingStatus}
                                className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors disabled:opacity-50 text-left"
                            >
                                <div className="font-semibold">Cancelar sin cobro</div>
                                <div className="text-xs text-slate-500">El turno se cancela y no se genera deuda</div>
                            </button>

                            <button
                                onClick={() => handleStatusChange('cancelado', true)}
                                disabled={isUpdatingStatus}
                                className="w-full py-3 px-4 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-medium transition-colors disabled:opacity-50 text-left border border-amber-200"
                            >
                                <div className="font-semibold">Cancelar con cobro</div>
                                <div className="text-xs text-amber-600">
                                    El turno se cancela pero se mantiene el cobro de honorarios
                                </div>
                            </button>
                        </div>

                        <button
                            onClick={() => setShowCancelDialog(false)}
                            disabled={isUpdatingStatus}
                            className="w-full mt-4 py-2 text-slate-500 hover:text-slate-700 font-medium disabled:opacity-50"
                        >
                            Volver
                        </button>

                        {isUpdatingStatus && (
                            <div className="mt-4 text-center text-sm text-slate-500 flex items-center justify-center">
                                <Loader2 size={16} className="animate-spin mr-2" /> Actualizando...
                            </div>
                        )}
                    </div>
                </div>
            )}
        </ModalOverlay>
    );
};
