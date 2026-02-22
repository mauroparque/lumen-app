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
            include: ['src/services/**', 'src/hooks/**', 'src/lib/**'],
            exclude: [
                'src/test/**',
                'src/**/*.test.{ts,tsx}',
                'src/types/**',
                'src/vite-env.d.ts',
            ],
            thresholds: {
                functions: 1,
                branches: 3,
                lines: 1,
                statements: 1,
            },
        },
    },
});
