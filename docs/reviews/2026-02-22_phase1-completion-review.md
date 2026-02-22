# Revisión de Cierre — Fase 1: Seguridad

**Fecha de revisión:** 22 de febrero de 2026

**Fase:** Phase 1 — Security

**Rama analizada:** `main`

**Auditoría de referencia:** [`docs/audits/2026-02-19_AUDIT.md`](../audits/2026-02-19_AUDIT.md)

**Planes ejecutados:**

- [`docs/plans/2026-02-19-phase1-security.md`](../plans/2026-02-19-phase1-security.md) — Plan principal (10 tasks)
- [`docs/plans/2026-02-19-phase1-security-fixes.md`](../plans/2026-02-19-phase1-security-fixes.md) — Fixes post code-review (6 tasks)

## Veredicto: FASE 1 COMPLETADA ✓

## Resumen Ejecutivo

La Fase 1 abordó los 4 hallazgos críticos de seguridad de la auditoría del 19/02/2026. Todos fueron implementados, revisados en code review, corregidos según el feedback, y mergeados a `main`. El build compila sin errores y los 7 tests de unidad pasan.

---

## Verificación por hallazgo crítico

| ID Auditoría | Hallazgo original | Estado | Solución implementada |
| --- | --- | --- | --- |
| **SEC-01** | Sin RBAC en Firestore — cualquier usuario autenticado accede a todos los datos clínicos | **Resuelto** | `firestore.rules` reescrito con funciones helper `getStaffData()`, `isAdmin()`, `getProfessionalName()` y reglas granulares por colección |
| **SEC-02** | Auto-admin en primer login — todo usuario nuevo recibía `role: 'admin'` hardcodeado | **Resuelto** | `AuthScreen.tsx` reemplazó la creación automática por verificación en colección `allowedEmails`; emails no autorizados reciben sign-out inmediato |
| **SEC-03** | Turnstile validado solo en cliente — token bypasseable | **Resuelto** | `validateTurnstile` Cloud Function con `secrets: ["TURNSTILE_SECRET"]`; AuthScreen llama al callable **antes** de `signInWithEmailAndPassword` |
| **SEC-04** | CSP con `unsafe-inline` + `unsafe-eval`, CDNs de dev en producción | **Resuelto** | `firebase.json` con CSP estricta sin `unsafe-eval`, dominios whitelisteados, caching headers para assets e `index.html` |

---

## Verificación por task del plan principal

### Task 1 — Tipo `AllowedEmail` y rutas centralizadas

- **Archivo:** `src/types/index.ts`
- **Estado:** Completada
- `AllowedEmail { email, role, professionalName }` agregado al dominio.

- **Archivo:** `src/lib/routes.ts`
- **Estado:** Completada
- 8 colecciones centralizadas: `ALLOWED_EMAILS_COLLECTION`, `STAFF_COLLECTION`, `NOTES_COLLECTION`, `PSIQUE_PAYMENTS_COLLECTION` + las 4 preexistentes.

### Task 2 — Seed script para allowlist

- **Archivo:** `scripts/seed-allowlist.ts`
- **Estado:** Completada
- Lee todos los documentos de `staff` y genera batch de documentos en `allowedEmails`. Documentado con instrucciones de ejecución. `firebase-admin` se referencia desde `functions/node_modules`.

### Task 3 — AuthScreen con allowlist

- **Archivo:** `src/views/AuthScreen.tsx`
- **Estado:** Completada
- Flujo: login Firebase Auth → verificar doc en `allowedEmails` → crear perfil `staff` con rol y `professionalName` del allowlist → continuar. Email no en allowlist → `auth.signOut()` + mensaje de error.

### Task 4 — Firestore Rules con RBAC

- **Archivo:** `firestore.rules`
- **Estado:** Completada
- Reglas implementadas para 8 colecciones: `allowedEmails`, `staff`, `patients`, `appointments`, `payments`, `integrations/billing/queue`, `notes`, `psiquePayments`.
- Deny-all default para todo lo demás.
- Conserva restricciones de dominio preexistentes: `billingStatus: 'invoiced'` solo permite actualizar `isPaid`, payments sin delete.

### Task 5 — Cloud Function Turnstile server-side

- **Archivo:** `functions/src/index.ts`
- **Estado:** Completada
- `validateTurnstile` con `onCall`, `secrets: ["TURNSTILE_SECRET"]` (crítico para v2), `fetch` nativo (Node 20, sin dependencias extra).

### Task 6 — Integración Turnstile en cliente

- **Archivo:** `src/views/AuthScreen.tsx`
- **Estado:** Completada
- `getFunctions()` y `httpsCallable` inicializados a nivel de módulo (fix SEC-03 + fix de code review).

### Task 7 — CSP estricta en firebase.json

- **Archivo:** `firebase.json`
- **Estado:** Completada
- CSP sin `unsafe-eval`, sin `cdn.tailwindcss.com` (era dev-only).
- Caching headers: assets con hash → `immutable, max-age=31536000`; `index.html` → `no-cache`.

### Task 8 — Limpieza de index.html

- **Archivo:** `index.html`
- **Estado:** Completada
- Eliminados mock globals (`window.__firebase_config`, `window.__app_id`).
- Agregados `preconnect` hints para `firestore.googleapis.com` y `fonts.googleapis.com`.
- Tag `<noscript>` con mensaje en español.
- Title corregido a "Lumen Salud Mental".
- Favicon MIME type corregido a `image/x-icon`.

### Task 9 — `.env.example`

- **Archivo:** `.env.example`
- **Estado:** Completada
- Documenta las 6 variables Firebase (`VITE_FIREBASE_*`) + `VITE_TURNSTILE_SITE_KEY`.

### Task 10 — Verificación end-to-end

- **Estado:** Completada
- Build: `✓ built in 4.53s`, PWA generada.
- Tests: `7 passed (1 file)`.

---

## Verificación de fixes post code-review

| # | Fix | Archivo | Estado |
| --- | --- | --- | --- |
| 1 | `secrets: ["TURNSTILE_SECRET"]` en `onCall` | `functions/src/index.ts:11` | **Completado** |
| 2 | Quitar `firebase-admin` de frontend `devDependencies` | `package.json` | **Completado** |
| 3 | Staff rules: reemplazar `write + create` por `create`, `update`, `delete` explícitos | `firestore.rules:20-25` | **Completado** |
| 4 | `getFunctions()` a nivel de módulo, no dentro del handler | `src/views/AuthScreen.tsx:13-14` | **Completado** |
| 5 | Rebase sobre `main` para incorporar `AGENTS.md` y copilot instructions | git | **Completado** |
| 6 | Verificación final (build + tests + rules dry-run) | — | **Completado** |

---

## Verificaciones técnicas (ejecutadas el 22/02/2026)

| Check | Resultado |
| --- | --- |
| `npm run build` | ✓ Build exitoso, sin errores de compilación |
| `npm test` | ✓ 7/7 tests passing |
| `firebase-admin` en root `package.json` | ✓ Eliminado (solo en `functions/package.json`) |
| Mock globals en `index.html` | ✓ Eliminados |
| `secrets: ["TURNSTILE_SECRET"]` en Cloud Function | ✓ Presente |

---

## Deuda técnica pendiente (fuera del scope de Fase 1)

Los siguientes hallazgos de la auditoría quedan abiertos para fases posteriores:

| ID | Área | Prioridad sugerida |
| --- | --- | --- |
| TEST-01 | Cobertura de tests ~6% — 0 tests para FirebaseService, billing, hooks de negocio | Alta |
| ARCH-01 | 5+ hooks bypasean `IDataService` accediendo a Firestore directamente | Alta |
| HOOK-01 | `useClinicalNotes` define hooks dentro de hooks (violación de Rules of Hooks) | Alta |
| DATA-01 | Ventana de datos stale al cruzar límites de fecha sin recargar la PWA | Media |
| BUILD-01 | Bundle principal 693KB — sin `manualChunks` en Vite | Media |
| A11Y-01 | Modals sin `role="dialog"`, ARIA, focus trap ni tecla Escape | Media |
| LINT-01 | Sin ESLint — zero análisis estático | Media |
| TSC-01 | Sin `tsc --noEmit` en pipeline de build | Media |
| T1 | 6 usos de `any` en componentes y hooks | Baja |

---

## Próximos pasos sugeridos — Fase 2

Orden de prioridad recomendado:

1. **Testing** (TEST-01) — Cobertura de `FirebaseService` y lógica de billing antes de cualquier refactor
2. **Arquitectura** (ARCH-01, HOOK-01) — Migrar hooks directos a `IDataService` y corregir violación de Rules of Hooks
3. **DX** (LINT-01, TSC-01) — ESLint + `tsc --noEmit` en scripts de build/CI
4. **Performance** (BUILD-01, DATA-01) — Bundle splitting y stale date window
5. **Accesibilidad** (A11Y-01) — `ModalOverlay` con ARIA completo
