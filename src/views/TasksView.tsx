import { useState, useMemo } from 'react';
import { User } from 'firebase/auth';
import { ListTodo, Plus, Search, Square, User as UserIcon, X, Save, Edit2 } from 'lucide-react';
import { StaffProfile } from '../types';
import { usePatients } from '../hooks/usePatients';
import { useData } from '../context/DataContext';
import { usePendingTasks, PendingTask } from '../hooks/usePendingTasks';
import { useDataActions } from '../hooks/useDataActions';
import { LoadingSpinner } from '../components/ui';
import { toast } from 'sonner';

interface TasksViewProps {
    user: User;
    profile: StaffProfile | null;
}

interface TaskFormData {
    text: string;
    patientId: string;
    subtasks: { text: string; completed: boolean }[];
}

export const TasksView = ({ user, profile }: TasksViewProps) => {
    const { patients, loading: loadingPatients } = usePatients(user);
    const { appointments } = useData();
    const { addTask, updateTask, toggleSubtaskCompletion } = useDataActions();

    // Create set of patient IDs for filtering tasks
    const myPatientIds = useMemo(() => new Set(patients.map((p) => p.id)), [patients]);

    const { pendingTasks, loading: loadingTasks, completeTask } = usePendingTasks(appointments, myPatientIds);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPatient, setFilterPatient] = useState<string>('');
    const [filterDate, setFilterDate] = useState<'all' | 'today' | 'week' | 'overdue'>('all');

    // UI State
    const [showNewTask, setShowNewTask] = useState(false);
    const [editingTask, setEditingTask] = useState<PendingTask | null>(null);
    const [editForm, setEditForm] = useState<TaskFormData>({ text: '', patientId: '', subtasks: [] });
    const [editSubtask, setEditSubtask] = useState('');

    // New task form
    const [newTask, setNewTask] = useState<TaskFormData>({
        text: '',
        patientId: '',
        subtasks: [],
    });
    const [newSubtask, setNewSubtask] = useState('');

    const today = useMemo(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }, []);

    const weekFromNow = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }, []);

    // Filter and group tasks
    const filteredTasks = useMemo(() => {
        let result = [...pendingTasks];

        // Filter by patient
        if (filterPatient) {
            result = result.filter((t) => t.patientId === filterPatient);
        }

        // Filter by date
        if (filterDate === 'today') {
            result = result.filter((t) => t.appointmentDate === today);
        } else if (filterDate === 'week') {
            result = result.filter((t) => t.appointmentDate && t.appointmentDate <= weekFromNow);
        } else if (filterDate === 'overdue') {
            result = result.filter((t) => t.appointmentDate && t.appointmentDate < today);
        }

        // Filter by search term
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(
                (t) =>
                    t.text.toLowerCase().includes(lower) ||
                    patients
                        .find((p) => p.id === t.patientId)
                        ?.name.toLowerCase()
                        .includes(lower),
            );
        }

        return result;
    }, [pendingTasks, filterPatient, filterDate, searchTerm, today, weekFromNow, patients]);

    // Group tasks by patient
    const tasksByPatient = useMemo(() => {
        const grouped: Record<string, PendingTask[]> = {};
        filteredTasks.forEach((task) => {
            if (!grouped[task.patientId]) {
                grouped[task.patientId] = [];
            }
            grouped[task.patientId].push(task);
        });
        return grouped;
    }, [filteredTasks]);

    const handleCompleteTask = async (noteId: string, taskIndex: number) => {
        try {
            await completeTask(noteId, taskIndex);
            toast.success('Tarea completada');
        } catch {
            toast.error('Error al completar tarea');
        }
    };

    const handleCreateTask = async () => {
        if (!newTask.text.trim() || !newTask.patientId) {
            toast.error('Completa el texto y selecciona un paciente');
            return;
        }

        try {
            await addTask({
                patientId: newTask.patientId,
                professional: profile?.name || user.displayName || user.email || '',
                content: newTask.text.trim(),
                createdBy: profile?.name || user.displayName || user.email || '',
                createdByUid: user.uid,
                subtasks: newTask.subtasks.length > 0 ? newTask.subtasks : undefined,
            });

            toast.success('Tarea creada');
            setShowNewTask(false);
            setNewTask({ text: '', patientId: '', subtasks: [] });
        } catch (error) {
            console.error('Error creating task:', error);
            toast.error('Error al crear la tarea');
        }
    };

    const addSubtask = () => {
        if (newSubtask.trim()) {
            setNewTask({
                ...newTask,
                subtasks: [...newTask.subtasks, { text: newSubtask.trim(), completed: false }],
            });
            setNewSubtask('');
        }
    };

    const removeSubtask = (index: number) => {
        setNewTask({
            ...newTask,
            subtasks: newTask.subtasks.filter((_, i) => i !== index),
        });
    };

    // Edit task functions
    const openEditModal = (task: PendingTask) => {
        setEditingTask(task);
        setEditForm({
            text: task.text,
            patientId: task.patientId,
            subtasks: task.subtasks || [],
        });
    };

    const handleUpdateTask = async () => {
        if (!editingTask || !editForm.text.trim()) {
            toast.error('El texto de la tarea es requerido');
            return;
        }

        try {
            await updateTask(editingTask.noteId, editingTask.taskIndex, {
                text: editForm.text.trim(),
                subtasks: editForm.subtasks,
            });
            toast.success('Tarea actualizada');
            setEditingTask(null);
            setEditForm({ text: '', patientId: '', subtasks: [] });
        } catch (error) {
            console.error('Error updating task:', error);
            toast.error('Error al actualizar la tarea');
        }
    };

    const addEditSubtask = () => {
        if (editSubtask.trim()) {
            setEditForm({
                ...editForm,
                subtasks: [...editForm.subtasks, { text: editSubtask.trim(), completed: false }],
            });
            setEditSubtask('');
        }
    };

    const removeEditSubtask = (index: number) => {
        setEditForm({
            ...editForm,
            subtasks: editForm.subtasks.filter((_, i) => i !== index),
        });
    };

    const toggleEditSubtaskComplete = (index: number) => {
        const updated = [...editForm.subtasks];
        updated[index] = { ...updated[index], completed: !updated[index].completed };
        setEditForm({ ...editForm, subtasks: updated });
    };

    // Toggle subtask completion directly from the list view
    const toggleSubtaskComplete = async (task: PendingTask, subtaskIndex: number) => {
        try {
            await toggleSubtaskCompletion(task.noteId, task.taskIndex, subtaskIndex);
            toast.success('Subitem actualizado');
        } catch (error) {
            console.error('Error toggling subtask:', error);
            toast.error('Error al actualizar subitem');
        }
    };

    const formatDate = (dateStr?: string): string => {
        if (!dateStr) return '';
        if (dateStr.startsWith('standalone-')) return 'Tarea independiente';
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    };

    const getPatientName = (patientId: string): string => {
        return patients.find((p) => p.id === patientId)?.name || 'Paciente';
    };

    if (loadingPatients || loadingTasks) {
        return (
            <div className="p-6 flex justify-center items-center h-64">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <ListTodo className="text-amber-500" />
                        Tareas
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">{filteredTasks.length} tarea(s) pendiente(s)</p>
                </div>
                <button
                    onClick={() => setShowNewTask(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
                >
                    <Plus size={18} />
                    Nueva Tarea
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search
                            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
                            size={18}
                        />
                        <input
                            type="text"
                            placeholder="Buscar tarea..."
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Patient Filter */}
                    <select
                        className="px-4 py-2 border rounded-lg bg-white min-w-[200px]"
                        value={filterPatient}
                        onChange={(e) => setFilterPatient(e.target.value)}
                    >
                        <option value="">Todos los pacientes</option>
                        {patients
                            .filter((p) => p.isActive !== false)
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                    </select>

                    {/* Date Filter */}
                    <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
                        {[
                            { value: 'all', label: 'Todas' },
                            { value: 'today', label: 'Hoy' },
                            { value: 'week', label: 'Semana' },
                            { value: 'overdue', label: 'Vencidas' },
                        ].map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setFilterDate(opt.value as 'all' | 'today' | 'week' | 'overdue')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                    filterDate === opt.value
                                        ? 'bg-white text-slate-700 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tasks List */}
            {filteredTasks.length === 0 ? (
                <div className="bg-white rounded-xl border p-12 text-center text-slate-500">
                    <ListTodo size={48} className="mx-auto mb-4 text-slate-200" />
                    {pendingTasks.length === 0
                        ? 'No hay tareas pendientes. ¡Buen trabajo!'
                        : 'No hay tareas que coincidan con los filtros.'}
                </div>
            ) : (
                <div className="space-y-4">
                    {Object.entries(tasksByPatient).map(([patientId, tasks]) => (
                        <div key={patientId} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            {/* Patient Header */}
                            <div className="bg-slate-50 px-4 py-3 border-b flex items-center gap-2">
                                <UserIcon size={16} className="text-slate-400" />
                                <span className="font-medium text-slate-700">{getPatientName(patientId)}</span>
                                <span className="text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
                                    {tasks.length} tarea(s)
                                </span>
                            </div>

                            {/* Tasks */}
                            <div className="divide-y divide-slate-100">
                                {tasks.map((task) => {
                                    const taskKey = `${task.noteId}-${task.taskIndex}`;

                                    return (
                                        <div key={taskKey} className="p-4 hover:bg-slate-50 transition-colors">
                                            <div className="flex items-start gap-3">
                                                {/* Checkbox */}
                                                <button
                                                    onClick={() => handleCompleteTask(task.noteId, task.taskIndex)}
                                                    className="mt-0.5 text-amber-400 hover:text-green-600 transition-colors flex-shrink-0"
                                                    title="Marcar como completada"
                                                >
                                                    <Square size={20} />
                                                </button>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="text-slate-800 font-medium">{task.text}</div>
                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                            <button
                                                                onClick={() => openEditModal(task)}
                                                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                title="Editar tarea"
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>
                                                            {task.appointmentDate && (
                                                                <span
                                                                    className={`text-xs px-2 py-0.5 rounded ${
                                                                        task.appointmentDate < today &&
                                                                        !task.appointmentDate.startsWith('standalone-')
                                                                            ? 'bg-red-100 text-red-600'
                                                                            : 'bg-slate-100 text-slate-500'
                                                                    }`}
                                                                >
                                                                    {formatDate(task.appointmentDate)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Subtasks */}
                                                    {task.subtasks && task.subtasks.length > 0 && (
                                                        <div className="mt-2 pl-2 border-l-2 border-slate-200 space-y-1">
                                                            {task.subtasks.map((st, stIdx) => (
                                                                <button
                                                                    key={stIdx}
                                                                    onClick={() => toggleSubtaskComplete(task, stIdx)}
                                                                    className="flex items-center gap-2 text-sm w-full text-left hover:bg-slate-100 p-1 rounded transition-colors group"
                                                                >
                                                                    {st.completed ? (
                                                                        <span className="text-green-500 group-hover:text-green-600">
                                                                            ✓
                                                                        </span>
                                                                    ) : (
                                                                        <Square
                                                                            size={12}
                                                                            className="text-slate-300 group-hover:text-amber-400"
                                                                        />
                                                                    )}
                                                                    <span
                                                                        className={
                                                                            st.completed
                                                                                ? 'text-slate-400 line-through'
                                                                                : 'text-slate-600'
                                                                        }
                                                                    >
                                                                        {st.text}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* New Task Modal */}
            {showNewTask && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-slate-800">Nueva Tarea</h2>
                            <button
                                onClick={() => {
                                    setShowNewTask(false);
                                    setNewTask({ text: '', patientId: '', subtasks: [] });
                                }}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Patient Select */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Paciente *</label>
                                <select
                                    className="w-full p-2 border rounded-lg bg-white"
                                    value={newTask.patientId}
                                    onChange={(e) => setNewTask({ ...newTask, patientId: e.target.value })}
                                >
                                    <option value="">Seleccionar paciente...</option>
                                    {patients
                                        .filter((p) => p.isActive !== false)
                                        .sort((a, b) => a.name.localeCompare(b.name))
                                        .map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            {/* Task Text */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción *</label>
                                <textarea
                                    className="w-full p-3 border rounded-lg resize-none focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                                    rows={3}
                                    placeholder="Descripción de la tarea..."
                                    value={newTask.text}
                                    onChange={(e) => setNewTask({ ...newTask, text: e.target.value })}
                                />
                            </div>

                            {/* Subtasks */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Subitems (opcional)
                                </label>
                                <div className="space-y-2">
                                    {newTask.subtasks.map((st, idx) => (
                                        <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg">
                                            <Square size={14} className="text-slate-300" />
                                            <span className="flex-1 text-sm text-slate-600">{st.text}</span>
                                            <button
                                                onClick={() => removeSubtask(idx)}
                                                className="text-slate-400 hover:text-red-500"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Agregar subitem..."
                                            className="flex-1 p-2 border rounded-lg text-sm"
                                            value={newSubtask}
                                            onChange={(e) => setNewSubtask(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                                        />
                                        <button
                                            type="button"
                                            onClick={addSubtask}
                                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => {
                                    setShowNewTask(false);
                                    setNewTask({ text: '', patientId: '', subtasks: [] });
                                }}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateTask}
                                disabled={!newTask.text.trim() || !newTask.patientId}
                                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Save size={16} />
                                Crear Tarea
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Task Modal */}
            {editingTask && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-slate-800">Editar Tarea</h2>
                            <button
                                onClick={() => {
                                    setEditingTask(null);
                                    setEditForm({ text: '', patientId: '', subtasks: [] });
                                }}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="text-sm text-slate-500 mb-4">
                            Paciente:{' '}
                            <span className="font-medium text-slate-700">{getPatientName(editingTask.patientId)}</span>
                        </div>

                        <div className="space-y-4">
                            {/* Task Text */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción *</label>
                                <textarea
                                    className="w-full p-3 border rounded-lg resize-none focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                                    rows={3}
                                    value={editForm.text}
                                    onChange={(e) => setEditForm({ ...editForm, text: e.target.value })}
                                />
                            </div>

                            {/* Subtasks */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Subitems</label>
                                <div className="space-y-2">
                                    {editForm.subtasks.map((st, idx) => (
                                        <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg">
                                            <button
                                                type="button"
                                                onClick={() => toggleEditSubtaskComplete(idx)}
                                                className={st.completed ? 'text-green-500' : 'text-slate-300'}
                                            >
                                                {st.completed ? '✓' : <Square size={14} />}
                                            </button>
                                            <span
                                                className={`flex-1 text-sm ${st.completed ? 'text-slate-400 line-through' : 'text-slate-600'}`}
                                            >
                                                {st.text}
                                            </span>
                                            <button
                                                onClick={() => removeEditSubtask(idx)}
                                                className="text-slate-400 hover:text-red-500"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Agregar subitem..."
                                            className="flex-1 p-2 border rounded-lg text-sm"
                                            value={editSubtask}
                                            onChange={(e) => setEditSubtask(e.target.value)}
                                            onKeyPress={(e) =>
                                                e.key === 'Enter' && (e.preventDefault(), addEditSubtask())
                                            }
                                        />
                                        <button
                                            type="button"
                                            onClick={addEditSubtask}
                                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => {
                                    setEditingTask(null);
                                    setEditForm({ text: '', patientId: '', subtasks: [] });
                                }}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleUpdateTask}
                                disabled={!editForm.text.trim()}
                                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Save size={16} />
                                Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
