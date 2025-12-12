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
import { PatientHistoryView } from './views/PatientHistoryView';
import { TasksView } from './views/TasksView';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt';

// Global declaration for initial auth token
declare global {
    var __initial_auth_token: string;
}

export default function LumenApp() {
    const [user, setUser] = useState<User | null>(null);

    const { profile, loading: loadingProfile, createProfile } = useStaff(user);

    const [currentView, setCurrentView] = useState<View>('dashboard');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [patientHistoryInitialTab, setPatientHistoryInitialTab] = useState<'history' | 'tasks'>('history');

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

    // PWA Update prompt - always render regardless of auth state
    const pwaPrompt = <PWAUpdatePrompt />;

    if (!user) return <><AuthScreen />{pwaPrompt}</>;

    if (loadingProfile) {
        return (
            <>
                <div className="h-screen flex items-center justify-center bg-slate-50">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
                </div>
                {pwaPrompt}
            </>
        );
    }

    if (!profile) {
        return <><ProfileModal onSubmit={createProfile} />{pwaPrompt}</>;
    }

    return (
        <ServiceProvider user={user}>
            <DataProvider>
                <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
                    <Toaster position="top-center" richColors />
                    {pwaPrompt}
                    <Sidebar
                        user={user}
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
                            <DashboardView user={user} profile={profile} onNavigate={(view) => setCurrentView(view as View)} />
                        )}
                        {currentView === 'calendar' && (
                            <CalendarView user={user} profile={profile} />
                        )}
                        {currentView === 'patients' && (
                            <PatientsView
                                user={user}
                                profile={profile}
                                setCurrentView={setCurrentView}
                                setSelectedPatientId={setSelectedPatientId}
                                setPatientHistoryInitialTab={setPatientHistoryInitialTab}
                            />
                        )}
                        {currentView === 'patient-history' && (
                            <PatientHistoryView
                                user={user}
                                profile={profile}
                                patientId={selectedPatientId}
                                setCurrentView={setCurrentView}
                                initialTab={patientHistoryInitialTab}
                            />
                        )}
                        {currentView === 'payments' && (
                            <PaymentsView user={user} />
                        )}
                        {currentView === 'billing' && (
                            <BillingView />
                        )}
                        {currentView === 'tasks' && (
                            <TasksView user={user} profile={profile} />
                        )}
                    </main>
                </div>
            </DataProvider>
        </ServiceProvider>
    );
}

