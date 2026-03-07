# Revisión de Cierre — Debug: Permisos Firestore, Turnstile y Estabilidad Post-Phase 6

**Fecha de revisión:** 4 de marzo de 2026

**Tipo:** Hotfixes post-merge (no-phase — fixes reactivos)

**Auditoría de referencia:** [`docs/audits/2026-02-26_AUDIT.md`](../audits/2026-02-26_AUDIT.md)

**Plan ejecutado:**

- [`docs/plans/2026-03-02-debug-permissions.md`](../plans/2026-03-02-debug-permissions.md) — Plan de diagnóstico y fix de permisos Firestore

**Revisión anterior:** [`docs/reviews/2026-03-01_phase6-completion-review.md`](../reviews/2026-03-01_phase6-completion-review.md)

---

## Veredicto: HOTFIXES COMPLETADOS ✓

## Resumen Ejecutivo

Tras el merge de la Phase 6, se detectaron errores de permisos (`FirebaseError: Missing or insufficient permissions`) en producción afectando dos flujos críticos:

1. **`addPayment`** — batch de crear pago + actualizar `isPaid` en turno
2. **`completeTask`** — transacción de leer + actualizar tareas de nota clínica

La causa raíz fue una combinación de problemas en las reglas Firestore recién desplegadas en Phase 6:

- `getProfessionalName()` podía devolver `null` para usuarios con datos de `createdBy` legacy (UID en lugar de nombre)
- La regla de `payments.create` exigía el campo `professional` pero no tenía fallback por `uid`
- La regla de `notes.update` bloqueaba notas legacy sin `createdByUid`
- La regla de `payments.isPaid` era demasiado restrictiva para el profesional propio

Adicionalmente se resolvieron dos problemas independientes: inestabilidad del widget Turnstile en el login, y el PWA no tomaba actualizaciones inmediatas en dispositivos con service worker cacheado.

---

## Fixes implementados

### Área 1 — Reglas Firestore (debug-permissions)

| Commit    | Descripción                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------- |
| `ec66cd7` | fix(firestore): enhance `getProfessionalName` function and update access rules for patients, appointments, payments |
| `79d9e90` | fix(firestore): null check en `getProfessionalName` y fix `createdBy` en `saveNote`                                 |
| `44629c4` | fix(rules): soportar notas legacy sin `createdByUid` en regla de update                                             |
| `1b620be` | fix(rules): permitir `isPaid` por cualquier usuario autenticado, usar `createdByUid` para payments                  |
| `7e84ad0` | fix(rules): agregar `isProfessionalOf` con fallback por email; `psiquePayments` permite al profesional propio       |

**Detalle de cambios en Firestore rules:**

- `getProfessionalName()` reforzado con null-check antes de comparación
- Nueva función `isProfessionalOf(professional)` con fallback by email cuando el campo `name` del staff doc difiere
- Regla `payments.create`: acepta tanto `professional == getProfessionalName()` como `professional == isStaffEmail()`
- Regla `payments.isPaid`: liberada para cualquier `isAuthenticated()` (antes solo admin)
- Regla `notes.update`: condición `createdByUid` se evalúa solo si el campo existe (soporte legacy)

### Área 2 — Autenticación / Turnstile

| Commit    | Descripción                                                                       |
| --------- | --------------------------------------------------------------------------------- |
| `be51130` | fix(auth): Turnstile con fallback por timeout y retry para evitar login bloqueado |
| `ba3726f` | fix(auth): Turnstile sin bypass — recargar página si no carga el widget           |

**Contexto:** El widget de Cloudflare Turnstile fallaba silenciosamente en algunos dispositivos/navegadores bloqueando el formulario de login indefinidamente. Se implementó un timeout de carga con retry automático y, como último recurso, recarga de página completa en lugar del bypass anterior que eliminaba el desafío.

### Área 3 — PWA / Service Worker

| Commit    | Descripción                                                                                   |
| --------- | --------------------------------------------------------------------------------------------- |
| `43ededd` | fix(pwa): cambiar a `autoUpdate` con `skipWaiting` para garantizar actualizaciones inmediatas |

**Contexto:** El modo anterior (`prompt`) requería interacción del usuario para aplicar actualizaciones. En producción, usuarios con la app cacheada en su dispositivo podían quedar en versiones antiguas indefinidamente. Migrado a `autoUpdate` + `skipWaiting` para forzar la toma del nuevo service worker en el próximo reload.

### Área 4 — CI/CD deployment

| Commit    | Descripción                                               |
| --------- | --------------------------------------------------------- |
| `35cd6cd` | ci: actualizar workflow para redeploy Coolify por webhook |
| `b499fa5` | Change deployment URL to development server               |
| `8ff3219` | Update deployment script to include Cloudflare headers    |
| `60ac8dc` | Modify deployment API request parameters                  |

**Contexto:** Se actualizó el pipeline de CI/CD para disparar redeploys en Coolify vía webhook, incluyendo headers de Cloudflare y URL del servidor de desarrollo.

---

## Estado final verificado

| Verificación                       | Resultado               |
| ---------------------------------- | ----------------------- |
| `addPayment` en producción         | ✅ Funciona             |
| `completeTask` en producción       | ✅ Funciona             |
| Login con Turnstile                | ✅ Estable con retry    |
| PWA — actualizaciones inmediatas   | ✅ `skipWaiting` activo |
| Firestore rules — deployed         | ✅ Desplegadas          |
| `isPaid` update para profesionales | ✅ Permitido            |
| Notas legacy sin `createdByUid`    | ✅ Soportadas           |

---

## Deuda técnica generada / pendiente

| Ítem                                                          | Prioridad | Observación                                            |
| ------------------------------------------------------------- | --------- | ------------------------------------------------------ |
| Audit trail para datos clínicos (SEC-10)                      | Media     | Diferido de Phase 6, requiere diseño específico        |
| Testing: 8/10 hooks sin tests, 0 componentes/vistas cubiertos | Alta      | Objetivo de próxima fase dedicada                      |
| Refactoring componentes >500 líneas (6 archivos)              | Media     | Diferido, requiere fase dedicada                       |
| Migrar `saveNote` para usar `professionalName` en `createdBy` | Baja      | Las notas legacy con UID en `createdBy` ya se soportan |

---

## Notas adicionales

El plan `2026-03-02-debug-permissions.md` incluía una Fase 1 de logging diagnóstico que se usó para identificar la causa raíz exacta. Los logs diagnósticos fueron removidos antes del deploy final; este ciclo no requirió la Fase 2 de Firebase Rules Playground ya que la causa raíz se identificó vía logs en staging.
