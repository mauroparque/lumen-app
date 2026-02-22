import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, db } from '../lib/firebase';
import { Turnstile } from '@marsidev/react-turnstile';
import { ALLOWED_EMAILS_COLLECTION, STAFF_COLLECTION } from '../lib/routes';
import type { AllowedEmail } from '../types';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';

// Initialize Firebase Functions once at module level (singleton)
const firebaseFunctions = getFunctions();
const validateTurnstileCallable = httpsCallable(firebaseFunctions, 'validateTurnstile');

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
            // Validate Turnstile token server-side
            try {
                await validateTurnstileCallable({ token: turnstileToken });
            } catch (turnstileErr: any) {
                setError('La verificación de seguridad falló. Intentá de nuevo.');
                setIsLoading(false);
                return;
            }

            // Save or clear remembered email
            if (rememberMe) {
                localStorage.setItem('lumen_remembered_email', email);
            } else {
                localStorage.removeItem('lumen_remembered_email');
            }

            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Check if user already has a staff profile
            const staffRef = doc(db, STAFF_COLLECTION, user.uid);
            const staffSnap = await getDoc(staffRef);

            if (!staffSnap.exists()) {
                // Verify allowlist
                const allowedRef = doc(db, ALLOWED_EMAILS_COLLECTION, user.email!);
                const allowedSnap = await getDoc(allowedRef);

                if (!allowedSnap.exists()) {
                    // Unauthorized email — sign out and show error
                    await auth.signOut();
                    setError('Tu email no está autorizado. Contactá al administrador de la clínica.');
                    return;
                }

                const allowed = allowedSnap.data() as AllowedEmail;

                // Create staff profile with data from allowlist
                await setDoc(staffRef, {
                    uid: user.uid,
                    email: user.email,
                    name: allowed.professionalName,
                    role: allowed.role,
                    createdAt: Timestamp.now(),
                });
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

                {error && <div className="bg-red-50 text-red-500 p-3 rounded mb-4 text-sm">{error}</div>}

                <form onSubmit={handleAuth} className="space-y-4">
                    <input
                        type="email"
                        placeholder="Email"
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />

                    <input
                        type="password"
                        placeholder="Contraseña"
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />

                    {/* Remember Me Checkbox */}
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
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
                        className={`w-full py-2 rounded font-medium transition-colors ${
                            turnstileToken && !isLoading
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
