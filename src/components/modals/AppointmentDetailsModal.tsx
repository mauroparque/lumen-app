import { useState, useEffect, useRef } from 'react';
import { deleteDoc, doc } from 'firebase/firestore';
import { db, appId, CLINIC_ID } from '../../lib/firebase';
import { User } from 'firebase/auth';
import { Appointment } from '../../types';
import { ModalOverlay } from '../ui';
import { Edit2, Trash2, Video, MapPin, CheckCircle, FileText, User as UserIcon, DollarSign, Calendar as CalendarIcon, Paperclip, Save, X, Download, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useInvoiceStatus } from '../../hooks/useInvoiceStatus';
import { useDataActions } from '../../hooks/useDataActions';
import { useClinicalNotes } from '../../hooks/useClinicalNotes';

interface AppointmentDetailsModalProps {
    appointment: Appointment;
    onClose: () => void;
    onEdit: () => void;
    user: User;
}

export const AppointmentDetailsModal = ({ appointment, onClose, onEdit, user }: AppointmentDetailsModalProps) => {
    const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
    const { useClinicalNote, saveNote, uploadAttachment, loading: saving } = useClinicalNotes(user);
    const { note, loadingNote } = useClinicalNote(appointment.id);
    const { requestBatchInvoice } = useDataActions();

    const [content, setContent] = useState('');
    const [attachments, setAttachments] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [trackingId, setTrackingId] = useState<string | null>(null);
    const [isRequesting, setIsRequesting] = useState(false);
    const invoiceStatus = useInvoiceStatus(trackingId);

    useEffect(() => {
        if (note) {
            setContent(note.content);
            setAttachments(note.attachments || []);
        }
    }, [note]);

    const handleDelete = async () => {
        if (confirm('¿Estás seguro de que deseas eliminar este turno?')) {
            try {
                await deleteDoc(doc(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'appointments', appointment.id));
                toast.success('Turno eliminado');
                onClose();
            } catch (error) {
                console.error(error);
                toast.error('Error al eliminar el turno');
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
                dni: '' // Not available in appointment object directly
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
        try {
            await saveNote({
                content,
                attachments,
                patientId: appointment.patientId
            }, appointment.id, note?.id);
            toast.success('Evolución guardada correctamente');
        } catch (error) {
            toast.error('Error al guardar la evolución');
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const url = await uploadAttachment(file, appointment.patientId);
            setAttachments(prev => [...prev, url]);
            toast.success('Archivo adjuntado');
        } catch (error) {
            toast.error('Error al subir archivo');
        }
    };

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
                        <button onClick={onEdit} className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors" title="Editar">
                            <Edit2 size={20} />
                        </button>
                        <button onClick={handleDelete} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                            <Trash2 size={20} />
                        </button>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'details'
                            ? 'border-teal-600 text-teal-700'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Detalles del Turno
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'history'
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
                                            {new Date(appointment.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                            <div className="mt-1 font-medium text-slate-700">
                                                {appointment.time} hs ({appointment.duration} min)
                                            </div>
                                            {appointment.recurrenceId && (
                                                <div className="mt-1 text-xs text-purple-600 font-medium bg-purple-50 px-2 py-0.5 rounded-full inline-block">
                                                    Parte de una serie (Sesión {appointment.recurrenceIndex !== undefined ? appointment.recurrenceIndex + 1 : '?'})
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-start space-x-3 text-slate-600">
                                    {appointment.type === 'online' ? <Video size={20} className="text-slate-400 mt-1" /> : <MapPin size={20} className="text-slate-400 mt-1" />}
                                    <div>
                                        <div className="font-medium text-slate-900">Modalidad</div>
                                        <div className="text-sm text-slate-500 capitalize">{appointment.type}</div>
                                        {appointment.type === 'online' && (appointment.googleMeetLink || appointment.meetLink) && (
                                            <a
                                                href={appointment.googleMeetLink || appointment.meetLink}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-sm text-blue-600 hover:underline block mt-1 flex items-center"
                                            >
                                                <Video size={14} className="mr-1" />
                                                {appointment.googleMeetLink ? 'Unirse con Google Meet' : 'Unirse a la reunión'}
                                            </a>
                                        )}
                                        {appointment.googleEventId && (
                                            <div className="flex items-center mt-1 text-xs text-green-600 font-medium" title="Sincronizado con Google Calendar">
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
                                        <div className="text-sm text-slate-500">{appointment.professional || 'No asignado'}</div>
                                    </div>
                                </div>

                                <div className="flex items-start space-x-3 text-slate-600">
                                    <DollarSign size={20} className="text-slate-400 mt-1" />
                                    <div>
                                        <div className="font-medium text-slate-900">Honorarios</div>
                                        <div className="flex items-center space-x-2 mt-1">
                                            <span className="font-bold text-lg text-slate-700">${appointment.price}</span>
                                            {appointment.isPaid ? (
                                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold flex items-center">
                                                    <CheckCircle size={12} className="mr-1" /> PAGADO
                                                </span>
                                            ) : (
                                                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">PENDIENTE</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
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
                                    ) : (invoiceStatus.status === 'pending' || invoiceStatus.status === 'processing' || isRequesting) ? (
                                        <div className="w-full py-2.5 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl font-medium flex items-center justify-center cursor-wait">
                                            <Loader2 size={18} className="mr-2 animate-spin" /> Procesando factura...
                                        </div>
                                    ) : (invoiceStatus.status === 'error' || invoiceStatus.status === 'error_sending' || invoiceStatus.status === 'error_config') ? (
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
                        <div className="space-y-4 h-full flex flex-col">
                            {loadingNote ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Evolución / Notas</label>
                                        <textarea
                                            className="w-full h-48 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none text-slate-700"
                                            placeholder="Escribe aquí la evolución del paciente..."
                                            value={content}
                                            onChange={(e) => setContent(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-sm font-medium text-slate-700">Archivos Adjuntos</label>
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center"
                                            >
                                                <Paperclip size={16} className="mr-1" /> Adjuntar archivo
                                            </button>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                className="hidden"
                                                onChange={handleFileUpload}
                                            />
                                        </div>

                                        {attachments.length > 0 ? (
                                            <div className="space-y-2">
                                                {attachments.map((url, index) => (
                                                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate max-w-[80%]">
                                                            Adjunto {index + 1}
                                                        </a>
                                                        <button
                                                            onClick={() => setAttachments(prev => prev.filter((_, i) => i !== index))}
                                                            className="text-slate-400 hover:text-red-500"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-slate-400 italic p-2">No hay archivos adjuntos</div>
                                        )}
                                    </div>

                                    <div className="pt-4 border-t border-slate-100 flex justify-end">
                                        <button
                                            onClick={handleSaveNote}
                                            disabled={saving}
                                            className="px-6 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 shadow-sm font-medium flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {saving ? 'Guardando...' : (
                                                <>
                                                    <Save size={18} className="mr-2" /> Guardar Evolución
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </ModalOverlay>
    );
};
