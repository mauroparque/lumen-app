import { useState } from 'react';
import { Patient } from '../../types';
import { usePatientData } from '../../hooks/usePatientData';
import { Phone, Mail, Calendar, DollarSign, Clock, X, User as UserIcon, Activity } from 'lucide-react';
import { ModalOverlay } from '../ui';

interface PatientProfileModalProps {
    patient: Patient;
    onClose: () => void;
}

export const PatientProfileModal = ({ patient, onClose }: PatientProfileModalProps) => {
    const [activeTab, setActiveTab] = useState<'details' | 'history' | 'finance'>('details');
    const { history, payments, loading, stats } = usePatientData(patient.id);

    // Preparar datos financieros
    const movements = [
        ...history.map((h) => ({
            id: h.id,
            date: new Date(h.date + 'T' + h.time),
            type: 'charge',
            amount: h.price || 0,
            description: `Sesión ${h.type}`,
            isPaid: h.isPaid,
        })),
        ...payments
            .filter((p) => p.date !== null)
            .map((p) => ({
                id: p.id,
                date: p.date!.toDate(),
                type: 'payment',
                amount: p.amount,
                description: `Pago: ${p.concept}`,
                isPaid: true,
            })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    // Helper para WhatsApp
    const whatsappLink = patient.phone ? `https://wa.me/${patient.phone.replace(/\D/g, '').replace(/^0/, '549')}` : '#';

    return (
        <ModalOverlay onClose={onClose}>
            {/* --- CONTENEDOR MAESTRO --- */}
            <div className="w-full max-w-[calc(100vw-2rem)] h-[85vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-row animate-in fade-in zoom-in duration-200 font-sans">
                {/* === ZONA 1: SIDEBAR DE IDENTIDAD (Fijo a la izquierda) === */}
                <div className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 h-full z-20">
                    {/* Header Perfil */}
                    <div className="p-5 flex flex-col items-center border-b border-slate-200/60">
                        <div className="relative">
                            <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center text-teal-700 text-3xl font-bold mb-3 shadow-sm border-4 border-white ring-1 ring-slate-200">
                                {(patient.firstName?.[0] || patient.name[0]).toUpperCase()}
                            </div>
                            <div
                                className={`absolute bottom-3 right-0 h-5 w-5 rounded-full border-3 border-white ${stats.totalDebt > 0 ? 'bg-red-500' : 'bg-green-500'}`}
                            ></div>
                        </div>

                        <h2 className="text-lg font-bold text-center text-slate-900 leading-tight mb-1">
                            {patient.name}
                        </h2>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            {patient.preference || 'Paciente General'}
                        </span>
                    </div>

                    {/* KPIs Rápidos */}
                    <div className="grid grid-cols-2 gap-px bg-slate-200 border-b border-slate-200">
                        <div className="bg-slate-50 p-4 text-center hover:bg-white transition-colors">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saldo</div>
                            <div
                                className={`text-lg font-bold ${stats.totalDebt > 0 ? 'text-red-600' : 'text-green-600'}`}
                            >
                                ${stats.totalDebt}
                            </div>
                        </div>
                        <div className="bg-slate-50 p-4 text-center hover:bg-white transition-colors">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Honorario
                            </div>
                            <div className="text-lg font-bold text-slate-700">${patient.fee || '-'}</div>
                        </div>
                    </div>

                    {/* Botonera de Acción */}
                    <div className="p-4 space-y-2 flex-1 overflow-y-auto">
                        {patient.phone && (
                            <a
                                href={whatsappLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center w-full py-2.5 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-lg font-bold text-sm transition-all shadow-sm group"
                            >
                                <Phone size={18} className="mr-2 group-hover:scale-110 transition-transform" /> WhatsApp
                            </a>
                        )}
                        {patient.email && (
                            <a
                                href={`mailto:${patient.email}`}
                                className="flex items-center justify-center w-full py-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors"
                            >
                                <Mail size={18} className="mr-2 text-slate-400" /> Enviar Email
                            </a>
                        )}

                        <div className="mt-4 pt-4 border-t border-slate-200">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Contacto</h4>
                            <div className="space-y-2 text-xs">
                                <div className="flex items-center text-slate-600">
                                    <Phone size={14} className="mr-3 text-slate-400" />{' '}
                                    {patient.phone || 'No registrado'}
                                </div>
                                <div className="flex items-center text-slate-600">
                                    <Mail size={14} className="mr-3 text-slate-400" />
                                    <span className="truncate">{patient.email || 'No registrado'}</span>
                                </div>
                                <div className="flex items-center text-slate-600">
                                    <Clock size={14} className="mr-3 text-slate-400" />
                                    {stats.lastVisit
                                        ? `Última visita: ${stats.lastVisit.toLocaleDateString()}`
                                        : 'Sin visitas previas'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* === ZONA 2: WORKSPACE (Contenido Dinámico) === */}
                <div className="flex-1 flex flex-col h-full min-w-0 bg-white relative">
                    {/* Header de Navegación */}
                    <div className="h-16 border-b border-slate-200 flex items-center justify-between px-8 bg-white sticky top-0 z-10">
                        <div className="flex space-x-8 h-full">
                            <button
                                onClick={() => setActiveTab('details')}
                                className={`h-full flex items-center px-1 border-b-[3px] font-bold text-sm transition-colors ${activeTab === 'details' ? 'border-teal-600 text-teal-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                            >
                                <UserIcon size={18} className="mr-2" /> Ficha Técnica
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`h-full flex items-center px-1 border-b-[3px] font-bold text-sm transition-colors ${activeTab === 'history' ? 'border-teal-600 text-teal-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                            >
                                <Activity size={18} className="mr-2" /> Historial Clínico
                            </button>
                            <button
                                onClick={() => setActiveTab('finance')}
                                className={`h-full flex items-center px-1 border-b-[3px] font-bold text-sm transition-colors ${activeTab === 'finance' ? 'border-teal-600 text-teal-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                            >
                                <DollarSign size={18} className="mr-2" /> Administración
                            </button>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Área de Contenido Scrollable */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/50 p-6">
                        {loading ? (
                            <div className="flex h-full items-center justify-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
                            </div>
                        ) : (
                            <div className="w-full">
                                {/* --- TAB 1: FICHA TÉCNICA (Lista Vertical) --- */}
                                {activeTab === 'details' && (
                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                                        {/* Lista de datos en formato tabla simple */}
                                        <div className="divide-y divide-slate-100">
                                            <div className="flex justify-between items-center px-5 py-4 hover:bg-slate-50">
                                                <span className="text-sm font-medium text-slate-500">
                                                    Nombre Completo
                                                </span>
                                                <span className="text-sm font-bold text-slate-900">{patient.name}</span>
                                            </div>
                                            <div className="flex justify-between items-center px-5 py-4 hover:bg-slate-50">
                                                <span className="text-sm font-medium text-slate-500">
                                                    DNI / Documento
                                                </span>
                                                <span className="text-sm font-bold text-slate-900">
                                                    {patient.dni || '---'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center px-5 py-4 hover:bg-slate-50">
                                                <span className="text-sm font-medium text-slate-500">Teléfono</span>
                                                <span className="text-sm font-bold text-slate-900">
                                                    {patient.phone || '---'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center px-5 py-4 hover:bg-slate-50">
                                                <span className="text-sm font-medium text-slate-500">Email</span>
                                                <span className="text-sm font-bold text-slate-900 truncate max-w-[200px]">
                                                    {patient.email || '---'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center px-5 py-4 hover:bg-slate-50 bg-slate-50/50">
                                                <span className="text-sm font-medium text-slate-500">Honorario</span>
                                                <span className="text-lg font-bold text-teal-700">
                                                    ${patient.fee || '---'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center px-5 py-4 hover:bg-slate-50">
                                                <span className="text-sm font-medium text-slate-500">Profesional</span>
                                                <span className="text-sm font-bold text-slate-900">
                                                    {patient.professional || 'Sin asignar'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center px-5 py-4 hover:bg-slate-50">
                                                <span className="text-sm font-medium text-slate-500">Modalidad</span>
                                                <span className="text-sm font-bold text-slate-900 capitalize">
                                                    {patient.preference || 'Presencial'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* --- TAB 2: HISTORIAL (Timeline) --- */}
                                {activeTab === 'history' && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                        {history.length === 0 ? (
                                            <div className="text-center py-20 text-slate-400">
                                                <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                                                <p>No hay historial de turnos registrado</p>
                                            </div>
                                        ) : (
                                            history.map((appt) => (
                                                <div
                                                    key={appt.id}
                                                    className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex items-start"
                                                >
                                                    <div className="h-12 w-12 rounded-lg bg-teal-50 text-teal-700 flex flex-col items-center justify-center mr-4 shrink-0 font-bold border border-teal-100">
                                                        <span className="text-xs uppercase">
                                                            {new Date(appt.date + 'T00:00:00').toLocaleDateString(
                                                                'es-ES',
                                                                { month: 'short' },
                                                            )}
                                                        </span>
                                                        <span className="text-xl leading-none">
                                                            {new Date(appt.date + 'T00:00:00').getDate()}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <h4 className="font-bold text-slate-900 text-lg">
                                                                    {appt.consultationType || 'Consulta General'}
                                                                </h4>
                                                                <p className="text-slate-500 text-sm flex items-center mt-1">
                                                                    <Clock size={14} className="mr-1" /> {appt.time} hs
                                                                    — {appt.type}
                                                                </p>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="font-bold text-slate-700">
                                                                    ${appt.price}
                                                                </div>
                                                                <div
                                                                    className={`text-[10px] font-bold uppercase mt-1 px-2 py-0.5 rounded-full inline-block ${appt.isPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                                                                >
                                                                    {appt.isPaid ? 'Pagado' : 'Pendiente'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}

                                {/* --- TAB 3: FINANZAS (Table) --- */}
                                {activeTab === 'finance' && (
                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                                        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                                            <h3 className="font-bold text-slate-700 text-sm uppercase">
                                                Movimientos de Cuenta
                                            </h3>
                                            <div className="text-sm font-medium text-slate-500">
                                                Saldo:{' '}
                                                <span
                                                    className={
                                                        stats.totalDebt > 0
                                                            ? 'text-red-600 font-bold'
                                                            : 'text-green-600 font-bold'
                                                    }
                                                >
                                                    ${stats.totalDebt}
                                                </span>
                                            </div>
                                        </div>
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-white text-slate-500 border-b border-slate-100">
                                                <tr>
                                                    <th className="px-6 py-3 font-medium">Fecha</th>
                                                    <th className="px-6 py-3 font-medium">Concepto</th>
                                                    <th className="px-6 py-3 font-medium text-right">Monto</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {movements.map((mov, idx) => (
                                                    <tr key={`${mov.id}-${idx}`} className="hover:bg-slate-50">
                                                        <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                                                            {mov.date.toLocaleDateString()}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="font-medium text-slate-900">
                                                                {mov.description}
                                                            </div>
                                                            <div className="text-xs text-slate-400">
                                                                {mov.type === 'charge'
                                                                    ? 'Cargo en cuenta'
                                                                    : 'Ingreso de pago'}
                                                            </div>
                                                        </td>
                                                        <td
                                                            className={`px-6 py-4 text-right font-bold ${mov.type === 'payment' ? 'text-green-600' : 'text-slate-700'}`}
                                                        >
                                                            {mov.type === 'payment' ? '+' : '-'}${mov.amount}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {movements.length === 0 && (
                                            <div className="p-8 text-center text-slate-400 italic">
                                                No hay movimientos registrados
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ModalOverlay>
    );
};
