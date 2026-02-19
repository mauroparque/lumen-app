# Lumen Salud Mental — Copilot Instructions

## Agent Skills — Mandatory Usage

This project uses a **skills** system located in `.agents/skills/`. The master index with descriptions, when to use each skill, and how they relate to each other is at [.agents/skills/SKILLS_INDEX.md](../.agents/skills/SKILLS_INDEX.md). **Read it before any non-trivial action.**

### Activation Rules

| Situation | Required skills |
| --- | --- |
| Start of any conversation | `using-superpowers` |
| Creating features, components, or modifying behavior | `brainstorming` → `writing-plans` |
| Executing a multi-step plan in the current session | `subagent-driven-development` |
| Implementing any feature or bugfix | `test-driven-development` |
| Any technical problem (bug, test failure, build error) | `systematic-debugging` |
| Before claiming work is complete | `verification-before-completion` |
| After completing a feature or before merging | `requesting-code-review` |
| Building or reviewing UI components | `frontend-design` + `vercel-react-best-practices` |

### Standard flow for new features

```
using-superpowers → brainstorming → writing-plans → subagent-driven-development
                                                      ├── test-driven-development (per task)
                                                      ├── requesting-code-review (per task)
                                                      └── verification-before-completion (at the end)
```

> **Rigid skills** (TDD, debugging, verification): follow strictly, no shortcuts.
> **Flexible skills** (frontend patterns, design): adapt to the project context.

---

## Project Overview
Mental-health clinic management PWA (React 18 + TypeScript + Vite + Firebase + TailwindCSS). Spanish-language domain: patients, appointments, payments, billing, clinical notes. Multi-professional support with per-professional data filtering.

## Architecture

### Data Flow
`ServiceContext` creates a `FirebaseService` (bound to current user/professional) → `DataContext` subscribes to Firestore real-time streams → views/hooks consume via `useData()` / `useService()` / `useDataActions()`.

- **`IDataService`** (`src/services/IDataService.ts`) — abstract interface for all data operations
- **`FirebaseService`** (`src/services/FirebaseService.ts`) — sole implementation; queries are scoped by `professionalName`
- **`DataContext`** exposes two appointment sets: `appointments` (my professional) and `allAppointments` (all professionals for agenda "Todos")

### Firestore Path Convention
All collections are nested under a fixed artifact/clinic path defined in `src/lib/routes.ts`:
```
artifacts/{appId}/clinics/{CLINIC_ID}/{collection}
```
`appId` and `CLINIC_ID` are constants in `src/lib/firebase.ts` — never dynamic.

### View Routing
No router library — `App.tsx` uses a `currentView` state (`View` type) with conditional rendering + `React.lazy` for code splitting. Navigation is via `setCurrentView()` prop drilling.

## Key Conventions

### Types
All domain types live in `src/types/index.ts`. Use `PatientInput`, `AppointmentInput`, `PaymentInput` (Omit<T, 'id'>) for creation payloads.

### Hooks Pattern
- **Data reads**: `useData()` from `DataContext` for patients/appointments/payments
- **Mutations**: `useDataActions()` wraps `IDataService` methods with service-availability guard
- **Specialized**: `useAgendaStats`, `usePsiquePayments`, `usePendingTasks`, `useClinicalNotes`, `useBillingStatus`, `useCalendarAppointments` — each in `src/hooks/`

### Styling
TailwindCSS with `cn()` utility (`src/lib/utils.ts`) combining `clsx` + `tailwind-merge`. Brand color: `teal-600`. No CSS modules or styled-components.

### UI Components
Shared primitives in `src/components/ui/index.tsx` (`LoadingSpinner`, `ModalOverlay`). Modals use `ModalOverlay` with backdrop-blur + click-outside-to-close pattern.

### Icons
`lucide-react` exclusively. No other icon library.

## Domain-Specific Rules

### Appointment Statuses
`'programado' | 'completado' | 'cancelado' | 'ausente' | 'presente'` — Spanish terms, not English.

### Psique Billing Logic
Patients with `patientSource: 'psique'` incur a 25% fee to Psique Salud Mental. Individual appointments can opt out via `excludeFromPsique: true`. Cancelled appointments with `chargeOnCancellation: true` still generate charges.

### Firestore Security Constraints
- **Invoiced appointments** (`billingStatus: 'invoiced'`) can only have `isPaid` updated — all other fields are locked by Firestore rules
- **Payments** cannot be deleted (rule: `allow delete: if false`)
- Billing queue items are write-once (no update/delete)

## Commands
```bash
npm run dev          # Vite dev server (localhost:5173)
npm run build        # Production build
npm test             # Vitest (unit, jsdom, src/**/*.test.ts)
npm run test:e2e     # Playwright (chromium, tests/*.spec.ts)
```

### Firebase
```bash
firebase deploy --only firestore:rules
firebase deploy --only hosting
```

### Cloud Functions
Located in `functions/` with separate `package.json`. The `triggerInvoiceGeneration` function watches the billing queue and forwards to an n8n webhook.

## Testing
- **Unit**: Vitest + jsdom + `@testing-library/react`. Setup in `src/test/setup.ts`. Tests in `src/lib/__tests__/`.
- **E2E**: Playwright against dev server (`--mode test`). Tests in `tests/`.

## Environment Variables
Firebase config via `VITE_FIREBASE_*` env vars (validated at startup in `src/lib/firebase.ts`):
`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
