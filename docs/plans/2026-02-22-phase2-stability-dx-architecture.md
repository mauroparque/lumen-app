# Phase 2: Estabilidad, DX y Arquitectura — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Origen:** [Auditoría 2026-02-19](../audits/2026-02-19_AUDIT.md) — hallazgos LINT-01, TSC-01, ARCH-01, HOOK-01, TEST-01
**Fase anterior:** [2026-02-22_phase1-completion-review.md](../reviews/2026-02-22_phase1-completion-review.md) — Priorización de deuda técnica pendiente

**Goal:** Establecer tooling de calidad (ESLint, Prettier, type-check en build), agregar ErrorBoundary para resiliencia, consolidar toda la lógica de datos en `IDataService`/`FirebaseService` eliminando accesos directos a Firestore desde hooks y componentes, y establecer la base de testing con cobertura mínima para la lógica de negocio.

**Architecture:** Extender `IDataService` con operaciones de clinical notes, tasks, psique payments, y patient data. Implementar en `FirebaseService`. Refactorizar hooks para consumir la abstracción del service layer en vez de Firestore directo. Extraer hooks anidados de `useClinicalNotes` como funciones top-level.

**Tech Stack:** ESLint 9 (flat config) + `@typescript-eslint` + `eslint-plugin-react-hooks`, Prettier, Vitest con cobertura `v8`, `react-error-boundary`.

---

## Scope — Hallazgos de auditoría cubiertos

| ID | Hallazgo | Task(s) |
| --- | --- | --- |
| LINT-01 | Sin ESLint ni linting | Task 1 |
| TSC-01 | Sin `tsc --noEmit` en pipeline | Task 2 |
| ARCH-01 | 5+ hooks bypasean `IDataService` | Tasks 5–10 |
| HOOK-01 | `useClinicalNotes` viola Rules of Hooks | Task 7 |
| TEST-01 | Cobertura ~6%, 0% lógica de negocio | Tasks 11–13 |
| — | Sin `ErrorBoundary` (App.tsx) | Task 3 |
| — | `.gitignore` no excluye artifacts de test | Task 2 |
| — | Vitest sin configuración de coverage | Task 4 |

### Fuera de scope (Fase 3)

| ID | Hallazgo | Razón |
| --- | --- | --- |
| DATA-01 | Ventana de datos stale | Requiere cambio en DataContext — mejor con test coverage establecida |
| BUILD-01 | Bundle 693KB sin code splitting | Optimización post-refactor |
| A11Y-01 | Modals sin accesibilidad | Requiere refactor de ModalOverlay y todos los consumidores |
| `useStaff.ts` | Acceso directo a Firestore | Se usa fuera de `ServiceProvider` — requiere reestructuración del árbol de componentes |

---

## Tabla de archivos afectados (referencia rápida)

| Archivo | Acción | Task |
| --- | --- | --- |
| `eslint.config.js` | Create | 1 |
| `.prettierrc` | Create | 1 |
| `package.json` | Modify | 1, 2, 4 |
| `.gitignore` | Modify | 2 |
| `tsconfig.json` | (sin cambios — `noEmit: true` ya existe) | — |
| `src/components/ErrorBoundary.tsx` | Create | 3 |
| `src/App.tsx` | Modify | 3 |
| `vitest.config.ts` | Modify | 4 |
| `src/services/IDataService.ts` | Modify | 5 |
| `src/services/FirebaseService.ts` | Modify | 6 |
| `src/hooks/useClinicalNotes.ts` | Rewrite | 7 |
| `src/hooks/usePendingTasks.ts` | Modify | 8 |
| `src/views/TasksView.tsx` | Modify | 8 |
| `src/components/modals/AddTaskModal.tsx` | Modify | 8 |
| `src/hooks/usePsiquePayments.ts` | Modify | 9 |
| `src/hooks/usePatientData.ts` | Modify | 10 |
| `src/services/__tests__/FirebaseService.test.ts` | Create | 11 |
| `src/hooks/__tests__/usePsiquePayments.test.ts` | Create | 12 |
| `src/hooks/__tests__/useAgendaStats.test.ts` | Create | 12 |
| `src/lib/__tests__/utils.test.ts` | Modify | 13 |

---

## Task 1: ESLint + Prettier

### Archivos

- Create: `eslint.config.js`
- Create: `.prettierrc`
- Modify: `package.json` (devDependencies + scripts)

### Step 1: Instalar dependencias

```bash
npm install -D eslint @eslint/js @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-react-hooks eslint-plugin-react-refresh prettier eslint-config-prettier
```

### Step 2: Crear `eslint.config.js` (flat config, ESLint 9)

```javascript
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

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
        },
        plugins: {
            '@typescript-eslint': tseslint,
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            // TypeScript
            ...tseslint.configs.recommended.rules,
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

            // React Hooks — critical for HOOK-01
            ...reactHooks.configs.recommended.rules,

            // React Refresh
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

            // Disable base rules overridden by TS
            'no-unused-vars': 'off',
            'no-undef': 'off',
        },
    },
    {
        ignores: ['dist/', 'node_modules/', 'functions/', 'scripts/', '*.config.*'],
    },
];
```

### Step 3: Crear `.prettierrc`

```json
{
    "semi": true,
    "singleQuote": true,
    "tabWidth": 4,
    "trailingComma": "all",
    "printWidth": 120,
    "bracketSpacing": true,
    "arrowParens": "always"
}
```

### Step 4: Agregar scripts a `package.json`

Agregar a `"scripts"`:

```json
"lint": "eslint src/",
"lint:fix": "eslint src/ --fix",
"format": "prettier --write \"src/**/*.{ts,tsx,css}\"",
"format:check": "prettier --check \"src/**/*.{ts,tsx,css}\""
```

### Step 5: Ejecutar lint para ver errores actuales (no fix)

```bash
npm run lint
```

Expected: Múltiples warnings de `@typescript-eslint/no-explicit-any` y posiblemente errores de hooks. Esto es esperado — NO corregir todo ahora, solo documentar. El objetivo es que el linter esté activo para código nuevo.

### Step 6: Fix automático de formato

```bash
npm run format
```

Expected: Se formatean todos los archivos bajo `src/` según las reglas de Prettier. Verificar que no rompe nada con `npm run build`.

### Step 7: Commit

```bash
git add eslint.config.js .prettierrc package.json package-lock.json
git commit -m "feat: add ESLint 9 + Prettier configuration (LINT-01)"
```

---

## Task 2: Type-check script + .gitignore cleanup

### Archivos

- Modify: `package.json` (scripts)
- Modify: `.gitignore`

### Step 1: Agregar script `type-check` a `package.json`

En `"scripts"`, agregar:

```json
"type-check": "tsc --noEmit"
```

### Step 2: Agregar script `ci` compuesto

```json
"ci": "npm run type-check && npm run lint && npm test -- --run && npm run build"
```

> `--run` ejecuta vitest en modo no-watch (single run).

### Step 3: Ejecutar type-check para verificar estado actual

```bash
npm run type-check
```

Expected: Puede haber 1 error pre-existente en `usePatients.ts` (parámetro `user` no utilizado). Si existe, corregir prefijando con `_`:

En `src/hooks/usePatients.ts`, cambiar el parámetro no utilizado:

```typescript
// ANTES
export function usePatients(user: User) {
// DESPUÉS
export function usePatients(_user: User) {
```

### Step 4: Agregar artifacts de test al `.gitignore`

Al final de `.gitignore`, agregar:

```gitignore
# Test artifacts
playwright-report/
test-results/
coverage/
```

### Step 5: Eliminar artifacts commiteados

```bash
git rm -r --cached playwright-report/ test-results/ 2>/dev/null || true
```

### Step 6: Commit

```bash
git add package.json .gitignore src/hooks/usePatients.ts
git commit -m "feat: add type-check and ci scripts, clean .gitignore (TSC-01)"
```

---

## Task 3: ErrorBoundary global

### Archivos

- Create: `src/components/ErrorBoundary.tsx`
- Modify: `src/App.tsx`

### Step 1: Instalar `react-error-boundary`

```bash
npm install react-error-boundary
```

### Step 2: Crear `src/components/ErrorBoundary.tsx`

```tsx
import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
                <div className="text-red-500 text-4xl mb-4">⚠️</div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                    Algo salió mal
                </h2>
                <p className="text-gray-600 mb-4">
                    Ocurrió un error inesperado. Podés intentar recargar la página.
                </p>
                {import.meta.env.DEV && (
                    <pre className="text-left text-xs bg-gray-100 p-3 rounded mb-4 overflow-auto max-h-40">
                        {error.message}
                    </pre>
                )}
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={resetErrorBoundary}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                    >
                        Reintentar
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                        Recargar página
                    </button>
                </div>
            </div>
        </div>
    );
}

interface AppErrorBoundaryProps {
    children: React.ReactNode;
}

export function AppErrorBoundary({ children }: AppErrorBoundaryProps) {
    return (
        <ReactErrorBoundary
            FallbackComponent={ErrorFallback}
            onReset={() => {
                // Reset app state if needed — for now just re-render
            }}
            onError={(error, info) => {
                console.error('Uncaught error:', error, info);
            }}
        >
            {children}
        </ReactErrorBoundary>
    );
}
```

### Step 3: Envolver el contenido principal de `App.tsx` con `AppErrorBoundary`

En `src/App.tsx`, agregar import:

```typescript
import { AppErrorBoundary } from './components/ErrorBoundary';
```

Envolver el `<Suspense>` del contenido autenticado con `<AppErrorBoundary>`:

```tsx
// ANTES (en la rama autenticada, ~línea 99):
<Suspense fallback={<LoadingFallback />}>
    {/* vista actual */}
</Suspense>

// DESPUÉS:
<AppErrorBoundary>
    <Suspense fallback={<LoadingFallback />}>
        {/* vista actual */}
    </Suspense>
</AppErrorBoundary>
```

También envolver el `<Suspense>` de `<AuthScreen>` (~línea 68):

```tsx
// ANTES:
<Suspense fallback={<LoadingFallback />}>
    <AuthScreen />
</Suspense>

// DESPUÉS:
<AppErrorBoundary>
    <Suspense fallback={<LoadingFallback />}>
        <AuthScreen />
    </Suspense>
</AppErrorBoundary>
```

### Step 4: Verificar build

```bash
npm run build
```

Expected: Build exitoso.

### Step 5: Commit

```bash
git add src/components/ErrorBoundary.tsx src/App.tsx package.json package-lock.json
git commit -m "feat: add ErrorBoundary with retry UI around Suspense boundaries"
```

---

## Task 4: Configurar cobertura en Vitest

### Archivos

- Modify: `vitest.config.ts`
- Modify: `package.json` (script)

### Step 1: Instalar provider de cobertura

```bash
npm install -D @vitest/coverage-v8
```

### Step 2: Agregar configuración de coverage a `vitest.config.ts`

```typescript
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
                // Umbrales iniciales — subir gradualmente
                functions: 30,
                branches: 30,
                lines: 20,
                statements: 20,
            },
        },
    },
});
```

### Step 3: Agregar script de coverage a `package.json`

```json
"test:coverage": "vitest run --coverage"
```

### Step 4: Ejecutar para ver cobertura actual

```bash
npm run test:coverage
```

Expected: Cobertura baja (~5-10%). Los thresholds iniciales son deliberadamente bajos para no romper CI. Se subirán después de agregar tests en Tasks 11-13.

### Step 5: Commit

```bash
git add vitest.config.ts package.json
git commit -m "feat: configure Vitest coverage with v8 provider and initial thresholds"
```

---

## Task 5: Expandir `IDataService` con operaciones faltantes

### Archivos

- Modify: `src/services/IDataService.ts`
- Modify: `src/types/index.ts` (agregar `ClinicalNoteInput` y `TaskInput`)

### Step 1: Agregar tipos de input faltantes en `src/types/index.ts`

Después de los tipos existentes de input (`PatientInput`, `AppointmentInput`, `PaymentInput`), agregar:

```typescript
// Input type for clinical notes — omit id and server-generated fields
export type ClinicalNoteInput = Omit<ClinicalNote, 'id'>;

// Input type for standalone tasks (notes with type 'task')
export interface TaskInput {
    patientId: string;
    professional: string;
    content: string;
    createdBy: string;
}
```

> **Nota:** Verificar los campos exactos de `ClinicalNote` en `src/types/index.ts` antes de implementar. Si `ClinicalNote` no tiene `id` como campo (sino como doc ID), ajustar el input type.

### Step 2: Expandir interfaz `IDataService`

En `src/services/IDataService.ts`, agregar después de las operaciones existentes:

```typescript
// --- Clinical Notes ---
subscribeToClinicalNote(noteId: string, onData: (note: ClinicalNote | null) => void): () => void;
subscribeToPatientNotes(patientId: string, onData: (notes: ClinicalNote[]) => void): () => void;
saveNote(note: ClinicalNoteInput): Promise<string>;
updateNote(noteId: string, updates: Partial<ClinicalNote>): Promise<void>;
uploadNoteAttachment(noteId: string, file: File): Promise<string>;

// --- Tasks ---
completeTask(noteId: string, taskIndex: number): Promise<void>;
addTask(task: TaskInput): Promise<string>;

// --- Psique Payments ---
subscribeToPsiquePayments(onData: (payments: PsiquePayment[]) => void): () => void;
markPsiquePaymentAsPaid(monthKey: string, data: Partial<PsiquePayment>): Promise<void>;

// --- Patient-specific data ---
subscribeToPatientAppointments(patientId: string, onData: (appointments: Appointment[]) => void): () => void;
subscribeToPatientPayments(patientId: string, onData: (payments: Payment[]) => void): () => void;
```

### Step 3: Agregar imports de tipos nuevos al archivo de interfaz

```typescript
import type { Patient, PatientInput, Appointment, AppointmentInput, Payment, PaymentInput, ClinicalNote, ClinicalNoteInput, TaskInput, PsiquePayment, PatientBillingData } from '../types';
```

### Step 4: Verificar que TypeScript reporta los nuevos métodos como faltantes en `FirebaseService`

```bash
npm run type-check
```

Expected: Errores en `FirebaseService.ts` porque los nuevos métodos no están implementados. Esto es correcto — se implementan en Task 6.

### Step 5: Commit

```bash
git add src/services/IDataService.ts src/types/index.ts
git commit -m "feat: expand IDataService with clinical notes, tasks, psique, patient data ops (ARCH-01)"
```

---

## Task 6: Implementar nuevos métodos en `FirebaseService`

### Archivos

- Modify: `src/services/FirebaseService.ts`

### Step 1: Agregar imports necesarios

En `FirebaseService.ts`, agregar a los imports de Firestore:

```typescript
import { addDoc, updateDoc, arrayUnion } from 'firebase/firestore';
```

E imports de routes:

```typescript
import { NOTES_COLLECTION, PSIQUE_PAYMENTS_COLLECTION } from '../lib/routes';
```

E imports de Firebase Storage (si no están):

```typescript
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
```

E imports de tipos:

```typescript
import type { ClinicalNote, ClinicalNoteInput, TaskInput, PsiquePayment } from '../types';
```

### Step 2: Implementar `subscribeToClinicalNote`

```typescript
subscribeToClinicalNote(noteId: string, onData: (note: ClinicalNote | null) => void): () => void {
    const noteRef = doc(db, NOTES_COLLECTION, noteId);
    return onSnapshot(noteRef, (snap) => {
        if (snap.exists()) {
            onData({ id: snap.id, ...snap.data() } as ClinicalNote);
        } else {
            onData(null);
        }
    });
}
```

### Step 3: Implementar `subscribeToPatientNotes`

```typescript
subscribeToPatientNotes(patientId: string, onData: (notes: ClinicalNote[]) => void): () => void {
    const q = query(
        collection(db, NOTES_COLLECTION),
        where('patientId', '==', patientId),
        orderBy('date', 'desc')
    );
    return onSnapshot(q, (snap) => {
        const notes = snap.docs.map(d => ({ id: d.id, ...d.data() } as ClinicalNote));
        onData(notes);
    });
}
```

### Step 4: Implementar `saveNote`

```typescript
async saveNote(note: ClinicalNoteInput): Promise<string> {
    const colRef = collection(db, NOTES_COLLECTION);
    const docRef = await addDoc(colRef, {
        ...note,
        createdAt: Timestamp.now(),
    });
    return docRef.id;
}
```

### Step 5: Implementar `updateNote`

```typescript
async updateNote(noteId: string, updates: Partial<ClinicalNote>): Promise<void> {
    const noteRef = doc(db, NOTES_COLLECTION, noteId);
    await updateDoc(noteRef, {
        ...updates,
        updatedAt: Timestamp.now(),
    });
}
```

### Step 6: Implementar `uploadNoteAttachment`

```typescript
async uploadNoteAttachment(noteId: string, file: File): Promise<string> {
    const storage = getStorage();
    const storageRef = ref(storage, `notes/${noteId}/${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    // Update note with attachment URL
    const noteRef = doc(db, NOTES_COLLECTION, noteId);
    await updateDoc(noteRef, {
        attachments: arrayUnion(url),
    });

    return url;
}
```

### Step 7: Implementar `completeTask`

```typescript
async completeTask(noteId: string, taskIndex: number): Promise<void> {
    const noteRef = doc(db, NOTES_COLLECTION, noteId);
    const snap = await getDoc(noteRef);
    if (!snap.exists()) throw new Error('Note not found');

    const data = snap.data();
    const tasks = [...(data.tasks || [])];
    if (taskIndex >= 0 && taskIndex < tasks.length) {
        tasks[taskIndex] = { ...tasks[taskIndex], completed: true, completedAt: Timestamp.now() };
        await updateDoc(noteRef, { tasks });
    }
}
```

### Step 8: Implementar `addTask`

```typescript
async addTask(task: TaskInput): Promise<string> {
    const colRef = collection(db, NOTES_COLLECTION);
    const docRef = await addDoc(colRef, {
        ...task,
        type: 'task',
        createdAt: Timestamp.now(),
        tasks: [{ content: task.content, completed: false }],
    });
    return docRef.id;
}
```

### Step 9: Implementar `subscribeToPsiquePayments`

```typescript
subscribeToPsiquePayments(onData: (payments: PsiquePayment[]) => void): () => void {
    const q = this.professionalName
        ? query(
            collection(db, PSIQUE_PAYMENTS_COLLECTION),
            where('professional', '==', this.professionalName)
        )
        : query(collection(db, PSIQUE_PAYMENTS_COLLECTION));

    return onSnapshot(q, (snap) => {
        const payments = snap.docs.map(d => ({ id: d.id, ...d.data() } as PsiquePayment));
        onData(payments);
    });
}
```

### Step 10: Implementar `markPsiquePaymentAsPaid`

```typescript
async markPsiquePaymentAsPaid(monthKey: string, data: Partial<PsiquePayment>): Promise<void> {
    const docRef = doc(db, PSIQUE_PAYMENTS_COLLECTION, monthKey);
    await setDoc(docRef, { ...data, paidAt: Timestamp.now() }, { merge: true });
}
```

### Step 11: Implementar `subscribeToPatientAppointments`

```typescript
subscribeToPatientAppointments(patientId: string, onData: (appointments: Appointment[]) => void): () => void {
    const q = query(
        collection(db, APPOINTMENTS_COLLECTION),
        where('patientId', '==', patientId),
        orderBy('date', 'desc')
    );
    return onSnapshot(q, (snap) => {
        const appointments = snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));
        onData(appointments);
    });
}
```

### Step 12: Implementar `subscribeToPatientPayments`

```typescript
subscribeToPatientPayments(patientId: string, onData: (payments: Payment[]) => void): () => void {
    const q = query(
        collection(db, PAYMENTS_COLLECTION),
        where('patientId', '==', patientId),
        orderBy('date', 'desc')
    );
    return onSnapshot(q, (snap) => {
        const payments = snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment));
        onData(payments);
    });
}
```

### Step 13: Verificar que TypeScript compila

```bash
npm run type-check
```

Expected: Sin errores — `FirebaseService` ahora implementa todos los métodos de `IDataService`.

### Step 14: Commit

```bash
git add src/services/FirebaseService.ts
git commit -m "feat: implement clinical notes, tasks, psique, patient data in FirebaseService (ARCH-01)"
```

---

## Task 7: Refactorizar `useClinicalNotes` — Fix HOOK-01

### Archivos

- Rewrite: `src/hooks/useClinicalNotes.ts`

### Problema actual

`useClinicalNotes` es un hook que **retorna** dos hooks internos (`useClinicalNote` y `usePatientNotes`). Esto viola las Rules of Hooks: React no puede garantizar orden estable de hooks cuando se llaman condicionalmente como funciones retornadas. Además, accede a Firestore directamente.

### Step 1: Reescribir como tres hooks independientes top-level

Reemplazar todo el contenido de `src/hooks/useClinicalNotes.ts` con:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useService } from '../context/ServiceContext';
import type { ClinicalNote, ClinicalNoteInput } from '../types';

/**
 * Subscribe to a single clinical note by ID.
 * Returns the note, loading state, and save/upload functions.
 */
export function useClinicalNote(noteId: string | null) {
    const { service } = useService();
    const [note, setNote] = useState<ClinicalNote | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!service || !noteId) {
            setNote(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        const unsub = service.subscribeToClinicalNote(noteId, (data) => {
            setNote(data);
            setLoading(false);
        });
        return unsub;
    }, [service, noteId]);

    const saveNote = useCallback(async (noteData: ClinicalNoteInput) => {
        if (!service) throw new Error('Service not available');
        return service.saveNote(noteData);
    }, [service]);

    const updateNote = useCallback(async (id: string, updates: Partial<ClinicalNote>) => {
        if (!service) throw new Error('Service not available');
        return service.updateNote(id, updates);
    }, [service]);

    const uploadAttachment = useCallback(async (id: string, file: File) => {
        if (!service) throw new Error('Service not available');
        return service.uploadNoteAttachment(id, file);
    }, [service]);

    return { note, loading, saveNote, updateNote, uploadAttachment };
}

/**
 * Subscribe to all clinical notes for a patient.
 */
export function usePatientNotes(patientId: string | null) {
    const { service } = useService();
    const [notes, setNotes] = useState<ClinicalNote[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!service || !patientId) {
            setNotes([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        const unsub = service.subscribeToPatientNotes(patientId, (data) => {
            setNotes(data);
            setLoading(false);
        });
        return unsub;
    }, [service, patientId]);

    return { notes, loading };
}
```

> **Nota:** El viejo export `useClinicalNotes` que retornaba `{ useClinicalNote, usePatientNotes }` ya no existe. Los consumidores deben importar los hooks directamente.

### Step 2: Actualizar imports en consumidores

Buscar todos los archivos que importan de `useClinicalNotes` y actualizar. Los consumidores típicos usan:

```typescript
// ANTES:
import { useClinicalNotes } from '../hooks/useClinicalNotes';
const { useClinicalNote, usePatientNotes } = useClinicalNotes();
const { note, loading, saveNote } = useClinicalNote(noteId);

// DESPUÉS:
import { useClinicalNote, usePatientNotes } from '../hooks/useClinicalNotes';
const { note, loading, saveNote, updateNote, uploadAttachment } = useClinicalNote(noteId);
```

Archivos a verificar (usar `grep -r "useClinicalNotes" src/`):

- `src/components/modals/AppointmentDetailsModal.tsx`
- Cualquier otra vista que use notas clínicas

### Step 3: Verificar que ESLint no reporta violación de hooks

```bash
npm run lint -- --filter src/hooks/useClinicalNotes.ts
```

Expected: Sin errores de `react-hooks/rules-of-hooks`.

### Step 4: Type-check

```bash
npm run type-check
```

Expected: Sin errores de tipos (los consumidores actualizados usan la nueva API).

### Step 5: Commit

```bash
git add src/hooks/useClinicalNotes.ts src/components/modals/AppointmentDetailsModal.tsx
git commit -m "fix: extract nested hooks from useClinicalNotes as top-level hooks (HOOK-01)"
```

---

## Task 8: Migrar `usePendingTasks`, `TasksView`, `AddTaskModal` a IDataService

### Archivos

- Modify: `src/hooks/usePendingTasks.ts`
- Modify: `src/views/TasksView.tsx`
- Modify: `src/components/modals/AddTaskModal.tsx`
- Modify: `src/hooks/useDataActions.ts` (agregar `completeTask` y `addTask`)

### Step 1: Agregar `completeTask` y `addTask` a `useDataActions`

En `src/hooks/useDataActions.ts`, agregar:

```typescript
const completeTask = async (noteId: string, taskIndex: number) => {
    const svc = ensureService();
    return svc.completeTask(noteId, taskIndex);
};

const addTask = async (task: TaskInput) => {
    const svc = ensureService();
    return svc.addTask(task);
};
```

Y agregarlos al objeto retornado. Agregar import de `TaskInput` desde `../types`.

### Step 2: Refactorizar `usePendingTasks.ts`

Eliminar imports directos de Firestore (`collection`, `onSnapshot`, `doc`, `getDoc`, `updateDoc`, `db`, `appId`, `CLINIC_ID`).

Reemplazar la suscripción directa con `service.subscribeToPatientNotes()` o una función de service dedicada. Si `usePendingTasks` necesita escuchar todas las notas que son tareas pendientes, considerar agregar un método `subscribeToTasks(patientIds, onData)` a `IDataService` o reutilizar la suscripción existente y filtrar client-side.

```typescript
import { useState, useEffect, useMemo } from 'react';
import { useService } from '../context/ServiceContext';
import { useData } from '../context/DataContext';
import type { ClinicalNote } from '../types';

export function usePendingTasks() {
    const { service } = useService();
    const { patients } = useData();
    const [allNotes, setAllNotes] = useState<ClinicalNote[]>([]);

    const myPatientIds = useMemo(
        () => new Set(patients.map(p => p.id)),
        [patients]
    );

    useEffect(() => {
        if (!service || myPatientIds.size === 0) return;

        // Subscribe to notes for each patient — or use a collection group query
        // For now, subscribe per patient and merge results
        const unsubs: (() => void)[] = [];
        const notesMap = new Map<string, ClinicalNote[]>();

        for (const patientId of myPatientIds) {
            const unsub = service.subscribeToPatientNotes(patientId, (notes) => {
                notesMap.set(patientId, notes);
                const all = Array.from(notesMap.values()).flat();
                setAllNotes(all);
            });
            unsubs.push(unsub);
        }

        return () => unsubs.forEach(u => u());
    }, [service, myPatientIds]);

    const pendingTasks = useMemo(() => {
        return allNotes
            .filter(n => n.tasks?.some(t => !t.completed))
            .map(n => ({
                noteId: n.id,
                patientId: n.patientId,
                tasks: (n.tasks || []).filter(t => !t.completed),
                patient: patients.find(p => p.id === n.patientId),
            }));
    }, [allNotes, patients]);

    return { pendingTasks, loading: false };
}
```

> **Nota:** Si la colección de notas es grande y la estrategia por-paciente genera demasiadas suscripciones, considerar agregar un método dedicado `subscribeToPendingTasks` a `IDataService` con un query `where('tasks', 'array-contains', ...)`. Evaluar en producción.

### Step 3: Refactorizar `TasksView.tsx`

Eliminar imports directos de Firestore:

```typescript
// ELIMINAR estas líneas:
import { collection, addDoc, updateDoc, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db, appId, CLINIC_ID } from '../lib/firebase';
```

Reemplazar con:

```typescript
import { useDataActions } from '../hooks/useDataActions';
```

Y usar `addTask` / `completeTask` de `useDataActions()` en lugar de `addDoc` / `updateDoc` directos.

### Step 4: Refactorizar `AddTaskModal.tsx`

Eliminar imports directos de Firestore:

```typescript
// ELIMINAR:
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, appId, CLINIC_ID } from '../../lib/firebase';
```

Reemplazar con:

```typescript
import { useDataActions } from '../../hooks/useDataActions';
```

Reemplazar el `handleSubmit` que hace `addDoc` directo con `addTask()` de `useDataActions()`.

### Step 5: Type-check + lint

```bash
npm run type-check && npm run lint
```

Expected: Sin errores.

### Step 6: Commit

```bash
git add src/hooks/usePendingTasks.ts src/hooks/useDataActions.ts src/views/TasksView.tsx src/components/modals/AddTaskModal.tsx
git commit -m "refactor: migrate tasks/pending tasks from direct Firestore to IDataService (ARCH-01)"
```

---

## Task 9: Migrar `usePsiquePayments` a IDataService

### Archivos

- Modify: `src/hooks/usePsiquePayments.ts`
- Modify: `src/hooks/useDataActions.ts` (agregar `markPsiquePaymentAsPaid`)

### Step 1: Agregar `markPsiquePaymentAsPaid` a `useDataActions`

En `src/hooks/useDataActions.ts`:

```typescript
const markPsiquePaymentAsPaid = async (monthKey: string, data: Partial<PsiquePayment>) => {
    const svc = ensureService();
    return svc.markPsiquePaymentAsPaid(monthKey, data);
};
```

Agregar al objeto retornado. Agregar import de `PsiquePayment`.

### Step 2: Refactorizar `usePsiquePayments.ts`

Eliminar imports directos de Firestore y `firebase.ts`. Reescribir:

```typescript
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useService } from '../context/ServiceContext';
import { useData } from '../context/DataContext';
import type { PsiquePayment, Appointment } from '../types';

const PSIQUE_RATE = 0.25;

export function usePsiquePayments() {
    const { service } = useService();
    const { appointments } = useData();
    const [psiquePayments, setPsiquePayments] = useState<PsiquePayment[]>([]);

    useEffect(() => {
        if (!service) return;
        return service.subscribeToPsiquePayments((payments) => {
            setPsiquePayments(payments);
        });
    }, [service]);

    const markAsPaid = useCallback(async (monthKey: string, data: Partial<PsiquePayment>) => {
        if (!service) throw new Error('Service not available');
        return service.markPsiquePaymentAsPaid(monthKey, data);
    }, [service]);

    // ... (mantener la lógica de cálculo de montos existente con useMemo)

    return { psiquePayments, markAsPaid, /* ...otros valores calculados */ };
}
```

> **Importante:** Preservar la lógica de cálculo del 25% fee y la agrupación por mes que ya existe. Solo reemplazar los accesos a Firestore.

### Step 3: Verificar que no quedan imports de `firebase/firestore` en el hook

```bash
grep -n "firebase/firestore\|firebase\.ts\|appId\|CLINIC_ID" src/hooks/usePsiquePayments.ts
```

Expected: Sin resultados.

### Step 4: Type-check

```bash
npm run type-check
```

### Step 5: Commit

```bash
git add src/hooks/usePsiquePayments.ts src/hooks/useDataActions.ts
git commit -m "refactor: migrate usePsiquePayments from direct Firestore to IDataService (ARCH-01)"
```

---

## Task 10: Migrar `usePatientData` a IDataService

### Archivos

- Modify: `src/hooks/usePatientData.ts`

### Step 1: Refactorizar `usePatientData.ts`

Eliminar imports directos de Firestore. Reescribir usando `useService()`:

```typescript
import { useState, useEffect, useMemo } from 'react';
import { useService } from '../context/ServiceContext';
import type { Appointment, Payment } from '../types';

interface PatientStats {
    totalDebt: number;
    totalPaid: number;
    lastVisit: Date | null;
    appointmentCount: number;
}

export function usePatientData(patientId: string | null) {
    const { service } = useService();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!service || !patientId) {
            setAppointments([]);
            setPayments([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        let appointmentsLoaded = false;
        let paymentsLoaded = false;

        const checkLoading = () => {
            if (appointmentsLoaded && paymentsLoaded) setLoading(false);
        };

        const unsubAppointments = service.subscribeToPatientAppointments(patientId, (data) => {
            setAppointments(data);
            appointmentsLoaded = true;
            checkLoading();
        });

        const unsubPayments = service.subscribeToPatientPayments(patientId, (data) => {
            setPayments(data);
            paymentsLoaded = true;
            checkLoading();
        });

        return () => {
            unsubAppointments();
            unsubPayments();
        };
    }, [service, patientId]);

    const stats = useMemo<PatientStats>(() => {
        // Preservar la lógica de cálculo existente
        const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const completedAppointments = appointments.filter(a => a.status === 'completado');
        const totalExpected = completedAppointments.reduce((sum, a) => sum + (a.fee || 0), 0);
        const totalDebt = totalExpected - totalPaid;
        const lastVisit = completedAppointments.length > 0
            ? new Date(completedAppointments[0].date)
            : null;

        return {
            totalDebt: Math.max(0, totalDebt),
            totalPaid,
            lastVisit,
            appointmentCount: appointments.length,
        };
    }, [appointments, payments]);

    return { appointments, payments, stats, loading };
}
```

### Step 2: Verificar que no quedan imports de `firebase/firestore`

```bash
grep -n "firebase/firestore\|firebase\.ts\|appId\|CLINIC_ID" src/hooks/usePatientData.ts
```

Expected: Sin resultados.

### Step 3: Type-check

```bash
npm run type-check
```

### Step 4: Commit

```bash
git add src/hooks/usePatientData.ts
git commit -m "refactor: migrate usePatientData from direct Firestore to IDataService (ARCH-01)"
```

---

## Task 11: Tests para `FirebaseService` (métodos nuevos)

### Archivos

- Create: `src/services/__tests__/FirebaseService.test.ts`

### Estrategia de testing

En lugar de mockear todo Firestore (complejo y frágil), testear la lógica de transformación de datos que `FirebaseService` aplica. Para suscripciones, verificar que llaman a las funciones de Firestore con los parámetros correctos.

### Step 1: Crear archivo de test con mocks de Firestore

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => 'mock-collection-ref'),
    doc: vi.fn(() => 'mock-doc-ref'),
    query: vi.fn((...args) => ({ _query: args })),
    where: vi.fn((field, op, val) => ({ field, op, val })),
    orderBy: vi.fn((field, dir) => ({ field, dir })),
    onSnapshot: vi.fn((ref, callback) => {
        // Default: return empty snapshot
        callback({ docs: [] });
        return vi.fn(); // unsubscribe
    }),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-doc-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    setDoc: vi.fn(() => Promise.resolve()),
    getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => null })),
    Timestamp: {
        now: vi.fn(() => ({ seconds: 1000, nanoseconds: 0 })),
    },
    writeBatch: vi.fn(() => ({
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        commit: vi.fn(() => Promise.resolve()),
    })),
}));

// Mock firebase config
vi.mock('../../lib/firebase', () => ({
    db: {},
    appId: 'test-app',
    CLINIC_ID: 'test-clinic',
}));

// Mock routes
vi.mock('../../lib/routes', () => ({
    PATIENTS_COLLECTION: 'test/patients',
    APPOINTMENTS_COLLECTION: 'test/appointments',
    PAYMENTS_COLLECTION: 'test/payments',
    BILLING_QUEUE_COLLECTION: 'test/billing/queue',
    NOTES_COLLECTION: 'test/notes',
    PSIQUE_PAYMENTS_COLLECTION: 'test/psiquePayments',
    ALLOWED_EMAILS_COLLECTION: 'test/allowedEmails',
    STAFF_COLLECTION: 'test/staff',
}));

import { FirebaseService } from '../FirebaseService';
import { addDoc, updateDoc, collection, onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore';

describe('FirebaseService', () => {
    let service: FirebaseService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new FirebaseService('test-uid', 'Dr. Test');
    });

    describe('saveNote', () => {
        it('creates a new note document and returns its ID', async () => {
            const noteInput = {
                patientId: 'patient-1',
                content: 'Test note content',
                professional: 'Dr. Test',
                date: '2026-02-22',
                createdBy: 'test-uid',
            };

            const id = await service.saveNote(noteInput as any);

            expect(addDoc).toHaveBeenCalledOnce();
            expect(id).toBe('new-doc-id');
        });
    });

    describe('completeTask', () => {
        it('updates the task at the specified index to completed', async () => {
            vi.mocked(getDoc).mockResolvedValueOnce({
                exists: () => true,
                data: () => ({
                    tasks: [
                        { content: 'Task 1', completed: false },
                        { content: 'Task 2', completed: false },
                    ],
                }),
            } as any);

            await service.completeTask('note-1', 0);

            expect(updateDoc).toHaveBeenCalledOnce();
            const updateCall = vi.mocked(updateDoc).mock.calls[0];
            expect(updateCall[1]).toHaveProperty('tasks');
            const tasks = (updateCall[1] as any).tasks;
            expect(tasks[0].completed).toBe(true);
            expect(tasks[1].completed).toBe(false);
        });
    });

    describe('subscribeToPsiquePayments', () => {
        it('creates a query filtered by professionalName', () => {
            const callback = vi.fn();
            service.subscribeToPsiquePayments(callback);

            expect(onSnapshot).toHaveBeenCalledOnce();
        });
    });

    describe('markPsiquePaymentAsPaid', () => {
        it('calls setDoc with merge option', async () => {
            await service.markPsiquePaymentAsPaid('2026-02', { paid: true } as any);

            expect(setDoc).toHaveBeenCalledWith(
                'mock-doc-ref',
                expect.objectContaining({ paid: true }),
                { merge: true }
            );
        });
    });

    describe('subscribeToPatientAppointments', () => {
        it('creates subscription for patient-specific appointments', () => {
            const callback = vi.fn();
            const unsub = service.subscribeToPatientAppointments('patient-1', callback);

            expect(onSnapshot).toHaveBeenCalledOnce();
            expect(typeof unsub).toBe('function');
        });
    });

    describe('subscribeToPatientPayments', () => {
        it('creates subscription for patient-specific payments', () => {
            const callback = vi.fn();
            const unsub = service.subscribeToPatientPayments('patient-1', callback);

            expect(onSnapshot).toHaveBeenCalledOnce();
            expect(typeof unsub).toBe('function');
        });
    });

    describe('addTask', () => {
        it('creates a task-type note document', async () => {
            const taskInput = {
                patientId: 'patient-1',
                professional: 'Dr. Test',
                content: 'Follow up',
                createdBy: 'test-uid',
            };

            const id = await service.addTask(taskInput);

            expect(addDoc).toHaveBeenCalledOnce();
            const addCall = vi.mocked(addDoc).mock.calls[0];
            expect((addCall[1] as any).type).toBe('task');
            expect(id).toBe('new-doc-id');
        });
    });
});
```

### Step 2: Ejecutar tests

```bash
npm test -- src/services/__tests__/FirebaseService.test.ts --run
```

Expected: Todos los tests pasan.

### Step 3: Commit

```bash
git add src/services/__tests__/FirebaseService.test.ts
git commit -m "test: add unit tests for new FirebaseService methods (TEST-01)"
```

---

## Task 12: Tests para hooks de negocio

### Archivos

- Create: `src/hooks/__tests__/useAgendaStats.test.ts`
- Create: `src/hooks/__tests__/usePsiquePayments.test.ts`

### Step 1: Test para lógica de stats de `useAgendaStats`

```typescript
import { describe, it, expect } from 'vitest';
import type { Appointment } from '../../types';

// Extraer la lógica de cálculo de estadísticas que el hook usa internamente
// Si la lógica está inline en el hook, testear con renderHook

// Test puro de la lógica de cálculo
function calculateAgendaStats(appointments: Appointment[], today: string) {
    const todayApps = appointments.filter(a => a.date === today);
    const completedToday = todayApps.filter(a => a.status === 'completado').length;
    const pendingToday = todayApps.filter(a => a.status === 'programado').length;
    const cancelledToday = todayApps.filter(a => a.status === 'cancelado').length;
    const absentToday = todayApps.filter(a => a.status === 'ausente').length;

    return { total: todayApps.length, completedToday, pendingToday, cancelledToday, absentToday };
}

describe('Agenda stats calculation', () => {
    const today = '2026-02-22';

    it('counts appointments by status for today', () => {
        const appointments = [
            { id: '1', date: today, status: 'completado' },
            { id: '2', date: today, status: 'programado' },
            { id: '3', date: today, status: 'cancelado' },
            { id: '4', date: '2026-02-23', status: 'programado' },
        ] as Appointment[];

        const stats = calculateAgendaStats(appointments, today);

        expect(stats.total).toBe(3);
        expect(stats.completedToday).toBe(1);
        expect(stats.pendingToday).toBe(1);
        expect(stats.cancelledToday).toBe(1);
        expect(stats.absentToday).toBe(0);
    });

    it('returns zeros when no appointments for today', () => {
        const stats = calculateAgendaStats([], today);
        expect(stats.total).toBe(0);
    });
});
```

### Step 2: Test para lógica de cálculo de psique fee

```typescript
import { describe, it, expect } from 'vitest';
import type { Appointment, Patient } from '../../types';

const PSIQUE_RATE = 0.25;

// Lógica pura de cálculo de fee de Psique
function calculatePsiqueFee(
    appointments: Appointment[],
    patients: Map<string, Patient>,
): number {
    return appointments
        .filter(a => {
            const patient = patients.get(a.patientId);
            if (!patient || patient.patientSource !== 'psique') return false;
            if (a.excludeFromPsique) return false;
            if (a.status === 'cancelado' && !a.chargeOnCancellation) return false;
            return a.status === 'completado' || (a.status === 'cancelado' && a.chargeOnCancellation);
        })
        .reduce((sum, a) => sum + (a.fee || 0) * PSIQUE_RATE, 0);
}

describe('Psique fee calculation', () => {
    const psiquePatient: Patient = {
        id: 'p1',
        name: 'Juan',
        patientSource: 'psique',
        professional: 'Dr. Test',
    } as Patient;

    const particularPatient: Patient = {
        id: 'p2',
        name: 'María',
        patientSource: 'particular',
        professional: 'Dr. Test',
    } as Patient;

    const patients = new Map([
        ['p1', psiquePatient],
        ['p2', particularPatient],
    ]);

    it('calculates 25% fee for completed psique appointments', () => {
        const appointments = [
            { id: 'a1', patientId: 'p1', status: 'completado', fee: 10000 },
        ] as Appointment[];

        expect(calculatePsiqueFee(appointments, patients)).toBe(2500);
    });

    it('excludes particular patients', () => {
        const appointments = [
            { id: 'a1', patientId: 'p2', status: 'completado', fee: 10000 },
        ] as Appointment[];

        expect(calculatePsiqueFee(appointments, patients)).toBe(0);
    });

    it('excludes appointments with excludeFromPsique flag', () => {
        const appointments = [
            { id: 'a1', patientId: 'p1', status: 'completado', fee: 10000, excludeFromPsique: true },
        ] as Appointment[];

        expect(calculatePsiqueFee(appointments, patients)).toBe(0);
    });

    it('includes cancelled appointments with chargeOnCancellation', () => {
        const appointments = [
            { id: 'a1', patientId: 'p1', status: 'cancelado', fee: 10000, chargeOnCancellation: true },
        ] as Appointment[];

        expect(calculatePsiqueFee(appointments, patients)).toBe(2500);
    });

    it('excludes cancelled appointments without chargeOnCancellation', () => {
        const appointments = [
            { id: 'a1', patientId: 'p1', status: 'cancelado', fee: 10000, chargeOnCancellation: false },
        ] as Appointment[];

        expect(calculatePsiqueFee(appointments, patients)).toBe(0);
    });

    it('sums fees across multiple appointments', () => {
        const appointments = [
            { id: 'a1', patientId: 'p1', status: 'completado', fee: 10000 },
            { id: 'a2', patientId: 'p1', status: 'completado', fee: 8000 },
        ] as Appointment[];

        expect(calculatePsiqueFee(appointments, patients)).toBe(4500); // (10000+8000)*0.25
    });
});
```

### Step 3: Ejecutar tests

```bash
npm test -- src/hooks/__tests__/ --run
```

Expected: Todos los tests pasan.

### Step 4: Commit

```bash
git add src/hooks/__tests__/
git commit -m "test: add unit tests for agenda stats and psique fee calculation (TEST-01)"
```

---

## Task 13: Expandir tests de utilidades + cobertura final

### Archivos

- Modify: `src/lib/__tests__/utils.test.ts`

### Step 1: Agregar tests para funciones de utils que no están cubiertas

Revisar `src/lib/utils.ts` y agregar tests para funciones no testeadas. Comunes:

```typescript
import { describe, it, expect } from 'vitest';
import { cn, formatPhoneNumber } from '../utils';

// Tests existentes se mantienen...

describe('cn', () => {
    // Tests existentes...

    it('handles undefined and null values', () => {
        expect(cn('base', undefined, null, 'extra')).toBe('base extra');
    });

    it('merges conflicting Tailwind classes correctly', () => {
        expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
    });
});
```

> **Nota:** Revisar qué funciones existen en `utils.ts` (posiblemente `calculateAge`, `getInitials`, date helpers) y agregar tests específicos. El engineer debe revisar el archivo y agregar tests para cada función exportada.

### Step 2: Ejecutar cobertura completa

```bash
npm run test:coverage
```

Expected: Cobertura significativamente mayor que el 6% inicial. Con los tests de Tasks 11-13, deberíamos superar los thresholds mínimos configurados (30% functions, 20% lines).

### Step 3: Commit

```bash
git add src/lib/__tests__/utils.test.ts
git commit -m "test: expand utility function tests and verify coverage thresholds (TEST-01)"
```

---

## Task 14: Verificación end-to-end

### Sin archivos nuevos — solo validación

### Step 1: Type-check completo

```bash
npm run type-check
```

Expected: Sin errores.

### Step 2: Lint completo

```bash
npm run lint
```

Expected: Sin errores (warnings de `@typescript-eslint/no-explicit-any` son aceptables como pre-existentes).

### Step 3: Tests completos con cobertura

```bash
npm run test:coverage
```

Expected: Todos los tests pasan. Cobertura cumple thresholds.

### Step 4: Build de producción

```bash
npm run build
```

Expected: Build exitoso sin errores.

### Step 5: Verificar que no quedan accesos directos a Firestore en hooks migrados

```bash
grep -rn "firebase/firestore" src/hooks/useClinicalNotes.ts src/hooks/usePendingTasks.ts src/hooks/usePsiquePayments.ts src/hooks/usePatientData.ts
```

Expected: Sin resultados.

```bash
grep -rn "firebase/firestore" src/views/TasksView.tsx src/components/modals/AddTaskModal.tsx
```

Expected: Sin resultados.

### Step 6: CI compuesto

```bash
npm run ci
```

Expected: type-check → lint → test → build, todo exitoso.

### Step 7: Commit final

```bash
git add -A
git commit -m "feat: Phase 2 complete — ESLint, ErrorBoundary, IDataService consolidation, testing foundation"
```

---

## Orden de ejecución y dependencias

```text
Task 1 (ESLint + Prettier) ──┐
Task 2 (type-check + gitignore) ──┤── Parallelizables (DX, sin dependencias)
Task 3 (ErrorBoundary) ──────┤
Task 4 (Vitest coverage) ────┘

Task 5 (Expandir IDataService) ──→ Task 6 (Implementar en FirebaseService) ──┐
                                                                              ├── Tasks 7-10 (Migrar hooks)
                                                                              │   ├── Task 7 (useClinicalNotes — HOOK-01)
                                                                              │   ├── Task 8 (usePendingTasks + TasksView)
                                                                              │   ├── Task 9 (usePsiquePayments)
                                                                              │   └── Task 10 (usePatientData)
                                                                              │
Task 11 (Tests FirebaseService) ──────────────────────────────────────────────┘
Task 12 (Tests hooks negocio) ── independiente (lógica pura)
Task 13 (Tests utils + coverage) ── independiente

Task 14 (Verificación) ── después de todo
```

**Tareas paralelizables:** {1, 2, 3, 4}, {7, 8, 9, 10} (post Task 6), {11, 12, 13}

**Dependencias secuenciales:** 5 → 6 → {7,8,9,10}, todo → 14

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| ESLint reporta cientos de errores pre-existentes | Configurar reglas como `warn` en vez de `error` para código existente. Solo `react-hooks/rules-of-hooks` como `error`. |
| Prettier reformatea todo el proyecto, diff gigante | Hacer el format commit como commit dedicado sin cambios funcionales. |
| `usePendingTasks` con N suscripciones por paciente es costoso | Monitorear en producción. Si es problema, agregar un query dedicado con `where('type', '==', 'task')` a nivel colección. |
| Consumidores de `useClinicalNotes` esperan API vieja | Buscar todos los imports con grep y actualizar en Task 7. Verificar con type-check. |
| `useStaff.ts` queda fuera de scope (sigue bypaseando) | Documentado como deuda técnica — requiere reestructuración del árbol de providers en App.tsx. |
| Tests con mocks de Firestore son frágiles | Testear lógica de transformación/cálculo como funciones puras cuando sea posible. Solo mockear Firestore para verificar contratos de llamada. |

---

## Métricas de éxito

| Métrica | Antes (Phase 1) | Objetivo Phase 2 |
| --- | --- | --- |
| ESLint | No existe | Configurado y ejecutable |
| `tsc --noEmit` | No en scripts | En scripts `type-check` y `ci` |
| ErrorBoundary | No existe | Envuelve ambos Suspense boundaries |
| Hooks bypasseando IDataService | 5 hooks + 2 componentes | 1 hook (`useStaff` — justificado) |
| Violaciones Rules of Hooks | 1 (useClinicalNotes) | 0 |
| Unit tests | 7 | ~30+ |
| Coverage (functions) | ~5% | ≥30% |
| Archivos test en .gitignore | No | Sí |
