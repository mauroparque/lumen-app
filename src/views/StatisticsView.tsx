import { User } from 'firebase/auth';
import { useData } from '../context/DataContext';
import { usePatients } from '../hooks/usePatients';
import { useAgendaStats } from '../hooks/useAgendaStats';
import {
    BarChart3,
    Users,
    DollarSign,
    TrendingUp,
    UserX,
    XCircle,
    Calendar,
    Activity,
    Building2,
    ArrowUpRight,
    ArrowDownRight,
} from 'lucide-react';

interface StatisticsViewProps {
    user: User;
}

export const StatisticsView = ({ user }: StatisticsViewProps) => {
    const { appointments } = useData();
    const { patients } = usePatients(user);
    const stats = useAgendaStats(appointments, patients);

    // Calculate some derived stats
    const completionRate =
        stats.totalScheduledAppointments > 0
            ? ((stats.totalCompletedSessions / stats.totalScheduledAppointments) * 100).toFixed(1)
            : '0';

    // Get top patients by sessions
    const topPatients = [...stats.patientStats].sort((a, b) => b.totalSessions - a.totalSessions).slice(0, 10);

    // Count psique vs particular patients
    const psiquePatients = stats.patientStats.filter((p) => p.isPsique).length;
    const particularPatients = stats.patientStats.length - psiquePatients;

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                    <BarChart3 className="text-indigo-600" size={28} />
                    Estadísticas de Agenda
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                    Análisis de los últimos {stats.periodMonths} meses ({stats.periodStart} a {stats.periodEnd})
                </p>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                {/* Total Patients */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
                        <Users size={14} />
                        Pacientes Activos
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{stats.totalPatients}</p>
                    <div className="flex gap-2 mt-2 text-xs">
                        <span className="text-purple-600">{psiquePatients} Psique</span>
                        <span className="text-slate-400">|</span>
                        <span className="text-slate-600">{particularPatients} Particular</span>
                    </div>
                </div>

                {/* Total Sessions */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
                        <Calendar size={14} />
                        Sesiones Realizadas
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{stats.totalCompletedSessions}</p>
                    <p className="text-xs text-slate-500 mt-2">en {stats.periodMonths} meses</p>
                </div>

                {/* Avg Sessions per Patient */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
                        <Activity size={14} />
                        Sesiones/Paciente
                    </div>
                    <p className="text-3xl font-bold text-indigo-600">{stats.avgSessionsPerPatient}</p>
                    <p className="text-xs text-slate-500 mt-2">promedio mensual</p>
                </div>

                {/* Average Fee */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
                        <DollarSign size={14} />
                        Honorario Promedio
                    </div>
                    <p className="text-3xl font-bold text-emerald-600">${stats.avgFee.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-2">por paciente</p>
                </div>

                {/* Average Session Value */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
                        <TrendingUp size={14} />
                        Valor por Sesión
                    </div>
                    <p className="text-3xl font-bold text-emerald-600">${stats.avgSessionValue.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-2">ingreso real</p>
                </div>

                {/* Completion Rate */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
                        <ArrowUpRight size={14} />
                        Tasa de Asistencia
                    </div>
                    <p className="text-3xl font-bold text-green-600">{completionRate}%</p>
                    <p className="text-xs text-slate-500 mt-2">{stats.totalScheduledAppointments} turnos</p>
                </div>
            </div>

            {/* Secondary Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Attendance Issues */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <ArrowDownRight className="text-red-500" size={18} />
                        Problemas de Asistencia
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                            <div className="flex items-center gap-2 text-amber-600 text-sm mb-1">
                                <UserX size={16} />
                                Ausentismo
                            </div>
                            <p className="text-2xl font-bold text-amber-700">{(stats.noShowRate * 100).toFixed(1)}%</p>
                            <p className="text-xs text-amber-600 mt-1">
                                {Math.round(stats.noShowRate * stats.totalScheduledAppointments)} turnos ausentes
                            </p>
                        </div>
                        <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                            <div className="flex items-center gap-2 text-red-600 text-sm mb-1">
                                <XCircle size={16} />
                                Cancelaciones
                            </div>
                            <p className="text-2xl font-bold text-red-700">
                                {(stats.cancellationRate * 100).toFixed(1)}%
                            </p>
                            <p className="text-xs text-red-600 mt-1">
                                {Math.round(stats.cancellationRate * stats.totalScheduledAppointments)} turnos
                                cancelados
                            </p>
                        </div>
                    </div>
                </div>

                {/* Patient Distribution */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <Building2 className="text-purple-500" size={18} />
                        Distribución de Pacientes
                    </h3>
                    <div className="space-y-3">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-purple-700 font-medium">Psique</span>
                                <span className="text-purple-700">
                                    {psiquePatients} (
                                    {stats.totalPatients > 0
                                        ? ((psiquePatients / stats.totalPatients) * 100).toFixed(0)
                                        : 0}
                                    %)
                                </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-3">
                                <div
                                    className="bg-purple-500 h-3 rounded-full transition-all"
                                    style={{
                                        width: `${stats.totalPatients > 0 ? (psiquePatients / stats.totalPatients) * 100 : 0}%`,
                                    }}
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-700 font-medium">Particular</span>
                                <span className="text-slate-700">
                                    {particularPatients} (
                                    {stats.totalPatients > 0
                                        ? ((particularPatients / stats.totalPatients) * 100).toFixed(0)
                                        : 0}
                                    %)
                                </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-3">
                                <div
                                    className="bg-slate-500 h-3 rounded-full transition-all"
                                    style={{
                                        width: `${stats.totalPatients > 0 ? (particularPatients / stats.totalPatients) * 100 : 0}%`,
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Patients Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <TrendingUp className="text-emerald-500" size={18} />
                        Top 10 Pacientes por Sesiones
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Últimos {stats.periodMonths} meses</p>
                </div>
                {topPatients.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">No hay datos de sesiones en este período.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                                <tr>
                                    <th className="p-4 pl-6">#</th>
                                    <th className="p-4">Paciente</th>
                                    <th className="p-4 text-center">Sesiones</th>
                                    <th className="p-4 text-center">Prom/Mes</th>
                                    <th className="p-4 text-right pr-6">Honorario</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {topPatients.map((patient, index) => (
                                    <tr key={patient.patientId} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 pl-6 text-slate-400 font-medium">{index + 1}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-800">{patient.patientName}</span>
                                                {patient.isPsique && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                                                        <Building2 size={10} className="mr-1" /> P
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-bold bg-emerald-100 text-emerald-700">
                                                {patient.totalSessions}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center text-slate-600">{patient.avgSessions}</td>
                                        <td className="p-4 text-right pr-6 font-medium text-slate-700">
                                            ${patient.fee.toLocaleString()}
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
