import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';

// Check for updates every 10 minutes
const UPDATE_CHECK_INTERVAL = 10 * 60 * 1000;

export const PWAUpdatePrompt = () => {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(swUrl, registration) {
            console.log('SW Registered:', swUrl);

            if (registration) {
                // Check for updates periodically (every 10 minutes)
                setInterval(() => {
                    console.log('Checking for updates...');
                    registration.update();
                }, UPDATE_CHECK_INTERVAL);
            }
        },
        onRegisterError(error) {
            console.error('SW registration error:', error);
        },
    });

    const handleUpdate = () => {
        updateServiceWorker(true);
    };

    const handleDismiss = () => {
        setNeedRefresh(false);
    };

    if (!needRefresh) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <div className="bg-teal-600 text-white rounded-xl shadow-2xl p-4 max-w-sm flex items-center gap-4 animate-pulse">
                <RefreshCw className="w-6 h-6 flex-shrink-0" />
                <div className="flex-1">
                    <p className="font-semibold text-sm">Nueva versión disponible</p>
                    <p className="text-xs text-teal-100">Actualizá para obtener las últimas mejoras</p>
                </div>
                <div className="flex flex-col gap-2">
                    <button
                        onClick={handleUpdate}
                        className="px-4 py-1.5 bg-white text-teal-700 rounded-lg text-xs font-semibold hover:bg-teal-50 transition-colors"
                    >
                        Actualizar
                    </button>
                    <button
                        onClick={handleDismiss}
                        className="px-4 py-1 text-teal-200 text-xs hover:text-white transition-colors"
                    >
                        Más tarde
                    </button>
                </div>
            </div>
        </div>
    );
};
