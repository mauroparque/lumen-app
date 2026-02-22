import { useState, useMemo, useRef, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Appointment } from '../types';
import { ChevronLeft, ChevronRight, Plus, Video, MapPin, CheckCircle, FileText, AlertCircle } from 'lucide-react';
import { AppointmentModal } from '../components/modals/AppointmentModal';
import { AppointmentDetailsModal } from '../components/modals/AppointmentDetailsModal';
import { useCalendarAppointments } from '../hooks/useCalendarAppointments';
import { usePatients } from '../hooks/usePatients';

import { StaffProfile } from '../types';

interface CalendarViewProps {
    user: User;
    profile: StaffProfile | null;
}

export const CalendarView = ({ user, profile }: CalendarViewProps) => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showModal, setShowModal] = useState(false);
    const [selectedProfessional, setSelectedProfessional] = useState<string>('all');
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [modalData, setModalData] = useState<{ date?: string; time?: string } | null>(null);

    const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

    // Current time state (updates every minute)
    const [currentTime, setCurrentTime] = useState(new Date());
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Update current time every minute
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    // Constants for time calculations
    const HOUR_HEIGHT_DESKTOP = 100; // px - matches min-h-[100px] on desktop (md:)
    const HOUR_HEIGHT_MOBILE = 80; // px - matches min-h-[80px] on mobile
    const START_HOUR = 8;
    const END_HOUR = 20;

    // Get the correct hour height based on screen size
    const getHourHeight = () => {
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            return HOUR_HEIGHT_MOBILE;
        }
        return HOUR_HEIGHT_DESKTOP;
    };

    // Calculate start and end of the visible range based on view mode
    const startOfRange = new Date(selectedDate);
    if (viewMode === 'week') {
        startOfRange.setDate(selectedDate.getDate() - selectedDate.getDay() + 1); // Monday
    } else {
        startOfRange.setDate(1); // First day of month
    }

    const endOfRange = new Date(startOfRange);
    if (viewMode === 'week') {
        endOfRange.setDate(startOfRange.getDate() + 5); // Saturday
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
    const { appointments } = useCalendarAppointments(toLocalDateString(startOfRange), toLocalDateString(endOfRange));

    const { patients } = usePatients(user);

    const weekDays = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(startOfRange);
        if (viewMode === 'week') {
            d.setDate(startOfRange.getDate() + i);
        }
        return d;
    });

    // Check if we're viewing the current week
    const isCurrentWeek = useMemo(() => {
        const today = new Date();
        return weekDays.some((d) => d.toDateString() === today.toDateString());
    }, [weekDays]);

    // Auto-scroll to current time on mount (only for week view on current week)
    useEffect(() => {
        if (viewMode === 'week' && scrollContainerRef.current && isCurrentWeek) {
            // Small delay to ensure DOM is fully rendered
            const timeoutId = setTimeout(() => {
                if (!scrollContainerRef.current) return;

                const now = new Date();
                const currentHour = now.getHours();
                const currentMinutes = now.getMinutes();

                if (currentHour >= START_HOUR && currentHour <= END_HOUR) {
                    // Calculate scroll position: center the current time in the view
                    const hourOffset = currentHour - START_HOUR;
                    const minuteOffset = currentMinutes / 60;
                    const scrollPosition = (hourOffset + minuteOffset) * getHourHeight() - 150; // -150 to show some context above

                    scrollContainerRef.current.scrollTo({
                        top: Math.max(0, scrollPosition),
                        behavior: 'smooth',
                    });
                }
            }, 100); // 100ms delay to ensure rendering is complete

            return () => clearTimeout(timeoutId);
        }
    }, [viewMode, isCurrentWeek]);

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
        appointments.forEach((app) => {
            if (app.professional) pros.add(app.professional);
        });
        // Eliminar al usuario actual de la lista genérica (ya tiene su opción "Mis Turnos")
        if (profile?.name) pros.delete(profile.name);
        if (profile?.email) pros.delete(profile.email);
        return Array.from(pros);
    }, [appointments, profile]);

    const filteredAppointments = useMemo(() => {
        if (selectedProfessional === 'all') return appointments;
        if (selectedProfessional === 'me') return appointments.filter((app) => app.professional === profile?.name);
        return appointments.filter((app) => app.professional === selectedProfessional);
    }, [appointments, selectedProfessional, profile?.name]);

    // Index appointments by date-hour for O(1) access
    const appointmentsMap = useMemo(() => {
        const map = new Map<string, Appointment[]>();
        filteredAppointments.forEach((app) => {
            // Key: YYYY-MM-DD-HH
            const hour = app.time.split(':')[0];
            const key = `${app.date}-${hour}`;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(app);
        });
        // Sort by time within the hour
        map.forEach((list) => list.sort((a, b) => a.time.localeCompare(b.time)));
        return map;
    }, [filteredAppointments]);

    const getAppts = (day: Date, hour: number) => {
        const dStr = toLocalDateString(day);
        const hStr = hour < 10 ? `0${hour}` : `${hour}`;
        return appointmentsMap.get(`${dStr}-${hStr}`) || [];
    };

    const getDayAppts = (day: Date) => {
        const dStr = toLocalDateString(day);
        return filteredAppointments.filter((a) => a.date === dStr);
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
            time: time,
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <h1 className="text-2xl font-bold text-slate-800">Agenda</h1>

                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full md:w-auto">
                    <div className="flex bg-slate-100 p-1 rounded-lg self-start md:self-auto">
                        <button
                            onClick={() => setViewMode('week')}
                            className={`px-3 py-1 text-sm rounded-md transition-all ${viewMode === 'week' ? 'bg-white shadow text-slate-800 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Semana
                        </button>
                        <button
                            onClick={() => setViewMode('month')}
                            className={`px-3 py-1 text-sm rounded-md transition-all ${viewMode === 'month' ? 'bg-white shadow text-slate-800 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Mes
                        </button>
                    </div>

                    <select
                        className="p-2 border rounded-lg bg-white text-sm w-full md:min-w-[180px]"
                        value={selectedProfessional}
                        onChange={(e) => setSelectedProfessional(e.target.value)}
                    >
                        <option value="all">Todos los profesionales</option>
                        <option value="me">Solo mis turnos</option>
                        {professionals
                            .filter((p) => p !== user.displayName)
                            .map((p) => (
                                <option key={p} value={p}>
                                    {p}
                                </option>
                            ))}
                    </select>

                    <div className="flex items-center border rounded-lg bg-white justify-between md:justify-start">
                        <button
                            onClick={() => {
                                const d = new Date(selectedDate);
                                if (viewMode === 'week') d.setDate(d.getDate() - 7);
                                else d.setMonth(d.getMonth() - 1);
                                setSelectedDate(d);
                            }}
                            className="p-2 hover:bg-slate-50"
                        >
                            <ChevronLeft size={18} />
                        </button>

                        <button
                            onClick={handleToday}
                            className="px-2 text-sm font-medium text-teal-600 hover:bg-teal-50 h-full border-x"
                        >
                            Hoy
                        </button>

                        <span className="px-4 text-sm font-medium min-w-[140px] text-center">
                            {viewMode === 'week'
                                ? `${weekDays[0].getDate()} - ${weekDays[4].getDate()} ${weekDays[4].toLocaleDateString('es-ES', { month: 'short' })}`
                                : selectedDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                        </span>

                        <button
                            onClick={() => {
                                const d = new Date(selectedDate);
                                if (viewMode === 'week') d.setDate(d.getDate() + 7);
                                else d.setMonth(d.getMonth() + 1);
                                setSelectedDate(d);
                            }}
                            className="p-2 hover:bg-slate-50"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                    <button
                        onClick={() => handleNewAppointment()}
                        className="bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2 shadow-sm hover:bg-teal-700 w-full md:w-auto"
                    >
                        <Plus size={18} /> <span>Turno</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
                <div className="w-full h-full flex flex-col">
                    {viewMode === 'week' ? (
                        <>
                            <div className="flex border-b bg-slate-50 pr-1 md:pr-4">
                                <div className="w-10 md:w-16 p-1 md:p-3 text-center text-[10px] md:text-xs text-slate-400 font-bold border-r flex-shrink-0 flex items-center justify-center">
                                    HORA
                                </div>
                                <div className="flex-1 grid grid-cols-6">
                                    {weekDays.map((d, i) => (
                                        <div
                                            key={i}
                                            className={`p-1 md:p-3 text-center border-r ${d.toDateString() === new Date().toDateString() ? 'bg-teal-50' : ''}`}
                                        >
                                            <div className="text-[8px] md:text-xs text-slate-500 uppercase truncate">
                                                {d.toLocaleDateString('es-ES', { weekday: 'short' })}
                                            </div>
                                            <div className="font-bold text-xs md:text-base">{d.getDate()}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto relative">
                                {/* Current Time Indicator Line */}
                                {isCurrentWeek &&
                                    (() => {
                                        const currentHour = currentTime.getHours();
                                        const currentMinutes = currentTime.getMinutes();

                                        if (currentHour < START_HOUR || currentHour > END_HOUR) return null;

                                        // Calculate position: (hours from start + fraction of current hour) * row height
                                        const hourOffset = currentHour - START_HOUR;
                                        const minuteOffset = currentMinutes / 60;
                                        const topPosition = (hourOffset + minuteOffset) * getHourHeight();

                                        // Find which day column is today
                                        const todayIndex = weekDays.findIndex(
                                            (d) => d.toDateString() === new Date().toDateString(),
                                        );

                                        return (
                                            <div
                                                className="absolute z-20 pointer-events-none flex items-center"
                                                style={{
                                                    top: `${topPosition}px`,
                                                    left: `calc(${(todayIndex / 6) * 100}% + 2.5rem)`, // 2.5rem = w-10 (hour column on mobile)
                                                    width: `${100 / 6}%`,
                                                }}
                                            >
                                                {/* Circle indicator */}
                                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-lg shadow-red-500/50 -ml-1" />
                                                {/* Line only on today */}
                                                <div className="flex-1 h-0.5 bg-red-500" />
                                            </div>
                                        );
                                    })()}

                                {hours.map((hour) => (
                                    <div
                                        key={hour}
                                        className="flex min-h-[80px] md:min-h-[100px] border-b last:border-0 relative"
                                    >
                                        <div className="w-10 md:w-16 p-1 md:p-2 text-[10px] md:text-xs text-slate-400 text-center border-r pt-3 font-bold flex-shrink-0">
                                            {hour}:00
                                        </div>
                                        <div className="flex-1 grid grid-cols-6">
                                            {weekDays.map((day, i) => {
                                                const appts = getAppts(day, hour);
                                                return (
                                                    <div
                                                        key={i}
                                                        className="border-r p-1 relative group hover:bg-slate-50/50 cursor-pointer"
                                                        onClick={() =>
                                                            handleNewAppointment(
                                                                day,
                                                                `${hour < 10 ? '0' + hour : hour}:00`,
                                                            )
                                                        }
                                                    >
                                                        {/* Appointments container with relative positioning */}
                                                        <div className="relative h-full">
                                                            {appts.map((appt, apptIndex) => {
                                                                const colors = getProfessionalColor(appt.professional);
                                                                const isOnline = appt.type === 'online';

                                                                // Determine effective status (auto-mark as presente if past and still programado)
                                                                const appointmentDateTime = new Date(
                                                                    `${appt.date}T${appt.time}`,
                                                                );
                                                                const isPast = appointmentDateTime < new Date();
                                                                const effectiveStatus =
                                                                    appt.status === 'programado' && isPast
                                                                        ? 'presente'
                                                                        : appt.status;

                                                                // Calculate vertical offset based on minutes
                                                                const [, minutes] = appt.time.split(':').map(Number);
                                                                const minuteOffsetPercent = (minutes / 60) * 100;

                                                                // Calculate horizontal offset for overlapping appointments
                                                                const overlapCount = appts.length;
                                                                const overlapWidth =
                                                                    overlapCount > 1
                                                                        ? `${100 / overlapCount}%`
                                                                        : '100%';
                                                                const overlapLeft =
                                                                    overlapCount > 1
                                                                        ? `${(apptIndex / overlapCount) * 100}%`
                                                                        : '0';

                                                                // Professional color as base (for multi-professional view)
                                                                const baseStyles = {
                                                                    bg: isOnline ? 'bg-white' : colors.bg,
                                                                    text: colors.text,
                                                                    border: isOnline
                                                                        ? colors.border
                                                                        : 'border-transparent',
                                                                };

                                                                // Status indicator (left strip color only - keeps professional color visible)
                                                                const getStatusStripColor = () => {
                                                                    switch (effectiveStatus) {
                                                                        case 'cancelado':
                                                                            return 'bg-slate-400';
                                                                        case 'ausente':
                                                                            return 'bg-orange-500';
                                                                        case 'presente':
                                                                        case 'completado':
                                                                            return 'bg-green-500';
                                                                        default: // programado - use professional color
                                                                            return colors.bg.replace('-50', '-500');
                                                                    }
                                                                };

                                                                const isCancelled = effectiveStatus === 'cancelado';
                                                                const stripColor = getStatusStripColor();

                                                                return (
                                                                    <div
                                                                        key={appt.id}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSelectedAppointment(appt);
                                                                        }}
                                                                        style={{
                                                                            position: 'absolute',
                                                                            top: `${minuteOffsetPercent}%`,
                                                                            left: overlapLeft,
                                                                            width: overlapWidth,
                                                                        }}
                                                                        className={`rounded p-1 md:p-2 text-[10px] md:text-xs shadow-sm cursor-pointer relative overflow-hidden transition-all hover:shadow-md hover:z-10 pl-2 md:pl-3 border
                                                                    ${isCancelled ? 'bg-slate-100 text-slate-400 border-slate-200 opacity-50' : `${baseStyles.bg} ${baseStyles.text} ${baseStyles.border}`}`}
                                                                    >
                                                                        {/* Status Color Indicator Strip */}
                                                                        <div
                                                                            className={`absolute left-0 top-0 bottom-0 w-1.5 ${stripColor}`}
                                                                        ></div>

                                                                        <div className="flex justify-between items-start">
                                                                            <div className="font-bold truncate leading-tight text-[9px] md:text-xs">
                                                                                {appt.patientName}
                                                                            </div>
                                                                            <div className="text-[8px] md:text-[10px] font-mono opacity-80 hidden md:block">
                                                                                {appt.time}
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex justify-between items-center mt-0.5 md:mt-1">
                                                                            <div className="flex items-center space-x-1 opacity-80 scale-75 md:scale-90 origin-left">
                                                                                {isOnline ? (
                                                                                    <Video size={10} />
                                                                                ) : (
                                                                                    <MapPin size={10} />
                                                                                )}
                                                                                <span className="truncate max-w-[40px] md:max-w-[60px] text-[8px] md:text-[10px]">
                                                                                    {appt.professional || 'General'}
                                                                                </span>

                                                                                {/* Clinical Note Indicator */}
                                                                                {appt.hasNotes ? (
                                                                                    <FileText
                                                                                        size={10}
                                                                                        className="text-slate-600 ml-1"
                                                                                    />
                                                                                ) : (
                                                                                    isPast &&
                                                                                    effectiveStatus !== 'cancelado' && (
                                                                                        <AlertCircle
                                                                                            size={10}
                                                                                            className="text-amber-500 ml-1"
                                                                                        />
                                                                                    )
                                                                                )}
                                                                            </div>
                                                                            {effectiveStatus !== 'cancelado' &&
                                                                                (appt.isPaid ? (
                                                                                    <CheckCircle
                                                                                        size={10}
                                                                                        className="text-green-600"
                                                                                    />
                                                                                ) : (
                                                                                    <span className="text-[8px] font-bold text-red-500">
                                                                                        IMPAGO
                                                                                    </span>
                                                                                ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        {/* Hover indicator for empty space */}
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                            <Plus size={16} className="text-teal-400" />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col h-full overflow-hidden">
                            <div className="grid grid-cols-7 border-b bg-slate-50 min-h-[30px] md:min-h-[40px] shrink-0 pr-1 md:pr-4">
                                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
                                    <div
                                        key={day}
                                        className="p-1 md:p-2 text-center text-[10px] md:text-xs font-bold text-slate-500 border-r last:border-r-0 flex items-center justify-center"
                                    >
                                        {day}
                                    </div>
                                ))}
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                <div className="grid grid-cols-7 auto-rows-fr h-full min-h-[500px]">
                                    {monthDays.map((d, i) => {
                                        const dayAppts = getDayAppts(d.date);
                                        return (
                                            <div
                                                key={i}
                                                onClick={() => {
                                                    setSelectedDate(d.date);
                                                    setViewMode('week');
                                                }}
                                                className={`p-1 md:p-2 border-b border-r cursor-pointer hover:bg-slate-50 transition-colors flex flex-col ${!d.isCurrentMonth ? 'bg-slate-50/50 text-slate-400' : ''}`}
                                            >
                                                <div
                                                    className={`text-right text-xs md:text-sm mb-1 ${d.date.toDateString() === new Date().toDateString() ? 'text-teal-600 font-bold' : ''}`}
                                                >
                                                    {d.date.getDate()}
                                                </div>
                                                <div className="space-y-1 overflow-y-auto flex-1 custom-scrollbar">
                                                    {dayAppts.slice(0, 3).map((appt) => {
                                                        const colors = getProfessionalColor(appt.professional);
                                                        return (
                                                            <div
                                                                key={appt.id}
                                                                className={`text-[8px] md:text-[10px] truncate px-0.5 md:px-1 rounded ${colors.bg} ${colors.text}`}
                                                            >
                                                                <span className="hidden md:inline">{appt.time} </span>
                                                                {appt.patientName}
                                                            </div>
                                                        );
                                                    })}
                                                    {dayAppts.length > 3 && (
                                                        <div className="text-[8px] md:text-[10px] text-slate-400 text-center">
                                                            +{dayAppts.length - 3}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showModal && (
                <AppointmentModal
                    onClose={handleCloseModal}
                    patients={patients}
                    user={user}
                    profile={profile}
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
