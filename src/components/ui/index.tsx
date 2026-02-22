import React from 'react';

export const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
    </div>
);

export const ModalOverlay = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
    <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-hidden"
        onClick={onClose}
    >
        <div className="max-w-full max-h-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {children}
        </div>
    </div>
);
