import { useState, useEffect, Suspense, lazy } from 'react';
import { onAuthStateChanged, User, signInWithCustomToken } from 'firebase/auth';
import { auth } from './lib/firebase';
import type { View, StaffProfile } from './types';
import { Toaster } from 'sonner';
import { useStaff } from './hooks/useStaff';
import { ServiceProvider } from './context/ServiceContext';
import { DataProvider } from './context/DataContext';

// Components
import { Sidebar } from './components/layout/Sidebar';
import { MobileHeader } from './components/layout/MobileHeader';
import { ProfileModal } from './components/modals/ProfileModal';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt';
import { AppErrorBoundary } from './components/ErrorBoundary';

// Views - Lazy Loaded
const AuthScreen = lazy(() => import('./views/AuthScreen').then((module) => ({ default: module.AuthScreen })));
const CalendarView = lazy(() => import('./views/CalendarView').then((module) => ({ default: module.CalendarView })));
const PatientsView = lazy(() => import('./views/PatientsView').then((module) => ({ default: module.PatientsView })));
const PaymentsView = lazy(() => import('./views/PaymentsView').then((module) => ({ default: module.PaymentsView })));
const BillingView = lazy(() => import('./views/BillingView').then((module) => ({ default: module.BillingView })));
const DashboardView = lazy(() => import('./views/DashboardView').then((module) => ({ default: module.DashboardView })));
const PatientHistoryView = lazy(() =>
    import('./views/PatientHistoryView').then((module) => ({ default: module.PatientHistoryView })),
);
const TasksView = lazy(() => import('./views/TasksView').then((module) => ({ default: module.TasksView })));
const StatisticsView = lazy(() =>
    import('./views/StatisticsView').then((module) => ({ default: module.StatisticsView })),
);

// Global declaration for initial auth token
declare global {
    var __initial_auth_token: string;
}

const LoadingFallback = () => (
    <div className="h-full w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
    </div>
);

function AuthenticatedApp({ user, profile }: { user: User; profile: StaffProfile }) {
    const [currentView, setCurrentView] = useState<View>('dashboard');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [patientHistoryInitialTab, setPatientHistoryInitialTab] = useState<'history' | 'tasks'>('history');

    return (
        <ServiceProvider user={user} profile={profile}>
            <DataProvider>
                <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
                    <Toaster position="top-center" richColors />
                    <PWAUpdatePrompt />
                    <Sidebar user={user} currentView={currentView} setCurrentView={setCurrentView} />

                    <MobileHeader
                        mobileMenuOpen={mobileMenuOpen}
                        setMobileMenuOpen={setMobileMenuOpen}
                        setCurrentView={setCurrentView}
                    />

                    <main className="flex-1 overflow-auto pt-16 md:pt-0 relative">
                        <AppErrorBoundary>
                            <Suspense fallback={<LoadingFallback />}>
                                {(currentView === 'home' || currentView === 'dashboard') && (
                                    <DashboardView
                                        user={user}
                                        profile={profile}
                                        onNavigate={(view) => setCurrentView(view as View)}
                                    />
                                )}
                                {currentView === 'calendar' && <CalendarView user={user} profile={profile} />}
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
                                {currentView === 'payments' && <PaymentsView user={user} profile={profile} />}
                                {currentView === 'billing' && <BillingView />}
                                {currentView === 'tasks' && <TasksView user={user} profile={profile} />}
                                {currentView === 'statistics' && <StatisticsView user={user} />}
                            </Suspense>
                        </AppErrorBoundary>
                    </main>
                </div>
            </DataProvider>
        </ServiceProvider>
    );
}

function StaffGate({ user }: { user: User }) {
    const { profile, loading: loadingProfile, createProfile } = useStaff(user);

    if (loadingProfile) {
        return (
            <>
                <div className="h-screen flex items-center justify-center bg-slate-50">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
                </div>
                <PWAUpdatePrompt />
            </>
        );
    }

    if (!profile) {
        return (
            <>
                <ProfileModal onSubmit={createProfile} />
                <PWAUpdatePrompt />
            </>
        );
    }

    return <AuthenticatedApp user={user} profile={profile} />;
}

export default function LumenApp() {
    const [user, setUser] = useState<User | null>(null);

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

    if (!user) {
        return (
            <AppErrorBoundary>
                <Suspense
                    fallback={
                        <div className="h-screen flex items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
                        </div>
                    }
                >
                    <AuthScreen />
                    <PWAUpdatePrompt />
                </Suspense>
            </AppErrorBoundary>
        );
    }

    return (
        <AppErrorBoundary>
            <ServiceProvider user={user} profile={null}>
                <StaffGate user={user} />
            </ServiceProvider>
        </AppErrorBoundary>
    );
}
