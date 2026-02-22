import { Home, Calendar as CalendarIcon, Users, DollarSign, FileText, LogOut, ListTodo, BarChart3 } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { User } from 'firebase/auth';
import { View } from '../../types';
import { useData } from '../../context/DataContext';

interface SidebarProps {
    user: User;
    currentView: View;
    setCurrentView: (view: View) => void;
}

export const Sidebar = ({ user, currentView, setCurrentView }: SidebarProps) => {
    const { appointments } = useData();

    const hasPendingDebts = appointments.some((a) => {
        if (a.isPaid) return false;
        // Cancelados sin cobro no generan deuda
        if (a.status === 'cancelado' && !a.chargeOnCancellation) return false;

        const apptDate = new Date(a.date + 'T00:00:00');
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return apptDate < now;
    });

    return (
        <aside className="hidden md:flex w-56 flex-col bg-white border-r border-slate-200 z-20 shadow-sm">
            <div className="p-6 border-b border-slate-100">
                <span className="text-lg font-bold text-teal-600">
                    Lumen
                    <br />
                    Salud Mental
                </span>
            </div>
            <nav className="flex-1 p-4 space-y-1">
                <SidebarItem
                    icon={Home}
                    label="Inicio"
                    active={currentView === 'home'}
                    onClick={() => setCurrentView('home')}
                />
                <SidebarItem
                    icon={CalendarIcon}
                    label="Agenda"
                    active={currentView === 'calendar'}
                    onClick={() => setCurrentView('calendar')}
                />
                <SidebarItem
                    icon={Users}
                    label="Pacientes"
                    active={currentView === 'patients'}
                    onClick={() => setCurrentView('patients')}
                />
                <SidebarItem
                    icon={ListTodo}
                    label="Tareas"
                    active={currentView === 'tasks'}
                    onClick={() => setCurrentView('tasks')}
                />

                <div className="pt-2 pb-2">
                    <div className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Administración
                    </div>
                    <div className="relative">
                        <SidebarItem
                            icon={DollarSign}
                            label="Pagos"
                            active={currentView === 'payments'}
                            onClick={() => setCurrentView('payments')}
                        />
                        {hasPendingDebts && (
                            <span className="absolute right-4 top-3 w-2 h-2 bg-red-500 rounded-full"></span>
                        )}
                    </div>
                    <SidebarItem
                        icon={FileText}
                        label="Facturación"
                        active={currentView === 'billing'}
                        onClick={() => setCurrentView('billing')}
                    />
                    <SidebarItem
                        icon={BarChart3}
                        label="Estadísticas"
                        active={currentView === 'statistics'}
                        onClick={() => setCurrentView('statistics')}
                    />
                </div>
            </nav>
            <div className="p-4 border-t text-sm">
                <p className="font-medium truncate">{user.email}</p>
                <button onClick={() => signOut(auth)} className="text-red-500 flex items-center mt-2">
                    <LogOut size={14} className="mr-1" /> Salir
                </button>
            </div>
        </aside>
    );
};

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${active ? 'bg-teal-50 text-teal-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
    >
        <Icon size={20} className={active ? 'text-teal-600' : 'text-slate-400'} />
        <span>{label}</span>
    </button>
);
