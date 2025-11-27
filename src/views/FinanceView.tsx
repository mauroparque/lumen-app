import React, { useState, useMemo } from 'react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { User } from 'firebase/auth';
import { Payment, Appointment, Patient } from '../types';
import { AlertTriangle, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { PaymentModal } from '../components/modals/PaymentModal';

interface FinanceViewProps {
    payments: Payment[];
    appointments: Appointment[];
    patients: Patient[];
    user: User;
}

export const FinanceView = ({ payments, appointments, patients, user }: FinanceViewProps) => {
    const [tab, setTab] = useState<'history' | 'debt'>('debt');
    const [showPayModal, setShowPayModal] = useState<Appointment | null>(null);

    const debts = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return appointments.filter((a: Appointment) => {
            const apptDate = new Date(a.date + 'T00:00:00');
            return apptDate < now && !a.isPaid && a.status !== 'cancelado';
        }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [appointments]);

    const totalIncome = payments.reduce((acc: number, p: Payment) => acc + p.amount, 0);
    const totalDebt = debts.reduce((acc: number, a: Appointment) => acc + (a.price || 0), 0);

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-800 mb-6">Panel Financiero</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-teal-600 text-white p-6 rounded-2xl shadow-lg">
                    <p className="text-teal-100 mb-1">Ingresos Totales</p>
                    <h2 className="text-4xl font-bold">${totalIncome.toLocaleString()}</h2>
                </div>
                <div className="bg-white border border-red-100 p-6 rounded-2xl shadow-sm relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-6 opacity-10 text-red-500"><AlertTriangle size={64} /></div>
                    <p className="text-red-500 font-medium mb-1">Deuda Pendiente (Sesiones pasadas)</p>
                    <h2 className="text-4xl font-bold text-slate-800">${totalDebt.toLocaleString()}</h2>
                    <p className="text-xs text-slate-400 mt-2">{debts.length} sesiones sin regularizar</p>
                </div>
            </div>

            <div className="flex space-x-6 border-b border-slate-200 mb-6">
                <button onClick={() => setTab('debt')} className={`pb-3 px-2 font-medium text-sm flex items-center space-x-2 border-b-2 transition-colors ${tab === 'debt' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                    <AlertCircle size={16} /> <span>Sesiones Adeudadas ({debts.length})</span>
                </button>
                <button onClick={() => setTab('history')} className={`pb-3 px-2 font-medium text-sm flex items-center space-x-2 border-b-2 transition-colors ${tab === 'history' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                    <CheckCircle size={16} /> <span>Historial de Pagos</span>
                </button>
            </div>

            {tab === 'debt' && (
                <div className="bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden">
                    {debts.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                            <CheckCircle size={48} className="mx-auto mb-4 text-teal-400" />
                            <p>¡Todo al día! No hay deudas pendientes.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-red-50 text-red-700 font-medium">
                                <tr><th className="p-4">Fecha Sesión</th><th className="p-4">Paciente</th><th className="p-4">Monto Pactado</th><th className="p-4 text-right">Acción</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {debts.map((d: Appointment) => (
                                    <tr key={d.id} className="hover:bg-slate-50">
                                        <td className="p-4 text-slate-600">{d.date.split('-').reverse().join('/')} <span className="text-xs text-slate-400 ml-1">({d.time})</span></td>
                                        <td className="p-4 font-bold text-slate-800">{d.patientName}</td>
                                        <td className="p-4 font-mono text-slate-600">${d.price || 0}</td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => setShowPayModal(d)}
                                                className="bg-teal-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-teal-700 shadow-sm"
                                            >
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

            {tab === 'history' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium">
                            <tr><th className="p-4">Fecha Pago</th><th className="p-4">Paciente</th><th className="p-4">Concepto</th><th className="p-4">Monto</th><th className="p-4"></th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {payments.sort((a: any, b: any) => b.date - a.date).map((p: Payment) => (
                                <tr key={p.id}>
                                    <td className="p-4 text-slate-500">{p.date?.toDate().toLocaleDateString()}</td>
                                    <td className="p-4 font-medium text-slate-800">{p.patientName}</td>
                                    <td className="p-4 text-slate-600">
                                        {p.concept}
                                        {p.appointmentId && <span className="ml-2 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] uppercase tracking-wide">Vinculado</span>}
                                    </td>
                                    <td className="p-4 font-mono text-teal-600 font-bold">+${p.amount}</td>
                                    <td className="p-4 text-right">
                                        <button onClick={() => { if (confirm('¿Eliminar registro de pago?')) deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'payments', p.id)); }} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
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
