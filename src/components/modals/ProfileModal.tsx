import React, { useState } from 'react';
import { toast } from 'sonner';

interface ProfileModalProps {
    onSubmit: (data: { name: string; specialty?: string }) => Promise<void>;
}

export const ProfileModal = ({ onSubmit }: ProfileModalProps) => {
    const [name, setName] = useState('');
    const [specialty, setSpecialty] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        try {
            await onSubmit({ name, specialty });
            toast.success('¡Bienvenido a Lumen!');
        } catch (error) {
            console.error(error);
            toast.error('Error al crear el perfil');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-800 mb-2">Bienvenido a Lumen</h1>
                    <p className="text-slate-500">Para comenzar, necesitamos conocerte un poco mejor.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
                        <input
                            type="text"
                            required
                            className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                            placeholder="Ej: Dr. Juan Pérez"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Especialidad (Opcional)</label>
                        <input
                            type="text"
                            className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                            placeholder="Ej: Cardiología"
                            value={specialty}
                            onChange={(e) => setSpecialty(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold text-lg hover:bg-teal-700 transition-colors shadow-lg shadow-teal-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Creando perfil...' : 'Comenzar'}
                    </button>
                </form>
            </div>
        </div>
    );
};
