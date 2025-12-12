import { useState, useMemo } from 'react';
import { User } from 'firebase/auth';
import { useData } from '../context/DataContext';
import { usePatients } from '../hooks/usePatients';
import { usePsiquePayments } from '../hooks/usePsiquePayments';
import { Search, CheckCircle, AlertCircle, Clock, DollarSign, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Building2, Loader2 } from 'lucide-react';
import { PaymentModal } from '../components/modals/PaymentModal';
import { toast } from 'sonner';

interface PaymentsViewProps {
    user: User;
}

export const PaymentsView = ({ user }: PaymentsViewProps) => {
    const { appointments, loading } = useData();
    const { patients } = usePatients(user);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'overdue' | 'upcoming' | 'history' | 'psique'>('overdue');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

    // Psique payments hook
    const { monthData: psiqueData, loading: psiqueLoading, markAsPaid } = usePsiquePayments(appointments, patients, selectedDate);

    // Month Selector helpers
    const currentMonthLabel = selectedDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    const changeMonth = (delta: number) => {
        const newDate = new Date(selectedDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setSelectedDate(newDate);
    };

    const filteredData = useMemo(() => {
        if (loading) return [];
        let data = appointments;

        // Filter by search term
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            data = data.filter(a =>
                a.patientName.toLowerCase().includes(lower) ||
                (a.patientEmail && a.patientEmail.toLowerCase().includes(lower))
            );
        }


        const now = new Date();

        // Helper to check if an appointment is overdue (1 hour after start time)
        const isOverdue = (appointment: any) => {
            const apptDateTime = new Date(appointment.date + 'T' + (appointment.time || '00:00') + ':00');
            // Add 1 hour to appointment time
            apptDateTime.setHours(apptDateTime.getHours() + 1);
            return now > apptDateTime;
        };

        const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);

        if (viewMode === 'overdue') {
            // ALL overdue appointments (1 hour past start time, unpaid), regardless of selected month
            return data.filter(a => {
                return !a.isPaid && a.status !== 'cancelado' && isOverdue(a);
            }).sort((a, b) => a.date.localeCompare(b.date));
        } else if (viewMode === 'upcoming') {
            // Future/Pending appointments in selected month (NOT overdue)
            return data.filter(a => {
                const apptDate = new Date(a.date + 'T00:00:00');
                const inMonth = apptDate >= startOfMonth && apptDate <= endOfMonth;
                // Must be unpaid, not cancelled, in month, and NOT overdue
                return !a.isPaid && a.status !== 'cancelado' && inMonth && !isOverdue(a);
            }).sort((a, b) => a.date.localeCompare(b.date));
        } else {
            // History: Paid appointments in selected month
            return data.filter(a => {
                const apptDate = new Date(a.date + 'T00:00:00');
                return a.isPaid && apptDate >= startOfMonth && apptDate <= endOfMonth;
            }).sort((a, b) => b.date.localeCompare(a.date));
        }
    }, [appointments, loading, searchTerm, viewMode, selectedDate]);

    const totalAmount = filteredData.reduce((acc, curr) => acc + (curr.price || 0), 0);

    // Calculate monthly gross income (all paid appointments in selected month)
    const monthlyGrossIncome = useMemo(() => {
        if (loading) return 0;
        const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);

        return appointments
            .filter(a => {
                const apptDate = new Date(a.date + 'T00:00:00');
                return a.isPaid && apptDate >= startOfMonth && apptDate <= endOfMonth;
            })
            .reduce((sum, a) => sum + (a.price || 0), 0);
    }, [appointments, loading, selectedDate]);

    // Net income = gross - psique expense
    const monthlyNetIncome = monthlyGrossIncome - psiqueData.totalAmount;

    const handleOpenPayment = (appt: any) => {
        setSelectedAppointment(appt);
        setPaymentModalOpen(true);
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Pagos</h1>
                    <p className="text-slate-500 text-sm">Control de Caja y Cobranzas</p>
                </div>

                <div className="flex items-center space-x-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className="w-full pl-10 pr-4 py-2 border rounded-xl shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Monthly Net Income Summary - Fixed card */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-5 mb-6 text-white shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <p className="text-slate-300 text-sm font-medium uppercase tracking-wider mb-1">
                            Resumen {currentMonthLabel}
                        </p>
                        <div className="flex items-center gap-6 text-sm">
                            <div>
                                <span className="text-slate-400">Bruto:</span>
                                <span className="ml-2 font-bold">${monthlyGrossIncome.toLocaleString()}</span>
                            </div>
                            <div>
                                <span className="text-purple-300">Psique (25%):</span>
                                <span className="ml-2 font-bold text-purple-300">-${psiqueData.totalAmount.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-slate-400 text-xs uppercase tracking-wider">Ingreso Neto</p>
                        <p className="text-3xl font-bold text-green-400">
                            ${monthlyNetIncome.toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>

            {/* Date Selector & Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                {/* Tabs */}
                <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
                    <button
                        onClick={() => setViewMode('overdue')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center whitespace-nowrap ${viewMode === 'overdue' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <AlertCircle size={16} className="mr-2" /> Vencidos
                    </button>
                    <button
                        onClick={() => setViewMode('upcoming')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center whitespace-nowrap ${viewMode === 'upcoming' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Clock size={16} className="mr-2" /> Próximos
                    </button>
                    <button
                        onClick={() => setViewMode('history')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center whitespace-nowrap ${viewMode === 'history' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <CheckCircle size={16} className="mr-2" /> Historial
                    </button>
                    <button
                        onClick={() => setViewMode('psique')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center whitespace-nowrap ${viewMode === 'psique' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Building2 size={16} className="mr-2" /> Psique
                    </button>
                </div>

                {/* Date Selector (Only relevant for Upcoming & History usually, but kept always visible for simplicity or specific behavior) */}
                {(viewMode !== 'overdue') && (
                    <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
                        <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500">
                            <ChevronLeft size={20} />
                        </button>
                        <span className="mx-4 font-bold text-slate-700 capitalize min-w-[140px] text-center block">
                            {currentMonthLabel}
                        </span>
                        <button onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                )}
            </div>

            {/* Summary Card */}
            {viewMode === 'psique' ? (
                <div className={`border p-6 rounded-2xl shadow-sm mb-6 ${psiqueData.isPaid ? 'bg-green-50 border-green-200' : 'bg-purple-50 border-purple-200'}`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={`font-bold text-sm mb-1 uppercase tracking-wider ${psiqueData.isPaid ? 'text-green-600' : 'text-purple-600'}`}>
                                Pago a Psique Salud Mental (25%)
                            </p>
                            <h2 className={`text-3xl font-bold flex items-center ${psiqueData.isPaid ? 'text-green-700' : 'text-purple-700'}`}>
                                <DollarSign size={24} className="mr-1" />
                                {psiqueData.totalAmount.toLocaleString()}
                            </h2>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            {psiqueData.isPaid ? (
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold bg-green-100 text-green-700">
                                        <CheckCircle size={16} className="mr-1.5" /> Pagado
                                    </span>
                                    <button
                                        onClick={() => markAsPaid(psiqueData.month, false)}
                                        className="text-xs text-slate-500 hover:text-red-600 underline"
                                    >
                                        Desmarcar
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => {
                                        markAsPaid(psiqueData.month, true);
                                        toast.success('Pago a Psique registrado');
                                    }}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors flex items-center"
                                    disabled={psiqueData.totalAmount === 0}
                                >
                                    <CheckCircle size={16} className="mr-2" /> Marcar como Pagado
                                </button>
                            )}
                            {psiqueData.paidDate && (
                                <span className="text-xs text-slate-500">
                                    Pagado el {new Date(psiqueData.paidDate + 'T00:00:00').toLocaleDateString()}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className={`border p-6 rounded-2xl shadow-sm mb-6 flex items-center justify-between
                    ${viewMode === 'overdue' ? 'bg-red-50 border-red-100' :
                        viewMode === 'upcoming' ? 'bg-amber-50 border-amber-100' :
                            'bg-green-50 border-green-100'}`}>
                    <div>
                        <p className={`font-bold text-sm mb-1 uppercase tracking-wider opacity-80
                            ${viewMode === 'overdue' ? 'text-red-600' :
                                viewMode === 'upcoming' ? 'text-amber-600' :
                                    'text-green-600'}`}>
                            {viewMode === 'overdue' ? 'Total Vencido' :
                                viewMode === 'upcoming' ? 'Total a Cobrar (Mes)' :
                                    'Total Cobrado (Mes)'}
                        </p>
                        <h2 className={`text-3xl font-bold flex items-center 
                            ${viewMode === 'overdue' ? 'text-red-700' :
                                viewMode === 'upcoming' ? 'text-amber-700' :
                                    'text-green-700'}`}>
                            <DollarSign size={24} className="mr-1" />
                            {totalAmount.toLocaleString()}
                        </h2>
                    </div>
                    <div className={`text-right text-sm font-medium opacity-80
                         ${viewMode === 'overdue' ? 'text-red-600' :
                            viewMode === 'upcoming' ? 'text-amber-600' :
                                'text-green-600'}`}>
                        {filteredData.length} registros
                    </div>
                </div>
            )}

            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {viewMode === 'psique' ? (
                    // Psique patient breakdown
                    psiqueLoading ? (
                        <div className="p-12 flex justify-center items-center text-slate-500">
                            <Loader2 size={24} className="animate-spin mr-3" />
                            Cargando...
                        </div>
                    ) : psiqueData.patientBreakdown.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                            <div className="bg-purple-50 p-4 rounded-full mb-4">
                                <Building2 size={32} className="text-purple-300" />
                            </div>
                            <p>No hay pacientes de Psique con pagos en este mes.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                                    <tr>
                                        <th className="p-4 pl-6">Paciente</th>
                                        <th className="p-4 text-center">Sesiones</th>
                                        <th className="p-4 text-right">Honorarios</th>
                                        <th className="p-4 text-right pr-6">25% Psique</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {psiqueData.patientBreakdown.map(patient => (
                                        <tr key={patient.patientId} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 pl-6 font-bold text-slate-800">
                                                {patient.patientName}
                                            </td>
                                            <td className="p-4 text-center text-slate-600">
                                                {patient.sessionCount}
                                            </td>
                                            <td className="p-4 text-right text-slate-600">
                                                ${patient.totalFee.toLocaleString()}
                                            </td>
                                            <td className="p-4 text-right pr-6 font-bold text-purple-700">
                                                ${patient.psiqueAmount.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-purple-50 border-t-2 border-purple-200">
                                    <tr>
                                        <td className="p-4 pl-6 font-bold text-purple-800" colSpan={2}>
                                            Total a Pagar
                                        </td>
                                        <td className="p-4 text-right text-slate-600">
                                            ${psiqueData.patientBreakdown.reduce((sum, p) => sum + p.totalFee, 0).toLocaleString()}
                                        </td>
                                        <td className="p-4 text-right pr-6 font-bold text-purple-800 text-lg">
                                            ${psiqueData.totalAmount.toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )
                ) : loading ? (
                    <div className="p-12 flex justify-center items-center text-slate-500">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400 mr-3"></div>
                        Cargando...
                    </div>
                ) : filteredData.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                        <div className="bg-slate-50 p-4 rounded-full mb-4">
                            {viewMode === 'overdue' ? <CheckCircle size={32} className="text-green-500" /> :
                                viewMode === 'upcoming' ? <CalendarIcon size={32} className="text-slate-300" /> :
                                    <Clock size={32} className="text-slate-300" />}
                        </div>
                        <p>
                            {viewMode === 'overdue' ? '¡Excelente! No hay deudas vencidas.' :
                                viewMode === 'upcoming' ? 'No hay cobros pendientes para este mes.' :
                                    'No hay historial de cobros en este mes.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left min-w-[600px]">
                            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                                <tr>
                                    <th className="p-4 pl-6">Fecha</th>
                                    <th className="p-4">Paciente</th>
                                    <th className="p-4 hidden sm:table-cell">Detalle</th>
                                    <th className="p-4 text-right">Monto</th>
                                    <th className="p-4 pr-6 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredData.map(item => {
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 pl-6 font-medium text-slate-700 whitespace-nowrap">
                                                {new Date(item.date + 'T00:00:00').toLocaleDateString()}
                                            </td>
                                            <td className="p-4 font-bold text-slate-800">
                                                {item.patientName}
                                            </td>
                                            <td className="p-4 text-slate-500 hidden sm:table-cell">
                                                {item.consultationType || 'Consulta'}
                                            </td>
                                            <td className="p-4 text-right font-bold text-slate-700 whitespace-nowrap">
                                                ${item.price}
                                            </td>
                                            <td className="p-4 pr-6 text-center">
                                                {item.isPaid ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                        Cobrado
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => handleOpenPayment(item)}
                                                        className="inline-flex items-center px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-medium transition-colors text-xs whitespace-nowrap"
                                                    >
                                                        Cobrar
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {paymentModalOpen && selectedAppointment && (
                <PaymentModal
                    appointment={selectedAppointment}
                    onClose={() => setPaymentModalOpen(false)}
                />
            )}
        </div>
    );
};
