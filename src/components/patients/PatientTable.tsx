import { Patient } from '../../types';
import { ArrowUpDown, ArrowUp, ArrowDown, FileText, ListTodo, Edit2, Trash2, User, Baby } from 'lucide-react';

type SortField = 'name' | 'age' | 'professional' | 'fee' | 'admissionDate';
type SortDirection = 'asc' | 'desc';

interface PatientTableProps {
    patients: Patient[];
    sortBy: SortField;
    sortDirection: SortDirection;
    onSort: (field: SortField) => void;
    onViewHistory: (patient: Patient) => void;
    onViewTasks: (patient: Patient) => void;
    onEdit: (patient: Patient) => void;
    onDelete: (patient: Patient) => void;
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

const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const SortHeader = ({
    label,
    field,
    currentSort,
    direction,
    onSort,
}: {
    label: string;
    field: SortField;
    currentSort: SortField;
    direction: SortDirection;
    onSort: (field: SortField) => void;
}) => (
    <th
        className="p-3 text-left font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors select-none"
        onClick={() => onSort(field)}
    >
        <div className="flex items-center gap-1">
            {label}
            {currentSort === field ? (
                direction === 'asc' ? (
                    <ArrowUp size={14} />
                ) : (
                    <ArrowDown size={14} />
                )
            ) : (
                <ArrowUpDown size={14} className="text-slate-300" />
            )}
        </div>
    </th>
);

export const PatientTable = ({
    patients,
    sortBy,
    sortDirection,
    onSort,
    onViewHistory,
    onViewTasks,
    onEdit,
    onDelete,
}: PatientTableProps) => {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <SortHeader
                                label="Nombre"
                                field="name"
                                currentSort={sortBy}
                                direction={sortDirection}
                                onSort={onSort}
                            />
                            <SortHeader
                                label="Edad"
                                field="age"
                                currentSort={sortBy}
                                direction={sortDirection}
                                onSort={onSort}
                            />
                            <SortHeader
                                label="Profesional"
                                field="professional"
                                currentSort={sortBy}
                                direction={sortDirection}
                                onSort={onSort}
                            />
                            <SortHeader
                                label="Honorarios"
                                field="fee"
                                currentSort={sortBy}
                                direction={sortDirection}
                                onSort={onSort}
                            />
                            <th className="p-3 text-left font-semibold text-slate-600">Origen</th>
                            <SortHeader
                                label="Admisión"
                                field="admissionDate"
                                currentSort={sortBy}
                                direction={sortDirection}
                                onSort={onSort}
                            />
                            <th className="p-3 text-left font-semibold text-slate-600">Estado</th>
                            <th className="p-3 text-center font-semibold text-slate-600">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {patients.map((patient) => {
                            const age = calculateAge(patient.birthDate);
                            const isChild = age !== null && age < 18;

                            return (
                                <tr key={patient.id} className="hover:bg-slate-50 transition-colors">
                                    {/* Name - Clickable to view history */}
                                    <td className="p-3">
                                        <div className="flex items-center gap-2">
                                            {isChild ? (
                                                <Baby size={16} className="text-amber-500" />
                                            ) : (
                                                <User size={16} className="text-slate-400" />
                                            )}
                                            <div>
                                                <button
                                                    onClick={() => onViewHistory(patient)}
                                                    className="font-medium text-slate-800 hover:text-teal-600 hover:underline transition-colors text-left"
                                                >
                                                    {patient.name}
                                                </button>
                                                <div className="text-xs text-slate-500">
                                                    {patient.email || patient.phone || '-'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Age */}
                                    <td className="p-3 text-slate-600">
                                        {age !== null ? (
                                            <span className={isChild ? 'text-amber-600 font-medium' : ''}>
                                                {age} años
                                            </span>
                                        ) : (
                                            '-'
                                        )}
                                    </td>

                                    {/* Professional */}
                                    <td className="p-3 text-slate-600">{patient.professional || '-'}</td>

                                    {/* Fee */}
                                    <td className="p-3">
                                        {patient.fee ? (
                                            <span className="font-medium text-slate-700">
                                                ${patient.fee.toLocaleString()}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">-</span>
                                        )}
                                    </td>

                                    {/* Source */}
                                    <td className="p-3">
                                        {patient.patientSource === 'psique' ? (
                                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                                                Psique
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded text-xs font-medium">
                                                Particular
                                            </span>
                                        )}
                                    </td>

                                    {/* Admission Date */}
                                    <td className="p-3 text-slate-600">{formatDate(patient.admissionDate)}</td>

                                    {/* Status */}
                                    <td className="p-3">
                                        {patient.isActive ? (
                                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                                Activo
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                                                {patient.dischargeType === 'clinical'
                                                    ? 'Alta Clínica'
                                                    : patient.dischargeType === 'dropout'
                                                      ? 'Abandono'
                                                      : 'Inactivo'}
                                            </span>
                                        )}
                                    </td>

                                    {/* Actions */}
                                    <td className="p-3">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => onViewHistory(patient)}
                                                className="p-1.5 text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
                                                title="Ver Historia Clínica"
                                            >
                                                <FileText size={16} />
                                            </button>
                                            <button
                                                onClick={() => onViewTasks(patient)}
                                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                title="Ver Tareas"
                                            >
                                                <ListTodo size={16} />
                                            </button>
                                            <button
                                                onClick={() => onEdit(patient)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => onDelete(patient)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {patients.length === 0 && (
                <div className="p-12 text-center text-slate-500">No hay pacientes que mostrar.</div>
            )}
        </div>
    );
};
