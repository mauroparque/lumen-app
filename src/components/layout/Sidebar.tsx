import React from 'react';
import { Calendar as CalendarIcon, Users, DollarSign, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { User } from 'firebase/auth';
import { View, Appointment } from '../../types';

interface SidebarProps {
    user: User;
    currentView: View;
    setCurrentView: (view: View) => void;
    appointments: Appointment[];
}

export const Sidebar = ({ user, currentView, setCurrentView, appointments }: SidebarProps) => {
    return (
        <aside className="hidden md:flex w-64 flex-col bg-white border-r border-slate-200 z-20 shadow-sm">
            <div className="p-6 border-b border-slate-100">
                <span className="text-lg font-bold text-teal-600">Lumen<br />Salud Mental</span>
            </div>
            <nav className="flex-1 p-4 space-y-1">
                <SidebarItem icon={CalendarIcon} label="Agenda" active={currentView === 'calendar'} onClick={() => setCurrentView('calendar')} />
                <SidebarItem icon={Users} label="Pacientes" active={currentView === 'patients'} onClick={() => setCurrentView('patients')} />

                <div className="relative">
                    <SidebarItem icon={DollarSign} label="Finanzas" active={currentView === 'finance'} onClick={() => setCurrentView('finance')} />
                    {appointments.some(a => !a.isPaid && new Date(a.date) < new Date() && a.status !== 'cancelado') && (
                        <span className="absolute right-4 top-3 w-2 h-2 bg-red-500 rounded-full"></span>
                    )}
                </div>
            </nav>
            <div className="p-4 border-t text-sm">
                <p className="font-medium truncate">{user.email}</p>
                <button onClick={() => signOut(auth)} className="text-red-500 flex items-center mt-2"><LogOut size={14} className="mr-1" /> Salir</button>
            </div>
        </aside>
    );
};

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
    <button onClick={onClick} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${active ? 'bg-teal-50 text-teal-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
        <Icon size={20} className={active ? 'text-teal-600' : 'text-slate-400'} />
        <span>{label}</span>
    </button>
);
