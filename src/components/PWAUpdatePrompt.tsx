import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

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

    const handleUpdate = async () => {
        console.log('Update button clicked, calling updateServiceWorker...');
        try {
            await updateServiceWorker(true);
            // If updateServiceWorker doesn't reload automatically, force reload
            console.log('updateServiceWorker completed, forcing reload...');
            window.location.reload();
        } catch (error) {
            console.error('Error updating service worker:', error);
            // Force reload anyway
            window.location.reload();
        }
    };

    const handleDismiss = () => {
        setNeedRefresh(false);
    };

    if (!needRefresh) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <div className="bg-slate-800 text-white rounded-lg shadow-lg px-3 py-2 flex items-center gap-3 text-sm">
                <RefreshCw className="w-4 h-4 text-teal-400" />
                <span className="text-slate-200">Nueva versión</span>
                <button
                    onClick={handleUpdate}
                    className="px-3 py-1 bg-teal-500 text-white rounded text-xs font-medium hover:bg-teal-600 transition-colors active:bg-teal-700"
                >
                    Actualizar
                </button>
                <button
                    onClick={handleDismiss}
                    className="p-1 text-slate-400 hover:text-white transition-colors"
                    aria-label="Cerrar"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
