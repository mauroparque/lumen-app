# Revisión de Cierre — Fase 6: Calidad de Código y Arquitectura (Prioridad Media)

**Fecha de revisión:** 1 de marzo de 2026

**Fase:** Phase 6 — Calidad de Código y Arquitectura: Prioridad Media

**Auditoría de referencia:** [`docs/audits/2026-02-26_AUDIT.md`](../audits/2026-02-26_AUDIT.md)

**Plan ejecutado:**

- [`docs/plans/2026-03-01-phase6-medium-priority-quality-architecture.md`](../plans/2026-03-01-phase6-medium-priority-quality-architecture.md) — Plan principal (17 tasks)

**Revisión anterior:** [`docs/reviews/2026-03-01_phase5-completion-review.md`](../reviews/2026-03-01_phase5-completion-review.md)

---

## Veredicto: FASE 6 COMPLETADA ✓

## Resumen Ejecutivo

La Fase 6 resolvió los 17 hallazgos de prioridad media identificados en la auditoría del 26/02/2026, agrupados en 5 categorías: duplicación de código (3 items), hooks cleanup (3 items), paridad de componentes (2 items), arquitectura (5 items) y seguridad media (4 items).

Se detectó y corrigió un problema adicional no contemplado en el plan: 3 errores TypeScript TS6133 ("declared but never read") en `DashboardView`, `PaymentsView` y `StatisticsView`, introducidos como consecuencia de la Task 6 (eliminación de `usePatients`). Corregidos con commit `9d8f2a9`.

**Estado final verificado:**
- TypeScript: **0 errores** (`npx tsc --noEmit`)
- Tests: **108/108 passing** (`npm test -- --run`)
- Firestore rules: **deployed** a Firebase (`firebase deploy --only firestore:rules`)
- Functions build: **compilando** (`cd functions && npm run build`)

---

## Verificación por hallazgo — 17/17 resueltos

### Grupo A — Centralizar helpers duplicados

| Issue        | Hallazgo                                       | Estado       | Solución implementada                                                                                 |
| ------------ | ---------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| **DUP**      | `calculateAge` duplicada en 2 vistas           | **Resuelto** | Centralizada en `utils.ts` L31. Importada desde `PatientsView` y `PatientHistoryView`. Tests agregados. Commit `a3a1f7e` |
| **DUP**      | `isOverdue` duplicada en 2 vistas              | **Resuelto** | Centralizada en `utils.ts` L43 con tipado explícito. Importada desde `DashboardView` y `PaymentsView`. Tests agregados. Commit `db4d643` |
| **HOOK-N04** | `PSIQUE_RATE = 0.25` triplicada                | **Resuelto** | Eliminadas en `useAgendaStats.ts` y `PaymentsView.tsx`; ambos importan desde `psiqueCalculations.ts`. Commit `983ef3b` |

### Grupo B — Hooks cleanup

| Issue        | Hallazgo                                                 | Estado       | Solución implementada                                                                                       |
| ------------ | -------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------- |
| **HOOK-N01** | `useDataActions` recrea 17 funciones en cada render      | **Resuelto** | Reescrito con `useMemo([service])`. Tests de estabilidad referencial en `hooks/__tests__/useDataActions.test.ts`. Commit `cf5ef39` |
| **HOOK-N02** | `useStaff` importa `serverTimestamp` directamente        | **Resuelto** | `serverTimestamp` movido a `FirebaseService.createStaffProfile` L649. `useStaff` ya no importa de `firebase/firestore`. Commit `ce74105` |
| **HOOK-N03** | `usePatients` wrapper trivial que ignora parámetro `_user` | **Resuelto** | Archivo eliminado. Los 7 callers migrados a `useData()` directo. Fix adicional: `user` removido del destructuring de 3 vistas (commit `9d8f2a9`). Commit base `b891bfc` |

### Grupo C — Componentes

| Issue        | Hallazgo                                                | Estado       | Solución implementada                                                                                    |
| ------------ | ------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| **COMP-N02** | `SidebarItem` props tipadas como `: any`                | **Resuelto** | `interface SidebarItemProps` explícita en `Sidebar.tsx` L102. Commit `153f6a2`                           |
| **COMP-N01** | `MobileHeader` sin "Estadísticas" ni indicador de deuda | **Resuelto** | Agregado ítem "Estadísticas" (`BarChart3`) y dot rojo condicional en "Pagos" basado en `hasPendingDebts`. Commit `8eca0e5` |

### Grupo D — Arquitectura

| Issue        | Hallazgo                                                          | Estado       | Solución implementada                                                                                              |
| ------------ | ----------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| **ARCH-N03** | Listener `subscribeToFinance` desperdiciado en `DataContext`      | **Resuelto** | Nuevo método `subscribeToPayments` en `IDataService` + `FirebaseService`. `DataContext` migrado a `subscribeToPayments`. Commit `fd55554` |
| **ARCH-N05** | `saveNote` con 2 operaciones no atómicas                          | **Resuelto** | Reescrita con `writeBatch`: nota + `hasNotes: true` en una sola transacción. Commit `bc66ce0`                      |
| **ARCH-N04** | `completeTask`, `updateTask`, `toggleSubtaskCompletion` con read-then-write no atómico | **Resuelto** | Los 3 métodos reescritos con `runTransaction`. Commit `3c6c029`                    |
| **ARCH-N06** | Batch writes sin partición (límite Firestore: 500 ops)            | **Resuelto** | `commitInBatches()` helper + `FIRESTORE_BATCH_LIMIT=500`. Aplicado en `addRecurringAppointments` y `deleteRecurringSeries`. Commit `6a3625b` |
| **ARCH-N07** | `setLoading(false)` solo espera `myAppointments`                  | **Resuelto** | `loadedFlags` objeto con 4 flags (patients, myAppointments, allAppointments, payments). `setLoading(false)` solo cuando todos son `true`. Commit `fd55554` (junto con ARCH-N03) |

### Grupo E — Seguridad media

| Issue        | Hallazgo                                               | Estado       | Solución implementada                                                                                          |
| ------------ | ------------------------------------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------- |
| **SEC-13**   | `AuthScreen` expone `err.message` crudo de Firebase    | **Resuelto** | `getAuthErrorMessage()` en `utils.ts` con 8 códigos Firebase mapeados al español. `AuthScreen` migrado + `catch (err: unknown)`. Tests en `utils.test.ts`. Commit `9465553` |
| **SEC-N05**  | `functions.config()` deprecated en Cloud Functions v2 | **Resuelto** | `defineString('BILLING_URL')` + `defineString('BILLING_SECRET')` con `firebase-functions/params`. Commit `ae0f341` |
| **SEC-11**   | Sin session timeout para Firebase Auth                 | **Resuelto** | `useSessionTimeout.ts` hook con `SESSION_TIMEOUT_MS=30min`. Escucha 5 eventos DOM, cierra sesión con `signOut`. Integrado en `App.tsx` L50. Commit `3457637` |
| **SEC-06**   | Sin schema validation en Firestore rules               | **Resuelto** | `isValidPatient()`, `isValidAppointment()`, `isValidPayment()` implementadas y aplicadas en `create` rules. Deployed a Firebase. Commit `d797cf8` |

---

## Commits realizados

| Commit    | Descripción                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------- |
| `a3a1f7e` | refactor: centralize calculateAge in utils.ts, remove duplicates (DUP)                        |
| `db4d643` | refactor: centralize isOverdue in utils.ts, remove duplicates (DUP)                           |
| `983ef3b` | refactor: import PSIQUE_RATE from canonical source, remove duplicates (HOOK-N04)              |
| `cf5ef39` | perf(hooks): memoize useDataActions return object with useMemo (HOOK-N01)                     |
| `ce74105` | refactor(hooks): move serverTimestamp from useStaff to FirebaseService.createStaffProfile (HOOK-N02) |
| `b891bfc` | refactor(hooks): remove trivial usePatients wrapper, use useData() directly (HOOK-N03)        |
| `153f6a2` | fix(types): type SidebarItem props explicitly, remove any (COMP-N02)                          |
| `8eca0e5` | feat(ui): add Statistics nav item and debt indicator to MobileHeader (COMP-N01)               |
| `fd55554` | refactor(arch): add subscribeToPayments, eliminate wasted Finance listener in DataContext (ARCH-N03 + ARCH-N07) |
| `bc66ce0` | fix(arch): make saveNote atomic with writeBatch (ARCH-N05)                                    |
| `3c6c029` | fix(arch): make task operations atomic with runTransaction (ARCH-N04)                         |
| `6a3625b` | fix(arch): partition batch writes to respect Firestore 500-op limit (ARCH-N06)               |
| `9465553` | fix(security): map Firebase auth errors to user-friendly Spanish messages (SEC-13)            |
| `ae0f341` | refactor(functions): migrate functions.config() to defineString params v2 (SEC-N05)          |
| `3457637` | feat(security): add session timeout for Firebase Auth after 30min inactivity (SEC-11)        |
| `d797cf8` | fix(security): add basic schema validation in Firestore rules for patients, appointments, payments (SEC-06) |
| `9d8f2a9` | fix(types): remove unused 'user' destructuring in views after usePatients removal (HOOK-N03 follow-up) |

---

## Hallazgos diferidos (no abordados en esta fase)

| Issue                 | Descripción                                        | Razón diferida                                              |
| --------------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| SEC-10                | Audit trail para datos clínicos                    | Feature completa, requiere diseño propio (~4h)             |
| Testing gaps          | 8/10 hooks, 0 componentes, 0 vistas sin tests      | Fase 7 dedicada                                            |
| Componentes oversized | 6 componentes con 500+ líneas                      | Refactoring largo, fase dedicada                           |
| Configuración         | Path aliases, engines, sourcemaps, semantic tokens | Mejoras DX menores                                         |

---

## Métricas finales

| Métrica              | Antes de Fase 6 | Después de Fase 6 |
| -------------------- | --------------- | ----------------- |
| Tests pasando        | ~60             | **108**           |
| Errores TypeScript   | 0               | **0**             |
| `any` explícitos     | 2+              | 0 en scope        |
| Funciones duplicadas | 3               | **0**             |
| Listeners Firestore desperdiciados | 1 | **0**           |
| Operaciones no atómicas (write) | 5   | **0**            |
| Session timeout      | No              | **Sí (30 min)**   |
| Schema validation DB | No              | **Sí (3 colecciones)** |
