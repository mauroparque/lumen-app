import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

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
                ...globals.browser,
                ...globals.es2021,
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
