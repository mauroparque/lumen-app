import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

// Check for updates every 60 seconds (more aggressive)
const UPDATE_CHECK_INTERVAL = 60 * 1000;

export const PWAUpdatePrompt = () => {
    const [showPrompt, setShowPrompt] = useState(false);

    const {
        needRefresh: [needRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(swUrl, registration) {
            console.log('SW Registered: ' + swUrl);

            if (registration) {
                // Check immediately on load
                registration.update();

                // Then check periodically
                setInterval(() => {
                    console.log('Checking for SW updates...');
                    registration.update();
                }, UPDATE_CHECK_INTERVAL);

                // Listen for waiting service worker
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New SW is waiting, show prompt or auto-update
                                console.log('New version available!');
                                setShowPrompt(true);
                            }
                        });
                    }
                });
            }
        },
        onRegisterError(error) {
            console.log('SW registration error', error);
        },
    });

    // Also react to needRefresh from the hook
    useEffect(() => {
        if (needRefresh) {
            console.log('needRefresh triggered');
            setShowPrompt(true);
        }
    }, [needRefresh]);

    // Listen for controller change and reload
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('Controller changed, reloading...');
                window.location.reload();
            });
        }
    }, []);

    const handleUpdate = () => {
        console.log('User clicked update, applying...');
        updateServiceWorker(true);
    };

    if (!showPrompt) return null;

    return (
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
    );
};
