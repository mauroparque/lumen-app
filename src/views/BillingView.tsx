import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Appointment } from '../types';
import { Loader2, CheckCircle, Receipt } from 'lucide-react';
import { useDataActions } from '../hooks/useDataActions';
import { toast } from 'sonner';

interface PatientBillingSummary {
    patientId: string;
    patientName: string;
    patientEmail?: string;
    sessionCount: number;
    totalAmount: number;
    appointments: Appointment[];
}

export const BillingView = () => {
    const { appointments, loading } = useData();
    const { requestBatchInvoice } = useDataActions();
    const [processingIds, setProcessingIds] = useState<string[]>([]);

    const billingQueue = useMemo(() => {
        if (loading) return [];

        // Filter: Paid but NOT invoiced
        const eligible = appointments.filter(a => a.isPaid && a.billingStatus !== 'invoiced');

        // Group by patient
        const grouped = eligible.reduce((acc, appt) => {
            if (!acc[appt.patientId]) {
                acc[appt.patientId] = {
                    patientId: appt.patientId,
                    patientName: appt.patientName,
                    patientEmail: appt.patientEmail,
                    sessionCount: 0,
                    totalAmount: 0,
                    appointments: []
                };
            }

            acc[appt.patientId].sessionCount++;
            acc[appt.patientId].totalAmount += (appt.price || 0);
            acc[appt.patientId].appointments.push(appt);

            return acc;
        }, {} as Record<string, PatientBillingSummary>);

        return Object.values(grouped);
    }, [appointments, loading]);

    const handleGenerateInvoice = async (summary: PatientBillingSummary) => {
        if (processingIds.includes(summary.patientId)) return;

        setProcessingIds(prev => [...prev, summary.patientId]);
        const toastId = toast.loading('Solicitando factura...');

        try {
            const patientData = {
                id: summary.patientId,
                name: summary.patientName,
                email: summary.patientEmail,
                dni: '' // Optional or fetched if needed
            };

            await requestBatchInvoice(summary.appointments, patientData);
            toast.success(`Factura solicitada para ${summary.patientName}`, { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error('Error al solicitar factura', { id: toastId });
        } finally {
            setProcessingIds(prev => prev.filter(id => id !== summary.patientId));
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800">Facturación</h1>
                <p className="text-slate-500 text-sm">Dashboard Fiscal - Pendientes de Facturación</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-12 flex justify-center items-center text-slate-500">
                        <Loader2 size={24} className="animate-spin mr-3" />
                        Cargando...
                    </div>
                ) : billingQueue.length === 0 ? (
                    <div className="p-16 text-center flex flex-col items-center">
                        <div className="bg-green-100 p-4 rounded-full mb-4 text-green-600">
                            <CheckCircle size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">¡Al día!</h3>
                        <p className="text-slate-500">No hay cobros pendientes de facturar.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                            <tr>
                                <th className="p-4 pl-6">Paciente</th>
                                <th className="p-4 text-center">Sesiones sin Facturar</th>
                                <th className="p-4 text-right">Monto Acumulado</th>
                                <th className="p-4 pr-6 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {billingQueue.map((item) => (
                                <tr key={item.patientId} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 pl-6">
                                        <div className="font-bold text-slate-800">{item.patientName}</div>
                                        <div className="text-xs text-slate-500">{item.patientEmail}</div>
                                    </td>
                                    <td className="p-4 text-center text-slate-600 font-medium">
                                        {item.sessionCount}
                                    </td>
                                    <td className="p-4 text-right font-bold text-slate-700">
                                        ${item.totalAmount.toLocaleString()}
                                    </td>
                                    <td className="p-4 pr-6 text-right">
                                        <button
                                            onClick={() => handleGenerateInvoice(item)}
                                            disabled={processingIds.includes(item.patientId)}
                                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-50 flex items-center justify-center ml-auto min-w-[140px]"
                                        >
                                            {processingIds.includes(item.patientId) ? (
                                                <> <Loader2 size={16} className="animate-spin mr-2" /> Procesando </>
                                            ) : (
                                                <> <Receipt size={16} className="mr-2" /> Generar Factura </>
                                            )}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
