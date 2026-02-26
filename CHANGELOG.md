# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Bundle splitting** via `manualChunks` in Vite — chunk principal reducido de 693KB a 29.65KB con chunks separados para Firebase, React y UI vendors (BUILD-01)
- **Accesibilidad en `ModalOverlay`** — `role="dialog"`, `aria-modal`, `aria-label`, focus trap (Tab/Shift+Tab), Escape key, save/restore focus (A11Y-01)
- **`subscribeToBillingStatus`** en `IDataService` + `FirebaseService` — suscripción real-time al estado de facturación (ARCH-01)
- **`BillingStatusData` type** en `src/types/index.ts` — tipo tipado para estados de billing queue
- **50 tests unitarios para `FirebaseService`** con mocks de Firestore — coverage 88% statements, 78% functions (TEST-01)

### Changed

- **Recálculo automático de ventana de datos** en `DataContext` — `visibilitychange` + intervalo 4h previenen stale data en sesiones largas PWA (DATA-01)
- **`useBillingStatus` migrado a `IDataService`** — ya no importa `firebase/firestore` directamente (ARCH-01)
- **`useStaff` migrado a `IDataService`** — usa `service.subscribeToStaffProfile` vía `ServiceContext` (ARCH-01)
- **Provider tree reestructurado en `App.tsx`** — nuevo patrón `StaffGate` + `AuthenticatedApp` permite que `useStaff` acceda a `ServiceContext` (ARCH-01)
- **Coverage scope ampliado** a 5 archivos (agrega `FirebaseService.ts`) — 92 tests en 6 archivos

### Added

- **ESLint 9 flat config** with `@typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, and Prettier integration (LINT-01)
- **Prettier** `.prettierrc` with opinionated defaults — `singleQuote`, `tabWidth: 4`, `printWidth: 100`
- **New npm scripts**: `lint`, `lint:fix`, `format`, `format:check`, `type-check` (`tsc --noEmit`), and `ci` (`lint + format:check + type-check + test + build`) (TSC-01)
- **Global `ErrorBoundary`** using `react-error-boundary` wrapping both Suspense boundaries in `App.tsx` — prevents chunk-load failures from crashing the app silently
- **Vitest v8 coverage** with reduced-scope thresholds (lines/functions/statements: 80%, branches: 60%) — scope grows incrementally as tests are added per module
- **14 new `IDataService` methods**: `subscribeToClinicalNote`, `subscribeToPatientNotes`, `saveNote`, `updateNote`, `uploadNoteAttachment`, `subscribeToAllNotes`, `completeTask`, `addTask`, `updateTask`, `toggleSubtaskCompletion`, `subscribeToPsiquePayments`, `markPsiquePaymentAsPaid`, `subscribeToPatientAppointments`, `subscribeToPatientPayments` — all implemented in `FirebaseService` (ARCH-01)
- **`updateTask` and `toggleSubtaskCompletion`** wrappers in `useDataActions` with service-availability guard
- **Unit tests**: `useAgendaStats.test.ts` (6 pure-logic tests), `IDataService.test.ts` (mock factory + method completeness), expanded `utils.test.ts` (edge cases for `formatPhoneNumber` and `cn`) — total 23 tests across 3 files (up from 7 in 1 file)

### Changed

- **`useClinicalNotes`** rewritten as two independent top-level hooks `useClinicalNote(appointmentId)` and `usePatientNotes(patientId)` — fixes Rules of Hooks violation (HOOK-01)
- **Migrated direct Firestore access to `IDataService`** in: `usePendingTasks`, `usePsiquePayments`, `usePatientData`, `AddTaskModal`, `TasksView` — 0 direct `firebase/firestore` imports remain in migrated files (ARCH-01)
- **ESLint config simplified** — ~40 manually declared browser globals replaced by `globals.browser` + `globals.es2021`
- **`.gitignore`** updated to exclude generated test artifacts: `playwright-report/`, `test-results/`, `.worktrees/`

### Fixed

- `usePsiquePayments`: removed 3 unnecessary regex escape characters — eliminates `no-useless-escape` lint errors
- `TasksView`: `handleUpdateTask` reduced from 17 to 5 lines; `toggleSubtaskComplete` from 22 to 3 lines — both now delegate to `IDataService` via `useDataActions`

---

## [1.0.0] - 2026-02-20

### Added

- **RBAC Firestore rules** with role-based access control — `admin`, `professional`, and `staff` roles with scoped permissions (SEC-01)
- **Allowlist-based onboarding** replacing previous auto-admin provisioning — only pre-approved emails can register (SEC-02)
- **Server-side Turnstile validation** via `validateTurnstile` Cloud Function — bot protection verified before Firebase Auth login (SEC-03)
- **Strict Content Security Policy** — removed `unsafe-eval`, whitelisted Firebase/Turnstile domains (SEC-04)
- Caching headers in `firebase.json` for static assets
- `AllowedEmail` type and centralized collection routes in `src/lib/routes.ts`
- Allowlist seed script (`scripts/seed-allowlist.ts`) for bootstrapping staff emails in Firestore
- `.env.example` documenting all required environment variables

### Fixed

- Declared `TURNSTILE_SECRET` in Cloud Function `secrets` option — critical for runtime secret access
- Clarified staff Firestore rules — replaced broad `write+create` with explicit `create`, `update`, `delete`
- Moved `getFunctions()` call to module level in `AuthScreen` — was re-initialized on every form submit
- Removed `firebase-admin` from frontend `devDependencies` — belongs only in `functions/` and seed scripts
- Cleaned `index.html` — removed mock globals, added `preconnect` hints, corrected meta tags
- Seed script auto-detects `projectId` from service account credentials
- Relax `notes` Firestore read rule to `isAuthenticated()` — previous rule caused `permission-denied` on app load and Notes view ([a088f08](https://github.com/mauroparque/lumen-app-v2/commit/a088f08))
- Add `createdByUid: user.uid` to note creation payload — previous field stored `displayName` instead of UID, so ownership check never matched ([a088f08](https://github.com/mauroparque/lumen-app-v2/commit/a088f08))
- Guarantee non-null `createdBy` using `user.email ?? user.uid` — `displayName` and `email` are nullable in Firebase ([705152a](https://github.com/mauroparque/lumen-app-v2/commit/705152a))
- Preserve `createdBy`/`createdByUid` on note update — ownership fields set only on creation to prevent edits from overwriting authorship ([705152a](https://github.com/mauroparque/lumen-app-v2/commit/705152a))

### Security

- Removed 25 npm vulnerabilities in `functions/` by dropping unused `firebase-functions-test`
- Upgraded `axios`, `fast-xml-parser`, `jws`, `qs` to patched versions (CVE fixes via `npm audit fix`)
- Eliminated `unsafe-eval` from CSP — all scripts require nonce-based authorization
- Server-side Turnstile validation prevents bot and replay attacks on the authentication flow

[Unreleased]: https://github.com/mauroparque/lumen-app-v2/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/mauroparque/lumen-app-v2/releases/tag/v1.0.0
