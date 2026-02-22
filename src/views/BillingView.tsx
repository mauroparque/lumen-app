import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Appointment } from '../types';
import { Loader2, CheckCircle, Receipt, ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';
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
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [expandedPatients, setExpandedPatients] = useState<string[]>([]);
    const [selectedAppointments, setSelectedAppointments] = useState<Record<string, string[]>>({}); // patientId -> appointmentIds[]

    // Month Selector helpers
    const currentMonthLabel = selectedDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const changeMonth = (delta: number) => {
        const newDate = new Date(selectedDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setSelectedDate(newDate);
    };

    const billingQueue = useMemo(() => {
        if (loading) return [];

        const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);

        // Filter: Paid but NOT invoiced AND in selected month
        const eligible = appointments.filter((a) => {
            const apptDate = new Date(a.date + 'T00:00:00');
            return a.isPaid && a.billingStatus !== 'invoiced' && apptDate >= startOfMonth && apptDate <= endOfMonth;
        });

        // Group by patient
        const grouped = eligible.reduce(
            (acc, appt) => {
                if (!acc[appt.patientId]) {
                    acc[appt.patientId] = {
                        patientId: appt.patientId,
                        patientName: appt.patientName,
                        patientEmail: appt.patientEmail,
                        sessionCount: 0,
                        totalAmount: 0,
                        appointments: [],
                    };
                }

                acc[appt.patientId].sessionCount++;
                acc[appt.patientId].totalAmount += appt.price || 0;
                acc[appt.patientId].appointments.push(appt);

                return acc;
            },
            {} as Record<string, PatientBillingSummary>,
        );

        return Object.values(grouped).sort((a, b) => a.patientName.localeCompare(b.patientName));
    }, [appointments, loading, selectedDate]);

    const toggleExpand = (patientId: string) => {
        setExpandedPatients((prev) =>
            prev.includes(patientId) ? prev.filter((id) => id !== patientId) : [...prev, patientId],
        );
    };

    const toggleAppointmentSelection = (patientId: string, appointmentId: string) => {
        setSelectedAppointments((prev) => {
            const currentSelected = prev[patientId] || [];
            const isSelected = currentSelected.includes(appointmentId);

            let newSelected;
            if (isSelected) {
                newSelected = currentSelected.filter((id) => id !== appointmentId);
            } else {
                newSelected = [...currentSelected, appointmentId];
            }

            return { ...prev, [patientId]: newSelected };
        });
    };

    const toggleSelectAll = (patientId: string, allIds: string[]) => {
        setSelectedAppointments((prev) => {
            const currentSelected = prev[patientId] || [];
            const allSelected = currentSelected.length === allIds.length;

            return {
                ...prev,
                [patientId]: allSelected ? [] : allIds,
            };
        });
    };

    const handleGenerateInvoice = async (summary: PatientBillingSummary) => {
        const patientId = summary.patientId;
        if (processingIds.includes(patientId)) return;

        const selectedIds = selectedAppointments[patientId] || [];
        // Default to all if none explicitly selected (or enforce selection? User said "Generar Factura debe enviar solo los appointmentIds seleccionados".
        // Logic: if granular selection exists, use it. If list is empty, maybe block button or assume none?
        // Let's assume if nothing selected, we can't bill. But initially nothing is selected.
        // Better UX: Pre-select all when expanded? Or assume all if nothing in state?
        // Let's go with: Only send selected. If count is 0, disable button.

        const appointmentsToBill = summary.appointments.filter((a) => selectedIds.includes(a.id));

        if (appointmentsToBill.length === 0) {
            toast.error('Selecciona al menos una sesión para facturar');
            return;
        }

        setProcessingIds((prev) => [...prev, patientId]);
        const toastId = toast.loading('Solicitando factura...');

        try {
            const patientData = {
                id: patientId,
                name: summary.patientName,
                email: summary.patientEmail || '',
                dni: '',
            };

            await requestBatchInvoice(appointmentsToBill, patientData);
            toast.success(`Factura solicitada para ${summary.patientName}`, { id: toastId });

            // Clear selection
            setSelectedAppointments((prev) => ({ ...prev, [patientId]: [] }));
        } catch (error) {
            console.error(error);
            toast.error('Error al solicitar factura', { id: toastId });
        } finally {
            setProcessingIds((prev) => prev.filter((id) => id !== patientId));
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Facturación</h1>
                    <p className="text-slate-500 text-sm">Dashboard Fiscal - Pendientes de Facturación</p>
                </div>

                {/* Date Selector */}
                <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
                    <button
                        onClick={() => changeMonth(-1)}
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <span className="mx-4 font-bold text-slate-700 capitalize min-w-[140px] text-center block">
                        {currentMonthLabel}
                    </span>
                    <button onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {loading ? (
                    <div className="bg-white rounded-xl p-12 flex justify-center items-center text-slate-500 border border-slate-200">
                        <Loader2 size={24} className="animate-spin mr-3" />
                        Cargando...
                    </div>
                ) : billingQueue.length === 0 ? (
                    <div className="bg-white rounded-xl p-16 text-center flex flex-col items-center border border-slate-200">
                        <div className="bg-green-100 p-4 rounded-full mb-4 text-green-600">
                            <CheckCircle size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">¡Al día!</h3>
                        <p className="text-slate-500">No hay cobros pendientes de facturar para este mes.</p>
                    </div>
                ) : (
                    billingQueue.map((item) => {
                        const isExpanded = expandedPatients.includes(item.patientId);
                        const selectedIds = selectedAppointments[item.patientId] || [];
                        const allIds = item.appointments.map((a) => a.id);
                        const isAllSelected = allIds.every((id) => selectedIds.includes(id));
                        const isIndeterminate = selectedIds.length > 0 && selectedIds.length < allIds.length;

                        // Calculate total based on selection if expanded, otherwise total available?
                        // Requirement: "Nivel 1: Total a Facturar en el mes". Usually implies total available.
                        // But button logic uses selected.

                        return (
                            <div
                                key={item.patientId}
                                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all"
                            >
                                {/* Summary Row */}
                                <div
                                    className={`p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50 border-b border-slate-100' : ''}`}
                                    onClick={() => toggleExpand(item.patientId)}
                                >
                                    <div className="flex items-center space-x-4">
                                        <button className="text-slate-400">
                                            {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                        </button>
                                        <div>
                                            <div className="font-bold text-slate-800 text-lg">{item.patientName}</div>
                                            <div className="text-sm text-slate-500">{item.patientEmail}</div>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-6">
                                        <div className="text-right hidden md:block">
                                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                Sesiones
                                            </div>
                                            <div className="font-bold text-slate-700">{item.sessionCount}</div>
                                        </div>
                                        <div className="text-right min-w-[100px]">
                                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                Total
                                            </div>
                                            <div className="font-bold text-slate-900 text-lg">
                                                ${item.totalAmount.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Detail Panel */}
                                {isExpanded && (
                                    <div className="p-4 bg-slate-50/50 animate-in slide-in-from-top-2 duration-200">
                                        <div className="flex justify-between items-center mb-4 px-2">
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                                    checked={isAllSelected}
                                                    ref={(input) => {
                                                        if (input) input.indeterminate = isIndeterminate;
                                                    }}
                                                    onChange={() => toggleSelectAll(item.patientId, allIds)}
                                                />
                                                <span className="text-sm font-medium text-slate-600">
                                                    Seleccionar todo
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleGenerateInvoice(item)}
                                                disabled={
                                                    processingIds.includes(item.patientId) || selectedIds.length === 0
                                                }
                                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                            >
                                                {processingIds.includes(item.patientId) ? (
                                                    <>
                                                        {' '}
                                                        <Loader2 size={16} className="animate-spin mr-2" />{' '}
                                                        Procesando{' '}
                                                    </>
                                                ) : (
                                                    <>
                                                        {' '}
                                                        <Receipt size={16} className="mr-2" /> Facturar Seleccionados (
                                                        {selectedIds.length}){' '}
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                                    <tr>
                                                        <th className="p-3 w-10 text-center"></th>
                                                        <th className="p-3">Fecha</th>
                                                        <th className="p-3">Servicio</th>
                                                        <th className="p-3 text-right">Monto</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {item.appointments.map((appt) => (
                                                        <tr
                                                            key={appt.id}
                                                            className="hover:bg-slate-50 transition-colors"
                                                        >
                                                            <td className="p-3 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                                                    checked={selectedIds.includes(appt.id)}
                                                                    onChange={() =>
                                                                        toggleAppointmentSelection(
                                                                            item.patientId,
                                                                            appt.id,
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            <td className="p-3 font-medium text-slate-700">
                                                                {new Date(appt.date + 'T00:00:00').toLocaleDateString()}
                                                            </td>
                                                            <td className="p-3 text-slate-600">
                                                                {appt.consultationType || 'Consulta'}
                                                            </td>
                                                            <td className="p-3 text-right font-bold text-slate-700">
                                                                ${appt.price}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
