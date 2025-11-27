import { useState } from 'react';
import { deleteDoc, doc } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { User } from 'firebase/auth';
import { Patient } from '../types';
import { Trash2 } from 'lucide-react';
import { PatientModal } from '../components/modals/PatientModal';
import { usePatients } from '../hooks/usePatients';

interface PatientsViewProps {
    user: User;
}

export const PatientsView = ({ user }: PatientsViewProps) => {
    const [showAdd, setShowAdd] = useState(false);
    const { patients } = usePatients(user);

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex justify-between mb-6"><h1 className="text-2xl font-bold">Pacientes</h1><button onClick={() => setShowAdd(true)} className="bg-teal-600 text-white px-3 py-2 rounded hover:bg-teal-700">+ Nuevo</button></div>
            <div className="bg-white rounded shadow border">
                {patients.map((p: Patient) => (
                    <div key={p.id} className="p-4 border-b flex justify-between hover:bg-slate-50">
                        <div><div className="font-bold">{p.name}</div><div className="text-sm text-slate-500">{p.email}</div></div>
                        <button onClick={() => { if (confirm('Borrar?')) deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'patients', p.id)); }} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                    </div>
                ))}
            </div>
            {showAdd && <PatientModal onClose={() => setShowAdd(false)} user={user} />}
        </div>
    );
};
