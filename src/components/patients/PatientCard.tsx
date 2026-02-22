import { Patient } from '../../types';
import { Mail, Phone, Video, MapPin, MessageCircle, FileText, User, Edit2, Trash2 } from 'lucide-react';
import { formatPhoneNumber } from '../../lib/utils';

interface PatientCardProps {
    patient: Patient;
    onView: () => void;
    onEdit?: (e: React.MouseEvent) => void;
    onDelete?: (e: React.MouseEvent) => void;
}

const getInitials = (name: string) => {
    return name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
};

const getRandomColor = (name: string) => {
    const colors = [
        'bg-red-100 text-red-600',
        'bg-orange-100 text-orange-600',
        'bg-amber-100 text-amber-600',
        'bg-yellow-100 text-yellow-600',
        'bg-lime-100 text-lime-600',
        'bg-green-100 text-green-600',
        'bg-emerald-100 text-emerald-600',
        'bg-teal-100 text-teal-600',
        'bg-cyan-100 text-cyan-600',
        'bg-sky-100 text-sky-600',
        'bg-blue-100 text-blue-600',
        'bg-indigo-100 text-indigo-600',
        'bg-violet-100 text-violet-600',
        'bg-purple-100 text-purple-600',
        'bg-fuchsia-100 text-fuchsia-600',
        'bg-pink-100 text-pink-600',
        'bg-rose-100 text-rose-600',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

export const PatientCard = ({ patient, onView, onEdit, onDelete }: PatientCardProps) => {
    return (
        <div
            onClick={onView}
            className="group bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-teal-200 transition-all cursor-pointer flex flex-col justify-between h-full relative"
        >
            {/* Context Actions */}
            <div className="absolute top-4 right-4 flex space-x-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                {onEdit && (
                    <button
                        onClick={onEdit}
                        className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                        title="Editar"
                    >
                        <Edit2 size={16} />
                    </button>
                )}
                {onDelete && (
                    <button
                        onClick={onDelete}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>

            <div className="flex items-start justify-between mb-4 pr-16">
                <div className="flex items-center space-x-4">
                    <div
                        className={`h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg ${getRandomColor(patient.name)}`}
                    >
                        {getInitials(patient.name)}
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg group-hover:text-teal-700 transition-colors line-clamp-1">
                            {patient.name}
                        </h3>
                        <div className="flex items-center text-slate-500 text-sm mt-0.5">
                            <Mail size={14} className="mr-1.5 shrink-0" />
                            <span className="truncate max-w-[140px]" title={patient.email}>
                                {patient.email}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mb-4">
                <div
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center ${
                        patient.preference === 'online' ? 'bg-blue-50 text-blue-700' : 'bg-teal-50 text-teal-700'
                    }`}
                >
                    {patient.preference === 'online' ? (
                        <Video size={14} className="mr-1" />
                    ) : (
                        <MapPin size={14} className="mr-1" />
                    )}
                    <span className="capitalize">{patient.preference || 'Presencial'}</span>
                </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-100 mt-auto">
                <div className="flex justify-between items-center text-sm">
                    <div className="text-slate-500 flex items-center">
                        <Phone size={14} className="mr-2" />
                        {patient.phone ? (
                            <a
                                href={`tel:${patient.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="hover:text-teal-600 hover:underline"
                            >
                                {patient.phone}
                            </a>
                        ) : (
                            <span className="italic text-slate-400">Sin teléfono</span>
                        )}
                    </div>

                    {patient.phone && (
                        <a
                            href={`https://wa.me/${formatPhoneNumber(patient.phone)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-green-600 hover:bg-green-50 p-1.5 rounded-full transition-colors"
                            title="Enviar WhatsApp"
                        >
                            <MessageCircle size={18} />
                        </a>
                    )}
                </div>

                <div className="flex justify-between items-center text-sm">
                    <div className="text-slate-500 flex items-center">
                        <User size={14} className="mr-2" />
                        <span className="truncate max-w-[150px]">{patient.professional || 'Sin profesional'}</span>
                    </div>
                    {patient.fee && (
                        <div className="font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded text-xs">
                            ${patient.fee}
                        </div>
                    )}
                </div>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onView();
                    }}
                    className="w-full mt-2 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 transition-colors flex items-center justify-center"
                >
                    <FileText size={16} className="mr-2" /> Ver Ficha
                </button>
            </div>
        </div>
    );
};
