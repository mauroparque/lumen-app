# Revisión de Cierre — Fase 4: Performance, Accesibilidad y Service Layer

**Fecha de revisión:** 26 de febrero de 2026

**Fase:** Phase 4 — Performance, Accesibilidad y Service Layer

**Rama analizada:** `phase4-performance-a11y-services` (9 commits, 12 archivos, +1178/-182)

**Auditoría de referencia:** [`docs/audits/2026-02-19_AUDIT.md`](../audits/2026-02-19_AUDIT.md)

**Plan ejecutado:**

- [`docs/plans/2026-02-25-phase4-performance-a11y-services.md`](../plans/2026-02-25-phase4-performance-a11y-services.md) — Plan principal (10 tasks)

**Revisión anterior:** [`docs/reviews/2026-02-24_phase3-completion-review.md`](../reviews/2026-02-24_phase3-completion-review.md)

---

## Veredicto: FASE 4 COMPLETADA ✓

## Resumen Ejecutivo

La Fase 4 cerró toda la deuda técnica identificada en la auditoría original y las fases anteriores: bundle splitting para eliminar el warning de chunk > 500KB, recálculo automático de la ventana de datos en sesiones largas de PWA, accesibilidad completa en `ModalOverlay`, migración de los últimos dos hooks (`useStaff`, `useBillingStatus`) al service layer, y 50 tests unitarios para `FirebaseService`. Las 6 áreas de deuda técnica pendiente quedan resueltas.

---

## Verificación por hallazgo

| ID | Hallazgo | Estado | Solución implementada |
| --- | --- | --- | --- |
| **BUILD-01** | Bundle 693KB sin `manualChunks` | **Resuelto** | `manualChunks` en `vite.config.ts` — chunk principal bajó de 693KB a 29.65KB. Chunks separados: `vendor-firebase` (498KB), `vendor-ui` (192KB) |
| **DATA-01** | Ventana de datos estática (stale en sesiones largas) | **Resuelto** | `getDateWindow()` función pura + `dateWindow` state + listener `visibilitychange` + intervalo 4h en `DataContext.tsx` |
| **A11Y-01** | `ModalOverlay` sin `role="dialog"`, ARIA, focus trap, Escape | **Resuelto** | `role="dialog"`, `aria-modal`, `aria-label`, focus trap Tab/Shift+Tab, Escape key, save/restore focus |
| **ARCH-01 (useStaff)** | `useStaff` bypasea `IDataService` | **Resuelto** | Provider tree reestructurado (`StaffGate` + `AuthenticatedApp`), hook migrado a `service.subscribeToStaffProfile` |
| **ARCH-01 (useBillingStatus)** | `useBillingStatus` bypasea `IDataService` | **Resuelto** | `subscribeToBillingStatus` en interface + implementación, hook migrado |
| **TEST-01 (remanente)** | `FirebaseService` 17+ métodos sin tests | **Resuelto** | 50 tests unitarios con mocks de Firestore. Coverage: 88.42% stmts, 78.31% functions |

---

## Verificación de tareas — Plan principal (10 tasks)

### Grupo A — Performance: Bundle Splitting (BUILD-01)

| # | Tarea | Estado | Detalle |
| --- | --- | --- | --- |
| T1 | Configurar `manualChunks` en Vite | ✅ | 3 chunks: `vendor-react`, `vendor-firebase`, `vendor-ui`. Commit `f9e9788` |

### Grupo B — Data Freshness (DATA-01)

| # | Tarea | Estado | Detalle |
| --- | --- | --- | --- |
| T2 | Recálculo de ventana de fechas en DataContext | ✅ | `getDateWindow()` + `visibilitychange` + intervalo 4h. Commit `4e18c0e` |

### Grupo C — Accesibilidad (A11Y-01)

| # | Tarea | Estado | Detalle |
| --- | --- | --- | --- |
| T3 | ARIA, Escape key, focus trap en ModalOverlay | ✅ | Implementación completa con save/restore focus. Commit `3d1336c` |

### Grupo D — Service Layer: Migración (ARCH-01)

| # | Tarea | Estado | Detalle |
| --- | --- | --- | --- |
| T4 | `subscribeToBillingStatus` en IDataService | ✅ | Interface + tipo `BillingStatusData`. Commit `56a4b32` |
| T5 | Implementar en FirebaseService | ✅ | Usa `BILLING_QUEUE_COLLECTION` + `onSnapshot`. Commit `bcf1147` |
| T6 | Migrar `useBillingStatus` | ✅ | Ya no importa `firebase/firestore` directamente. Commit `838358c` |
| T7 | Reestructurar provider tree en App.tsx | ✅ | `StaffGate` + `AuthenticatedApp` con doble `ServiceProvider`. Commit `fcc3c79` |
| T8 | Migrar `useStaff` a IDataService | ✅ | Usa `service.subscribeToStaffProfile`. Commit `619f1c2` |

### Grupo E — Testing (TEST-01)

| # | Tarea | Estado | Detalle |
| --- | --- | --- | --- |
| T9 | Tests unitarios para FirebaseService | ✅ | 50 tests cubriendo suscripciones, CRUD, billing, notes, tasks, staff, errors. Commit `6d48c1a` |

### Verificación Final

| # | Tarea | Estado | Detalle |
| --- | --- | --- | --- |
| T10 | End-to-end verification | ✅ | tsc ✅, lint ✅, tests ✅, build ✅ |

---

## Decisiones de diseño tomadas

### Doble ServiceProvider en App.tsx

El plan sugería envolver `StaffGate` en un `ServiceProvider` sin profile. La implementación usa **dos instancias** de `ServiceProvider`:

1. **Exterior** (en `LumenApp`): `profile=null` — provee `IDataService` a `useStaff` sin scoping por profesional
2. **Interior** (en `AuthenticatedApp`): `profile=profile` — provee `IDataService` con scoping correcto para `DataProvider` y el resto de la app

Este patrón es correcto: el service exterior permite que `useStaff` funcione antes de tener el profile, y el interior recrea el service con `professionalName` para las queries filtradas.

### vendor-react chunk absorbido por vendor-ui

El chunk `vendor-react` (0.03KB) es solo un re-import de `vendor-ui` (192KB). Rollup fusiona React con `lucide-react` porque `lucide-react` importa React directamente. Funcionalmente correcto — el objetivo BUILD-01 (eliminar chunk > 500KB) se cumple. Para mayor granularidad de cache en el futuro, se podría usar una función `manualChunks` en lugar del objeto actual.

### Archivo extra: IDataService.test.ts

Se encontró un archivo `src/services/__tests__/IDataService.test.ts` no previsto en el plan de Fase 4 (preexistente de Fase 2). No es un problema — contiene tests de completitud de la interfaz mock.

---

## Verificaciones técnicas (26/02/2026)

| Check | Resultado |
| --- | --- |
| `npx tsc --noEmit` | ✅ 0 errores |
| `npx eslint src/` | ✅ 0 errors, 11 warnings (todos `no-explicit-any`) |
| `npm test -- --run` | ✅ 92 tests pasan (6 archivos) |
| `npm run build` | ✅ Build exitoso, chunk principal 29.65KB |
| Coverage | ✅ Stmts 89.83%, Branches 79.01%, Functions 82.6%, Lines 91.01% — todos sobre threshold |

### Bundle splitting verificado

| Chunk | Tamaño | gzip |
| --- | --- | --- |
| `vendor-firebase` | 498.50 KB | 116.34 KB |
| `vendor-ui` | 192.51 KB | 58.05 KB |
| `index` (app code) | 29.65 KB | 9.68 KB |
| `CalendarView` | 39.50 KB | 10.29 KB |
| Resto (lazy views) | 1-25 KB cada uno | — |

---

## Métricas de la rama

| Métrica | Valor |
| --- | --- |
| Commits totales | 9 |
| Archivos tocados | 12 |
| Líneas agregadas | +1,178 |
| Líneas eliminadas | -182 |
| Tests antes (Fase 3) | ~40 (4 archivos) |
| Tests después (Fase 4) | **92** (6 archivos) |
| Archivos en coverage scope | 5 (vs 4 en Fase 3) |
| Bundle chunk principal | 29.65 KB (vs 693 KB pre-Fase 4) |
| Hooks con Firestore directo | **0** (vs 2 pre-Fase 4) |

---

## Deuda técnica pendiente

### De esta fase (Phase 4)

Ninguna deuda nueva generada.

### Observaciones menores (no bloqueantes)

| Item | Detalle | Prioridad |
| --- | --- | --- |
| `vendor-react` chunk vacío | React absorbido por `vendor-ui`. Considerar función `manualChunks` para separación explícita | Baja |
| 11 warnings `no-explicit-any` | Presentes desde Fase 2. Uso intencional en types/service layer | Baja |

### Estado de deuda técnica de auditoría original

| ID | Área | Estado |
| --- | --- | --- |
| ~~SEC-01~~ | RBAC Firestore rules | Fase 1 ✓ |
| ~~SEC-02~~ | Allowlist onboarding | Fase 1 ✓ |
| ~~SEC-03~~ | Turnstile validation | Fase 1 ✓ |
| ~~SEC-04~~ | Content Security Policy | Fase 1 ✓ |
| ~~LINT-01~~ | ESLint config | Fase 2 ✓ |
| ~~TSC-01~~ | TypeScript strict | Fase 2 ✓ |
| ~~ARCH-01~~ | Service layer migration | Fase 2-4 ✓ |
| ~~HOOK-01~~ | Hooks Rules violation | Fase 2 ✓ |
| ~~TEST-01~~ | Unit test coverage | Fase 2-4 ✓ |
| ~~BUILD-01~~ | Bundle splitting | **Fase 4 ✓** |
| ~~DATA-01~~ | Stale data window | **Fase 4 ✓** |
| ~~A11Y-01~~ | Modal accessibility | **Fase 4 ✓** |

**Todos los hallazgos de la auditoría original han sido resueltos.**

---

### *Revisión realizada por GitHub Copilot (Claude) — 26 de febrero de 2026*
