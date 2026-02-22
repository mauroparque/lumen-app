import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettierConfig from 'eslint-config-prettier';

export default [
    js.configs.recommended,
    {
        files: ['src/**/*.{ts,tsx}'],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: { jsx: true },
            },
            globals: {
                window: 'readonly',
                document: 'readonly',
                navigator: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                fetch: 'readonly',
                URL: 'readonly',
                File: 'readonly',
                FormData: 'readonly',
                HTMLElement: 'readonly',
                HTMLInputElement: 'readonly',
                HTMLTextAreaElement: 'readonly',
                HTMLSelectElement: 'readonly',
                KeyboardEvent: 'readonly',
                MouseEvent: 'readonly',
                Event: 'readonly',
                EventTarget: 'readonly',
                RequestInit: 'readonly',
                Response: 'readonly',
                Blob: 'readonly',
                FileReader: 'readonly',
                AbortController: 'readonly',
                structuredClone: 'readonly',
                alert: 'readonly',
                confirm: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                location: 'readonly',
                history: 'readonly',
                crypto: 'readonly',
                performance: 'readonly',
                requestAnimationFrame: 'readonly',
                cancelAnimationFrame: 'readonly',
                IntersectionObserver: 'readonly',
                ResizeObserver: 'readonly',
                MutationObserver: 'readonly',
                queueMicrotask: 'readonly',
                Map: 'readonly',
                Set: 'readonly',
                WeakMap: 'readonly',
                WeakSet: 'readonly',
                Promise: 'readonly',
                Symbol: 'readonly',
                Proxy: 'readonly',
                Reflect: 'readonly',
                BigInt: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...tseslint.configs.recommended.rules,
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

            ...reactHooks.configs.recommended.rules,

            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

            'no-unused-vars': 'off',
            'no-undef': 'off',
        },
    },
    prettierConfig,
    {
        ignores: ['dist/', 'node_modules/', 'functions/', 'scripts/', '*.config.*'],
    },
];
