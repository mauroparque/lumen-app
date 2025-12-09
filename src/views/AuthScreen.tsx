import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db, appId } from '../lib/firebase';
import { Turnstile } from '@marsidev/react-turnstile';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';

export const AuthScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Load remembered email on mount
    useEffect(() => {
        const savedEmail = localStorage.getItem('lumen_remembered_email');
        if (savedEmail) {
            setEmail(savedEmail);
            setRememberMe(true);
        }
    }, []);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!turnstileToken) {
            setError('Por favor, completa la verificación de seguridad.');
            return;
        }

        setIsLoading(true);

        try {
            // Save or clear remembered email
            if (rememberMe) {
                localStorage.setItem('lumen_remembered_email', email);
            } else {
                localStorage.removeItem('lumen_remembered_email');
            }

            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Lazy Creation Logic
            const userRef = doc(db, 'artifacts', appId, 'users', user.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                await setDoc(userRef, {
                    email: user.email,
                    displayName: user.displayName || 'Profesional Lumen',
                    createdAt: Timestamp.now(),
                    role: 'admin',
                    settings: { notifications: true }
                });
                console.log('Perfil creado en Firestore:', user.uid);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-8">
                <h1 className="text-2xl font-bold text-teal-600 text-center mb-6">Lumen Acceso</h1>

                {error && (
                    <div className="bg-red-50 text-red-500 p-3 rounded mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    <input
                        type="email"
                        placeholder="Email"
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                    />

                    <input
                        type="password"
                        placeholder="Contraseña"
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                    />

                    {/* Remember Me Checkbox */}
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={e => setRememberMe(e.target.checked)}
                            className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                        />
                        Recordar usuario
                    </label>

                    {/* Cloudflare Turnstile */}
                    <div className="flex justify-center">
                        <Turnstile
                            siteKey={TURNSTILE_SITE_KEY}
                            onSuccess={(token) => setTurnstileToken(token)}
                            onError={() => setTurnstileToken(null)}
                            onExpire={() => setTurnstileToken(null)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={!turnstileToken || isLoading}
                        className={`w-full py-2 rounded font-medium transition-colors ${turnstileToken && !isLoading
                                ? 'bg-teal-600 text-white hover:bg-teal-700'
                                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                            }`}
                    >
                        {isLoading ? 'Ingresando...' : 'Ingresar'}
                    </button>
                </form>
            </div>
        </div>
    );
};
