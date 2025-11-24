import React, { useState, useMemo } from 'react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { User } from 'firebase/auth';
import { Appointment, Patient } from '../types';
import { ChevronLeft, ChevronRight, Plus, Video, MapPin, CheckCircle, Trash2 } from 'lucide-react';
import { AppointmentModal } from '../components/modals/AppointmentModal';

interface CalendarViewProps {
    appointments: Appointment[];
    patients: Patient[];
    user: User;
}

export const CalendarView = ({ appointments, patients, user }: CalendarViewProps) => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showModal, setShowModal] = useState(false);

    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay() + 1);
    const weekDays = Array.from({ length: 5 }, (_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        return d;
    });

    // OPTIMIZACIÓN: Indexar citas por fecha-hora para acceso O(1)
    const appointmentsMap = useMemo(() => {
        const map = new Map<string, Appointment>();
        appointments.forEach(app => {
            // Clave: YYYY-MM-DD-HH
            const hour = app.time.split(':')[0];
            const key = `${app.date}-${hour}`;
            map.set(key, app);
        });
        return map;
    }, [appointments]);

    const getAppt = (day: Date, hour: number) => {
        const dStr = day.toISOString().split('T')[0];
        const key = `${dStr}-${hour < 10 ? '0' + hour : hour}`; // Asegurar formato de hora si es necesario, pero el split anterior suele dar "09" o "9"
        // Ajuste: el input time suele dar "09:00", el split da "09".
        // Mi generador de claves usa el split directo.
        // Verifiquemos consistencia. Si app.time es "09:00", split es "09".
        // Si paso hour como numero 9, debo convertirlo a string.
        // Mejor normalizar a entero para la clave.
        return appointmentsMap.get(`${dStr}-${hour < 10 ? '0' + hour : hour}`);
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold text-slate-800">Agenda</h1>
                <div className="flex space-x-4">
                    <div className="flex items-center border rounded-lg bg-white">
                        <button onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() - 7)))} className="p-2 hover:bg-slate-50"><ChevronLeft size={18} /></button>
                        <span className="px-4 text-sm font-medium min-w-[120px] text-center">
                            {weekDays[0].getDate()} - {weekDays[4].getDate()} {weekDays[4].toLocaleDateString('es-ES', { month: 'short' })}
                        </span>
                        <button onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() + 7)))} className="p-2 hover:bg-slate-50"><ChevronRight size={18} /></button>
                    </div>
                    <button onClick={() => setShowModal(true)} className="bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 shadow-sm hover:bg-teal-700">
                        <Plus size={18} /> <span>Turno</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
                <div className="grid grid-cols-6 border-b bg-slate-50">
                    <div className="p-3 text-center text-xs text-slate-400 font-bold border-r">HORA</div>
                    {weekDays.map((d, i) => (
                        <div key={i} className={`p-3 text-center border-r ${d.toDateString() === new Date().toDateString() ? 'bg-teal-50' : ''}`}>
                            <div className="text-xs text-slate-500 uppercase">{d.toLocaleDateString('es-ES', { weekday: 'short' })}</div>
                            <div className="font-bold">{d.getDate()}</div>
                        </div>
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto">
                    {Array.from({ length: 11 }, (_, i) => i + 8).map(hour => (
                        <div key={hour} className="grid grid-cols-6 h-28 border-b last:border-0">
                            <div className="p-2 text-xs text-slate-400 text-center border-r pt-3">{hour}:00</div>
                            {weekDays.map((day, i) => {
                                const appt = getAppt(day, hour);
                                return (
                                    <div key={i} className="border-r p-1 relative group hover:bg-slate-50/50">
                                        {appt ? (
                                            <div className={`w-full h-full rounded p-2 text-xs border-l-4 shadow-sm cursor-pointer relative
                        ${appt.type === 'online' ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-teal-50 border-teal-300 text-teal-800'}`}>
                                                <div className="font-bold truncate">{appt.patientName}</div>
                                                <div className="flex justify-between items-end mt-2">
                                                    <div className="flex items-center space-x-1 opacity-80">
                                                        {appt.type === 'online' ? <Video size={10} /> : <MapPin size={10} />}
                                                        <span>{appt.type}</span>
                                                    </div>
                                                    {appt.isPaid ? (
                                                        <div className="bg-green-100 text-green-700 p-0.5 rounded rounded-full" title="Pagado"><CheckCircle size={10} /></div>
                                                    ) : (
                                                        <div className="bg-red-100 text-red-600 px-1 rounded text-[8px] font-bold uppercase" title="Pendiente de Pago">IMPAGO</div>
                                                    )}
                                                </div>
                                                <button onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'appointments', appt.id)); }} className="absolute top-1 right-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12} /></button>
                                            </div>
                                        ) : (
                                            <button onClick={() => setShowModal(true)} className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 text-teal-300 hover:text-teal-600"><Plus size={14} /></button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    ))}
                </div>
            </div>
            {showModal && <AppointmentModal onClose={() => setShowModal(false)} patients={patients} user={user} />}
        </div>
    );
};
