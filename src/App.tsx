import { useState, useEffect } from 'react';
import { onAuthStateChanged, User, signInWithCustomToken } from 'firebase/auth';
import { auth } from './lib/firebase';
import { View } from './types';
import { Toaster } from 'sonner';
import { useStaff } from './hooks/useStaff';
import { ServiceProvider } from './context/ServiceContext';
import { DataProvider } from './context/DataContext';

// Components
import { Sidebar } from './components/layout/Sidebar';
import { MobileHeader } from './components/layout/MobileHeader';
import { ProfileModal } from './components/modals/ProfileModal';

// Views
import { AuthScreen } from './views/AuthScreen';
import { CalendarView } from './views/CalendarView';
import { PatientsView } from './views/PatientsView';
import { PaymentsView } from './views/PaymentsView';
import { BillingView } from './views/BillingView';
import { DashboardView } from './views/DashboardView';

// Global declaration for initial auth token
declare global {
    var __initial_auth_token: string;
}

export default function LumenApp() {
    const [user, setUser] = useState<User | null>(null);
    const [demoUser, setDemoUser] = useState<User | null>(null);
    const activeUser = user || demoUser;

    const { profile, loading: loadingProfile, createProfile } = useStaff(activeUser);

    const [currentView, setCurrentView] = useState<View>('dashboard');
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

    if (loadingProfile) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    if (!profile) {
        return <ProfileModal onSubmit={createProfile} />;
    }

    return (
        <ServiceProvider user={activeUser}>
            <DataProvider>
                <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
                    <Toaster position="top-center" richColors />
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
                        {(currentView === 'home' || currentView === 'dashboard') && (
                            <DashboardView user={activeUser} profile={profile} onNavigate={(view) => setCurrentView(view as View)} />
                        )}
                        {currentView === 'calendar' && (
                            <CalendarView user={activeUser} profile={profile} />
                        )}
                        {currentView === 'patients' && (
                            <PatientsView user={activeUser} profile={profile} />
                        )}
                        {currentView === 'payments' && (
                            <PaymentsView user={activeUser} />
                        )}
                        {currentView === 'billing' && (
                            <BillingView />
                        )}
                    </main>
                </div>
            </DataProvider>
        </ServiceProvider>
    );
}
