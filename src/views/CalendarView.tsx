import { useState, useMemo } from 'react';
import { User } from 'firebase/auth';
import { Appointment } from '../types';
import { ChevronLeft, ChevronRight, Plus, Video, MapPin, CheckCircle } from 'lucide-react';
import { AppointmentModal } from '../components/modals/AppointmentModal';
import { AppointmentDetailsModal } from '../components/modals/AppointmentDetailsModal';
import { useCalendarAppointments } from '../hooks/useCalendarAppointments';
import { usePatients } from '../hooks/usePatients';

interface CalendarViewProps {
    user: User;
}

export const CalendarView = ({ user }: CalendarViewProps) => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showModal, setShowModal] = useState(false);
    const [selectedProfessional, setSelectedProfessional] = useState<string>('all');
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [modalData, setModalData] = useState<{ date?: string, time?: string } | null>(null);

    const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

    // Calculate start and end of the visible range based on view mode
    const startOfRange = new Date(selectedDate);
    if (viewMode === 'week') {
        startOfRange.setDate(selectedDate.getDate() - selectedDate.getDay() + 1); // Monday
    } else {
        startOfRange.setDate(1); // First day of month
    }

    const endOfRange = new Date(startOfRange);
    if (viewMode === 'week') {
        endOfRange.setDate(startOfRange.getDate() + 4); // Friday
    } else {
        endOfRange.setMonth(startOfRange.getMonth() + 1);
        endOfRange.setDate(0); // Last day of month
    }

    const toLocalDateString = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Fetch appointments for the visible range
    const { appointments } = useCalendarAppointments(
        user,
        toLocalDateString(startOfRange),
        toLocalDateString(endOfRange)
    );

    const { patients } = usePatients(user);

    const weekDays = Array.from({ length: 5 }, (_, i) => {
        const d = new Date(startOfRange);
        if (viewMode === 'week') {
            d.setDate(startOfRange.getDate() + i);
        }
        return d;
    });

    // Month days generation
    const monthDays = useMemo(() => {
        if (viewMode !== 'month') return [];
        const days = [];
        const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const lastDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

        // Fill previous month days to start on Monday
        let startDay = firstDay.getDay() || 7; // 1 (Mon) - 7 (Sun)
        for (let i = 1; i < startDay; i++) {
            const d = new Date(firstDay);
            d.setDate(firstDay.getDate() - (startDay - i));
            days.push({ date: d, isCurrentMonth: false });
        }

        // Fill current month days
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push({ date: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i), isCurrentMonth: true });
        }

        // Fill next month days to complete grid (up to 35 or 42 cells)
        const remaining = 35 - days.length;
        for (let i = 1; i <= remaining; i++) {
            const d = new Date(lastDay);
            d.setDate(lastDay.getDate() + i);
            days.push({ date: d, isCurrentMonth: false });
        }

        return days;
    }, [selectedDate, viewMode]);

    // Extract unique professionals
    const professionals = useMemo(() => {
        const pros = new Set<string>();
        appointments.forEach(app => {
            if (app.professional) pros.add(app.professional);
        });
        return Array.from(pros);
    }, [appointments]);

    const filteredAppointments = useMemo(() => {
        if (selectedProfessional === 'all') return appointments;
        if (selectedProfessional === 'me') return appointments.filter(app => app.professional === user.displayName);
        return appointments.filter(app => app.professional === selectedProfessional);
    }, [appointments, selectedProfessional, user.displayName]);

    // Index appointments by date-hour for O(1) access
    const appointmentsMap = useMemo(() => {
        const map = new Map<string, Appointment[]>();
        filteredAppointments.forEach(app => {
            // Key: YYYY-MM-DD-HH
            const hour = app.time.split(':')[0];
            const key = `${app.date}-${hour}`;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(app);
        });
        // Sort by time within the hour
        map.forEach(list => list.sort((a, b) => a.time.localeCompare(b.time)));
        return map;
    }, [filteredAppointments]);

    const getAppts = (day: Date, hour: number) => {
        const dStr = toLocalDateString(day);
        const hStr = hour < 10 ? `0${hour}` : `${hour}`;
        return appointmentsMap.get(`${dStr}-${hStr}`) || [];
    };

    const getDayAppts = (day: Date) => {
        const dStr = toLocalDateString(day);
        return filteredAppointments.filter(a => a.date === dStr);
    };

    const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8 to 20

    const handleEdit = () => {
        setIsEditing(true);
        setShowModal(true);
        // Keep selectedAppointment for the modal to use
    };

    const handleNewAppointment = (date?: Date, time?: string) => {
        setModalData({
            date: date ? toLocalDateString(date) : undefined,
            time: time
        });
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setIsEditing(false);
        setSelectedAppointment(null);
        setModalData(null);
    };

    // Color palette for professionals
    const PROFESSIONAL_COLORS = [
        { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-800', borderStrong: 'border-teal-500' },
        { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', borderStrong: 'border-blue-500' },
        { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', borderStrong: 'border-purple-500' },
        { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', borderStrong: 'border-rose-500' },
        { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', borderStrong: 'border-amber-500' },
        { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800', borderStrong: 'border-indigo-500' },
    ];

    const getProfessionalColor = (professionalName?: string) => {
        if (!professionalName) return PROFESSIONAL_COLORS[0];
        let hash = 0;
        for (let i = 0; i < professionalName.length; i++) {
            hash = professionalName.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % PROFESSIONAL_COLORS.length;
        return PROFESSIONAL_COLORS[index];
    };

    const handleToday = () => {
        setSelectedDate(new Date());
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold text-slate-800">Agenda</h1>

                <div className="flex items-center space-x-4">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button onClick={() => setViewMode('week')} className={`px-3 py-1 text-sm rounded-md transition-all ${viewMode === 'week' ? 'bg-white shadow text-slate-800 font-medium' : 'text-slate-500 hover:text-slate-700'}`}>Semana</button>
                        <button onClick={() => setViewMode('month')} className={`px-3 py-1 text-sm rounded-md transition-all ${viewMode === 'month' ? 'bg-white shadow text-slate-800 font-medium' : 'text-slate-500 hover:text-slate-700'}`}>Mes</button>
                    </div>

                    <select
                        className="p-2 border rounded-lg bg-white text-sm min-w-[180px]"
                        value={selectedProfessional}
                        onChange={(e) => setSelectedProfessional(e.target.value)}
                    >
                        <option value="all">Todos los profesionales</option>
                        <option value="me">Solo mis turnos</option>
                        {professionals.filter(p => p !== user.displayName).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>

                    <div className="flex items-center border rounded-lg bg-white">
                        <button onClick={() => {
                            const d = new Date(selectedDate);
                            if (viewMode === 'week') d.setDate(d.getDate() - 7);
                            else d.setMonth(d.getMonth() - 1);
                            setSelectedDate(d);
                        }} className="p-2 hover:bg-slate-50"><ChevronLeft size={18} /></button>

                        <button onClick={handleToday} className="px-2 text-sm font-medium text-teal-600 hover:bg-teal-50 h-full border-x">Hoy</button>

                        <span className="px-4 text-sm font-medium min-w-[140px] text-center">
                            {viewMode === 'week' ? (
                                `${weekDays[0].getDate()} - ${weekDays[4].getDate()} ${weekDays[4].toLocaleDateString('es-ES', { month: 'short' })}`
                            ) : (
                                selectedDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
                            )}
                        </span>

                        <button onClick={() => {
                            const d = new Date(selectedDate);
                            if (viewMode === 'week') d.setDate(d.getDate() + 7);
                            else d.setMonth(d.getMonth() + 1);
                            setSelectedDate(d);
                        }} className="p-2 hover:bg-slate-50"><ChevronRight size={18} /></button>
                    </div>
                    <button onClick={() => handleNewAppointment()} className="bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 shadow-sm hover:bg-teal-700">
                        <Plus size={18} /> <span>Turno</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
                {viewMode === 'week' ? (
                    <>
                        <div className="flex border-b bg-slate-50 pr-2">
                            <div className="w-16 p-3 text-center text-xs text-slate-400 font-bold border-r flex-shrink-0">HORA</div>
                            <div className="flex-1 grid grid-cols-5">
                                {weekDays.map((d, i) => (
                                    <div key={i} className={`p-3 text-center border-r ${d.toDateString() === new Date().toDateString() ? 'bg-teal-50' : ''}`}>
                                        <div className="text-xs text-slate-500 uppercase">{d.toLocaleDateString('es-ES', { weekday: 'short' })}</div>
                                        <div className="font-bold">{d.getDate()}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {hours.map(hour => (
                                <div key={hour} className="flex min-h-[100px] border-b last:border-0">
                                    <div className="w-16 p-2 text-xs text-slate-400 text-center border-r pt-3 font-bold flex-shrink-0">{hour}:00</div>
                                    <div className="flex-1 grid grid-cols-5">
                                        {weekDays.map((day, i) => {
                                            const appts = getAppts(day, hour);
                                            return (
                                                <div key={i} className="border-r p-1 relative group hover:bg-slate-50/50 flex flex-col space-y-1">
                                                    {appts.map(appt => {
                                                        const colors = getProfessionalColor(appt.professional);
                                                        const isOnline = appt.type === 'online';
                                                        const stripColor = colors.bg.replace('bg-', 'bg-').replace('-50', '-500');

                                                        return (
                                                            <div key={appt.id}
                                                                onClick={() => setSelectedAppointment(appt)}
                                                                className={`w-full rounded p-2 text-xs shadow-sm cursor-pointer relative overflow-hidden transition-all hover:shadow-md mb-1 pl-3
                                                                ${isOnline ? `bg-white border ${colors.border}` : `${colors.bg} border border-transparent`}
                                                                ${colors.text}`}
                                                            >
                                                                {/* Professional Color Indicator Strip */}
                                                                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${stripColor}`}></div>

                                                                <div className="flex justify-between items-start">
                                                                    <div className="font-bold truncate leading-tight">{appt.patientName}</div>
                                                                    <div className="text-[10px] font-mono opacity-80">{appt.time}</div>
                                                                </div>
                                                                <div className="flex justify-between items-center mt-1">
                                                                    <div className="flex items-center space-x-1 opacity-80 scale-90 origin-left">
                                                                        {isOnline ? <Video size={10} /> : <MapPin size={10} />}
                                                                        <span className="truncate max-w-[80px]">{appt.professional || 'General'}</span>
                                                                    </div>
                                                                    {appt.isPaid ? (
                                                                        <CheckCircle size={10} className="text-green-600" />
                                                                    ) : (
                                                                        <span className="text-[8px] font-bold text-red-500">IMPAGO</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    <button onClick={() => handleNewAppointment(day, `${hour < 10 ? '0' + hour : hour}:00`)} className="w-full flex-1 min-h-[20px] flex items-center justify-center opacity-0 group-hover:opacity-100 text-teal-300 hover:text-teal-600 transition-opacity">
                                                        <Plus size={12} />
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 grid grid-cols-7 grid-rows-5">
                        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
                            <div key={day} className="p-2 text-center text-xs font-bold text-slate-500 border-b border-r bg-slate-50">{day}</div>
                        ))}
                        {monthDays.map((d, i) => {
                            const dayAppts = getDayAppts(d.date);
                            return (
                                <div key={i}
                                    onClick={() => { setSelectedDate(d.date); setViewMode('week'); }}
                                    className={`p-2 border-b border-r min-h-[100px] cursor-pointer hover:bg-slate-50 transition-colors ${!d.isCurrentMonth ? 'bg-slate-50/50 text-slate-400' : ''}`}
                                >
                                    <div className={`text-right text-sm mb-1 ${d.date.toDateString() === new Date().toDateString() ? 'text-teal-600 font-bold' : ''}`}>{d.date.getDate()}</div>
                                    <div className="space-y-1">
                                        {dayAppts.slice(0, 3).map(appt => {
                                            const colors = getProfessionalColor(appt.professional);
                                            return (
                                                <div key={appt.id} className={`text-[10px] truncate px-1 rounded ${colors.bg} ${colors.text}`}>
                                                    {appt.time} {appt.patientName}
                                                </div>
                                            )
                                        })}
                                        {dayAppts.length > 3 && (
                                            <div className="text-[10px] text-slate-400 text-center">+{dayAppts.length - 3} más</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {showModal && (
                <AppointmentModal
                    onClose={handleCloseModal}
                    patients={patients}
                    user={user}
                    existingAppointment={isEditing ? selectedAppointment! : undefined}
                    initialDate={modalData?.date}
                    initialTime={modalData?.time}
                />
            )}

            {selectedAppointment && !showModal && (
                <AppointmentDetailsModal
                    appointment={selectedAppointment}
                    onClose={() => setSelectedAppointment(null)}
                    onEdit={handleEdit}
                    user={user}
                />
            )}
        </div>
    );
};
