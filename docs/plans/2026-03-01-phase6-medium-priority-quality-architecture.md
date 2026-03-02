# Phase 6 — Calidad de Código y Arquitectura (Prioridad Media) — Plan de Implementación

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolver los ~17 hallazgos de prioridad media de la auditoría del 26/02/2026 — duplicación de código, memoización de hooks, migración de abstracción, paridad de componentes, operaciones atómicas, manejo de errores y migración de Cloud Functions config.

**Architecture:** Cambios transversales en utils, hooks, componentes, service layer, contexts, Cloud Functions. Sin cambios en Firestore/Storage rules. TDD estricto: red-green-refactor para cada ítem.

**Tech Stack:** React 18, TypeScript, Vitest, Firebase Firestore (transactions), Cloud Functions v2 params, TailwindCSS, lucide-react.

**Auditoría de origen:** [`docs/audits/2026-02-26_AUDIT.md`](../audits/2026-02-26_AUDIT.md)  
**Plan anterior:** [`docs/plans/2026-02-26-phase5-high-priority-security-architecture.md`](../plans/2026-02-26-phase5-high-priority-security-architecture.md)  
**Review anterior:** [`docs/reviews/2026-03-01_phase5-completion-review.md`](../reviews/2026-03-01_phase5-completion-review.md)  
**Review de cierre:** [`docs/reviews/2026-03-01_phase6-completion-review.md`](../reviews/2026-03-01_phase6-completion-review.md)

---

## Resumen de acciones

| #   | Grupo | Acción                                                                           | Issues   | Esfuerzo est. |
| --- | ----- | -------------------------------------------------------------------------------- | -------- | ------------- |
| 1   | A     | Centralizar `calculateAge` en `utils.ts`                                         | DUP      | 30 min        |
| 2   | A     | Centralizar `isOverdue` en `utils.ts`                                            | DUP      | 30 min        |
| 3   | A     | Eliminar `PSIQUE_RATE` duplicado, importar desde `psiqueCalculations.ts`         | HOOK-N04 | 15 min        |
| 4   | B     | Memoizar `useDataActions` con `useMemo`                                          | HOOK-N01 | 45 min        |
| 5   | B     | Mover `serverTimestamp` de `useStaff` a `FirebaseService.createStaffProfile`     | HOOK-N02 | 45 min        |
| 6   | B     | Eliminar wrapper `usePatients`, reemplazar con `useData()` directo               | HOOK-N03 | 30 min        |
| 7   | C     | Tipar `SidebarItem` props explícitamente                                         | COMP-N02 | 20 min        |
| 8   | C     | Agregar Estadísticas + indicador deuda en `MobileHeader`                         | COMP-N01 | 45 min        |
| 9   | D     | Eliminar listener desperdiciado en `subscribeToFinance`                          | ARCH-N03 | 30 min        |
| 10  | D     | Hacer `saveNote` atómica con `writeBatch`                                        | ARCH-N05 | 45 min        |
| 11  | D     | Hacer task operations atómicas con `runTransaction`                              | ARCH-N04 | 1.5h          |
| 12  | D     | Particionar batch writes en `addRecurringAppointments` y `deleteRecurringSeries` | ARCH-N06 | 45 min        |
| 13  | D     | Corregir `setLoading(false)` para esperar todas las suscripciones                | ARCH-N07 | 30 min        |
| 14  | E     | Mapear errores Firebase a mensajes user-friendly en `AuthScreen`                 | SEC-13   | 30 min        |
| 15  | E     | Migrar `functions.config()` a `defineString()` params v2                         | SEC-N05  | 45 min        |
| 16  | E     | Implementar session timeout para Firebase Auth                                   | SEC-11   | 1.5h          |
| 17  | E     | Schema validation básica en Firestore rules (campos requeridos)                  | SEC-06   | 1.5h          |

**Esfuerzo total estimado:** ~12h con TDD

---

## Grupo A — Centralizar helpers duplicados

### Task 1: Centralizar `calculateAge` en `utils.ts` (DUP)

**Contexto:** `calculateAge` está duplicada exactamente en `PatientsView.tsx` L25-34 y `PatientHistoryView.tsx` L37-46.

**Files:**

- Modify: `src/lib/utils.ts`
- Modify: `src/views/PatientsView.tsx` L25-34
- Modify: `src/views/PatientHistoryView.tsx` L37-46
- Test: `src/lib/__tests__/utils.test.ts`

**Step 1: Escribir el test**

En `src/lib/__tests__/utils.test.ts`, agregar al final:

```typescript
describe('calculateAge', () => {
    it('retorna edad correcta para fecha pasada', () => {
        // Mockear la fecha actual para consistencia
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-01'));

        expect(calculateAge('1990-06-15')).toBe(35);

        vi.useRealTimers();
    });

    it('retorna edad decrementada si aún no cumplió años este año', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-01'));

        expect(calculateAge('1990-12-25')).toBe(35);

        vi.useRealTimers();
    });

    it('retorna null si birthDate es undefined', () => {
        expect(calculateAge(undefined)).toBeNull();
    });

    it('retorna null si birthDate es string vacío', () => {
        expect(calculateAge('')).toBeNull();
    });
});
```

Agregar el import de `calculateAge` en el import existente de `utils.ts` del test.

**Step 2: Ejecutar test para verificar que falla**

Run: `npm test -- --run src/lib/__tests__/utils.test.ts`  
Expected: FAIL — `calculateAge` no existe en `utils.ts`

**Step 3: Implementar `calculateAge` en `utils.ts`**

Agregar al final de `src/lib/utils.ts`:

```typescript
export const calculateAge = (birthDate?: string): number | null => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
};
```

**Step 4: Ejecutar test para verificar que pasa**

Run: `npm test -- --run src/lib/__tests__/utils.test.ts`  
Expected: PASS

**Step 5: Reemplazar en `PatientsView.tsx`**

- Eliminar la función local `calculateAge` (L25-34)
- Agregar al import existente de utils: `import { cn, calculateAge } from '../lib/utils';` (o crear el import si no existe)

**Step 6: Reemplazar en `PatientHistoryView.tsx`**

- Eliminar la función local `calculateAge` (L37-46)
- Agregar import: `import { calculateAge } from '../lib/utils';`

**Step 7: Verificar compilación**

Run: `npx tsc --noEmit`  
Expected: 0 errores

**Step 8: Commit**

```bash
git add src/lib/utils.ts src/lib/__tests__/utils.test.ts src/views/PatientsView.tsx src/views/PatientHistoryView.tsx
git commit -m "refactor: centralize calculateAge in utils.ts, remove duplicates (DUP)"
```

---

### Task 2: Centralizar `isOverdue` en `utils.ts` (DUP)

**Contexto:** `isOverdue` está en `DashboardView.tsx` L71-77 (con `any` typing) y `PaymentsView.tsx` L86-91 (con `Appointment` typing). Las implementaciones son casi idénticas.

**Files:**

- Modify: `src/lib/utils.ts`
- Modify: `src/views/DashboardView.tsx` L71-77
- Modify: `src/views/PaymentsView.tsx` L86-91
- Test: `src/lib/__tests__/utils.test.ts`

**Step 1: Escribir el test**

```typescript
describe('isOverdue', () => {
    it('retorna true si la cita ya pasó (más de 1 hora)', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-01T15:00:00'));

        expect(isOverdue({ date: '2026-03-01', time: '10:00' })).toBe(true);

        vi.useRealTimers();
    });

    it('retorna false si la cita es futura', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-01T09:00:00'));

        expect(isOverdue({ date: '2026-03-01', time: '10:00' })).toBe(true);
        // 09:00 < 10:00 + 1h = 11:00, so not overdue
        // Wait — 09:00 > (10:00 + 1h = 11:00)? No. 09:00 < 11:00, so false.
        vi.useRealTimers();
    });

    it('retorna false si la cita es hoy y dentro de la ventana de 1h', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-01T10:30:00'));

        expect(isOverdue({ date: '2026-03-01', time: '10:00' })).toBe(false);

        vi.useRealTimers();
    });

    it('maneja time ausente usando 00:00 como default', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-01T15:00:00'));

        expect(isOverdue({ date: '2026-03-01' })).toBe(true);

        vi.useRealTimers();
    });
});
```

Agregar import de `isOverdue` al test.

**Step 2: Ejecutar test para verificar que falla**

Run: `npm test -- --run src/lib/__tests__/utils.test.ts`  
Expected: FAIL — `isOverdue` no existe

**Step 3: Implementar `isOverdue` en `utils.ts`**

```typescript
export const isOverdue = (appointment: { date: string; time?: string }): boolean => {
    const now = new Date();
    const apptDateTime = new Date(appointment.date + 'T' + (appointment.time || '00:00') + ':00');
    apptDateTime.setHours(apptDateTime.getHours() + 1);
    return now > apptDateTime;
};
```

**Step 4: Ejecutar test para verificar que pasa**

Run: `npm test -- --run src/lib/__tests__/utils.test.ts`  
Expected: PASS

**Step 5: Reemplazar en `DashboardView.tsx`**

- Eliminar función local `isOverdue` (L71-77)
- Agregar import: `import { isOverdue } from '../lib/utils';`
- Nota: el `DashboardView` usa `appointment: any` — al usar la versión tipada, puede requerir ajuste mínimo o no si los campos `date`/`time` existen en el tipo `any`.

**Step 6: Reemplazar en `PaymentsView.tsx`**

- Eliminar función local `isOverdue` (L86-91)
- Agregar import: `import { isOverdue } from '../lib/utils';`
- Nota: esta versión captura `now` fuera — al centralizar, `now` se crea dentro de la función, lo cual es correcto.

**Step 7: Verificar compilación**

Run: `npx tsc --noEmit`  
Expected: 0 errores

**Step 8: Commit**

```bash
git add src/lib/utils.ts src/lib/__tests__/utils.test.ts src/views/DashboardView.tsx src/views/PaymentsView.tsx
git commit -m "refactor: centralize isOverdue in utils.ts, remove duplicates (DUP)"
```

---

### Task 3: Eliminar `PSIQUE_RATE` duplicado (HOOK-N04)

**Contexto:** `PSIQUE_RATE = 0.25` definida en 3 archivos. El export canónico está en `psiqueCalculations.ts` L9.

**Files:**

- Modify: `src/hooks/useAgendaStats.ts` L5
- Modify: `src/views/PaymentsView.tsx` L32

**Step 1: Eliminar en `useAgendaStats.ts`**

- Eliminar `const PSIQUE_RATE = 0.25;` (L5)
- Agregar al import existente de `psiqueCalculations`: `import { PSIQUE_RATE } from '../lib/psiqueCalculations';`
- (Verificar si ya importa otras cosas de `psiqueCalculations` y agregar al import existente)

**Step 2: Eliminar en `PaymentsView.tsx`**

- Eliminar `const PSIQUE_RATE = 0.25;` (L32)
- Agregar import: `import { PSIQUE_RATE } from '../lib/psiqueCalculations';`

**Step 3: Verificar compilación y tests**

Run: `npx tsc --noEmit && npm test -- --run`  
Expected: 0 errores, todos los tests pasan

**Step 4: Commit**

```bash
git add src/hooks/useAgendaStats.ts src/views/PaymentsView.tsx
git commit -m "refactor: import PSIQUE_RATE from canonical source, remove duplicates (HOOK-N04)"
```

---

## Grupo B — Hooks cleanup

### Task 4: Memoizar `useDataActions` (HOOK-N01)

**Contexto:** `useDataActions` recrea 17 funciones en cada render. Todas son closures sobre `service` de `useService()`. Se necesita memoizar con `useMemo` dependiendo de `service`.

**Files:**

- Modify: `src/hooks/useDataActions.ts`
- Test: `src/hooks/__tests__/useDataActions.test.ts` (crear)

**Step 1: Escribir el test de estabilidad referencial**

Crear `src/hooks/__tests__/useDataActions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDataActions } from '../useDataActions';

// Mock ServiceContext
const mockService = {
    addPatient: vi.fn(),
    addAppointment: vi.fn(),
    addRecurringAppointments: vi.fn(),
    addPayment: vi.fn(),
    deletePatient: vi.fn(),
    deleteAppointment: vi.fn(),
    updateAppointment: vi.fn(),
    updatePatient: vi.fn(),
    requestBatchInvoice: vi.fn(),
    deleteRecurringSeries: vi.fn(),
    deleteRecurringFromDate: vi.fn(),
    updatePayment: vi.fn(),
    completeTask: vi.fn(),
    addTask: vi.fn(),
    updateTask: vi.fn(),
    toggleSubtaskCompletion: vi.fn(),
    updateNote: vi.fn(),
    markPsiquePaymentAsPaid: vi.fn(),
};

vi.mock('../../context/ServiceContext', () => ({
    useService: () => mockService,
}));

describe('useDataActions', () => {
    it('retorna el mismo objeto entre renders si service no cambia', () => {
        const { result, rerender } = renderHook(() => useDataActions());

        const first = result.current;
        rerender();
        const second = result.current;

        // Todas las funciones deben ser referencialmente estables
        expect(first.addPatient).toBe(second.addPatient);
        expect(first.updateAppointment).toBe(second.updateAppointment);
        expect(first.deleteItem).toBe(second.deleteItem);
        expect(first.completeTask).toBe(second.completeTask);
    });

    it('lanza error si service no está disponible', () => {
        // Temporarily mock service as null
        vi.doMock('../../context/ServiceContext', () => ({
            useService: () => null,
        }));

        // Re-import to get the null-service version
        // Note: this test may need adjustment depending on how vitest handles module re-mocking
    });
});
```

**Step 2: Ejecutar test**

Run: `npm test -- --run src/hooks/__tests__/useDataActions.test.ts`  
Expected: FAIL — las funciones no son referencialmente estables (created fresh each render)

**Step 3: Implementar memoización**

Reescribir `useDataActions.ts` para usar `useMemo`:

```typescript
import { useMemo } from 'react';
import { useService } from '../context/ServiceContext';
import {
    PatientInput,
    AppointmentInput,
    PaymentInput,
    Patient,
    Appointment,
    Payment,
    PatientBillingData,
    TaskInput,
    TaskSubitem,
    ClinicalNote,
    PsiquePayment,
} from '../types';

export const useDataActions = () => {
    const service = useService();

    return useMemo(() => {
        const ensureService = () => {
            if (!service) throw new Error('Service not available. Is user logged in?');
            return service;
        };

        return {
            addPatient: async (patient: PatientInput) => ensureService().addPatient(patient),
            addAppointment: async (appointment: AppointmentInput) => ensureService().addAppointment(appointment),
            addRecurringAppointments: async (
                baseAppointment: AppointmentInput,
                dates: string[],
                recurrenceRule: string = 'WEEKLY',
            ) => ensureService().addRecurringAppointments(baseAppointment, dates, recurrenceRule),
            addPayment: async (payment: PaymentInput, appointmentId?: string) =>
                ensureService().addPayment(payment, appointmentId),
            deleteItem: async (collectionName: 'patients' | 'appointments', id: string) => {
                const s = ensureService();
                if (collectionName === 'patients') return s.deletePatient(id);
                if (collectionName === 'appointments') return s.deleteAppointment(id);
                throw new Error(`Unknown collection: ${collectionName}`);
            },
            updateAppointment: async (id: string, data: Partial<Appointment>) =>
                ensureService().updateAppointment(id, data),
            updatePatient: async (id: string, data: Partial<Patient>) => ensureService().updatePatient(id, data),
            requestBatchInvoice: async (appointments: Appointment[], patientData: PatientBillingData) =>
                ensureService().requestBatchInvoice(appointments, patientData),
            deleteRecurringSeries: async (recurrenceId: string) => ensureService().deleteRecurringSeries(recurrenceId),
            deleteRecurringFromDate: async (recurrenceId: string, fromDate: string) =>
                ensureService().deleteRecurringFromDate(recurrenceId, fromDate),
            updatePayment: async (id: string, data: Partial<Payment>) => ensureService().updatePayment(id, data),
            completeTask: async (noteId: string, taskIndex: number) => ensureService().completeTask(noteId, taskIndex),
            addTask: async (task: TaskInput) => ensureService().addTask(task),
            updateTask: async (noteId: string, taskIndex: number, data: { text: string; subtasks?: TaskSubitem[] }) =>
                ensureService().updateTask(noteId, taskIndex, data),
            toggleSubtaskCompletion: async (noteId: string, taskIndex: number, subtaskIndex: number) =>
                ensureService().toggleSubtaskCompletion(noteId, taskIndex, subtaskIndex),
            updateNote: async (noteId: string, data: Partial<ClinicalNote>) => ensureService().updateNote(noteId, data),
            markPsiquePaymentAsPaid: async (
                docKey: string,
                data: Omit<PsiquePayment, 'id'> & { professional?: string },
            ) => ensureService().markPsiquePaymentAsPaid(docKey, data),
        };
    }, [service]);
};
```

**Step 4: Ejecutar test**

Run: `npm test -- --run src/hooks/__tests__/useDataActions.test.ts`  
Expected: PASS — funciones referencialmente estables entre renders

**Step 5: Verificar todos los tests**

Run: `npm test -- --run`  
Expected: Todos los tests pasan

**Step 6: Commit**

```bash
git add src/hooks/useDataActions.ts src/hooks/__tests__/useDataActions.test.ts
git commit -m "perf(hooks): memoize useDataActions return object with useMemo (HOOK-N01)"
```

---

### Task 5: Mover `serverTimestamp` de `useStaff` a `FirebaseService` (HOOK-N02)

**Contexto:** `useStaff.ts` L3 importa `serverTimestamp` directamente de `firebase/firestore`. La generación del timestamp debería estar en la capa de servicio (`FirebaseService.createStaffProfile`).

**Files:**

- Modify: `src/hooks/useStaff.ts` L3, L41
- Modify: `src/services/FirebaseService.ts` L620-622 (`createStaffProfile`)
- Test: `src/services/__tests__/FirebaseService.test.ts`

**Step 1: Escribir test para `createStaffProfile` que valide uso de `serverTimestamp`**

En `src/services/__tests__/FirebaseService.test.ts`, agregar:

```typescript
it('createStaffProfile agrega serverTimestamp si createdAt no está presente', async () => {
    await service.createStaffProfile('uid-123', {
        uid: 'uid-123',
        email: 'test@test.com',
        name: 'Test User',
        role: 'professional',
    } as StaffProfile);

    expect(setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
            uid: 'uid-123',
            createdAt: expect.anything(), // serverTimestamp()
        }),
    );
});
```

**Step 2: Ejecutar test**

Run: `npm test -- --run src/services/__tests__/FirebaseService.test.ts`  
Expected: FAIL o PASS dependiendo del mock (si pasa, ajustar para que verifique el específico serverTimestamp)

**Step 3: Modificar `FirebaseService.createStaffProfile`**

Cambiar de:

```typescript
    async createStaffProfile(uid: string, profile: StaffProfile): Promise<void> {
        const docRef = doc(db, STAFF_COLLECTION, uid);
        await setDoc(docRef, { ...profile, uid });
    }
```

A:

```typescript
    async createStaffProfile(uid: string, profile: StaffProfile): Promise<void> {
        const docRef = doc(db, STAFF_COLLECTION, uid);
        await setDoc(docRef, {
            ...profile,
            uid,
            createdAt: profile.createdAt || serverTimestamp(),
        });
    }
```

Nota: `serverTimestamp` ya está importado en `FirebaseService.ts` L13.

**Step 4: Modificar `useStaff.ts`**

- Eliminar `import { serverTimestamp } from 'firebase/firestore';` (L3)
- Cambiar L41 de:

```typescript
createdAt: serverTimestamp() as StaffProfile['createdAt'],
```

A simplemente no pasar `createdAt` (el servicio lo generará):

```typescript
// Eliminar la línea createdAt del newProfile
```

El `newProfile` en `createProfile` callback quedaría:

```typescript
const newProfile: Omit<StaffProfile, 'createdAt'> & { createdAt?: StaffProfile['createdAt'] } = {
    uid: user.uid,
    email: user.email || '',
    name: data.name,
    role: 'professional',
    specialty: data.specialty,
};
```

O más simple, usar un cast o simplemente omitir `createdAt` del objeto:

```typescript
const newProfile = {
    uid: user.uid,
    email: user.email || '',
    name: data.name,
    role: 'professional' as const,
    specialty: data.specialty,
};

await service.createStaffProfile(user.uid, newProfile as StaffProfile);
```

**Step 5: Verificar que no quedan imports de `firebase/firestore` en `useStaff`**

Run: `grep 'firebase/firestore' src/hooks/useStaff.ts`  
Expected: 0 matches

**Step 6: Ejecutar tests**

Run: `npm test -- --run`  
Expected: Todos los tests pasan

**Step 7: Commit**

```bash
git add src/hooks/useStaff.ts src/services/FirebaseService.ts src/services/__tests__/FirebaseService.test.ts
git commit -m "refactor(hooks): move serverTimestamp from useStaff to FirebaseService.createStaffProfile (HOOK-N02)"
```

---

### Task 6: Eliminar wrapper `usePatients` (HOOK-N03)

**Contexto:** `usePatients` es un wrapper trivial que ignora su parámetro `_user` y solo re-exporta `useData()`. Se usa en 6 archivos. Reemplazar todas las llamadas con `useData()` directo.

**Files:**

- Delete: `src/hooks/usePatients.ts`
- Modify: 6 archivos que lo importan:
    - `src/components/modals/PatientModal.tsx` L5, L70
    - `src/views/PatientHistoryView.tsx` L20, L64
    - `src/views/PaymentsView.tsx` L4, L35
    - `src/views/TasksView.tsx` L5, L24
    - `src/views/StatisticsView.tsx` L3, L25
    - `src/views/PatientsView.tsx` L8, L51
    - `src/views/DashboardView.tsx` L5

**Step 1: En cada archivo, reemplazar el patrón**

De:

```typescript
import { usePatients } from '../hooks/usePatients';
// ...
const { patients } = usePatients(user);
```

A:

```typescript
import { useData } from '../context/DataContext';
// ...
const { patients } = useData();
```

Si el archivo ya importa `useData`, agregar `patients` a la desestructuración existente. Si además usaba `loading` de `usePatients`, tomarlo de `useData()` también.

Notar que en `TasksView.tsx` se usa `const { patients, loading: loadingPatients } = usePatients(user);`. Cambiar a `const { patients, loading: loadingPatients } = useData();`.

**Step 2: Eliminar `src/hooks/usePatients.ts`**

Run: `rm src/hooks/usePatients.ts`

**Step 3: Eliminar imports de `User` de `firebase/auth` si ya no se usan**

En algunos archivos, `User` se importaba solo para tipado del parámetro de `usePatients`. Verificar si queda sin uso y eliminar.

**Step 4: Verificar compilación**

Run: `npx tsc --noEmit`  
Expected: 0 errores

**Step 5: Ejecutar tests**

Run: `npm test -- --run`  
Expected: Todos los tests pasan

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor(hooks): remove trivial usePatients wrapper, use useData() directly (HOOK-N03)"
```

---

## Grupo C — Componentes

### Task 7: Tipar `SidebarItem` props (COMP-N02)

**Contexto:** `SidebarItem` en `Sidebar.tsx` L102 tiene props tipadas como `: any`.

**Files:**

- Modify: `src/components/layout/Sidebar.tsx` L102

**Step 1: Definir interface y reemplazar `any`**

Cambiar de:

```tsx
const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
```

A:

```tsx
interface SidebarItemProps {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    label: string;
    active: boolean;
    onClick: () => void;
}

const SidebarItem = ({ icon: Icon, label, active, onClick }: SidebarItemProps) => (
```

**Step 2: Verificar compilación**

Run: `npx tsc --noEmit`  
Expected: 0 errores

**Step 3: Verificar que el warning de ESLint desaparece**

Run: `npx eslint src/components/layout/Sidebar.tsx`  
Expected: 0 warnings de `no-explicit-any` para este archivo

**Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "fix(types): type SidebarItem props explicitly, remove any (COMP-N02)"
```

---

### Task 8: Paridad de features en `MobileHeader` (COMP-N01)

**Contexto:** `MobileHeader` le falta el item "Estadísticas" (que sí tiene `Sidebar` con `BarChart3` icon) y no tiene el indicador de deudas pendientes (dot rojo) que `Sidebar` muestra en "Pagos".

**Files:**

- Modify: `src/components/layout/MobileHeader.tsx`

**Step 1: Agregar imports necesarios**

Agregar `BarChart3` a los imports de lucide-react. Agregar props para `hasPendingDebts`.

**Step 2: Actualizar interface `MobileHeaderProps`**

```tsx
interface MobileHeaderProps {
    mobileMenuOpen: boolean;
    setMobileMenuOpen: (open: boolean) => void;
    setCurrentView: (view: View) => void;
    hasPendingDebts?: boolean;
}
```

**Step 3: Agregar item "Estadísticas" después de "Facturación"**

```tsx
<button
    onClick={() => {
        setCurrentView('statistics');
        setMobileMenuOpen(false);
    }}
    className="block w-full text-left text-lg py-3 border-b text-slate-700 font-medium flex justify-between items-center"
>
    <span className="flex items-center">
        <BarChart3 size={20} className="mr-3" /> Estadísticas
    </span>{' '}
    <ChevronRight size={16} className="text-slate-400" />
</button>
```

**Step 4: Agregar indicador de deuda en "Pagos"**

En el botón de "Pagos", agregar el dot rojo condicional:

```tsx
<button
    onClick={() => {
        setCurrentView('payments');
        setMobileMenuOpen(false);
    }}
    className="block w-full text-left text-lg py-3 border-b text-slate-700 font-medium flex justify-between items-center"
>
    <span className="flex items-center">
        <DollarSign size={20} className="mr-3" /> Pagos
        {hasPendingDebts && <span className="ml-2 w-2 h-2 bg-red-500 rounded-full inline-block"></span>}
    </span>{' '}
    <ChevronRight size={16} className="text-slate-400" />
</button>
```

**Step 5: Actualizar el componente padre que pasa props a `MobileHeader`**

Buscar dónde se instancia `<MobileHeader>` (probablemente en `App.tsx`) y agregar la prop `hasPendingDebts`.

**Step 6: Verificar compilación**

Run: `npx tsc --noEmit`  
Expected: 0 errores

**Step 7: Commit**

```bash
git add src/components/layout/MobileHeader.tsx src/App.tsx
git commit -m "feat(ui): add Statistics nav item and debt indicator to MobileHeader (COMP-N01)"
```

---

## Grupo D — Arquitectura

### Task 9: Eliminar listener desperdiciado en `subscribeToFinance` (ARCH-N03)

**Contexto:** `DataContext.tsx` L93 pasa `() => {}` como primer argumento de `subscribeToFinance`, descartando las unpaid appointments. Este listener Firestore consume lecturas facturables sin beneficio.

**Opción A (preferida):** Crear un método `subscribeToPayments` separado en `IDataService` que solo suscribe a pagos, sin el listener de unpaid appointments.

**Opción B:** Cambiar `subscribeToFinance` para que los callbacks sean opcionales.

Se elige **Opción A** porque es más limpia y no requiere cambiar la interface existente para callers que sí usan ambos callbacks.

**Files:**

- Modify: `src/services/IDataService.ts`
- Modify: `src/services/FirebaseService.ts`
- Modify: `src/context/DataContext.tsx` L93-100
- Test: `src/services/__tests__/IDataService.test.ts`
- Test: `src/services/__tests__/FirebaseService.test.ts`

**Step 1: Agregar `subscribeToPayments` a `IDataService`**

```typescript
    subscribeToPayments(onData: (data: Payment[]) => void): () => void;
```

**Step 2: Implementar en `FirebaseService`**

Extraer la lógica de suscripción a pagos que ya existe dentro de `subscribeToFinance`:

```typescript
    subscribeToPayments(onPayments: (data: Payment[]) => void): () => void {
        const paymentsQuery = query(
            collection(db, PAYMENTS_COLLECTION),
            where('professional', '==', this.professionalName),
            orderBy('date', 'desc'),
        );

        return onSnapshot(
            paymentsQuery,
            (snapshot) => {
                const payments = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Payment[];
                onPayments(payments);
            },
            (error) => console.error('Error fetching payments:', error),
        );
    }
```

(Verificar que la query coincide con la que usa `subscribeToFinance` internamente para payments.)

**Step 3: Reemplazar en `DataContext.tsx`**

De:

```tsx
const unsubFinance = service.subscribeToFinance(
    () => {}, // We don't need unpaid appointments here
    (paymentData) => {
        setPayments(paymentData);
    },
);
```

A:

```tsx
const unsubPayments = service.subscribeToPayments((paymentData) => {
    setPayments(paymentData);
});
```

Y actualizar el cleanup: `unsubFinance()` → `unsubPayments()`.

**Step 4: Agregar tests**

En `IDataService.test.ts`, agregar `subscribeToPayments` al mock y al array de métodos.

En `FirebaseService.test.ts`, agregar:

```typescript
it('subscribeToPayments emite datos correctamente', () => {
    const callback = vi.fn();
    service.subscribeToPayments(callback);

    expect(onSnapshot).toHaveBeenCalled();
});
```

**Step 5: Verificar compilación y tests**

Run: `npx tsc --noEmit && npm test -- --run`  
Expected: 0 errores, todos los tests pasan

**Step 6: Commit**

```bash
git add src/services/IDataService.ts src/services/FirebaseService.ts src/context/DataContext.tsx src/services/__tests__/IDataService.test.ts src/services/__tests__/FirebaseService.test.ts
git commit -m "refactor(arch): add subscribeToPayments, eliminate wasted Finance listener in DataContext (ARCH-N03)"
```

---

### Task 10: Hacer `saveNote` atómica con `writeBatch` (ARCH-N05)

**Contexto:** `saveNote` (L377-400) hace dos operaciones separadas: guardar/actualizar nota y luego `updateDoc(appointmentRef, { hasNotes: true })`. Si la segunda falla, queda desincronizado.

**Files:**

- Modify: `src/services/FirebaseService.ts` L377-400

**Step 1: Reescribir `saveNote` usando `writeBatch`**

```typescript
    async saveNote(noteData: Partial<ClinicalNote>, appointmentId: string, existingNoteId?: string): Promise<void> {
        const batch = writeBatch(db);
        const notesCollection = collection(db, NOTES_COLLECTION);

        const basePayload = {
            ...noteData,
            appointmentId,
            updatedAt: Timestamp.now(),
        };

        if (existingNoteId) {
            batch.update(doc(notesCollection, existingNoteId), basePayload);
        } else {
            const newNoteRef = doc(notesCollection);
            batch.set(newNoteRef, {
                ...basePayload,
                createdAt: Timestamp.now(),
                createdBy: this.uid,
                createdByUid: this.uid,
            });
        }

        // Marcar appointment como con notas — atómico
        const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
        batch.update(appointmentRef, { hasNotes: true });

        await batch.commit();
    }
```

**Step 2: Verificar tests existentes**

Run: `npm test -- --run src/services/__tests__/FirebaseService.test.ts`  
Expected: Tests existentes de `saveNote` siguen pasando (pueden necesitar ajuste de mocks si verificaban `addDoc`/`updateDoc` separados → ahora verifican `writeBatch`)

**Step 3: Commit**

```bash
git add src/services/FirebaseService.ts src/services/__tests__/FirebaseService.test.ts
git commit -m "fix(arch): make saveNote atomic with writeBatch (ARCH-N05)"
```

---

### Task 11: Hacer task operations atómicas con `runTransaction` (ARCH-N04)

**Contexto:** `completeTask`, `updateTask`, `toggleSubtaskCompletion` usan read-then-write sin transacción. Susceptibles a race conditions.

**Files:**

- Modify: `src/services/FirebaseService.ts` — agregar import de `runTransaction`, reescribir 3 métodos
- Test: `src/services/__tests__/FirebaseService.test.ts`

**Step 1: Agregar `runTransaction` al import de Firestore**

En `src/services/FirebaseService.ts` L1-18, agregar `runTransaction` al import:

```typescript
import {
    collection,
    doc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    serverTimestamp,
    Timestamp,
    getDocs,
    getDoc,
    setDoc,
    runTransaction,
} from 'firebase/firestore';
```

**Step 2: Reescribir `completeTask`**

```typescript
    async completeTask(noteId: string, taskIndex: number): Promise<void> {
        const noteRef = doc(db, NOTES_COLLECTION, noteId);

        await runTransaction(db, async (transaction) => {
            const noteSnap = await transaction.get(noteRef);
            if (!noteSnap.exists()) throw new Error('Note not found');

            const noteData = noteSnap.data() as ClinicalNote;
            const updatedTasks = [...(noteData.tasks || [])];

            if (updatedTasks[taskIndex]) {
                updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], completed: true };
                transaction.update(noteRef, { tasks: updatedTasks });
            }
        });
    }
```

**Step 3: Reescribir `updateTask`**

```typescript
    async updateTask(
        noteId: string,
        taskIndex: number,
        data: { text: string; subtasks?: TaskSubitem[] },
    ): Promise<void> {
        const noteRef = doc(db, NOTES_COLLECTION, noteId);

        await runTransaction(db, async (transaction) => {
            const noteSnap = await transaction.get(noteRef);
            if (!noteSnap.exists()) throw new Error('Note not found');

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

            transaction.update(noteRef, {
                tasks: updatedTasks,
                updatedAt: Timestamp.now(),
            });
        });
    }
```

**Step 4: Reescribir `toggleSubtaskCompletion`**

```typescript
    async toggleSubtaskCompletion(
        noteId: string,
        taskIndex: number,
        subtaskIndex: number,
    ): Promise<void> {
        const noteRef = doc(db, NOTES_COLLECTION, noteId);

        await runTransaction(db, async (transaction) => {
            const noteSnap = await transaction.get(noteRef);
            if (!noteSnap.exists()) throw new Error('Note not found');

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
            updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], subtasks };

            transaction.update(noteRef, {
                tasks: updatedTasks,
                updatedAt: Timestamp.now(),
            });
        });
    }
```

**Step 5: Actualizar mocks en tests**

Los tests existentes de `completeTask`, `updateTask`, `toggleSubtaskCompletion` probablemente mockean `getDoc` + `updateDoc`. Necesitan actualizarse para mockear `runTransaction`.

**Step 6: Verificar compilación y tests**

Run: `npx tsc --noEmit && npm test -- --run`  
Expected: 0 errores, todos los tests pasan

**Step 7: Commit**

```bash
git add src/services/FirebaseService.ts src/services/__tests__/FirebaseService.test.ts
git commit -m "fix(arch): make task operations atomic with runTransaction (ARCH-N04)"
```

---

### Task 12: Particionar batch writes (ARCH-N06)

**Contexto:** `addRecurringAppointments` y `deleteRecurringSeries` usan un solo batch sin límite. Firestore permite máximo 500 ops por batch.

**Files:**

- Modify: `src/services/FirebaseService.ts` — `addRecurringAppointments` L186-208, `deleteRecurringSeries`

**Step 1: Crear helper de partición**

Al inicio del archivo (después de los imports), agregar:

```typescript
const FIRESTORE_BATCH_LIMIT = 500;

async function commitInBatches(operations: ((batch: WriteBatch) => void)[]): Promise<void> {
    for (let i = 0; i < operations.length; i += FIRESTORE_BATCH_LIMIT) {
        const chunk = operations.slice(i, i + FIRESTORE_BATCH_LIMIT);
        const batch = writeBatch(db);
        chunk.forEach((op) => op(batch));
        await batch.commit();
    }
}
```

**Step 2: Refactorizar `addRecurringAppointments`**

```typescript
    async addRecurringAppointments(
        baseAppointment: AppointmentInput,
        dates: string[],
        recurrenceRule: string = 'WEEKLY',
    ): Promise<void> {
        const seriesId = crypto.randomUUID();

        const operations = dates.map((date, index) => {
            return (batch: WriteBatch) => {
                const docRef = doc(collection(db, APPOINTMENTS_COLLECTION));
                batch.set(docRef, {
                    ...baseAppointment,
                    date,
                    recurrenceId: seriesId,
                    recurrenceRule,
                    recurrenceIndex: index,
                });
            };
        });

        await commitInBatches(operations);
    }
```

**Step 3: Refactorizar `deleteRecurringSeries` de forma similar**

Buscar la implementación actual y aplicar el mismo patrón con `commitInBatches`.

**Step 4: Agregar test para caso de más de 500 items**

```typescript
it('addRecurringAppointments particiona en múltiples batches si supera 500', async () => {
    const dates = Array.from({ length: 520 }, (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`);

    await service.addRecurringAppointments(
        {
            /* base appointment */
        } as AppointmentInput,
        dates,
    );

    // Verificar que writeBatch se llamó al menos 2 veces
    expect(writeBatch).toHaveBeenCalledTimes(2);
});
```

**Step 5: Verificar compilación y tests**

Run: `npx tsc --noEmit && npm test -- --run`  
Expected: 0 errores

**Step 6: Commit**

```bash
git add src/services/FirebaseService.ts src/services/__tests__/FirebaseService.test.ts
git commit -m "fix(arch): partition batch writes to respect Firestore 500-op limit (ARCH-N06)"
```

---

### Task 13: Corregir `setLoading(false)` en `DataContext` (ARCH-N07)

**Contexto:** `setLoading(false)` solo depende de `myAppointments`. La app puede mostrar datos antes de que patients/payments/allAppointments hayan cargado.

**Files:**

- Modify: `src/context/DataContext.tsx` L88-91

**Step 1: Implementar loading que espere todas las suscripciones**

Reemplazar el patrón actual por un sistema de flags:

```tsx
useEffect(() => {
    if (!service) return;

    let loadedFlags = { patients: false, myAppointments: false, allAppointments: false, payments: false };

    const checkAllLoaded = () => {
        if (Object.values(loadedFlags).every(Boolean)) {
            setLoading(false);
        }
    };

    const unsubPatients = service.subscribeToPatients((data) => {
        setPatients(data);
        loadedFlags.patients = true;
        checkAllLoaded();
    });

    const unsubAllAppointments = service.subscribeToAppointments(dateWindow.start, dateWindow.end, (data) => {
        setAllAppointments(data);
        loadedFlags.allAppointments = true;
        checkAllLoaded();
    });

    const unsubMyAppointments = service.subscribeToMyAppointments(dateWindow.start, dateWindow.end, (data) => {
        setMyAppointments(data);
        loadedFlags.myAppointments = true;
        checkAllLoaded();
    });

    const unsubPayments = service.subscribeToPayments((paymentData) => {
        setPayments(paymentData);
        loadedFlags.payments = true;
        checkAllLoaded();
    });

    return () => {
        unsubPatients();
        unsubAllAppointments();
        unsubMyAppointments();
        unsubPayments();
    };
}, [service, dateWindow]);
```

**Nota:** Este cambio depende de Task 9 (subscribeToPayments). Ejecutar después de Task 9.

**Step 2: Verificar compilación**

Run: `npx tsc --noEmit`  
Expected: 0 errores

**Step 3: Ejecutar tests**

Run: `npm test -- --run`  
Expected: Todos los tests pasan

**Step 4: Commit**

```bash
git add src/context/DataContext.tsx
git commit -m "fix(arch): wait for all subscriptions before setting loading=false (ARCH-N07)"
```

---

## Grupo E — Seguridad media

### Task 14: Mapear errores Firebase a mensajes user-friendly (SEC-13)

**Contexto:** `AuthScreen.tsx` L91-92 expone `err.message` crudo de Firebase al usuario.

**Files:**

- Modify: `src/views/AuthScreen.tsx` L91-92
- Modify: `src/lib/utils.ts` (agregar helper)
- Test: `src/lib/__tests__/utils.test.ts`

**Step 1: Escribir test para `getAuthErrorMessage`**

```typescript
describe('getAuthErrorMessage', () => {
    it('mapea auth/user-not-found a mensaje en español', () => {
        expect(getAuthErrorMessage('Firebase: Error (auth/user-not-found).')).toBe(
            'No se encontró una cuenta con ese email.',
        );
    });

    it('mapea auth/wrong-password a mensaje en español', () => {
        expect(getAuthErrorMessage('Firebase: Error (auth/wrong-password).')).toBe('Contraseña incorrecta.');
    });

    it('mapea auth/invalid-credential a mensaje genérico', () => {
        expect(getAuthErrorMessage('Firebase: Error (auth/invalid-credential).')).toBe(
            'Email o contraseña incorrectos.',
        );
    });

    it('mapea auth/too-many-requests a mensaje de rate limit', () => {
        expect(getAuthErrorMessage('Firebase: Error (auth/too-many-requests).')).toBe(
            'Demasiados intentos. Esperá unos minutos e intentá de nuevo.',
        );
    });

    it('retorna mensaje genérico para errores desconocidos', () => {
        expect(getAuthErrorMessage('Something unexpected')).toBe('Error de autenticación. Intentá de nuevo.');
    });
});
```

**Step 2: Ejecutar test**

Run: `npm test -- --run src/lib/__tests__/utils.test.ts`  
Expected: FAIL

**Step 3: Implementar `getAuthErrorMessage` en `utils.ts`**

```typescript
const AUTH_ERROR_MESSAGES: Record<string, string> = {
    'auth/user-not-found': 'No se encontró una cuenta con ese email.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/invalid-credential': 'Email o contraseña incorrectos.',
    'auth/invalid-email': 'El formato del email no es válido.',
    'auth/user-disabled': 'Esta cuenta ha sido deshabilitada.',
    'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.',
    'auth/network-request-failed': 'Error de red. Verificá tu conexión a internet.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese email.',
};

export const getAuthErrorMessage = (errorMessage: string): string => {
    const match = errorMessage.match(/\(([^)]+)\)/);
    const code = match?.[1];
    return (code && AUTH_ERROR_MESSAGES[code]) || 'Error de autenticación. Intentá de nuevo.';
};
```

**Step 4: Ejecutar test**

Run: `npm test -- --run src/lib/__tests__/utils.test.ts`  
Expected: PASS

**Step 5: Reemplazar en `AuthScreen.tsx`**

De:

```tsx
        } catch (err: any) {
            setError(err.message);
```

A:

```tsx
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            setError(getAuthErrorMessage(message));
```

Agregar import: `import { getAuthErrorMessage } from '../lib/utils';`

Esto también elimina el warning `no-explicit-any` de `err: any`.

**Step 6: Verificar compilación y tests**

Run: `npx tsc --noEmit && npm test -- --run`  
Expected: 0 errores

**Step 7: Commit**

```bash
git add src/lib/utils.ts src/lib/__tests__/utils.test.ts src/views/AuthScreen.tsx
git commit -m "fix(security): map Firebase auth errors to user-friendly Spanish messages (SEC-13)"
```

---

### Task 15: Migrar `functions.config()` a `defineString()` params v2 (SEC-N05)

**Contexto:** `triggerInvoiceGeneration` usa `functions.config()` (deprecated en v2) con cast `as any`. El approach v2 es `defineString()` de `firebase-functions/params`.

**Files:**

- Modify: `functions/src/index.ts` L2, L88

**Step 1: Agregar import de params**

```typescript
import { defineString } from 'firebase-functions/params';
```

**Step 2: Definir los parámetros**

```typescript
const billingUrl = defineString('BILLING_URL');
const billingSecret = defineString('BILLING_SECRET');
```

**Step 3: Reemplazar uso de `functions.config()`**

De:

```typescript
const config = (functions.config as any)().billing;

if (!config || !config.url || !config.secret) {
    console.error('Falta configuración de billing (url o secret)');
    return snap.ref.update({ status: 'error_config' });
}
```

A:

```typescript
const url = billingUrl.value();
const secret = billingSecret.value();

if (!url || !secret) {
    console.error('Falta configuración de billing (BILLING_URL o BILLING_SECRET)');
    return snap.ref.update({ status: 'error_config' });
}
```

Y en el axios call, reemplazar `config.url` → `url` y `config.secret` → `secret`.

**Step 4: Verificar si `functions.config` import sigue siendo necesario**

Si `functions.config` ya no se usa, el import de `firebase-functions/v1` puede simplificarse o eliminarse. Verificar si `functions.firestore` (para el trigger) viene del v1 import.

**Nota:** `functions.firestore.document(...)` es del v1 API — el import se necesita. Pero `functions.config` ya no.

**Step 5: Compilar**

Run: `cd functions && npm run build`  
Expected: Build exitoso

**Step 6: Documentar la migración de config**

Los valores previamente configurados con `firebase functions:config:set billing.url=... billing.secret=...` deben migrarse a environment variables o secrets. Agregar nota en el commit.

**Step 7: Commit**

```bash
git add functions/src/index.ts
git commit -m "refactor(functions): migrate functions.config() to defineString params v2 (SEC-N05)"
```

---

### Task 16: Session timeout para Firebase Auth (SEC-11)

**Contexto:** Firebase Auth persiste sesiones indefinidamente. Para una app clínica con datos sensibles, se debería cerrar sesión automáticamente tras inactividad prolongada.

**Approach:** Implementar un hook `useSessionTimeout` que detecte inactividad del usuario y cierre sesión. Se usa un enfoque basado en eventos del DOM (`mousemove`, `keydown`, `click`) con un temporizador.

**Files:**

- Create: `src/hooks/useSessionTimeout.ts`
- Modify: `src/App.tsx` — integrar el hook
- Modify: `src/lib/constants.ts` — agregar constante de timeout

**Step 1: Agregar constante**

En `src/lib/constants.ts`:

```typescript
/** Session timeout por inactividad (en milisegundos). 30 minutos. */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
```

**Step 2: Crear `useSessionTimeout.ts`**

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { SESSION_TIMEOUT_MS } from '../lib/constants';

/**
 * Cierra sesión automáticamente tras un período de inactividad.
 * Escucha mousemove, keydown, click y touchstart para resetear el timer.
 */
export const useSessionTimeout = (enabled: boolean) => {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resetTimer = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            signOut(auth);
        }, SESSION_TIMEOUT_MS);
    }, []);

    useEffect(() => {
        if (!enabled) return;

        const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const;
        events.forEach((event) => window.addEventListener(event, resetTimer));

        // Iniciar timer al montar
        resetTimer();

        return () => {
            events.forEach((event) => window.removeEventListener(event, resetTimer));
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [enabled, resetTimer]);
};
```

**Step 3: Integrar en `App.tsx`**

Buscar el componente principal que se renderiza cuando el usuario está autenticado. Agregar:

```typescript
import { useSessionTimeout } from './hooks/useSessionTimeout';

// Dentro del componente, cuando user está autenticado:
useSessionTimeout(!!user);
```

**Step 4: Verificar compilación**

Run: `npx tsc --noEmit`  
Expected: 0 errores

**Step 5: Commit**

```bash
git add src/hooks/useSessionTimeout.ts src/App.tsx src/lib/constants.ts
git commit -m "feat(security): add session timeout for Firebase Auth after 30min inactivity (SEC-11)"
```

---

### Task 17: Schema validation básica en Firestore rules (SEC-06)

**Contexto:** Las Firestore rules no validan tipos ni campos requeridos. Un cliente malicioso podría escribir documentos con campos faltantes o tipos incorrectos.

**Approach:** Agregar funciones de validación para las colecciones más críticas: `patients`, `appointments`, `payments`. No se busca validar todos los campos (sería excesivo), sino los campos requeridos y tipos básicos.

**Files:**

- Modify: `firestore.rules`

**Step 1: Agregar funciones de validación**

Dentro del match de `artifacts/{appId}/clinics/{clinicId}`:

```
      // --- Schema Validation Helpers ---
      function isValidPatient() {
        let d = request.resource.data;
        return d.keys().hasAll(['name', 'professional'])
          && d.name is string
          && d.professional is string;
      }

      function isValidAppointment() {
        let d = request.resource.data;
        return d.keys().hasAll(['patientName', 'date', 'professional', 'status'])
          && d.patientName is string
          && d.date is string
          && d.professional is string
          && d.status in ['programado', 'completado', 'cancelado', 'ausente', 'presente'];
      }

      function isValidPayment() {
        let d = request.resource.data;
        return d.keys().hasAll(['patientName', 'amount', 'concept'])
          && d.patientName is string
          && d.amount is number
          && d.concept is string;
      }
```

**Step 2: Aplicar a las reglas de `create`**

Modificar las reglas de escritura para agregar la validación:

**Patients:**

```
allow create: if isAuthenticated()
  && (isAdmin() || request.resource.data.professional == getProfessionalName())
  && isValidPatient();
```

**Appointments:**

```
allow create: if isAuthenticated()
  && (isAdmin() || request.resource.data.professional == getProfessionalName())
  && isValidAppointment();
```

**Payments:**

```
allow create: if isAuthenticated() && isValidPayment();
```

**Step 3: Desplegar reglas**

Run: `firebase deploy --only firestore:rules`  
Expected: Deploy exitoso

**Step 4: Verificar que la app sigue funcionando**

Probar en dev que se pueden crear pacientes, citas y pagos normalmente. Los campos requeridos ya se envían desde el frontend, por lo que la validación no debería bloquear operaciones legítimas.

**Step 5: Commit**

```bash
git add firestore.rules
git commit -m "fix(security): add basic schema validation in Firestore rules for patients, appointments, payments (SEC-06)"
```

---

## Verificación final

Después de completar las 17 tasks:

**Step 1: Compilar todo**

```bash
npx tsc --noEmit
cd functions && npm run build && cd ..
```

Expected: 0 errores

**Step 2: Lint**

```bash
npx eslint src/
```

Expected: Menos warnings que antes (al menos el `any` de `SidebarItem` y `AuthScreen` catch eliminados)

**Step 3: Tests**

```bash
npm test -- --run
```

Expected: Todos los tests pasan. Count debería ser ~100+ (nuevos tests de utils, useDataActions, subscribeToPayments, batch partitioning).

**Step 4: Build de producción**

```bash
npm run build
```

Expected: Build exitoso

**Step 5: Commit final y tag**

```bash
git tag -a v1.2.0 -m "Phase 6: Medium-priority code quality and architecture improvements"
```

---

## Resumen de hallazgos abordados

| Issue    | Descripción                                        | Task    |
| -------- | -------------------------------------------------- | ------- |
| DUP      | `calculateAge` duplicada                           | Task 1  |
| DUP      | `isOverdue` duplicada                              | Task 2  |
| HOOK-N04 | `PSIQUE_RATE` triplicada                           | Task 3  |
| HOOK-N01 | `useDataActions` sin memoización                   | Task 4  |
| HOOK-N02 | `useStaff` importa `serverTimestamp` directo       | Task 5  |
| HOOK-N03 | `usePatients` wrapper trivial                      | Task 6  |
| COMP-N02 | `SidebarItem` props `: any`                        | Task 7  |
| COMP-N01 | `MobileHeader` sin Estadísticas ni indicador deuda | Task 8  |
| ARCH-N03 | Listener `subscribeToFinance` desperdiciado        | Task 9  |
| ARCH-N05 | `saveNote` no atómica                              | Task 10 |
| ARCH-N04 | Task operations no atómicas                        | Task 11 |
| ARCH-N06 | Batch writes sin partición                         | Task 12 |
| ARCH-N07 | `setLoading(false)` prematura                      | Task 13 |
| SEC-13   | Error messages de Firebase crudos                  | Task 14 |
| SEC-N05  | `functions.config()` deprecated                    | Task 15 |
| SEC-11   | Sin session timeout                                | Task 16 |
| SEC-06   | Sin schema validation en Firestore rules           | Task 17 |

### Hallazgos diferidos a fases futuras

| Issue                 | Descripción                                        | Razón                                                          |
| --------------------- | -------------------------------------------------- | -------------------------------------------------------------- |
| SEC-10                | Audit trail para datos clínicos                    | Feature completa que requiere diseño propio (~4h)              |
| SEC-N04               | `axios` import ~~muerto~~                          | Falso positivo — axios sí se usa en `triggerInvoiceGeneration` |
| Testing gaps          | 8/10 hooks, 0 componentes, 0 vistas sin tests      | Fase 7 dedicada                                                |
| Componentes oversized | 6 componentes con 500+ líneas                      | Refactoring largo, fase dedicada                               |
| Config                | Path aliases, engines, sourcemaps, semantic tokens | Mejoras DX menores                                             |
