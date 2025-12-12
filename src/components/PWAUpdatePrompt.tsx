import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

// Check for updates every 30 seconds for debugging
const UPDATE_CHECK_INTERVAL = 30 * 1000;

// Debug logger with timestamp
const log = (message: string, data?: any) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[PWA ${timestamp}] ${message}`, data || '');
};

export const PWAUpdatePrompt = () => {
    const [showPrompt, setShowPrompt] = useState(false);
    const [debugInfo, setDebugInfo] = useState<string[]>([]);

    const addDebug = useCallback((msg: string) => {
        log(msg);
        setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
    }, []);

    const {
        needRefresh: [needRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(swUrl, registration) {
            addDebug(`SW Registered at: ${swUrl}`);

            if (!registration) {
                addDebug('ERROR: No registration object!');
                return;
            }

            addDebug(`SW state: installing=${!!registration.installing}, waiting=${!!registration.waiting}, active=${!!registration.active}`);

            // If there's already a waiting SW, show prompt
            if (registration.waiting) {
                addDebug('Found WAITING SW on load - showing prompt');
                setShowPrompt(true);
            }

            // Check immediately on load
            addDebug('Calling update() immediately...');
            registration.update().then(() => {
                addDebug('update() completed');
            }).catch(err => {
                addDebug(`update() error: ${err.message}`);
            });

            // Then check periodically
            setInterval(() => {
                addDebug('Periodic check - calling update()...');
                registration.update().then(() => {
                    addDebug('Periodic update() completed');
                    addDebug(`After update - waiting=${!!registration.waiting}, installing=${!!registration.installing}`);
                    if (registration.waiting) {
                        addDebug('FOUND WAITING SW after periodic check!');
                        setShowPrompt(true);
                    }
                }).catch(err => {
                    addDebug(`Periodic update() error: ${err.message}`);
                });
            }, UPDATE_CHECK_INTERVAL);

            // Listen for new service worker installation
            registration.addEventListener('updatefound', () => {
                addDebug('EVENT: updatefound - new SW is being installed');
                const newWorker = registration.installing;

                if (newWorker) {
                    addDebug(`New worker state: ${newWorker.state}`);

                    newWorker.addEventListener('statechange', () => {
                        addDebug(`New worker statechange: ${newWorker.state}`);

                        if (newWorker.state === 'installed') {
                            addDebug('New worker is INSTALLED');
                            if (navigator.serviceWorker.controller) {
                                addDebug('There is a controller - new version available!');
                                setShowPrompt(true);
                            } else {
                                addDebug('No controller - this is first install');
                            }
                        }

                        if (newWorker.state === 'activated') {
                            addDebug('New worker ACTIVATED');
                        }
                    });
                }
            });
        },
        onRegisterError(error) {
            addDebug(`SW registration ERROR: ${error}`);
        },
    });

    // React to needRefresh from the hook
    useEffect(() => {
        if (needRefresh) {
            addDebug('Hook needRefresh changed to TRUE');
            setShowPrompt(true);
        }
    }, [needRefresh, addDebug]);

    // Listen for controller change
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            const handler = () => {
                addDebug('EVENT: controllerchange - reloading page...');
                window.location.reload();
            };
            navigator.serviceWorker.addEventListener('controllerchange', handler);
            addDebug('Added controllerchange listener');

            // Log current SW status
            navigator.serviceWorker.ready.then(reg => {
                addDebug(`Current SW ready - active: ${!!reg.active}, waiting: ${!!reg.waiting}`);
            });

            return () => navigator.serviceWorker.removeEventListener('controllerchange', handler);
        }
    }, [addDebug]);

    const handleUpdate = () => {
        addDebug('User clicked UPDATE button');
        addDebug('Calling updateServiceWorker(true)...');
        updateServiceWorker(true);
    };

    // Always show debug panel in development
    const showDebug = true; // Change to false in production

    return (
        <>
            {/* Debug Panel - Fixed at top */}
            {showDebug && (
                <div className="fixed top-0 left-0 right-0 z-[100] bg-slate-900 text-green-400 text-xs font-mono p-2 max-h-32 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertCircle size={14} />
                        <span className="font-bold">PWA Debug (showPrompt: {showPrompt ? 'YES' : 'NO'})</span>
                    </div>
                    {debugInfo.slice(-8).map((msg, i) => (
                        <div key={i} className="text-[10px] opacity-80">{msg}</div>
                    ))}
                </div>
            )}

            {/* Update Prompt */}
            {showPrompt && (
                <div className="fixed bottom-4 right-4 z-50 animate-pulse">
                    <div className="bg-teal-600 text-white rounded-xl shadow-2xl p-4 max-w-sm flex items-center gap-4">
                        <RefreshCw className="w-6 h-6 flex-shrink-0" />
                        <div className="flex-1">
                            <p className="font-semibold text-sm">Nueva versión disponible</p>
                            <p className="text-xs text-teal-100">Hacé clic para actualizar</p>
                        </div>
                        <button
                            onClick={handleUpdate}
                            className="px-4 py-2 bg-white text-teal-700 rounded-lg text-sm font-semibold hover:bg-teal-50 transition-colors"
                        >
                            Actualizar
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
