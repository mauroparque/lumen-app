# Phase 4: Performance, Accesibilidad y Service Layer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cerrar la deuda técnica pendiente de Fases 1-3: optimizar bundle size, corregir la ventana de datos estática, agregar accesibilidad a modals, completar la migración del service layer (`useStaff`, `useBillingStatus`), y agregar tests unitarios para `FirebaseService`.

**Architecture:** La fase se divide en 5 grupos independientes ejecutables en cualquier orden. Cada grupo ataca un hallazgo específico de la auditoría y puede ser mergeado como una PR independiente.

**Tech Stack:** React 18, TypeScript, Vite 5, Firebase/Firestore, Vitest, TailwindCSS

**Auditoría de referencia:** [`docs/audits/2026-02-19_AUDIT.md`](../audits/2026-02-19_AUDIT.md)

**Revisión anterior:** [`docs/reviews/2026-02-24_phase3-completion-review.md`](../reviews/2026-02-24_phase3-completion-review.md)

**Review de cierre:** [`docs/reviews/2026-02-26_phase4-completion-review.md`](../reviews/2026-02-26_phase4-completion-review.md)

---

## Estado actual del proyecto

### Fases completadas

| Fase | Foco | Estado |
| --- | --- | --- |
| Fase 1 | Seguridad (RBAC, CSP, Turnstile, Firestore rules) | ✅ Completada |
| Fase 2 | Estabilidad, DX y Arquitectura (ESLint, ErrorBoundary, hooks) | ✅ Completada |
| Fase 3 | Testing & Cleanup (coverage expansion, lint 0 errors, psiqueCalculations) | ✅ Completada |

### Deuda técnica pendiente (entrada a Fase 4)

| ID | Área | Origen | Prioridad |
| --- | --- | --- | --- |
| BUILD-01 | Bundle 693KB sin `manualChunks` | Auditoría original | Media |
| DATA-01 | Ventana de datos estática (stale en sesiones largas PWA) | Auditoría original | Media |
| A11Y-01 | `ModalOverlay` sin `role="dialog"`, ARIA, focus trap, Escape | Auditoría original | Media |
| ARCH-01 (rem.) | `useStaff.ts` bypasea `IDataService` (interface lista, hook pendiente) | Fase 3 parcial | Baja |
| ARCH-01 (rem.) | `useBillingStatus.ts` bypasea `IDataService` | Fase 3 no abordado | Media |
| TEST-01 (rem.) | `FirebaseService` 17+ métodos sin tests unitarios | Auditoría original | Media |

### Métricas actuales

| Métrica | Valor |
| --- | --- |
| `npx eslint src/` | 0 errors, 11 warnings (`no-explicit-any`) |
| `npx tsc --noEmit` | 0 errores |
| `npm test` | ~40 tests (5 archivos) |
| `npm run build` | Build exitoso, bundle index ~693KB |
| Coverage scope | 4 archivos |

---

## Grupos de trabajo

---

### Grupo A — Performance: Bundle Splitting (BUILD-01)

**Hallazgo original:** El chunk `index-*.js` pesa 693KB (178KB gzip). Firebase SDK, React, y todo el código de la app están en un único archivo. Vite emite warning de chunk > 500KB.

**Objetivo:** Separar Firebase, React/vendor, y código de app en chunks independientes para mejorar caching y tiempos de carga.

---

#### Task 1: Configurar `manualChunks` en Vite

**Files:**
- Modify: `vite.config.ts`

**Step 1: Agregar `build.rollupOptions.output.manualChunks` a `vite.config.ts`**

Agregar la sección `build` al `defineConfig`:

```typescript
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            // ... existing config remains unchanged
        })
    ],
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom'],
                    'vendor-firebase': [
                        'firebase/app',
                        'firebase/auth',
                        'firebase/firestore',
                        'firebase/storage',
                        'firebase/functions',
                    ],
                    'vendor-ui': ['lucide-react', 'sonner'],
                },
            },
        },
    },
})
```

**Step 2: Ejecutar build y verificar splitting**

Run: `npm run build`
Expected: El chunk `index-*.js` debe bajar de 693KB. Deben aparecer chunks separados para `vendor-react`, `vendor-firebase`, `vendor-ui`. Ningún chunk debe exceder 500KB.

**Step 3: Verificar que la app carga correctamente**

Run: `npm run preview`
Expected: La app debe cargar sin errores en consola. Navegar entre vistas debe funcionar.

**Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "perf(build): add manualChunks splitting for Firebase, React, and UI vendors"
```

---

### Grupo B — Data Freshness: Stale Date Window (DATA-01)

**Hallazgo original:** La ventana de suscripción (-3 a +6 meses) en `DataContext.tsx` se calcula una sola vez al montar el contexto. Si la PWA queda abierta, los datos se vuelven stale al cruzar límites de fecha.

**Objetivo:** Recalcular la ventana de fechas periódicamente y al volver de background (visibility change).

---

#### Task 2: Agregar recálculo de ventana de fechas en DataContext

**Files:**
- Modify: `src/context/DataContext.tsx`

**Step 1: Agregar función `getDateWindow` y state para la key**

Extraer la lógica de cálculo de fechas a una función pura reutilizable, y agregar un mecanismo de re-suscripción:

```typescript
/** Calcula la ventana de fechas para las suscripciones Firestore */
function getDateWindow(): { start: string; end: string } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 6, 0);
    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
    };
}
```

**Step 2: Agregar efecto de visibilitychange + intervalo diario**

Agregar un `useEffect` que escuche `visibilitychange` y un intervalo de 24h. Cuando el día cambia, re-calcular la ventana y forzar re-suscripción:

```typescript
// Inside DataProvider, add a state to track the current window dates
const [dateWindow, setDateWindow] = useState(getDateWindow);

useEffect(() => {
    const checkWindow = () => {
        const newWindow = getDateWindow();
        setDateWindow(prev => {
            if (prev.start !== newWindow.start || prev.end !== newWindow.end) {
                return newWindow;
            }
            return prev;
        });
    };

    // Check on visibility change (tab switch, phone unlock)
    const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
            checkWindow();
        }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    // Check every 4 hours as safety net
    const interval = setInterval(checkWindow, 4 * 60 * 60 * 1000);

    return () => {
        document.removeEventListener('visibilitychange', handleVisibility);
        clearInterval(interval);
    };
}, []);
```

**Step 3: Usar `dateWindow` en las suscripciones de appointments**

Reemplazar las variables `startStr`/`endStr` inline por `dateWindow.start` y `dateWindow.end` en el useEffect existente, y agregar `dateWindow` a las dependencias del useEffect.

**Step 4: Verificar que `tsc` y `lint` pasan**

Run: `npx tsc --noEmit && npx eslint src/context/DataContext.tsx`
Expected: 0 errores.

**Step 5: Commit**

```bash
git add src/context/DataContext.tsx
git commit -m "fix(data): recalculate date window on visibility change and interval (DATA-01)"
```

---

### Grupo C — Accesibilidad: ModalOverlay (A11Y-01)

**Hallazgo original:** `ModalOverlay` carece de `role="dialog"`, `aria-modal`, focus trapping, manejo de tecla Escape, y `aria-label`. Afecta todos los modals de la aplicación.

**Objetivo:** Hacer `ModalOverlay` accesible según WCAG 2.1 AA.

---

#### Task 3: Agregar ARIA, Escape key, y focus trap a ModalOverlay

**Files:**
- Modify: `src/components/ui/index.tsx`

**Step 1: Reescribir `ModalOverlay` con accesibilidad completa**

```tsx
import React, { useEffect, useRef, useCallback } from 'react';

// ... LoadingSpinner stays unchanged ...

interface ModalOverlayProps {
    children: React.ReactNode;
    onClose: () => void;
    ariaLabel?: string;
}

export const ModalOverlay = ({ children, onClose, ariaLabel }: ModalOverlayProps) => {
    const overlayRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    // Save focus and restore on unmount
    useEffect(() => {
        previousFocusRef.current = document.activeElement as HTMLElement;
        return () => {
            previousFocusRef.current?.focus();
        };
    }, []);

    // Focus trap
    useEffect(() => {
        const overlay = overlayRef.current;
        if (!overlay) return;

        const focusableSelector =
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
            }

            if (e.key === 'Tab') {
                const focusable = overlay.querySelectorAll<HTMLElement>(focusableSelector);
                if (focusable.length === 0) return;

                const first = focusable[0];
                const last = focusable[focusable.length - 1];

                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        overlay.addEventListener('keydown', handleKeyDown);

        // Auto-focus first focusable element
        const firstFocusable = overlay.querySelector<HTMLElement>(focusableSelector);
        if (firstFocusable) {
            firstFocusable.focus();
        }

        return () => overlay.removeEventListener('keydown', handleKeyDown);
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
```

**Step 2: Verificar que `tsc` y `lint` pasan**

Run: `npx tsc --noEmit && npx eslint src/components/ui/index.tsx`
Expected: 0 errores.

**Step 3: Verificar que los modals existentes siguen funcionando**

Verificación manual: Abrir cualquier modal (crear paciente, crear turno), verificar que:
- Escape cierra el modal
- Tab cicla entre elementos focusables sin escapar al fondo
- El foco vuelve al elemento original al cerrar

**Step 4: Commit**

```bash
git add src/components/ui/index.tsx
git commit -m "feat(a11y): add ARIA attributes, focus trap, and Escape key to ModalOverlay (A11Y-01)"
```

---

### Grupo D — Service Layer: Migrar `useBillingStatus` y `useStaff`

**Hallazgo original:** `useStaff.ts` y `useBillingStatus.ts` acceden a Firestore directamente, bypasseando `IDataService`. La interface y la implementación de staff ya están listas (preparadas en Fase 3). `useBillingStatus` necesita ambas partes.

**Constraint `useStaff`:** Se invoca en `App.tsx` **antes** de que `ServiceProvider` exista en el árbol. Reestructurar el provider tree es necesario para migrar este hook.

---

#### Task 4: Agregar `subscribeToBillingStatus` a IDataService

**Files:**
- Modify: `src/services/IDataService.ts`

**Step 1: Agregar método a la interface**

```typescript
// --- Billing ---
subscribeToBillingStatus(
    requestId: string,
    onData: (status: BillingStatusData) => void,
): () => void;
```

Agregar el tipo `BillingStatusData` al import (definirlo en `src/types/index.ts` si no existe):

```typescript
export interface BillingStatusData {
    status: 'pending' | 'processing' | 'completed' | 'error' | 'error_sending' | 'error_config';
    invoiceUrl?: string;
    invoiceNumber?: string;
    error?: string;
}
```

**Step 2: Verificar tsc**

Run: `npx tsc --noEmit`
Expected: Error en `FirebaseService.ts` por no implementar el nuevo método (confirma que la interface se actualizó).

**Step 3: Commit**

```bash
git add src/services/IDataService.ts src/types/index.ts
git commit -m "feat(service): add subscribeToBillingStatus to IDataService interface"
```

---

#### Task 5: Implementar `subscribeToBillingStatus` en FirebaseService

**Files:**
- Modify: `src/services/FirebaseService.ts`

**Step 1: Implementar el método**

```typescript
subscribeToBillingStatus(
    requestId: string,
    onData: (status: BillingStatusData) => void,
): () => void {
    const docRef = doc(
        db, 'artifacts', appId, 'clinics', CLINIC_ID,
        'integrations', 'billing', 'queue', requestId
    );

    return onSnapshot(
        docRef,
        (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                onData({
                    status: data.status,
                    invoiceUrl: data.invoiceUrl || undefined,
                    invoiceNumber: data.invoiceNumber || undefined,
                    error: data.error,
                });
            }
        },
        (error) => {
            console.error('Error listening to billing status:', error);
            onData({
                status: 'error',
                error: error.message,
            });
        },
    );
}
```

**Step 2: Verificar tsc**

Run: `npx tsc --noEmit`
Expected: 0 errores.

**Step 3: Commit**

```bash
git add src/services/FirebaseService.ts
git commit -m "feat(service): implement subscribeToBillingStatus in FirebaseService"
```

---

#### Task 6: Migrar `useBillingStatus` a usar IDataService via ServiceContext

**Files:**
- Modify: `src/hooks/useBillingStatus.ts`

**Step 1: Reescribir el hook para usar ServiceContext**

```typescript
import { useState, useEffect } from 'react';
import { useService } from '../context/ServiceContext';
import type { BillingStatusData } from '../types';

export interface BillingStatus {
    status: BillingStatusData['status'];
    invoiceUrl: string | null;
    invoiceNumber: string | null;
    loading: boolean;
    error?: string;
}

export const useBillingStatus = (requestId: string | null) => {
    const service = useService();
    const [state, setState] = useState<BillingStatus>({
        status: 'pending',
        invoiceUrl: null,
        invoiceNumber: null,
        loading: false,
        error: undefined,
    });

    useEffect(() => {
        if (!requestId || !service) {
            setState(prev => ({ ...prev, loading: false }));
            return;
        }

        setState(prev => ({ ...prev, loading: true }));

        const unsubscribe = service.subscribeToBillingStatus(requestId, (data) => {
            setState({
                status: data.status,
                invoiceUrl: data.invoiceUrl || null,
                invoiceNumber: data.invoiceNumber || null,
                loading: data.status === 'pending' || data.status === 'processing',
                error: data.error,
            });
        });

        return () => unsubscribe();
    }, [requestId, service]);

    return state;
};
```

**Step 2: Verificar tsc y lint**

Run: `npx tsc --noEmit && npx eslint src/hooks/useBillingStatus.ts`
Expected: 0 errores. El hook ya no importa `firebase/firestore` ni `../lib/firebase`.

**Step 3: Commit**

```bash
git add src/hooks/useBillingStatus.ts
git commit -m "refactor(hooks): migrate useBillingStatus to IDataService (ARCH-01)"
```

---

#### Task 7: Reestructurar provider tree en App.tsx para migrar `useStaff`

**Files:**
- Modify: `src/App.tsx`

**Contexto:** `useStaff` se invoca en `LumenApp` antes de que `ServiceProvider` exista. La solución es mover `useStaff` adentro del `ServiceProvider` extrayendo un componente `AuthenticatedApp`.

**Step 1: Extraer `AuthenticatedApp` como componente interno**

Crear un componente `AuthenticatedApp` que reciba `user` y `profile` ya disponibles, y que sea hijo de `ServiceProvider`:

```tsx
function AuthenticatedApp({ user, profile }: { user: User; profile: StaffProfile }) {
    const [currentView, setCurrentView] = useState<View>('dashboard');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [patientHistoryInitialTab, setPatientHistoryInitialTab] = useState<'history' | 'tasks'>('history');

    return (
        <DataProvider>
            <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
                <Toaster position="top-center" richColors />
                <Sidebar user={user} currentView={currentView} setCurrentView={setCurrentView} />
                {/* ... rest of current authenticated layout ... */}
            </div>
        </DataProvider>
    );
}
```

Y modificar `LumenApp` para que use `ServiceProvider` antes de `useStaff`:

```tsx
export default function LumenApp() {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        // ... auth init ...
        return onAuthStateChanged(auth, setUser);
    }, []);

    if (!user) {
        return (
            <AppErrorBoundary>
                <Suspense fallback={/* ... */}>
                    <AuthScreen />
                    <PWAUpdatePrompt />
                </Suspense>
            </AppErrorBoundary>
        );
    }

    // ServiceProvider wraps everything including useStaff now
    return (
        <AppErrorBoundary>
            <ServiceProvider user={user}>
                <StaffGate user={user} />
            </ServiceProvider>
        </AppErrorBoundary>
    );
}
```

Donde `StaffGate` es un componente intermedio que usa `useStaff` (ahora con ServiceContext disponible):

```tsx
function StaffGate({ user }: { user: User }) {
    const { profile, loading: loadingProfile, createProfile } = useStaff(user);

    if (loadingProfile) {
        return (
            <>
                <div className="h-screen flex items-center justify-center bg-slate-50">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
                </div>
                <PWAUpdatePrompt />
            </>
        );
    }

    if (!profile) {
        return (
            <>
                <ProfileModal onSubmit={createProfile} />
                <PWAUpdatePrompt />
            </>
        );
    }

    return <AuthenticatedApp user={user} profile={profile} />;
}
```

> [!IMPORTANT]
> `ServiceProvider` necesita funcionar sin `profile` inicialmente (durante el loading de `useStaff`). Verificar que `ServiceProvider` acepta `profile` como opcional o adaptar según sea necesario.

**Step 2: Verificar tsc**

Run: `npx tsc --noEmit`
Expected: 0 errores.

**Step 3: Verificar que la app funciona**

Run: `npm run dev`
Verificación manual: Login → verificar que el profile se carga → verificar que las vistas funcionan.

**Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "refactor(app): restructure provider tree to enable useStaff migration (ARCH-01)"
```

---

#### Task 8: Migrar `useStaff` a usar IDataService

**Files:**
- Modify: `src/hooks/useStaff.ts`

**Step 1: Reescribir `useStaff` para usar ServiceContext**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { StaffProfile } from '../types';
import { useService } from '../context/ServiceContext';

export const useStaff = (user: User | null) => {
    const service = useService();
    const [profile, setProfile] = useState<StaffProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !service) {
            setProfile(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubscribe = service.subscribeToStaffProfile(user.uid, (data) => {
            setProfile(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, service]);

    const createProfile = useCallback(async (data: { name: string; specialty?: string }) => {
        if (!user || !service) return;

        const newProfile: StaffProfile = {
            uid: user.uid,
            email: user.email || '',
            name: data.name,
            role: 'professional',
            specialty: data.specialty,
            createdAt: serverTimestamp() as any,
        };

        await service.createStaffProfile(user.uid, newProfile);
    }, [user, service]);

    const updateProfile = useCallback(async (data: Partial<StaffProfile>) => {
        if (!user || !service) return;
        await service.updateStaffProfile(user.uid, data);
    }, [user, service]);

    return { profile, loading, createProfile, updateProfile };
};
```

**Step 2: Verificar tsc y lint**

Run: `npx tsc --noEmit && npx eslint src/hooks/useStaff.ts`
Expected: 0 errores. El hook ya no importa `firebase/firestore` ni `../lib/firebase`.

**Step 3: Commit**

```bash
git add src/hooks/useStaff.ts
git commit -m "refactor(hooks): migrate useStaff to IDataService (ARCH-01)"
```

---

### Grupo E — Testing: FirebaseService Unit Tests (TEST-01)

**Hallazgo original:** `FirebaseService` tiene 17+ métodos sin tests unitarios. Es la implementación única de `IDataService` y toda mutación de datos pasa por esta clase.

**Objetivo:** Agregar tests unitarios para los métodos core de `FirebaseService` usando mocks de Firestore.

---

#### Task 9: Crear test setup y tests unitarios para FirebaseService

**Files:**
- Create: `src/services/__tests__/FirebaseService.test.ts`
- Modify: `vitest.config.ts` (expand coverage scope)

**Step 1: Crear el archivo de test con mocks de Firestore**

Crear `src/services/__tests__/FirebaseService.test.ts` con mocks de los módulos de Firebase:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase modules before importing FirebaseService
vi.mock('firebase/firestore');
vi.mock('../../lib/firebase', () => ({
    db: {},
    appId: 'test-app',
    CLINIC_ID: 'test-clinic',
}));

import { FirebaseService } from '../FirebaseService';
import {
    collection, doc, query, addDoc, updateDoc, deleteDoc,
    onSnapshot, getDocs, writeBatch, setDoc,
} from 'firebase/firestore';
```

Luego agregar tests para:
- `subscribeToPatients` — llama `onSnapshot` con query correcto
- `addPatient` — llama `addDoc` y retorna ID
- `updatePatient` — llama `updateDoc` con data correcta
- `deletePatient` — llama `deleteDoc`
- `addAppointment` — llama `addDoc` con datos + professional
- `updateAppointment` — llama `updateDoc`
- `deleteAppointment` — llama `deleteDoc`
- `addPayment` — llama `addDoc`, marca appointment como paid si `appointmentId`

**Step 2: Verificar que los tests pasan**

Run: `npm test -- --run src/services/__tests__/FirebaseService.test.ts`
Expected: Todos los tests pasan.

**Step 3: Agregar `FirebaseService.ts` al coverage scope en `vitest.config.ts`**

```typescript
include: [
    'src/lib/utils.ts',
    'src/lib/psiqueCalculations.ts',
    'src/hooks/useAgendaStats.ts',
    'src/hooks/usePendingTasks.ts',
    'src/services/FirebaseService.ts', // NEW
],
```

**Step 4: Ejecutar coverage y verificar thresholds**

Run: `npm test -- --run --coverage`
Expected: Coverage para `FirebaseService.ts` debe aparecer. Los thresholds existentes no se deben romper.

**Step 5: Commit**

```bash
git add src/services/__tests__/FirebaseService.test.ts vitest.config.ts
git commit -m "test(service): add unit tests for FirebaseService core methods (TEST-01)"
```

---

## Verificación Final

#### Task 10: End-to-end verification

**Step 1: Ejecutar todos los checks**

```bash
npx tsc --noEmit
npx eslint src/
npm test -- --run
npm run build
```

Expected:
- `tsc`: 0 errores
- `eslint`: 0 errors (warnings `no-explicit-any` aceptables)
- `tests`: todos pasan
- `build`: exitoso, chunk principal < 500KB

**Step 2: Verificar bundle splitting**

Inspeccionar la salida del build. Deben existir chunks separados para:
- `vendor-react-*.js`
- `vendor-firebase-*.js`
- `vendor-ui-*.js`
- `index-*.js` (ahora < 500KB)

**Step 3: Commit final (si hay cambios pendientes)**

```bash
git add .
git commit -m "chore: phase 4 final verification"
```

---

## Resumen de archivos modificados

| Grupo | Archivo | Acción | Hallazgo |
| --- | --- | --- | --- |
| A | `vite.config.ts` | Modify | BUILD-01 |
| B | `src/context/DataContext.tsx` | Modify | DATA-01 |
| C | `src/components/ui/index.tsx` | Modify | A11Y-01 |
| D | `src/services/IDataService.ts` | Modify | ARCH-01 |
| D | `src/types/index.ts` | Modify | ARCH-01 |
| D | `src/services/FirebaseService.ts` | Modify | ARCH-01, TEST-01 |
| D | `src/hooks/useBillingStatus.ts` | Modify | ARCH-01 |
| D | `src/App.tsx` | Modify | ARCH-01 |
| D | `src/hooks/useStaff.ts` | Modify | ARCH-01 |
| E | `src/services/__tests__/FirebaseService.test.ts` | Create | TEST-01 |
| E | `vitest.config.ts` | Modify | TEST-01 |

---

## Verification Plan

### Automated Tests

| Test | Comando | Expected |
| --- | --- | --- |
| TypeScript compilation | `npx tsc --noEmit` | 0 errores |
| ESLint | `npx eslint src/` | 0 errors |
| Unit tests | `npm test -- --run` | Todos pasan (~40 existentes + nuevos) |
| Coverage | `npm test -- --run --coverage` | Thresholds met (functions 80%, branches 60%) |
| Production build | `npm run build` | Exitoso, index chunk < 500KB |

### Manual Verification

1. **Bundle splitting** — revisar output de `npm run build` para confirmar chunks separados
2. **Modal accesibilidad** — abrir un modal, presionar Escape (cierra), Tab (focus trap funciona), click de fondo (cierra)
3. **App funcional** — login, navegar entre vistas, crear/editar paciente, crear turno
4. **Date freshness** — (difícil de verificar sin esperar cruce de mes, pero no debe haber regresiones)
