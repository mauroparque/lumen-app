import { useState } from 'react';
import { User } from 'firebase/auth';
import { Patient } from '../../types';
import { usePatientData } from '../../hooks/usePatientData';
import { X, Phone, Mail, Calendar, DollarSign, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useInvoiceStatus } from '../../hooks/useInvoiceStatus';
import { toast } from 'sonner';
import { useService } from '../../context/ServiceContext';

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
    const [confirmingBilling, setConfirmingBilling] = useState(false);
    const invoiceStatus = useInvoiceStatus(trackingId);
    const service = useService();

    // Filter appointments for "To Bill" section
    const toBill = history.filter(h => h.isPaid && (!h.billingStatus || h.billingStatus !== 'invoiced'));

    // Group by Month
    const groupedToBill = toBill.reduce((acc, appt) => {
        const date = new Date(appt.date + 'T00:00:00');
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(appt);
        return acc;
    }, {} as Record<string, typeof toBill>);

    const sortedMonths = Object.keys(groupedToBill).sort().reverse();

    const handleBatchBilling = async () => {
        if (!service) return;
        try {
            const appointmentsToBill = toBill.filter(a => selectedIds.includes(a.id));
            if (appointmentsToBill.length === 0) return;

            const id = await service.requestBatchInvoice(appointmentsToBill, patient);
            setTrackingId(id);
            setConfirmingBilling(false);
            toast.success('Solicitud de facturación enviada');
        } catch (error) {
            console.error(error);
            toast.error('Error al solicitar facturación');
        }
    };

    const toggleMonth = (monthKey: string) => {
        const idsInMonth = groupedToBill[monthKey].map(a => a.id);
        const allSelected = idsInMonth.every(id => selectedIds.includes(id));

        if (allSelected) {
            setSelectedIds(prev => prev.filter(id => !idsInMonth.includes(id)));
        } else {
            setSelectedIds(prev => [...new Set([...prev, ...idsInMonth])]);
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

    const getMonthName = (monthKey: string) => {
        const [year, month] = monthKey.split('-');
        const date = new Date(Number(year), Number(month) - 1, 1);
        return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    };

    return (
        <div className="fixed inset-0 z-50 overflow-hidden">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="absolute inset-y-0 right-0 flex max-w-full pl-10 pointer-events-none">
                <div className="w-screen max-w-2xl pointer-events-auto">
                    <div className="flex h-full flex-col bg-white shadow-2xl">

                        {/* Header */}
                        <div className="px-8 py-8 bg-slate-50 border-b border-slate-200">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-3xl font-bold text-slate-900">{patient.name}</h2>
                                    <div className="flex items-center space-x-6 mt-3 text-slate-500">
                                        {patient.email && (
                                            <a href={`mailto:${patient.email}`} className="flex items-center hover:text-teal-600 transition-colors">
                                                <Mail size={16} className="mr-2" /> {patient.email}
                                            </a>
                                        )}
                                        {patient.phone && (
                                            <a href={`tel:${patient.phone}`} className="flex items-center hover:text-teal-600 transition-colors">
                                                <Phone size={16} className="mr-2" /> {patient.phone}
                                            </a>
                                        )}
                                    </div>
                                </div>
                                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-200 rounded-full">
                                    <X size={28} />
                                </button>
                            </div>

                            {/* Status Badges */}
                            <div className="flex space-x-3 mt-6">
                                <div className={`px-4 py-1.5 rounded-full text-sm font-bold flex items-center ${stats.totalDebt > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                    <DollarSign size={16} className="mr-2" />
                                    {stats.totalDebt > 0 ? `Deuda: $${stats.totalDebt}` : 'Al día'}
                                </div>
                                {stats.lastVisit && (
                                    <div className="px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 text-sm font-bold flex items-center">
                                        <Clock size={16} className="mr-2" />
                                        Última visita: {stats.lastVisit.toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-slate-200 px-8">
                            <button
                                onClick={() => setActiveTab('details')}
                                className={`mr-8 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'details' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                Ficha
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`mr-8 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'history' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                Historial
                            </button>
                            <button
                                onClick={() => setActiveTab('finance')}
                                className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'finance' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                Cta. Cte.
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
                            {loading ? (
                                <div className="flex justify-center py-20">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600"></div>
                                </div>
                            ) : (
                                <>
                                    {activeTab === 'details' && (
                                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                            <h3 className="text-lg font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4">Información Personal</h3>
                                            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre</label>
                                                    <div className="text-base font-medium text-slate-900">{patient.firstName}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Apellido</label>
                                                    <div className="text-base font-medium text-slate-900">{patient.lastName}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">DNI</label>
                                                    <div className="text-base font-medium text-slate-900">{patient.dni || '-'}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Teléfono</label>
                                                    <div className="text-base font-medium text-slate-900">{patient.phone || '-'}</div>
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Email</label>
                                                    <div className="text-base font-medium text-slate-900">{patient.email}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Honorarios</label>
                                                    <div className="text-base font-medium text-slate-900">${patient.fee || '-'}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Modalidad</label>
                                                    <div className="text-base font-medium text-slate-900 capitalize">{patient.preference || '-'}</div>
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Profesional Asignado</label>
                                                    <div className="text-base font-medium text-slate-900">{patient.professional || 'No asignado'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'history' && (
                                        <div className="space-y-6">
                                            {history.length === 0 ? (
                                                <div className="text-center text-slate-500 py-12 bg-white rounded-2xl border border-slate-100">
                                                    <Calendar size={48} className="mx-auto mb-4 text-slate-300" />
                                                    <p>No hay historial de turnos registrado.</p>
                                                </div>
                                            ) : (
                                                <div className="relative border-l-2 border-slate-200 ml-4 space-y-8 py-2">
                                                    {history.map(appt => (
                                                        <div key={appt.id} className="relative pl-8">
                                                            <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-white bg-teal-500 shadow-sm"></div>
                                                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <div>
                                                                        <div className="text-lg font-bold text-slate-900">
                                                                            {new Date(appt.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                                                        </div>
                                                                        <div className="text-sm text-slate-500 font-medium">{appt.time} hs - {appt.type}</div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <div className="text-lg font-bold text-slate-700">${appt.price}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex justify-end">
                                                                    {appt.isPaid ? (
                                                                        <span className="px-2 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-md flex items-center">
                                                                            <CheckCircle size={12} className="mr-1" /> PAGADO
                                                                        </span>
                                                                    ) : (
                                                                        <span className="px-2 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-md flex items-center">
                                                                            <AlertCircle size={12} className="mr-1" /> IMPAGO
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'finance' && (
                                        <div className="space-y-6">
                                            {/* To Bill Section */}
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-800 mb-4 flex justify-between items-center">
                                                    <span>A Facturar</span>
                                                </h3>

                                                {confirmingBilling ? (
                                                    <div className="bg-white border border-teal-100 rounded-2xl p-6 shadow-lg animate-in fade-in zoom-in duration-200">
                                                        <h4 className="text-lg font-bold text-slate-800 mb-4">Confirmar Facturación</h4>
                                                        <div className="bg-slate-50 rounded-xl p-4 mb-6 space-y-3">
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-slate-500">Sesiones seleccionadas:</span>
                                                                <span className="font-bold text-slate-900">{selectedIds.length}</span>
                                                            </div>
                                                            <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-3">
                                                                <span className="text-slate-700">Total a facturar:</span>
                                                                <span className="text-teal-600">${toBill.filter(a => selectedIds.includes(a.id)).reduce((sum, a) => sum + (a.price || 0), 0)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex space-x-3">
                                                            <button
                                                                onClick={() => setConfirmingBilling(false)}
                                                                className="flex-1 py-3 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                                                            >
                                                                Cancelar
                                                            </button>
                                                            <button
                                                                onClick={handleBatchBilling}
                                                                className="flex-1 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 shadow-lg shadow-teal-100 transition-colors flex justify-center items-center"
                                                            >
                                                                Confirmar Envío
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {toBill.length === 0 ? (
                                                            <div className="text-center text-slate-500 py-12 bg-white rounded-2xl border border-slate-100 italic">
                                                                No hay turnos pendientes de facturación.
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-4">
                                                                {sortedMonths.map(monthKey => {
                                                                    const monthAppts = groupedToBill[monthKey];
                                                                    const allSelected = monthAppts.every(a => selectedIds.includes(a.id));
                                                                    const someSelected = monthAppts.some(a => selectedIds.includes(a.id));

                                                                    return (
                                                                        <div key={monthKey} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                                                            <div
                                                                                className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                                                                                onClick={() => toggleMonth(monthKey)}
                                                                            >
                                                                                <div className="flex items-center font-medium text-slate-800 capitalize">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={allSelected}
                                                                                        ref={input => {
                                                                                            if (input) input.indeterminate = someSelected && !allSelected;
                                                                                        }}
                                                                                        readOnly
                                                                                        className="h-4 w-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 mr-3 pointer-events-none"
                                                                                    />
                                                                                    {getMonthName(monthKey)}
                                                                                </div>
                                                                                <div className="text-xs text-slate-500 font-medium">
                                                                                    {monthAppts.length} sesiones
                                                                                </div>
                                                                            </div>
                                                                            <div className="divide-y divide-slate-50">
                                                                                {monthAppts.map(appt => (
                                                                                    <div key={appt.id} className="flex items-center px-5 py-4 hover:bg-slate-50 transition-colors">
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
                                                                                            <div className="flex justify-between items-baseline">
                                                                                                <div className="text-sm font-medium text-slate-900">
                                                                                                    {new Date(appt.date + 'T00:00:00').toLocaleDateString()}
                                                                                                </div>
                                                                                                <div className="text-xs font-bold text-slate-600">
                                                                                                    ${appt.price}
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="text-xs text-slate-500">
                                                                                                {appt.consultationType || 'Consulta'}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}

                                                        {selectedIds.length > 0 && (
                                                            <div className="mt-6 pt-6 border-t border-slate-100 sticky bottom-0 bg-white pb-2 z-10">
                                                                {invoiceStatus.status === 'completed' && invoiceStatus.invoiceUrl ? (
                                                                    <a
                                                                        href={invoiceStatus.invoiceUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="w-full py-4 bg-green-50 border border-green-200 text-green-700 rounded-xl hover:bg-green-100 font-bold flex items-center justify-center transition-colors shadow-sm text-lg"
                                                                    >
                                                                        <CheckCircle size={24} className="mr-2" /> Ver Factura Generada
                                                                    </a>
                                                                ) : (invoiceStatus.status === 'pending' || invoiceStatus.status === 'processing') ? (
                                                                    <div className="w-full py-4 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl font-bold flex items-center justify-center cursor-wait shadow-sm text-lg">
                                                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-500 mr-3"></div>
                                                                        Procesando ({selectedIds.length})...
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => setConfirmingBilling(true)}
                                                                        className="w-full py-4 bg-teal-600 text-white rounded-xl hover:bg-teal-700 shadow-xl shadow-teal-100 font-bold flex items-center justify-center transition-all hover:scale-[1.02] text-lg"
                                                                    >
                                                                        <DollarSign size={24} className="mr-2" />
                                                                        Facturar ({selectedIds.length}) - Total: ${toBill.filter(a => selectedIds.includes(a.id)).reduce((sum, a) => sum + (a.price || 0), 0)}
                                                                    </button>
                                                                )}
                                                                {invoiceStatus.error && (
                                                                    <div className="mt-3 text-sm text-red-600 text-center font-medium bg-red-50 p-2 rounded-lg">
                                                                        Error: {invoiceStatus.error}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>

                                            {/* Balance Box */}
                                            <div className={`p-6 rounded-2xl border ${stats.totalDebt > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                                                <div className="text-sm font-bold text-slate-500 uppercase mb-2 tracking-wide">Saldo Pendiente</div>
                                                <div className={`text-4xl font-bold ${stats.totalDebt > 0 ? 'text-red-700' : 'text-green-700'}`}>
                                                    ${stats.totalDebt}
                                                </div>
                                                <div className="text-sm text-slate-500 mt-3 font-medium">
                                                    Total Pagado Histórico: ${stats.totalPaid}
                                                </div>
                                            </div>

                                            {/* Movements Table */}
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-800 mb-4">Movimientos Recientes</h3>
                                                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                                    {movements.length === 0 ? (
                                                        <div className="text-center text-slate-500 py-8 italic">No hay movimientos registrados.</div>
                                                    ) : (
                                                        movements.map((mov, idx) => (
                                                            <div key={`${mov.id}-${idx}`} className="flex justify-between items-center px-6 py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                                                <div>
                                                                    <div className="text-sm font-bold text-slate-900">{mov.description}</div>
                                                                    <div className="text-xs text-slate-500 font-medium mt-0.5">{mov.date.toLocaleDateString()}</div>
                                                                </div>
                                                                <div className={`text-base font-bold ${mov.type === 'payment' ? 'text-green-600' : 'text-slate-700'}`}>
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
