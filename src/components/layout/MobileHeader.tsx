import { Menu, X, ChevronRight, LogOut, Home, Calendar, Users, DollarSign, FileText, ListTodo } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { View } from '../../types';

interface MobileHeaderProps {
    mobileMenuOpen: boolean;
    setMobileMenuOpen: (open: boolean) => void;
    setCurrentView: (view: View) => void;
}

export const MobileHeader = ({ mobileMenuOpen, setMobileMenuOpen, setCurrentView }: MobileHeaderProps) => {
    return (
        <>
            <div className="md:hidden fixed top-0 w-full h-16 bg-white border-b z-50 flex items-center justify-between px-4">
                <span className="font-bold text-teal-600">Lumen</span>
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2">
                    {mobileMenuOpen ? <X /> : <Menu />}
                </button>
            </div>

            {mobileMenuOpen && (
                <div className="md:hidden fixed inset-0 bg-white z-40 pt-20 px-6 space-y-4 animate-in fade-in slide-in-from-top-5 duration-200">
                    <button
                        onClick={() => {
                            setCurrentView('home');
                            setMobileMenuOpen(false);
                        }}
                        className="block w-full text-left text-lg py-3 border-b text-slate-700 font-medium flex justify-between items-center"
                    >
                        <span className="flex items-center">
                            <Home size={20} className="mr-3" /> Inicio
                        </span>{' '}
                        <ChevronRight size={16} className="text-slate-400" />
                    </button>
                    <button
                        onClick={() => {
                            setCurrentView('calendar');
                            setMobileMenuOpen(false);
                        }}
                        className="block w-full text-left text-lg py-3 border-b text-slate-700 font-medium flex justify-between items-center"
                    >
                        <span className="flex items-center">
                            <Calendar size={20} className="mr-3" /> Agenda
                        </span>{' '}
                        <ChevronRight size={16} className="text-slate-400" />
                    </button>
                    <button
                        onClick={() => {
                            setCurrentView('patients');
                            setMobileMenuOpen(false);
                        }}
                        className="block w-full text-left text-lg py-3 border-b text-slate-700 font-medium flex justify-between items-center"
                    >
                        <span className="flex items-center">
                            <Users size={20} className="mr-3" /> Pacientes
                        </span>{' '}
                        <ChevronRight size={16} className="text-slate-400" />
                    </button>
                    <button
                        onClick={() => {
                            setCurrentView('tasks');
                            setMobileMenuOpen(false);
                        }}
                        className="block w-full text-left text-lg py-3 border-b text-slate-700 font-medium flex justify-between items-center"
                    >
                        <span className="flex items-center">
                            <ListTodo size={20} className="mr-3" /> Tareas
                        </span>{' '}
                        <ChevronRight size={16} className="text-slate-400" />
                    </button>
                    <button
                        onClick={() => {
                            setCurrentView('payments');
                            setMobileMenuOpen(false);
                        }}
                        className="block w-full text-left text-lg py-3 border-b text-slate-700 font-medium flex justify-between items-center"
                    >
                        <span className="flex items-center">
                            <DollarSign size={20} className="mr-3" /> Pagos
                        </span>{' '}
                        <ChevronRight size={16} className="text-slate-400" />
                    </button>
                    <button
                        onClick={() => {
                            setCurrentView('billing');
                            setMobileMenuOpen(false);
                        }}
                        className="block w-full text-left text-lg py-3 border-b text-slate-700 font-medium flex justify-between items-center"
                    >
                        <span className="flex items-center">
                            <FileText size={20} className="mr-3" /> Facturación
                        </span>{' '}
                        <ChevronRight size={16} className="text-slate-400" />
                    </button>
                    <button
                        onClick={() => signOut(auth)}
                        className="block w-full text-left text-lg py-3 border-b text-red-500 font-medium flex justify-between items-center"
                    >
                        <span className="flex items-center">
                            <LogOut size={20} className="mr-3" /> Cerrar Sesión
                        </span>
                    </button>
                </div>
            )}
        </>
    );
};
