import { useState } from 'react';
import { User } from 'firebase/auth';
import { Patient } from '../../types';
import { usePatientData } from '../../hooks/usePatientData';
import { X, Phone, Mail, Calendar, DollarSign, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useInvoiceStatus } from '../../hooks/useInvoiceStatus';
import { requestBatchInvoice } from '../../lib/queue';
import { toast } from 'sonner';

interface PatientDetailsDrawerProps {
    patient: Patient;
    onClose: () => void;
    user: User;
}

export const PatientDetailsDrawer = ({ patient, onClose, user }: PatientDetailsDrawerProps) => {
    const [activeTab, setActiveTab] = useState<'details' | 'history' | 'finance'>('details');
    const { history, payments, loading, stats } = usePatientData(user, patient.id);

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [trackingId, setTrackingId] = useState<string | null>(null);
    const invoiceStatus = useInvoiceStatus(trackingId);

    // Filter appointments for "To Bill" section
    const toBill = history.filter(h => h.isPaid && (!h.billingStatus || h.billingStatus !== 'invoiced'));

    const handleBatchBilling = async () => {
        try {
            const appointmentsToBill = toBill.filter(a => selectedIds.includes(a.id));
            if (appointmentsToBill.length === 0) return;

            const id = await requestBatchInvoice(appointmentsToBill, user, patient);
            setTrackingId(id);
            toast.success('Solicitud de facturación enviada');
        } catch (error) {
            console.error(error);
            toast.error('Error al solicitar facturación');
        }
    };

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
        <div className="fixed inset-0 z-50 overflow-hidden">
            <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="absolute inset-y-0 right-0 flex max-w-full pl-10 pointer-events-none">
                <div className="w-screen max-w-md pointer-events-auto">
                    <div className="flex h-full flex-col bg-white shadow-xl">

                        {/* Header */}
                        <div className="px-6 py-6 bg-slate-50 border-b border-slate-200">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">{patient.name}</h2>
                                    <div className="flex items-center space-x-3 mt-2 text-sm text-slate-500">
                                        {patient.email && (
                                            <a href={`mailto:${patient.email}`} className="flex items-center hover:text-teal-600">
                                                <Mail size={14} className="mr-1" /> {patient.email}
                                            </a>
                                        )}
                                        {patient.phone && (
                                            <a href={`tel:${patient.phone}`} className="flex items-center hover:text-teal-600">
                                                <Phone size={14} className="mr-1" /> {patient.phone}
                                            </a>
                                        )}
                                    </div>
                                </div>
                                <button onClick={onClose} className="text-slate-400 hover:text-slate-500">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Status Badges */}
                            <div className="flex space-x-3 mt-4">
                                <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center ${stats.totalDebt > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                    <DollarSign size={12} className="mr-1" />
                                    {stats.totalDebt > 0 ? `Deuda: $${stats.totalDebt}` : 'Al día'}
                                </div>
                                {stats.lastVisit && (
                                    <div className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold flex items-center">
                                        <Clock size={12} className="mr-1" />
                                        Última visita: {stats.lastVisit.toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-slate-200">
                            <button
                                onClick={() => setActiveTab('details')}
                                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'details' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                Ficha
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'history' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                Historial
                            </button>
                            <button
                                onClick={() => setActiveTab('finance')}
                                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'finance' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                Cta. Cte.
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {loading ? (
                                <div className="flex justify-center py-10">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                                </div>
                            ) : (
                                <>
                                    {activeTab === 'details' && (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 uppercase">Nombre</label>
                                                    <div className="mt-1 text-sm text-slate-900">{patient.firstName}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 uppercase">Apellido</label>
                                                    <div className="mt-1 text-sm text-slate-900">{patient.lastName}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 uppercase">DNI</label>
                                                    <div className="mt-1 text-sm text-slate-900">{patient.dni || '-'}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 uppercase">Teléfono</label>
                                                    <div className="mt-1 text-sm text-slate-900">{patient.phone || '-'}</div>
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-xs font-medium text-slate-500 uppercase">Email</label>
                                                    <div className="mt-1 text-sm text-slate-900">{patient.email}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 uppercase">Honorarios</label>
                                                    <div className="mt-1 text-sm text-slate-900">${patient.fee || '-'}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 uppercase">Modalidad</label>
                                                    <div className="mt-1 text-sm text-slate-900 capitalize">{patient.preference || '-'}</div>
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-xs font-medium text-slate-500 uppercase">Profesional Asignado</label>
                                                    <div className="mt-1 text-sm text-slate-900">{patient.professional || 'No asignado'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'history' && (
                                        <div className="space-y-4">
                                            {history.length === 0 ? (
                                                <div className="text-center text-slate-500 py-8">No hay historial de turnos.</div>
                                            ) : (
                                                history.map(appt => (
                                                    <div key={appt.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                        <div className="flex items-center space-x-3">
                                                            <div className="bg-white p-2 rounded-full border border-slate-200 text-slate-400">
                                                                <Calendar size={16} />
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-medium text-slate-900">
                                                                    {new Date(appt.date + 'T00:00:00').toLocaleDateString()}
                                                                </div>
                                                                <div className="text-xs text-slate-500">{appt.time} hs - {appt.type}</div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm font-bold text-slate-700">${appt.price}</div>
                                                            {appt.isPaid ? (
                                                                <span className="text-[10px] font-bold text-green-600 flex items-center justify-end">
                                                                    <CheckCircle size={10} className="mr-1" /> PAGADO
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-red-500 flex items-center justify-end">
                                                                    <AlertCircle size={10} className="mr-1" /> IMPAGO
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
                                            {/* To Bill Section */}
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-800 mb-3 flex justify-between items-center">
                                                    <span>A Facturar</span>
                                                    {toBill.length > 0 && (
                                                        <button
                                                            onClick={() => setSelectedIds(selectedIds.length === toBill.length ? [] : toBill.map(a => a.id))}
                                                            className="text-xs text-teal-600 font-medium hover:underline"
                                                        >
                                                            {selectedIds.length === toBill.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                                                        </button>
                                                    )}
                                                </h3>
                                                {toBill.length === 0 ? (
                                                    <div className="text-sm text-slate-500 italic bg-slate-50 p-3 rounded-lg text-center">
                                                        No hay turnos pendientes de facturación.
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {toBill.map(appt => (
                                                            <div key={appt.id} className="flex items-center p-3 bg-white border border-slate-200 rounded-lg hover:border-teal-200 transition-colors">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedIds.includes(appt.id)}
                                                                    onChange={() => {
                                                                        if (selectedIds.includes(appt.id)) {
                                                                            setSelectedIds(prev => prev.filter(id => id !== appt.id));
                                                                        } else {
                                                                            setSelectedIds(prev => [...prev, appt.id]);
                                                                        }
                                                                    }}
                                                                    className="h-4 w-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 mr-3"
                                                                />
                                                                <div className="flex-1">
                                                                    <div className="text-sm font-medium text-slate-900">
                                                                        {new Date(appt.date + 'T00:00:00').toLocaleDateString()}
                                                                    </div>
                                                                    <div className="text-xs text-slate-500">
                                                                        {appt.consultationType || 'Consulta'} - ${appt.price}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {selectedIds.length > 0 && (
                                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                                        {invoiceStatus.status === 'completed' && invoiceStatus.invoiceUrl ? (
                                                            <a
                                                                href={invoiceStatus.invoiceUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="w-full py-2.5 bg-green-50 border border-green-200 text-green-700 rounded-xl hover:bg-green-100 font-medium flex items-center justify-center transition-colors"
                                                            >
                                                                <CheckCircle size={18} className="mr-2" /> Ver Factura Generada
                                                            </a>
                                                        ) : (invoiceStatus.status === 'pending' || invoiceStatus.status === 'processing') ? (
                                                            <div className="w-full py-2.5 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl font-medium flex items-center justify-center cursor-wait">
                                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-500 mr-2"></div>
                                                                Procesando ({selectedIds.length})...
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={handleBatchBilling}
                                                                className="w-full py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 shadow-sm font-medium flex items-center justify-center transition-colors"
                                                            >
                                                                <DollarSign size={18} className="mr-2" />
                                                                Facturar ({selectedIds.length}) - Total: ${toBill.filter(a => selectedIds.includes(a.id)).reduce((sum, a) => sum + (a.price || 0), 0)}
                                                            </button>
                                                        )}
                                                        {invoiceStatus.error && (
                                                            <div className="mt-2 text-xs text-red-600 text-center">
                                                                Error: {invoiceStatus.error}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Balance Box */}
                                            <div className={`p-4 rounded-xl border ${stats.totalDebt > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                                                <div className="text-sm font-medium text-slate-500 uppercase mb-1">Saldo Pendiente</div>
                                                <div className={`text-3xl font-bold ${stats.totalDebt > 0 ? 'text-red-700' : 'text-green-700'}`}>
                                                    ${stats.totalDebt}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-2">
                                                    Total Pagado Histórico: ${stats.totalPaid}
                                                </div>
                                            </div>

                                            {/* Movements Table */}
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-800 mb-3">Movimientos Recientes</h3>
                                                <div className="space-y-3">
                                                    {movements.length === 0 ? (
                                                        <div className="text-center text-slate-500 py-4">No hay movimientos registrados.</div>
                                                    ) : (
                                                        movements.map((mov, idx) => (
                                                            <div key={`${mov.id}-${idx}`} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                                                                <div>
                                                                    <div className="text-sm font-medium text-slate-900">{mov.description}</div>
                                                                    <div className="text-xs text-slate-500">{mov.date.toLocaleDateString()}</div>
                                                                </div>
                                                                <div className={`text-sm font-bold ${mov.type === 'payment' ? 'text-green-600' : 'text-slate-700'}`}>
                                                                    {mov.type === 'payment' ? '+' : '-'}${mov.amount}
                                                                </div>
                                                            </div>
                                                        ))
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
            </div>
        </div>
    );
};
