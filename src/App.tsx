import { useState, useEffect } from 'react';
import { onAuthStateChanged, User, signInWithCustomToken } from 'firebase/auth';
import { auth } from './lib/firebase';
import { View } from './types';

// Components
import { Sidebar } from './components/layout/Sidebar';
import { MobileHeader } from './components/layout/MobileHeader';

// Views
import { AuthScreen } from './views/AuthScreen';
import { CalendarView } from './views/CalendarView';
import { PatientsView } from './views/PatientsView';
import { FinanceView } from './views/FinanceView';

// Global declaration for initial auth token
declare global {
    var __initial_auth_token: string;
}

export default function LumenApp() {
    const [user, setUser] = useState<User | null>(null);
    const [demoUser, setDemoUser] = useState<User | null>(null);
    const activeUser = user || demoUser;

    const [currentView, setCurrentView] = useState<View>('calendar');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Auth Init
    useEffect(() => {
        const init = async () => {
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                await signInWithCustomToken(auth, __initial_auth_token);
            }
        };
        init();
        return onAuthStateChanged(auth, setUser);
    }, []);

    if (!activeUser) return <AuthScreen onDemoLogin={() => setDemoUser({ uid: 'demo-user', email: 'demo@lumen.app', displayName: 'Demo User' } as User)} />;

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
            <Sidebar
                user={activeUser}
                currentView={currentView}
                setCurrentView={setCurrentView}
            />

            <MobileHeader
                mobileMenuOpen={mobileMenuOpen}
                setMobileMenuOpen={setMobileMenuOpen}
                setCurrentView={setCurrentView}
            />

            {/* Content */}
            <main className="flex-1 overflow-auto pt-16 md:pt-0 relative">
                {currentView === 'calendar' && (
                    <CalendarView user={activeUser} />
                )}
                {currentView === 'patients' && (
                    <PatientsView user={activeUser} />
                )}
                {currentView === 'finance' && (
                    <FinanceView user={activeUser} />
                )}
            </main>
        </div>
    );
}
