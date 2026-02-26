import React, { useEffect, useRef } from 'react';

export const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
    </div>
);

interface ModalOverlayProps {
    children: React.ReactNode;
    onClose: () => void;
    ariaLabel?: string;
}

export const ModalOverlay = ({ children, onClose, ariaLabel }: ModalOverlayProps) => {
    const overlayRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        previousFocusRef.current = document.activeElement as HTMLElement;

        return () => {
            previousFocusRef.current?.focus();
        };
    }, []);

    useEffect(() => {
        const overlay = overlayRef.current;
        if (!overlay) return;

        const focusableSelector =
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable]:not([contenteditable="false"]), audio[controls], video[controls], iframe';

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
                return;
            }

            if (event.key !== 'Tab') {
                return;
            }

            const focusableElements = overlay.querySelectorAll<HTMLElement>(focusableSelector);
            if (focusableElements.length === 0) {
                return;
            }

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (event.shiftKey && document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
                return;
            }

            if (!event.shiftKey && document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        };

        overlay.addEventListener('keydown', handleKeyDown);

        const firstFocusable = overlay.querySelector<HTMLElement>(focusableSelector);
        if (firstFocusable) {
            firstFocusable.focus();
        }

        return () => {
            overlay.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-hidden"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel || 'Modal'}
        >
            <div className="max-w-full max-h-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>
    );
};
