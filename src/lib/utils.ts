import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const formatPhoneNumber = (phone: string | null | undefined): string => {
    if (!phone) return '';

    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // If empty, return empty
    if (!cleaned) return '';

    // If starts with 0, replace with 549 (Argentina mobile prefix assumption)
    if (cleaned.startsWith('0')) {
        cleaned = '549' + cleaned.substring(1);
    }
    // If it doesn't have a country code (assuming standard Argentina length without country code is usually 10 digits like 11 1234 5678)
    // If it's 10 digits, preprend 549.
    else if (cleaned.length === 10) {
        cleaned = '549' + cleaned;
    }
    // If it's a local number without 15 (e.g., 8 digits), this is harder to guess, but let's assume valid mobile numbers provided.

    return cleaned;
};

export const calculateAge = (birthDate?: string): number | null => {
    if (!birthDate) return null;
    const today = new Date();
    // Usar T00:00:00 fuerza parsing como hora local en lugar de UTC midnight.
    // Evita que en TZ < 0 (ej. Argentina UTC-3) la fecha se desplace al día anterior.
    const birth = new Date(birthDate + 'T00:00:00');
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
};

export const isOverdue = (appointment: { date: string; time?: string }): boolean => {
    const now = new Date();
    const apptDateTime = new Date(appointment.date + 'T' + (appointment.time || '00:00') + ':00');
    apptDateTime.setHours(apptDateTime.getHours() + 1);
    return now > apptDateTime;
};

const AUTH_ERROR_MESSAGES: Record<string, string> = {
    'auth/user-not-found': 'No se encontró una cuenta con ese email.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/invalid-credential': 'Email o contraseña incorrectos.',
    'auth/invalid-email': 'El formato del email no es válido.',
    'auth/user-disabled': 'Esta cuenta ha sido deshabilitada.',
    'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.',
    'auth/network-request-failed': 'Error de red. Verificá tu conexión a internet.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese email.',
};

export const getAuthErrorMessage = (errorMessage: string): string => {
    const match = errorMessage.match(/\(([^)]+)\)/);
    const code = match?.[1];
    return (code && AUTH_ERROR_MESSAGES[code]) || 'Error de autenticación. Intentá de nuevo.';
};
