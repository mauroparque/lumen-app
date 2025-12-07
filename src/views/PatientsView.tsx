import { useState } from 'react';
import { deleteDoc, doc } from 'firebase/firestore';
import { db, appId, CLINIC_ID } from '../lib/firebase';
import { User } from 'firebase/auth';
import { Patient } from '../types';
import { Search } from 'lucide-react';
import { PatientModal } from '../components/modals/PatientModal';
import { PatientDetailsDrawer } from '../components/drawers/PatientDetailsDrawer';
import { PatientCard } from '../components/patients/PatientCard';
import { usePatients } from '../hooks/usePatients';
import { toast } from 'sonner';

import { StaffProfile } from '../types';

interface PatientsViewProps {
    user: User;
    profile: StaffProfile | null;
}

export const PatientsView = ({ user, profile }: PatientsViewProps) => {
    const [showAdd, setShowAdd] = useState(false);
    const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
    const [viewingPatient, setViewingPatient] = useState<Patient | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const { patients } = usePatients(user);

    const filteredPatients = patients.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDelete = async (e: React.MouseEvent, patient: Patient) => {
        e.stopPropagation();
        if (confirm(`¿Estás seguro de que deseas eliminar a ${patient.name}?`)) {
            try {
                await deleteDoc(doc(db, 'artifacts', appId, 'clinics', CLINIC_ID, 'patients', patient.id));
                toast.success(`Paciente ${patient.name} eliminado`);
            } catch (error) {
                console.error(error);
                toast.error('Error al eliminar el paciente');
            }
        }
    };

    const handleEdit = (e: React.MouseEvent, patient: Patient) => {
        e.stopPropagation();
        setEditingPatient(patient);
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Pacientes</h1>
                <button onClick={() => setShowAdd(true)} className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 shadow-sm font-medium flex items-center gap-2">
                    <span>+ Nuevo Paciente</span>
                </button>
            </div>

            <div className="mb-6 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                <input
                    type="text"
                    placeholder="Buscar por nombre o email..."
                    className="w-full pl-10 pr-4 py-3 border rounded-xl shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${filteredPatients.length === 0 ? 'hidden' : ''}`}>
                {filteredPatients.map((p: Patient) => (
                    <PatientCard
                        key={p.id}
                        patient={p}
                        onView={() => setViewingPatient(p)}
                        onEdit={(e) => handleEdit(e, p)}
                        onDelete={(e) => handleDelete(e, p)}
                    />
                ))}
            </div>

            {filteredPatients.length === 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
                    <div className="flex justify-center mb-4">
                        <Search size={48} className="text-slate-200" />
                    </div>
                    No se encontraron pacientes que coincidan con tu búsqueda.
                </div>
            )}

            {(showAdd || editingPatient) && (
                <PatientModal
                    onClose={() => {
                        setShowAdd(false);
                        setEditingPatient(null);
                    }}
                    user={user}
                    profile={profile}
                    existingPatient={editingPatient}
                />
            )}

            {viewingPatient && (
                <PatientDetailsDrawer
                    patient={viewingPatient}
                    onClose={() => setViewingPatient(null)}
                    user={user}
                />
            )}
        </div>
    );
};
