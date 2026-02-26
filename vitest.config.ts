import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()] as any,
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        restoreMocks: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'text-summary', 'lcov'],
            include: [
                // Scope reducido: solo archivos con tests reales.
                // Ampliar incrementalmente al agregar tests para más módulos.
                'src/lib/utils.ts',
                'src/lib/psiqueCalculations.ts',
                'src/hooks/useAgendaStats.ts',
                'src/hooks/usePendingTasks.ts',
                'src/services/FirebaseService.ts',
            ],
            exclude: [
                'src/test/**',
                'src/**/*.test.{ts,tsx}',
                'src/types/**',
                'src/vite-env.d.ts',
            ],
            thresholds: {
                functions: 80,
                branches: 60,
                lines: 80,
                statements: 80,
            },
        },
    },
});
