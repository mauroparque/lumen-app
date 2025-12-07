import { useState } from 'react';
import { User } from 'firebase/auth';
import { useFinanceData, PatientBillingSummary } from '../hooks/useFinanceData';
import { ChevronLeft, ChevronRight, DollarSign, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useDataActions } from '../hooks/useDataActions';
import { toast } from 'sonner';

interface FinanceViewProps {
    user: User;
}

export const FinanceView = ({ user }: FinanceViewProps) => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const { summary, loading } = useFinanceData(user, selectedDate);
    const { requestBatchInvoice } = useDataActions();
    const [processingIds, setProcessingIds] = useState<string[]>([]);

    const handlePrevMonth = () => {
        setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
    };

    const totalMonthAmount = summary.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalSessions = summary.reduce((acc, s) => acc + s.sessionCount, 0);

    const handleBillPatient = async (patientSummary: PatientBillingSummary) => {
        if (processingIds.includes(patientSummary.patientId)) return;

        // Filter out appointments that are already invoiced
        const toBill = patientSummary.appointments.filter(a => a.billingStatus !== 'invoiced');

        if (toBill.length === 0) {
            toast.info('Todos los turnos de este paciente ya están facturados.');
            return;
        }

        setProcessingIds(prev => [...prev, patientSummary.patientId]);

        try {
            const patientData = {
                id: patientSummary.patientId,
                name: patientSummary.patientName,
                email: patientSummary.patientEmail,
                dni: ''
            };

            await requestBatchInvoice(toBill, patientData);
            toast.success(`Solicitud de facturación enviada para ${patientSummary.patientName}`);
        } catch (error) {
            console.error(error);
            toast.error('Error al procesar la facturación');
        } finally {
            setProcessingIds(prev => prev.filter(id => id !== patientSummary.patientId));
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-2xl font-bold text-slate-800">Facturación Mensual</h1>

                <div className="flex items-center bg-white rounded-xl shadow-sm border border-slate-200 p-1">
                    <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <ChevronLeft size={20} className="text-slate-600" />
                    </button>
                    <div className="px-4 font-bold text-slate-800 w-40 text-center capitalize">
                        {selectedDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                    </div>
                    <button onClick={handleNextMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <ChevronRight size={20} className="text-slate-600" />
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                    <p className="text-slate-500 font-medium text-sm mb-1">Total a Facturar (Estimado)</p>
                    <h2 className="text-3xl font-bold text-teal-600 flex items-center">
                        <DollarSign size={24} className="mr-1" />
                        {totalMonthAmount.toLocaleString()}
                    </h2>
                </div>
                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                    <p className="text-slate-500 font-medium text-sm mb-1">Total Sesiones</p>
                    <h2 className="text-3xl font-bold text-slate-800">
                        {totalSessions}
                    </h2>
                </div>
                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                    <p className="text-slate-500 font-medium text-sm mb-1">Estado del Mes</p>
                    <div className="flex items-center mt-1">
                        <div className="w-full bg-slate-100 rounded-full h-2.5 mr-3">
                            <div
                                className="bg-teal-500 h-2.5 rounded-full"
                                style={{ width: `${summary.length > 0 ? (summary.filter(s => s.status === 'completed').length / summary.length) * 100 : 0}%` }}
                            ></div>
                        </div>
                        <span className="text-sm font-bold text-slate-600">
                            {summary.length > 0 ? Math.round((summary.filter(s => s.status === 'completed').length / summary.length) * 100) : 0}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-12 flex justify-center items-center text-slate-500">
                        <Loader2 size={24} className="animate-spin mr-3" />
                        Cargando datos...
                    </div>
                ) : summary.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                        <FileText size={48} className="text-slate-200 mb-4" />
                        <p>No hay actividad registrada en este mes.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                                <tr>
                                    <th className="p-4 pl-6">Paciente</th>
                                    <th className="p-4 text-center">Sesiones</th>
                                    <th className="p-4">Estado</th>
                                    <th className="p-4 text-right">Total ($)</th>
                                    <th className="p-4 pr-6 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {summary.map((item) => (
                                    <tr key={item.patientId} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 pl-6">
                                            <div className="font-bold text-slate-800">{item.patientName}</div>
                                            <div className="text-xs text-slate-500">{item.patientEmail}</div>
                                        </td>
                                        <td className="p-4 text-center text-slate-600 font-medium">
                                            {item.sessionCount}
                                        </td>
                                        <td className="p-4">
                                            {item.status === 'completed' ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    <CheckCircle size={12} className="mr-1" /> Facturado
                                                </span>
                                            ) : item.status === 'partial' ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                    <AlertCircle size={12} className="mr-1" /> Parcial
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                                    Pendiente
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right font-bold text-slate-700">
                                            ${item.totalAmount.toLocaleString()}
                                        </td>
                                        <td className="p-4 pr-6 text-right">
                                            {item.status === 'completed' ? (
                                                <button disabled className="text-green-600 font-medium text-sm flex items-center justify-end w-full cursor-default opacity-50">
                                                    <CheckCircle size={18} />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleBillPatient(item)}
                                                    disabled={processingIds.includes(item.patientId)}
                                                    className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 shadow-sm transition-all disabled:opacity-50 flex items-center justify-center ml-auto min-w-[120px]"
                                                >
                                                    {processingIds.includes(item.patientId) ? (
                                                        <> <Loader2 size={16} className="animate-spin mr-2" /> Procesando </>
                                                    ) : (
                                                        'Facturar Mes'
                                                    )}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
