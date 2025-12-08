import { useState } from 'react';
import { User } from 'firebase/auth';
import { Patient } from '../../types';
import { usePatientData } from '../../hooks/usePatientData';
import { Phone, Mail, Calendar, DollarSign, CheckCircle, AlertCircle, Clock, X, User as UserIcon } from 'lucide-react';
import { ModalOverlay } from '../ui';

interface PatientProfileModalProps {
    patient: Patient;
    onClose: () => void;
    user: User;
}

export const PatientProfileModal = ({ patient, onClose, user }: PatientProfileModalProps) => {
    const [activeTab, setActiveTab] = useState<'details' | 'history' | 'finance'>('details');
    const { history, payments, loading, stats } = usePatientData(user, patient.id);

    // Combine history and payments for "Cuenta Corriente" view
    const movements = [
        ...history.map(h => ({
            id: h.id,
            date: new Date(h.date + 'T' + h.time),
            type: 'charge',
            amount: h.price || 0,
            description: `Turno: ${h.date} ${h.time}`,
            isPaid: h.isPaid
        })),
        ...payments.map(p => ({
            id: p.id,
            date: p.date.toDate(),
            type: 'payment',
            amount: p.amount,
            description: `Pago: ${p.concept}`,
            isPaid: true
        }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    return (
        <ModalOverlay onClose={onClose}>
            <div className="flex flex-col md:flex-row h-[85vh] w-full max-w-5xl bg-white rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                {/* Sidebar */}
                <div className="w-full md:w-1/3 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 p-6 flex flex-col justify-between items-center md:items-start shrink-0 overflow-y-auto">
                    <div className="flex items-start space-x-4">
                        <div className="h-16 w-16 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 font-bold text-2xl border-2 border-white shadow-sm">
                            {(patient.firstName?.[0] || patient.name[0]).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">{patient.name}</h2>
                            <div className="flex flex-col space-y-1 mt-1 text-slate-500 text-sm">
                                {patient.email && (
                                    <div className="flex items-center">
                                        <Mail size={14} className="mr-2" /> {patient.email}
                                    </div>
                                )}
                                {patient.phone && (
                                    <div className="flex items-center">
                                        <Phone size={14} className="mr-2" /> {patient.phone}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-2 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="w-full md:w-2/3 p-0 flex flex-col h-full bg-white">
                    {/* Tabs Header */}
                    <div className="px-6 pt-4 border-b border-slate-100 flex-shrink-0 bg-white sticky top-0 z-10 flex">
                        <button
                            onClick={() => setActiveTab('details')}
                            className={`mr-6 py-4 text-sm font-bold border-b-2 transition-colors flex items-center ${activeTab === 'details' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            <UserIcon size={16} className="mr-2" /> Datos Personales
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`mr-6 py-4 text-sm font-bold border-b-2 transition-colors flex items-center ${activeTab === 'history' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            <Calendar size={16} className="mr-2" /> Historial de Turnos
                        </button>
                        <button
                            onClick={() => setActiveTab('finance')}
                            className={`py-4 text-sm font-bold border-b-2 transition-colors flex items-center ${activeTab === 'finance' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            <DollarSign size={16} className="mr-2" /> Cuenta Corriente
                        </button>
                    </div>

                    {/* Tabs Content */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                        {loading ? (
                            <div className="flex justify-center items-center h-full">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600"></div>
                            </div>
                        ) : (
                            <>
                                {activeTab === 'details' && (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre</label>
                                                <div className="text-slate-900 border-b border-slate-100 pb-2">{patient.firstName || patient.name.split(' ')[0]}</div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Apellido</label>
                                                <div className="text-slate-900 border-b border-slate-100 pb-2">{patient.lastName || patient.name.split(' ').slice(1).join(' ')}</div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">DNI</label>
                                                <div className="text-slate-900 border-b border-slate-100 pb-2">{patient.dni || '-'}</div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Telefono</label>
                                                <div className="text-slate-900 border-b border-slate-100 pb-2">{patient.phone || '-'}</div>
                                            </div>
                                            <div className="col-span-1 md:col-span-2">
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Email</label>
                                                <div className="text-slate-900 border-b border-slate-100 pb-2">{patient.email}</div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Honorarios</label>
                                                <div className="text-slate-900 border-b border-slate-100 pb-2 font-mono">${patient.fee || '-'}</div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Modalidad</label>
                                                <div className="text-slate-900 border-b border-slate-100 pb-2 capitalize">{patient.preference || '-'}</div>
                                            </div>
                                            <div className="col-span-1 md:col-span-2">
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Profesional Asignado</label>
                                                <div className="text-slate-900 border-b border-slate-100 pb-2">{patient.professional || 'No asignado'}</div>
                                            </div>
                                        </div>

                                        {stats.lastVisit && (
                                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center text-blue-700 text-sm font-medium">
                                                <Clock size={18} className="mr-2" />
                                                Última visita registrada: {stats.lastVisit.toLocaleDateString()}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'history' && (
                                    <div className="space-y-4">
                                        {history.length === 0 ? (
                                            <div className="text-center text-slate-500 py-12 bg-white rounded-xl border border-slate-100">
                                                <Calendar size={48} className="mx-auto mb-4 text-slate-300" />
                                                <p>No hay turnos registrados en el historial.</p>
                                            </div>
                                        ) : (
                                            history.map(appt => (
                                                <div key={appt.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center hover:bg-slate-50 transition-colors">
                                                    <div>
                                                        <div className="font-bold text-slate-800">
                                                            {new Date(appt.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                                                        </div>
                                                        <div className="text-sm text-slate-500 flex items-center mt-1">
                                                            <Clock size={14} className="mr-1" /> {appt.time} hs - {appt.type}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end space-y-2">
                                                        <div className="font-bold text-slate-700">${appt.price}</div>
                                                        {appt.isPaid ? (
                                                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] uppercase font-bold rounded-full flex items-center">
                                                                <CheckCircle size={10} className="mr-1" /> Pagado
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] uppercase font-bold rounded-full flex items-center">
                                                                <AlertCircle size={10} className="mr-1" /> Impago
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}

                                {activeTab === 'finance' && (
                                    <div className="space-y-6">
                                        {/* Balance Summary */}
                                        <div className={`p-6 rounded-xl border ${stats.totalDebt > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <div className="text-sm font-bold text-slate-500 uppercase tracking-wide opacity-80">Saldo Pendiente</div>
                                                    <div className={`text-4xl font-bold mt-1 ${stats.totalDebt > 0 ? 'text-red-700' : 'text-green-700'}`}>
                                                        ${stats.totalDebt}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wide opacity-80">Total Pagado Histórico</div>
                                                    <div className="text-xl font-bold text-slate-700 mt-1">${stats.totalPaid}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Movimientos (Cta. Cte.)</h3>
                                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                                {movements.length === 0 ? (
                                                    <div className="text-center text-slate-500 py-8 italic">No hay movimientos registrados.</div>
                                                ) : (
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                                            <tr>
                                                                <th className="px-4 py-3">Fecha</th>
                                                                <th className="px-4 py-3">Descripción</th>
                                                                <th className="px-4 py-3 text-right">Monto</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {movements.map((mov, idx) => (
                                                                <tr key={`${mov.id}-${idx}`} className="hover:bg-slate-50">
                                                                    <td className="px-4 py-3 text-slate-500">{mov.date.toLocaleDateString()}</td>
                                                                    <td className="px-4 py-3 font-medium text-slate-800">{mov.description}</td>
                                                                    <td className={`px-4 py-3 text-right font-bold ${mov.type === 'payment' ? 'text-green-600' : 'text-slate-700'}`}>
                                                                        {mov.type === 'payment' ? '+' : '-'}${mov.amount}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </ModalOverlay>
    );
};
