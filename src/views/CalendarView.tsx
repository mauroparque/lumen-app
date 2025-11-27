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

    // Calculate start and end of the visible week
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay() + 1); // Monday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 4); // Friday

    const toLocalDateString = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Fetch appointments for the visible range
    const { appointments } = useCalendarAppointments(
        user,
        toLocalDateString(startOfWeek),
        toLocalDateString(endOfWeek)
    );

    const { patients } = usePatients(user);

    const weekDays = Array.from({ length: 5 }, (_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        return d;
    });

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
        return appointments.filter(app => app.professional === selectedProfessional);
    }, [appointments, selectedProfessional]);

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

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold text-slate-800">Agenda</h1>

                <div className="flex items-center space-x-4">
                    {professionals.length > 0 && (
                        <select
                            className="p-2 border rounded-lg bg-white text-sm"
                            value={selectedProfessional}
                            onChange={(e) => setSelectedProfessional(e.target.value)}
                        >
                            <option value="all">Todos los profesionales</option>
                            {professionals.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    )}

                    <div className="flex items-center border rounded-lg bg-white">
                        <button onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() - 7)))} className="p-2 hover:bg-slate-50"><ChevronLeft size={18} /></button>
                        <span className="px-4 text-sm font-medium min-w-[120px] text-center">
                            {weekDays[0].getDate()} - {weekDays[4].getDate()} {weekDays[4].toLocaleDateString('es-ES', { month: 'short' })}
                        </span>
                        <button onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() + 7)))} className="p-2 hover:bg-slate-50"><ChevronRight size={18} /></button>
                    </div>
                    <button onClick={() => handleNewAppointment()} className="bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 shadow-sm hover:bg-teal-700">
                        <Plus size={18} /> <span>Turno</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
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
