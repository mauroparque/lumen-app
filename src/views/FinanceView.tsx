import { useState } from 'react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db, appId, CLINIC_ID } from '../lib/firebase';
import { User } from 'firebase/auth';
import { Appointment, Payment } from '../types';
import { AlertTriangle, AlertCircle, CheckCircle, Trash2, Clock, Calendar } from 'lucide-react';
import { PaymentModal } from '../components/modals/PaymentModal';
import { useFinanceData } from '../hooks/useFinanceData';
import { toast } from 'sonner';

interface FinanceViewProps {
    user: User;
}

export const FinanceView = ({ user }: FinanceViewProps) => {
    const [tab, setTab] = useState<'overdue' | 'pending' | 'history'>('overdue');
    const [showPayModal, setShowPayModal] = useState<Appointment | null>(null);

    const { unpaidAppointments, payments } = useFinanceData(user);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Helper to parse YYYY-MM-DD to local Date
    const getApptDate = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    // Filter 1: Overdue (Real Debt)
    const overdue = unpaidAppointments.filter(a => getApptDate(a.date) < today);

    // Filter 2: Pending/Future (Projected)
    const pending = unpaidAppointments.filter(a => getApptDate(a.date) >= today);

    const totalIncome = payments.reduce((acc: number, p: Payment) => acc + p.amount, 0);
    const totalOverdue = overdue.reduce((acc: number, a: Appointment) => acc + (a.price || 0), 0);
    const totalPending = pending.reduce((acc: number, a: Appointment) => acc + (a.price || 0), 0);

    const handleDeletePayment = async (payment: Payment) => {
        if (confirm('¿Eliminar registro de pago?')) {
            try {
                await deleteDoc(doc(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'payments', payment.id));
                toast.success('Pago eliminado correctamente');
            } catch (error) {
                console.error(error);
                toast.error('Error al eliminar el pago');
            }
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-800 mb-6">Panel Financiero</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white border border-red-100 p-6 rounded-2xl shadow-sm relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-6 opacity-10 text-red-500"><AlertTriangle size={64} /></div>
                    <p className="text-red-500 font-medium mb-1">Vencidos (Deuda Real)</p>
                    <h2 className="text-3xl font-bold text-slate-800">${totalOverdue.toLocaleString()}</h2>
                    <p className="text-xs text-slate-400 mt-2">{overdue.length} sesiones vencidas</p>
                </div>

                <div className="bg-white border border-yellow-100 p-6 rounded-2xl shadow-sm relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-6 opacity-10 text-yellow-500"><Clock size={64} /></div>
                    <p className="text-yellow-600 font-medium mb-1">Pendientes (Proyección)</p>
                    <h2 className="text-3xl font-bold text-slate-800">${totalPending.toLocaleString()}</h2>
                    <p className="text-xs text-slate-400 mt-2">{pending.length} sesiones futuras</p>
                </div>

                <div className="bg-teal-600 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-6 opacity-10 text-white"><CheckCircle size={64} /></div>
                    <p className="text-teal-100 mb-1">Ingresos Totales</p>
                    <h2 className="text-3xl font-bold">${totalIncome.toLocaleString()}</h2>
                    <p className="text-xs text-teal-200 mt-2">{payments.length} pagos registrados</p>
                </div>
            </div>

            <div className="flex space-x-6 border-b border-slate-200 mb-6 overflow-x-auto">
                <button onClick={() => setTab('overdue')} className={`pb-3 px-2 font-medium text-sm flex items-center space-x-2 border-b-2 transition-colors whitespace-nowrap ${tab === 'overdue' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                    <AlertCircle size={16} /> <span>Vencidos ({overdue.length})</span>
                </button>
                <button onClick={() => setTab('pending')} className={`pb-3 px-2 font-medium text-sm flex items-center space-x-2 border-b-2 transition-colors whitespace-nowrap ${tab === 'pending' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                    <Clock size={16} /> <span>Pendientes ({pending.length})</span>
                </button>
                <button onClick={() => setTab('history')} className={`pb-3 px-2 font-medium text-sm flex items-center space-x-2 border-b-2 transition-colors whitespace-nowrap ${tab === 'history' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                    <CheckCircle size={16} /> <span>Historial de Pagos</span>
                </button>
            </div>

            {tab === 'overdue' && (
                <div className="bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden overflow-x-auto">
                    {overdue.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                            <CheckCircle size={48} className="mx-auto mb-4 text-teal-400" />
                            <p>¡Excelente! No hay pagos vencidos.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-red-50 text-red-700 font-medium">
                                <tr><th className="p-2 md:p-4">Fecha</th><th className="p-2 md:p-4">Paciente</th><th className="p-2 md:p-4">Monto</th><th className="p-2 md:p-4 text-right">Acción</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {overdue.map((d: Appointment) => (
                                    <tr key={d.id} className="hover:bg-slate-50">
                                        <td className="p-2 md:p-4 text-slate-600">{d.date.split('-').reverse().join('/')}</td>
                                        <td className="p-2 md:p-4 font-bold text-slate-800">{d.patientName}</td>
                                        <td className="p-2 md:p-4 font-mono text-slate-600">${d.price || 0}</td>
                                        <td className="p-2 md:p-4 text-right">
                                            <button onClick={() => setShowPayModal(d)} className="bg-red-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-red-700 shadow-sm">
                                                Regularizar Pago
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {tab === 'pending' && (
                <div className="bg-white rounded-xl border border-yellow-100 shadow-sm overflow-hidden overflow-x-auto">
                    {pending.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                            <Calendar size={48} className="mx-auto mb-4 text-slate-300" />
                            <p>No hay sesiones futuras pendientes de cobro.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-yellow-50 text-yellow-700 font-medium">
                                <tr><th className="p-2 md:p-4">Fecha</th><th className="p-2 md:p-4">Paciente</th><th className="p-2 md:p-4">Monto</th><th className="p-2 md:p-4 text-right">Acción</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pending.map((d: Appointment) => (
                                    <tr key={d.id} className="hover:bg-slate-50">
                                        <td className="p-2 md:p-4 text-slate-600">{d.date.split('-').reverse().join('/')}</td>
                                        <td className="p-2 md:p-4 font-bold text-slate-800">{d.patientName}</td>
                                        <td className="p-2 md:p-4 font-mono text-slate-600">${d.price || 0}</td>
                                        <td className="p-2 md:p-4 text-right">
                                            <button onClick={() => setShowPayModal(d)} className="bg-yellow-500 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-yellow-600 shadow-sm">
                                                Adelantar Pago
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {tab === 'history' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium">
                            <tr><th className="p-2 md:p-4">Fecha Pago</th><th className="p-2 md:p-4">Paciente</th><th className="p-2 md:p-4">Concepto</th><th className="p-2 md:p-4">Monto</th><th className="p-2 md:p-4"></th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {payments.sort((a: any, b: any) => b.date - a.date).map((p: Payment) => (
                                <tr key={p.id}>
                                    <td className="p-2 md:p-4 text-slate-500">{p.date?.toDate().toLocaleDateString()}</td>
                                    <td className="p-2 md:p-4 font-medium text-slate-800">{p.patientName}</td>
                                    <td className="p-2 md:p-4 text-slate-600">
                                        {p.concept}
                                        {p.appointmentId && <span className="ml-2 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] uppercase tracking-wide">Vinculado</span>}
                                    </td>
                                    <td className="p-2 md:p-4 font-mono text-teal-600 font-bold">+${p.amount}</td>
                                    <td className="p-2 md:p-4 text-right">
                                        <button onClick={() => handleDeletePayment(p)} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showPayModal && (
                <PaymentModal
                    appointment={showPayModal}
                    onClose={() => setShowPayModal(null)}
                    user={user}
                />
            )}
        </div>
    );
};
