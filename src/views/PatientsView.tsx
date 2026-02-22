import { useState, useMemo } from 'react';
import { User } from 'firebase/auth';
import { Patient, View } from '../types';
import { Search, Plus } from 'lucide-react';
import { PatientModal } from '../components/modals/PatientModal';
import { PatientTable } from '../components/patients/PatientTable';
import { LoadingSpinner } from '../components/ui';
import { usePatients } from '../hooks/usePatients';
import { useDataActions } from '../hooks/useDataActions';
import { toast } from 'sonner';
import { StaffProfile } from '../types';

type SortField = 'name' | 'age' | 'professional' | 'fee' | 'admissionDate';
type SortDirection = 'asc' | 'desc';
type FilterStatus = 'all' | 'active' | 'inactive';

interface PatientsViewProps {
    user: User;
    profile: StaffProfile | null;
    setCurrentView: (view: View) => void;
    setSelectedPatientId: (id: string | null) => void;
    setPatientHistoryInitialTab: (tab: 'history' | 'tasks') => void;
}

const calculateAge = (birthDate?: string): number | null => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
};

export const PatientsView = ({
    user,
    profile,
    setCurrentView,
    setSelectedPatientId,
    setPatientHistoryInitialTab,
}: PatientsViewProps) => {
    const [showAdd, setShowAdd] = useState(false);
    const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<SortField>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('active');

    const { patients, loading } = usePatients(user);
    const { deleteItem } = useDataActions();

    // Filter and sort patients
    const filteredAndSortedPatients = useMemo(() => {
        let result = [...patients];

        // Filter by status
        if (filterStatus === 'active') {
            result = result.filter((p) => p.isActive !== false);
        } else if (filterStatus === 'inactive') {
            result = result.filter((p) => p.isActive === false);
        }

        // Filter by search term
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(
                (p) =>
                    p.name.toLowerCase().includes(lower) ||
                    (p.email && p.email.toLowerCase().includes(lower)) ||
                    (p.dni && p.dni.includes(searchTerm)) ||
                    (p.professional && p.professional.toLowerCase().includes(lower)),
            );
        }

        // Sort
        result.sort((a, b) => {
            let comparison = 0;

            switch (sortBy) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'age':
                    const ageA = calculateAge(a.birthDate) ?? 999;
                    const ageB = calculateAge(b.birthDate) ?? 999;
                    comparison = ageA - ageB;
                    break;
                case 'professional':
                    comparison = (a.professional || '').localeCompare(b.professional || '');
                    break;
                case 'fee':
                    comparison = (a.fee || 0) - (b.fee || 0);
                    break;
                case 'admissionDate':
                    comparison = (a.admissionDate || '').localeCompare(b.admissionDate || '');
                    break;
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });

        return result;
    }, [patients, searchTerm, sortBy, sortDirection, filterStatus]);

    const handleSort = (field: SortField) => {
        if (sortBy === field) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortBy(field);
            setSortDirection('asc');
        }
    };

    const handleDelete = async (patient: Patient) => {
        if (confirm(`¿Estás seguro de que deseas eliminar a ${patient.name}?`)) {
            try {
                await deleteItem('patients', patient.id);
                toast.success(`Paciente ${patient.name} eliminado`);
            } catch (error) {
                console.error(error);
                toast.error('Error al eliminar el paciente');
            }
        }
    };

    const handleViewHistory = (patient: Patient) => {
        setSelectedPatientId(patient.id);
        setPatientHistoryInitialTab('history');
        setCurrentView('patient-history');
    };

    const handleViewTasks = (patient: Patient) => {
        // Navigate to patient history with tasks tab selected
        setSelectedPatientId(patient.id);
        setPatientHistoryInitialTab('tasks');
        setCurrentView('patient-history');
    };

    // Count stats
    const activeCount = patients.filter((p) => p.isActive !== false).length;
    const inactiveCount = patients.filter((p) => p.isActive === false).length;

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Pacientes</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        {activeCount} activos · {inactiveCount} inactivos
                    </p>
                </div>
                <button
                    onClick={() => setShowAdd(true)}
                    className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 shadow-sm font-medium flex items-center gap-2"
                >
                    <Plus size={18} />
                    <span>Nuevo Paciente</span>
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                {/* Status Tabs */}
                <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setFilterStatus('active')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            filterStatus === 'active'
                                ? 'bg-white text-teal-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Activos ({activeCount})
                    </button>
                    <button
                        onClick={() => setFilterStatus('inactive')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            filterStatus === 'inactive'
                                ? 'bg-white text-slate-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Inactivos ({inactiveCount})
                    </button>
                    <button
                        onClick={() => setFilterStatus('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            filterStatus === 'all'
                                ? 'bg-white text-slate-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Todos ({patients.length})
                    </button>
                </div>

                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, email, DNI o profesional..."
                        className="w-full pl-10 pr-4 py-2.5 border rounded-xl shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="py-12">
                    <LoadingSpinner />
                </div>
            ) : (
                <PatientTable
                    patients={filteredAndSortedPatients}
                    sortBy={sortBy}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    onViewHistory={handleViewHistory}
                    onViewTasks={handleViewTasks}
                    onEdit={setEditingPatient}
                    onDelete={handleDelete}
                />
            )}

            {/* Empty state */}
            {!loading && filteredAndSortedPatients.length === 0 && patients.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
                    <div className="flex justify-center mb-4">
                        <Search size={48} className="text-slate-200" />
                    </div>
                    No se encontraron pacientes que coincidan con los filtros.
                </div>
            )}

            {/* Modals */}
            {(showAdd || editingPatient) && (
                <PatientModal
                    onClose={() => {
                        setShowAdd(false);
                        setEditingPatient(null);
                    }}
                    user={user}
                    profile={profile}
                    existingPatient={editingPatient || undefined}
                />
            )}
        </div>
    );
};
