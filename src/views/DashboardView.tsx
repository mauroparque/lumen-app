import { useMemo } from 'react';
import { User } from 'firebase/auth';
import { StaffProfile } from '../types';
import { useData } from '../context/DataContext';
import { usePatients } from '../hooks/usePatients';
import { usePendingTasks } from '../hooks/usePendingTasks';
import { usePsiquePayments } from '../hooks/usePsiquePayments';
import {
    Calendar,
    Users,
    Clock,
    AlertCircle,
    TrendingUp,
    ChevronRight,
    CheckCircle,
    Video,
    MapPin,
    ListTodo,
    Square,
} from 'lucide-react';
import { toast } from 'sonner';

interface DashboardViewProps {
    user: User;
    profile: StaffProfile;
    onNavigate: (view: string) => void;
}

export const DashboardView = ({ user, profile, onNavigate }: DashboardViewProps) => {
    const { appointments, loading } = useData();
    const { patients } = usePatients(user);

    // Create set of patient IDs for filtering tasks
    const myPatientIds = useMemo(() => new Set(patients.map((p) => p.id)), [patients]);
    const { pendingTasks, completeTask } = usePendingTasks(appointments, myPatientIds);

    // Psique payments for current month
    const currentMonth = useMemo(() => new Date(), []);
    const { monthData: psiqueData } = usePsiquePayments(appointments, patients, currentMonth, profile.name);

    // Fecha de hoy en formato YYYY-MM-DD
    const today = useMemo(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }, []);

    // Turnos de hoy
    const todayAppointments = useMemo(() => {
        return appointments
            .filter((a) => a.date === today && a.status !== 'cancelado')
            .sort((a, b) => a.time.localeCompare(b.time));
    }, [appointments, today]);

    // Próximos turnos (próximos 7 días, excluyendo hoy)
    const upcomingAppointments = useMemo(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);

        const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
        const nextWeekStr = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(2, '0')}-${String(nextWeek.getDate()).padStart(2, '0')}`;

        return appointments
            .filter((a) => a.date >= tomorrowStr && a.date <= nextWeekStr && a.status !== 'cancelado')
            .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
            .slice(0, 5);
    }, [appointments]);

    // Helper para verificar si un turno está vencido (1 hora después de la hora de inicio)
    const isOverdue = (appointment: any) => {
        const now = new Date();
        const apptDateTime = new Date(appointment.date + 'T' + (appointment.time || '00:00') + ':00');
        // Agregar 1 hora al turno
        apptDateTime.setHours(apptDateTime.getHours() + 1);
        return now > apptDateTime;
    };

    // Deudas pendientes (turnos vencidos no pagados - 1 hora después del inicio)
    const pendingDebts = useMemo(() => {
        return appointments
            .filter((a) => {
                if (a.isPaid) return false;
                // Cancelados sin cobro no generan deuda
                if (a.status === 'cancelado' && !a.chargeOnCancellation) return false;
                return isOverdue(a);
            })
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 5);
    }, [appointments]);

    // Estadísticas
    const stats = useMemo(() => {
        const totalDebt = appointments
            .filter((a) => {
                if (a.isPaid) return false;
                // Cancelados sin cobro no generan deuda
                if (a.status === 'cancelado' && !a.chargeOnCancellation) return false;
                return isOverdue(a);
            })
            .reduce((sum, a) => sum + (a.price || 0), 0);

        const thisMonthAppointments = appointments.filter((a) => {
            const month = today.slice(0, 7); // YYYY-MM
            return a.date.startsWith(month);
        });

        const completedThisMonth = thisMonthAppointments.filter(
            (a) => a.date < today && a.status !== 'cancelado',
        ).length;
        const paidThisMonth = thisMonthAppointments.filter((a) => a.isPaid).reduce((sum, a) => sum + (a.price || 0), 0);

        return {
            totalPatients: patients.filter((p) => p.isActive !== false).length,
            todayCount: todayAppointments.length,
            totalDebt,
            completedThisMonth,
            paidThisMonth,
            pendingCount: pendingDebts.length,
            netIncome: paidThisMonth - psiqueData.totalAmount,
        };
    }, [appointments, patients, today, todayAppointments, pendingDebts, psiqueData.totalAmount]);

    // Saludo según hora del día
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Buenos días';
        if (hour < 19) return 'Buenas tardes';
        return 'Buenas noches';
    }, []);

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                    {greeting}, {profile.name?.split(' ')[0] || 'Profesional'}
                </h1>
                <p className="text-slate-500 mt-1">
                    {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard
                    icon={Calendar}
                    label="Turnos Hoy"
                    value={stats.todayCount}
                    color="teal"
                    onClick={() => onNavigate('calendar')}
                />
                <StatCard
                    icon={Users}
                    label="Pacientes"
                    value={stats.totalPatients}
                    color="blue"
                    onClick={() => onNavigate('patients')}
                />
                <StatCard
                    icon={TrendingUp}
                    label="Cobrado (Mes)"
                    value={`$${stats.paidThisMonth.toLocaleString()}`}
                    color="green"
                    onClick={() => onNavigate('payments')}
                />
                <StatCard
                    icon={AlertCircle}
                    label="Deuda Total"
                    value={`$${stats.totalDebt.toLocaleString()}`}
                    color={stats.totalDebt > 0 ? 'red' : 'green'}
                    onClick={() => onNavigate('payments')}
                />
            </div>

            {/* Net Income Summary */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-5 mb-8 text-white shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <p className="text-slate-300 text-sm font-medium uppercase tracking-wider mb-1">
                            Resumen del Mes
                        </p>
                        <div className="flex items-center gap-6 text-sm">
                            <div>
                                <span className="text-slate-400">Bruto:</span>
                                <span className="ml-2 font-bold">${stats.paidThisMonth.toLocaleString()}</span>
                            </div>
                            <div>
                                <span className="text-purple-300">Psique:</span>
                                <span className="ml-2 font-bold text-purple-300">
                                    -${psiqueData.totalAmount.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-slate-400 text-xs uppercase tracking-wider">Ingreso Neto</p>
                        <p className="text-3xl font-bold text-green-400">${stats.netIncome.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Turnos de Hoy */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                        <div className="flex items-center">
                            <div className="h-10 w-10 rounded-xl bg-teal-100 flex items-center justify-center mr-3">
                                <Clock size={20} className="text-teal-600" />
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-900">Turnos de Hoy</h2>
                                <p className="text-xs text-slate-500">
                                    {todayAppointments.length} turno(s) programado(s)
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => onNavigate('calendar')}
                            className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center"
                        >
                            Ver agenda <ChevronRight size={16} className="ml-1" />
                        </button>
                    </div>

                    <div className="divide-y divide-slate-50">
                        {todayAppointments.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">
                                <Calendar size={40} className="mx-auto mb-3 opacity-50" />
                                <p>No hay turnos programados para hoy</p>
                            </div>
                        ) : (
                            todayAppointments.map((appt) => (
                                <div
                                    key={appt.id}
                                    className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between"
                                >
                                    <div className="flex items-center">
                                        <div className="h-12 w-12 rounded-xl bg-slate-100 flex flex-col items-center justify-center mr-4 font-bold text-slate-600">
                                            <span className="text-lg leading-none">{appt.time.split(':')[0]}</span>
                                            <span className="text-[10px] text-slate-400">
                                                {appt.time.split(':')[1]}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="font-semibold text-slate-900">{appt.patientName}</div>
                                            <div className="text-sm text-slate-500 flex items-center">
                                                {appt.type === 'online' ? (
                                                    <>
                                                        <Video size={12} className="mr-1" /> Online
                                                    </>
                                                ) : (
                                                    <>
                                                        <MapPin size={12} className="mr-1" /> Presencial
                                                    </>
                                                )}
                                                {appt.consultationType && (
                                                    <span className="ml-2 text-slate-400">
                                                        • {appt.consultationType}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-slate-700">${appt.price}</div>
                                        {appt.isPaid ? (
                                            <span className="text-xs text-green-600 flex items-center justify-end">
                                                <CheckCircle size={12} className="mr-1" /> Pagado
                                            </span>
                                        ) : (
                                            <span className="text-xs text-amber-600">Pendiente</span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Panel Derecho */}
                <div className="space-y-6">
                    {/* Tareas Pendientes */}
                    {pendingTasks.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-amber-50/50">
                                <div className="flex items-center">
                                    <ListTodo size={18} className="text-amber-600 mr-2" />
                                    <span className="font-bold text-slate-900 text-sm">Tareas Pendientes</span>
                                    <span className="ml-2 text-xs text-amber-600 font-medium bg-amber-100 px-2 py-0.5 rounded-full">
                                        {pendingTasks.length}
                                    </span>
                                </div>
                                <button
                                    onClick={() => onNavigate('tasks')}
                                    className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                                >
                                    Ver todas
                                </button>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {pendingTasks.slice(0, 5).map((task) => {
                                    const patient = patients.find((p) => p.id === task.patientId);
                                    return (
                                        <div
                                            key={`${task.noteId}-${task.taskIndex}`}
                                            className="p-3 hover:bg-slate-50 transition-colors flex items-start gap-2"
                                        >
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await completeTask(task.noteId, task.taskIndex);
                                                        toast.success('Tarea completada');
                                                    } catch {
                                                        toast.error('Error al completar tarea');
                                                    }
                                                }}
                                                className="mt-0.5 text-amber-400 hover:text-green-600 transition-colors flex-shrink-0"
                                                title="Marcar como completada"
                                            >
                                                <Square size={16} />
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-slate-700 font-medium">{task.text}</div>
                                                <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                                                    <span>{patient?.name || 'Paciente'}</span>
                                                    {task.appointmentDate && (
                                                        <span className="text-slate-500">
                                                            {new Date(
                                                                task.appointmentDate + 'T00:00:00',
                                                            ).toLocaleDateString('es-ES', {
                                                                day: 'numeric',
                                                                month: 'short',
                                                            })}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Deudas Pendientes */}
                    {stats.pendingCount > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-red-50/50">
                                <div className="flex items-center">
                                    <AlertCircle size={18} className="text-red-500 mr-2" />
                                    <span className="font-bold text-slate-900 text-sm">Pagos Pendientes</span>
                                </div>
                                <button
                                    onClick={() => onNavigate('payments')}
                                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                                >
                                    Ver todos
                                </button>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {pendingDebts.map((debt) => (
                                    <div key={debt.id} className="p-3 flex justify-between items-center">
                                        <div>
                                            <div className="font-medium text-slate-900 text-sm">{debt.patientName}</div>
                                            <div className="text-xs text-slate-400">
                                                {new Date(debt.date + 'T00:00:00').toLocaleDateString('es-ES', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                })}
                                            </div>
                                        </div>
                                        <div className="font-bold text-red-600 text-sm">${debt.price}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Próximos Turnos */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-900 text-sm">Próximos Turnos</h3>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {upcomingAppointments.length === 0 ? (
                                <div className="p-6 text-center text-slate-400 text-sm">No hay turnos programados</div>
                            ) : (
                                upcomingAppointments.map((appt) => (
                                    <div key={appt.id} className="p-3 flex justify-between items-center">
                                        <div>
                                            <div className="font-medium text-slate-900 text-sm">{appt.patientName}</div>
                                            <div className="text-xs text-slate-400">
                                                {new Date(appt.date + 'T00:00:00').toLocaleDateString('es-ES', {
                                                    weekday: 'short',
                                                    day: 'numeric',
                                                    month: 'short',
                                                })}{' '}
                                                - {appt.time}
                                            </div>
                                        </div>
                                        <div
                                            className={`text-xs font-medium px-2 py-1 rounded ${appt.type === 'online' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}
                                        >
                                            {appt.type === 'online' ? 'Online' : 'Presencial'}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Componente StatCard
const StatCard = ({
    icon: Icon,
    label,
    value,
    color,
    onClick,
}: {
    icon: any;
    label: string;
    value: string | number;
    color: string;
    onClick?: () => void;
}) => {
    const colorClasses: Record<string, string> = {
        teal: 'bg-teal-50 text-teal-600 border-teal-100',
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        green: 'bg-green-50 text-green-600 border-green-100',
        red: 'bg-red-50 text-red-600 border-red-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
    };

    return (
        <button
            onClick={onClick}
            className={`bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-shadow text-left w-full group`}
        >
            <div className={`h-10 w-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3 border`}>
                <Icon size={20} />
            </div>
            <div className="text-2xl font-bold text-slate-900 group-hover:text-teal-700 transition-colors">{value}</div>
            <div className="text-sm text-slate-500">{label}</div>
        </button>
    );
};
