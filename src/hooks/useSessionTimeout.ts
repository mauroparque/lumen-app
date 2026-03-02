import { useEffect, useRef, useCallback } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { SESSION_TIMEOUT_MS } from '../lib/constants';

export const useSessionTimeout = (enabled: boolean) => {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resetTimer = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            timeoutRef.current = null;
            void signOut(auth).catch((err) => console.error('Session timeout signOut failed:', err));
        }, SESSION_TIMEOUT_MS);
    }, []);

    useEffect(() => {
        if (!enabled) return;

        const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const;
        events.forEach((event) => window.addEventListener(event, resetTimer));

        resetTimer();

        return () => {
            events.forEach((event) => window.removeEventListener(event, resetTimer));
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [enabled, resetTimer]);
};
