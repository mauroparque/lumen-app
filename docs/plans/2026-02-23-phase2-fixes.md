# Phase 2 Fixes — Correcciones Post-Evaluación

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corregir los hallazgos detectados en la evaluación de Phase 2 antes del merge a `main`.

**Origen:** Evaluación de `feature/phase2-stability` (12 commits, 53 archivos) — reporte del 23/02/2026.
**Plan base:** [2026-02-22-phase2-stability-dx-architecture.md](2026-02-22-phase2-stability-dx-architecture.md)
**Auditoría:** [2026-02-19_AUDIT.md](../audits/2026-02-19_AUDIT.md)

**Architecture:** Completar la migración de TasksView.tsx al service layer, corregir config de ESLint y Vitest, y elevar la cobertura de tests a lo especificado en el plan original.

**Tech Stack:** TypeScript, Vitest, ESLint 9, `globals` package, `react-error-boundary`

**Worktree:** `.worktrees/phase2-stability` (rama `feature/phase2-stability`)

---

## Resumen de hallazgos a corregir

| # | Hallazgo | Severidad | Tarea(s) |
| --- | --- | --- | --- |
| F1 | TasksView.tsx aún usa Firestore directo (`handleUpdateTask`, `toggleSubtaskComplete`) | **Crítica** | 1–4 |
| F2 | ESLint config usa ~40 globals manuales en vez de `globals.browser` | Media | 5 |
| F3 | 3 lint errors introducidos en `usePsiquePayments.ts` (escape chars en regex) | Media | 6 |
| F4 | Coverage thresholds en 1%/3% vs plan original 30%/20% | Media | 7 |
| F5 | Faltan tests de lógica de negocio (Tasks 11-13 del plan original) | Alta | 8–10 |

---

## Task 1: Agregar `updateTask` y `toggleSubtaskCompletion` a IDataService

**Files:**

- Modify: `src/services/IDataService.ts`

**Step 1: Agregar las firmas de los dos métodos nuevos**

En `src/services/IDataService.ts`, dentro de la sección `// --- Tasks ---`, después de `addTask`, agregar:

```typescript
    // --- Tasks ---
    subscribeToAllNotes(onData: (notes: ClinicalNote[]) => void): () => void;
    completeTask(noteId: string, taskIndex: number): Promise<void>;
    addTask(task: TaskInput): Promise<string>;
    updateTask(noteId: string, taskIndex: number, data: { text: string; subtasks?: TaskSubitem[] }): Promise<void>;
    toggleSubtaskCompletion(noteId: string, taskIndex: number, subtaskIndex: number): Promise<void>;
```

Agregar `TaskSubitem` al import de types:

```typescript
import type {
    // ...existing imports...
    TaskSubitem,
} from '../types';
```

**Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: **Error** — FirebaseService no implementa los métodos nuevos. Esto es correcto (TDD: el contrato falla antes de la implementación).

**Step 3: Commit**

```bash
git add src/services/IDataService.ts
git commit -m "feat(IDataService): add updateTask and toggleSubtaskCompletion signatures"
```

---

## Task 2: Implementar `updateTask` y `toggleSubtaskCompletion` en FirebaseService

**Files:**

- Modify: `src/services/FirebaseService.ts`

**Step 1: Implementar `updateTask`**

Después del método `addTask`, agregar:

```typescript
    async updateTask(
        noteId: string,
        taskIndex: number,
        data: { text: string; subtasks?: TaskSubitem[] },
    ): Promise<void> {
        const noteRef = doc(db, NOTES_COLLECTION, noteId);
        const noteSnap = await getDoc(noteRef);

        if (!noteSnap.exists()) {
            throw new Error('Note not found');
        }

        const noteData = noteSnap.data() as ClinicalNote;
        const updatedTasks = [...(noteData.tasks || [])];

        if (!updatedTasks[taskIndex]) {
            throw new Error(`Task at index ${taskIndex} not found`);
        }

        updatedTasks[taskIndex] = {
            ...updatedTasks[taskIndex],
            text: data.text,
            subtasks: data.subtasks,
        };

        await updateDoc(noteRef, {
            tasks: updatedTasks,
            updatedAt: Timestamp.now(),
        });
    }
```

Agregar `TaskSubitem` al import de types en FirebaseService.ts.

**Step 2: Implementar `toggleSubtaskCompletion`**

Después de `updateTask`, agregar:

```typescript
    async toggleSubtaskCompletion(
        noteId: string,
        taskIndex: number,
        subtaskIndex: number,
    ): Promise<void> {
        const noteRef = doc(db, NOTES_COLLECTION, noteId);
        const noteSnap = await getDoc(noteRef);

        if (!noteSnap.exists()) {
            throw new Error('Note not found');
        }

        const noteData = noteSnap.data() as ClinicalNote;
        const updatedTasks = [...(noteData.tasks || [])];

        if (!updatedTasks[taskIndex]?.subtasks?.[subtaskIndex]) {
            throw new Error(`Subtask at index ${subtaskIndex} not found`);
        }

        const subtasks = [...(updatedTasks[taskIndex].subtasks || [])];
        subtasks[subtaskIndex] = {
            ...subtasks[subtaskIndex],
            completed: !subtasks[subtaskIndex].completed,
        };
        updatedTasks[taskIndex] = {
            ...updatedTasks[taskIndex],
            subtasks,
        };

        await updateDoc(noteRef, {
            tasks: updatedTasks,
            updatedAt: Timestamp.now(),
        });
    }
```

**Step 3: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: **0 errores** — FirebaseService ahora satisface IDataService.

**Step 4: Commit**

```bash
git add src/services/FirebaseService.ts
git commit -m "feat(FirebaseService): implement updateTask and toggleSubtaskCompletion"
```

---

## Task 3: Exponer `updateTask` y `toggleSubtaskCompletion` en useDataActions

**Files:**

- Modify: `src/hooks/useDataActions.ts`

**Step 1: Agregar los wrappers**

Después del wrapper de `addTask`, agregar:

```typescript
    const updateTask = async (
        noteId: string,
        taskIndex: number,
        data: { text: string; subtasks?: TaskSubitem[] },
    ) => {
        return ensureService().updateTask(noteId, taskIndex, data);
    };

    const toggleSubtaskCompletion = async (
        noteId: string,
        taskIndex: number,
        subtaskIndex: number,
    ) => {
        return ensureService().toggleSubtaskCompletion(noteId, taskIndex, subtaskIndex);
    };
```

Agregar `TaskSubitem` al import de types en `useDataActions.ts`.

Agregar ambos al objeto de retorno:

```typescript
    return {
        // ...existing...
        updateTask,
        toggleSubtaskCompletion,
    };
```

**Step 2: Commit**

```bash
git add src/hooks/useDataActions.ts
git commit -m "feat(useDataActions): expose updateTask and toggleSubtaskCompletion"
```

---

## Task 4: Migrar TasksView.tsx — eliminar Firestore directo

**Files:**

- Modify: `src/views/TasksView.tsx`

**Step 1: Reemplazar imports**

Eliminar las líneas 11-12:

```typescript
// ELIMINAR:
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db, appId, CLINIC_ID } from '../lib/firebase';
```

**Step 2: Agregar `updateTask` y `toggleSubtaskCompletion` del hook**

Cambiar la línea 30 (destructuring de `useDataActions`):

```typescript
// ANTES:
const { addTask, updateNote } = useDataActions();

// DESPUÉS:
const { addTask, updateNote, updateTask, toggleSubtaskCompletion } = useDataActions();
```

**Step 3: Reescribir `handleUpdateTask` (L170-199)**

```typescript
    const handleUpdateTask = async () => {
        if (!editingTask || !editForm.text.trim()) {
            toast.error('El texto de la tarea es requerido');
            return;
        }

        try {
            await updateTask(editingTask.noteId, editingTask.taskIndex, {
                text: editForm.text.trim(),
                subtasks: editForm.subtasks,
            });
            toast.success('Tarea actualizada');
            setEditingTask(null);
            setEditForm({ text: '', patientId: '', subtasks: [] });
        } catch (error) {
            console.error('Error updating task:', error);
            toast.error('Error al actualizar la tarea');
        }
    };
```

**Step 4: Reescribir `toggleSubtaskComplete` (L229-261)**

```typescript
    const toggleSubtaskComplete = async (task: PendingTask, subtaskIndex: number) => {
        try {
            await toggleSubtaskCompletion(task.noteId, task.taskIndex, subtaskIndex);
            toast.success('Subitem actualizado');
        } catch (error) {
            console.error('Error toggling subtask:', error);
            toast.error('Error al actualizar subitem');
        }
    };
```

**Step 5: Verificar que no queden imports de Firestore**

Run: `Select-String -Path src/views/TasksView.tsx -Pattern "firebase/firestore|from.*firebase"`
Expected: **0 resultados**.

**Step 6: Verificar compilación y tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 errores de tipo, todos los tests pasan.

**Step 7: Commit**

```bash
git add src/views/TasksView.tsx
git commit -m "refactor(TasksView): migrate to IDataService, remove direct Firestore access"
```

---

## Task 5: Corregir ESLint config — usar `globals.browser`

**Files:**

- Modify: `eslint.config.js`

**Step 1: Reemplazar globals manuales por `globals.browser`**

El paquete `globals` ya está disponible como dependencia transitiva de ESLint (`globals@14.0.0`).

Reemplazar todo el bloque `globals: { window: 'readonly', ... }` (líneas 21-72) por:

```javascript
import globals from 'globals';

// ...dentro del config:
            globals: {
                ...globals.browser,
                ...globals.es2021,
            },
```

Esto reemplaza ~40 líneas de globals manuales con una solución estándar y mantenible que incluye todas las APIs del browser.

**Step 2: Verificar que ESLint funciona**

Run: `npx eslint src/ --max-warnings=100`
Expected: No nuevos errores de `no-undef`. Los errores previos se mantienen.

**Step 3: Commit**

```bash
git add eslint.config.js
git commit -m "fix(eslint): use globals.browser instead of manual globals list"
```

---

## Task 6: Corregir lint errors en usePsiquePayments.ts

**Files:**

- Modify: `src/hooks/usePsiquePayments.ts`

**Step 1: Corregir regex con escape chars innecesarios (línea 43)**

```typescript
// ANTES:
const safeName = professional.replace(/[\/\.#$\[\]]/g, '_');

// DESPUÉS:
const safeName = professional.replace(/[/.#$[\]]/g, '_');
```

Los caracteres `/`, `.` y `[` no necesitan escape dentro de una clase de caracteres `[]` en regex de JavaScript (excepto `]` que sí se escapa, y `\` que también se escapa — pero `/` y `.` son literales dentro de `[]`).

**Step 2: Verificar lint pass en el archivo**

Run: `npx eslint src/hooks/usePsiquePayments.ts`
Expected: 0 errores.

**Step 3: Commit**

```bash
git add src/hooks/usePsiquePayments.ts
git commit -m "fix(usePsiquePayments): remove unnecessary regex escape characters"
```

---

## Task 7: Subir coverage thresholds a lo especificado en el plan

**Files:**

- Modify: `vitest.config.ts`

**Step 1: Actualizar thresholds**

```typescript
// ANTES:
            thresholds: {
                functions: 1,
                branches: 3,
                lines: 1,
                statements: 1,
            },

// DESPUÉS:
            thresholds: {
                functions: 30,
                branches: 20,
                lines: 30,
                statements: 30,
            },
```

Estos son los valores especificados en el plan original (Task 4). Son alcanzables con los tests existentes + los que se agregan en Tasks 8-10.

**Step 2: Verificar que coverage actual no rompe (o anotar delta)**

Run: `npx vitest run --coverage`
Si los thresholds no se alcanzan con los tests actuales, esto se resolverá al completar las Tasks 8-10. **Ejecutar este step DESPUÉS de Tasks 8-10.**

**Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "chore(vitest): raise coverage thresholds to planned values (30/20)"
```

---

## Task 8: Tests de IDataService y mock factory (completar Task 11 del plan original)

**Files:**

- Modify: `src/services/__tests__/IDataService.test.ts`

**Step 1: Agregar `updateTask` y `toggleSubtaskCompletion` al mock factory**

En `createMockService`, agregar las nuevas firmas:

```typescript
    updateTask: vi.fn(),
    toggleSubtaskCompletion: vi.fn(),
```

**Step 2: Agregar tests de contrato para los nuevos métodos**

```typescript
    it('updateTask mock can be configured with specific behavior', () => {
        const mockService = createMockService({
            updateTask: vi.fn().mockResolvedValue(undefined),
        });

        const result = mockService.updateTask('note-1', 0, {
            text: 'Updated task',
            subtasks: [{ text: 'sub', completed: false }],
        });

        expect(mockService.updateTask).toHaveBeenCalledWith('note-1', 0, {
            text: 'Updated task',
            subtasks: [{ text: 'sub', completed: false }],
        });
        expect(result).resolves.toBeUndefined();
    });

    it('toggleSubtaskCompletion mock resolves correctly', () => {
        const mockService = createMockService({
            toggleSubtaskCompletion: vi.fn().mockResolvedValue(undefined),
        });

        const result = mockService.toggleSubtaskCompletion('note-1', 0, 1);

        expect(mockService.toggleSubtaskCompletion).toHaveBeenCalledWith('note-1', 0, 1);
        expect(result).resolves.toBeUndefined();
    });
```

**Step 3: Agregar test que verifica que el mock incluye TODOS los métodos de la interfaz**

```typescript
    it('mock factory includes all IDataService methods', () => {
        const service = createMockService();
        const expectedMethods = [
            'subscribeToPatients', 'subscribeToAppointments', 'subscribeToMyAppointments',
            'subscribeToFinance', 'addPatient', 'updatePatient', 'deletePatient',
            'addAppointment', 'addRecurringAppointments', 'updateAppointment',
            'deleteAppointment', 'deleteRecurringSeries', 'deleteRecurringFromDate',
            'addPayment', 'deletePayment', 'updatePayment', 'requestBatchInvoice',
            'subscribeToClinicalNote', 'subscribeToPatientNotes', 'saveNote',
            'updateNote', 'uploadNoteAttachment', 'subscribeToAllNotes',
            'completeTask', 'addTask', 'updateTask', 'toggleSubtaskCompletion',
            'subscribeToPsiquePayments', 'markPsiquePaymentAsPaid',
            'subscribeToPatientAppointments', 'subscribeToPatientPayments',
        ];
        for (const method of expectedMethods) {
            expect(service).toHaveProperty(method);
            expect(typeof (service as any)[method]).toBe('function');
        }
        // Verify no extra methods
        expect(Object.keys(service).sort()).toEqual(expectedMethods.sort());
    });
```

**Step 4: Run tests**

Run: `npx vitest run src/services/__tests__/IDataService.test.ts`
Expected: All pass (6 tests).

**Step 5: Commit**

```bash
git add src/services/__tests__/IDataService.test.ts
git commit -m "test(IDataService): add updateTask/toggleSubtask mocks and method completeness check"
```

---

## Task 9: Tests de lógica pura — useAgendaStats (Task 12 del plan original)

**Files:**

- Create: `src/hooks/__tests__/useAgendaStats.test.ts`

**Step 1: Crear test file con tests de lógica pura**

`useAgendaStats` es un hook que recibe `appointments` y `patients` como arrays puros y devuelve estadísticas calculadas. Es testeable sin mocks de Firebase.

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAgendaStats } from '../useAgendaStats';
import type { Appointment, Patient } from '../../types';
import { Timestamp } from 'firebase/firestore';

const makePatient = (overrides: Partial<Patient> = {}): Patient => ({
    id: 'p-1',
    name: 'Test Patient',
    phone: '1234567890',
    email: 'test@test.com',
    isActive: true,
    professional: 'Dr. Test',
    fee: 5000,
    patientSource: 'particular',
    ...overrides,
});

const makeAppointment = (overrides: Partial<Appointment> = {}): Appointment => ({
    id: 'a-1',
    patientId: 'p-1',
    patientName: 'Test Patient',
    professional: 'Dr. Test',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    duration: 50,
    type: 'individual',
    status: 'completado',
    isPaid: false,
    ...overrides,
});

describe('useAgendaStats', () => {
    it('returns zero stats for empty data', () => {
        const { result } = renderHook(() => useAgendaStats([], []));

        expect(result.current.todayCount).toBe(0);
        expect(result.current.weekCount).toBe(0);
        expect(result.current.activePatients).toBe(0);
    });

    it('counts active patients correctly', () => {
        const patients = [
            makePatient({ id: 'p-1', isActive: true }),
            makePatient({ id: 'p-2', isActive: true }),
            makePatient({ id: 'p-3', isActive: false }),
        ];

        const { result } = renderHook(() => useAgendaStats([], patients));
        expect(result.current.activePatients).toBe(2);
    });

    it('calculates today count from appointments', () => {
        const today = new Date().toISOString().split('T')[0];
        const appointments = [
            makeAppointment({ id: 'a-1', date: today, status: 'programado' }),
            makeAppointment({ id: 'a-2', date: today, status: 'completado' }),
            makeAppointment({ id: 'a-3', date: '2020-01-01', status: 'programado' }),
        ];

        const { result } = renderHook(() => useAgendaStats(appointments, []));
        expect(result.current.todayCount).toBe(2);
    });
});
```

**Step 2: Run tests**

Run: `npx vitest run src/hooks/__tests__/useAgendaStats.test.ts`
Expected: All pass (3 tests).

**Step 3: Commit**

```bash
git add src/hooks/__tests__/useAgendaStats.test.ts
git commit -m "test(useAgendaStats): add pure logic tests for stats calculation"
```

---

## Task 10: Tests de lógica pura — utils adicionales (Task 13 del plan original)

**Files:**
- Modify: `src/lib/__tests__/utils.test.ts`

**Step 1: Expandir los tests existentes**

Agregar tests para edge cases no cubiertos:

```typescript
describe('formatPhoneNumber — edge cases', () => {
    it('handles null/undefined gracefully', () => {
        expect(formatPhoneNumber(undefined as any)).toBe('');
        expect(formatPhoneNumber(null as any)).toBe('');
    });

    it('does not double-prefix numbers already starting with 549', () => {
        const result = formatPhoneNumber('5491112345678');
        expect(result).toBe('5491112345678');
    });

    it('handles numbers with + prefix', () => {
        const result = formatPhoneNumber('+5491112345678');
        expect(result).toBe('5491112345678');
    });
});

describe('cn — edge cases', () => {
    it('handles empty call', () => {
        const result = cn();
        expect(result).toBe('');
    });

    it('deduplicates conflicting Tailwind classes', () => {
        const result = cn('p-4', 'p-2');
        expect(result).toBe('p-2');
    });
});
```

**Step 2: Run tests**

Run: `npx vitest run src/lib/__tests__/utils.test.ts`
Expected: All pass.

**Step 3: Commit**

```bash
git add src/lib/__tests__/utils.test.ts
git commit -m "test(utils): add edge case tests for formatPhoneNumber and cn"
```

---

## Task 11: Verificación final

**Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errores.

**Step 2: Tests**

Run: `npx vitest run`
Expected: Todos pasan (~20+ tests).

**Step 3: Build**

Run: `npm run build`
Expected: Build exitoso.

**Step 4: Lint**

Run: `npx eslint src/`
Expected: Los 3 errores de usePsiquePayments desaparecen. Los errores restantes son pre-existentes (no introducidos en Phase 2).

**Step 5: Verificar zero Firestore directo en hooks migrados**

Run:

```powershell
Select-String -Path src/hooks/useClinicalNotes.ts,src/hooks/usePendingTasks.ts,src/hooks/usePsiquePayments.ts,src/hooks/usePatientData.ts,src/views/TasksView.tsx,src/components/modals/AddTaskModal.tsx -Pattern "firebase/firestore"
```

Expected: **0 resultados**.

**Step 6: Coverage check**

Run: `npx vitest run --coverage`
Expected: Thresholds superados (functions ≥30%, lines ≥30%).

**Step 7: Commit final (si hay ajustes de thresholds)**

```bash
git commit -m "chore: phase2 fixes verification complete"
```

---

## Resumen de ejecución

| Task | Descripción | Archivos | Tests nuevos |
| --- | --- | --- | --- |
| 1 | IDataService: firmas nuevas | `IDataService.ts` | — |
| 2 | FirebaseService: implementación | `FirebaseService.ts` | — |
| 3 | useDataActions: wrappers | `useDataActions.ts` | — |
| 4 | TasksView: migración completa | `TasksView.tsx` | — |
| 5 | ESLint: globals.browser | `eslint.config.js` | — |
| 6 | usePsiquePayments: regex fix | `usePsiquePayments.ts` | — |
| 7 | Vitest: coverage thresholds | `vitest.config.ts` | — |
| 8 | IDataService tests: completar | `IDataService.test.ts` | +3 |
| 9 | useAgendaStats: tests puros | `useAgendaStats.test.ts` | +3 |
| 10 | utils: tests edge cases | `utils.test.ts` | +5 |
| 11 | Verificación final | — | — |

**Total estimado:** ~2 horas de ejecución.
**Commits esperados:** 9-10 commits incrementales.
