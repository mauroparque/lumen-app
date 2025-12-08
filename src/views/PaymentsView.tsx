import { useState, useMemo } from 'react';
import { User } from 'firebase/auth';
import { useData } from '../context/DataContext';
import { Search, CheckCircle, AlertCircle, Clock, DollarSign } from 'lucide-react';

interface PaymentsViewProps {
    user: User;
}

export const PaymentsView = ({ }: PaymentsViewProps) => {
    const { appointments, loading } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'pending' | 'history'>('pending');

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
        now.setHours(0, 0, 0, 0);

        if (viewMode === 'pending') {
            // Show unpaid appointments (past and future)
            return data.filter(a => !a.isPaid && a.status !== 'cancelado').sort((a, b) => a.date.localeCompare(b.date));
        } else {
            // Show paid appointments (history)
            return data.filter(a => a.isPaid).sort((a, b) => b.date.localeCompare(a.date));
        }
    }, [appointments, loading, searchTerm, viewMode]);

    const totalAmount = filteredData.reduce((acc, curr) => acc + (curr.price || 0), 0);

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Pagos</h1>
                    <p className="text-slate-500 text-sm">Registro de Cobros y Deudas</p>
                </div>

                <div className="flex items-center space-x-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar paciente..."
                            className="w-full pl-10 pr-4 py-2 border rounded-xl shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
                <button
                    onClick={() => setViewMode('pending')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'pending' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Pendientes de Cobro
                </button>
                <button
                    onClick={() => setViewMode('history')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'history' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Historial de Cobros
                </button>
            </div>

            {/* Summary Card */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm mb-6 flex items-center justify-between">
                <div>
                    <p className="text-slate-500 font-medium text-sm mb-1 uppercase tracking-wider">
                        {viewMode === 'pending' ? 'Total por cobrar' : 'Total cobrado'}
                    </p>
                    <h2 className={`text-3xl font-bold flex items-center ${viewMode === 'pending' ? 'text-slate-700' : 'text-green-600'}`}>
                        <DollarSign size={24} className="mr-1" />
                        {totalAmount.toLocaleString()}
                    </h2>
                </div>
                <div className="text-right text-slate-400 text-sm">
                    {filteredData.length} registros
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-12 flex justify-center items-center text-slate-500">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400 mr-3"></div>
                        Cargando...
                    </div>
                ) : filteredData.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                        <div className="bg-slate-50 p-4 rounded-full mb-4">
                            {viewMode === 'pending' ? <CheckCircle size={32} className="text-green-500" /> : <Clock size={32} className="text-slate-300" />}
                        </div>
                        <p>{viewMode === 'pending' ? '¡Todo al día! No hay cobros pendientes.' : 'No hay historial de cobros registrado.'}</p>
                    </div>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                            <tr>
                                <th className="p-4 pl-6">Fecha</th>
                                <th className="p-4">Paciente</th>
                                <th className="p-4">Detalle</th>
                                <th className="p-4 text-right">Monto</th>
                                <th className="p-4 pr-6 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredData.map(item => {
                                const isOverdue = !item.isPaid && new Date(item.date + 'T00:00:00') < new Date(new Date().setHours(0, 0, 0, 0));
                                return (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 pl-6 font-medium text-slate-700">
                                            {new Date(item.date + 'T00:00:00').toLocaleDateString()}
                                        </td>
                                        <td className="p-4 font-bold text-slate-800">
                                            {item.patientName}
                                        </td>
                                        <td className="p-4 text-slate-500">
                                            {item.consultationType || 'Consulta'}
                                        </td>
                                        <td className="p-4 text-right font-bold text-slate-700">
                                            ${item.price}
                                        </td>
                                        <td className="p-4 pr-6 text-center">
                                            {item.isPaid ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    Pagado
                                                </span>
                                            ) : isOverdue ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                    <AlertCircle size={12} className="mr-1" /> Vencido
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                                    Pendiente
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
