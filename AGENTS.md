# AGENTS.md - Lumen App V2

This file contains guidelines and commands for agentic coding tools working in this repository.

---

## Project Overview

- **Stack**: React 18 + TypeScript + Vite + Firebase (Firestore, Auth, Storage) + TailwindCSS
- **Type**: Progressive Web App (PWA) for mental health clinic management
- **Language**: Spanish-language domain (patients, appointments, payments, billing, clinical notes)
- **Location**: Frontend in root, Cloud Functions in `functions/`

---

## Commands

### Frontend (Root)

```bash
npm run dev           # Start Vite dev server (localhost:5173)
npm run build         # Production build
npm run preview       # Preview production build
npm test              # Run all Vitest unit tests
npm run test:ui       # Run Vitest with UI browser
npm run test:e2e      # Run Playwright e2e tests
```

### Running a Single Test

```bash
# Vitest - run specific test file
npm test -- src/lib/__tests__/utils.test.ts

# Vitest - run tests matching a name pattern
npm test -- --grep "formatPhoneNumber"

# Vitest - run in watch mode (default)
npm test -- --watch
```

### Cloud Functions (`functions/`)

```bash
cd functions
npm run build         # Compile TypeScript
npm run serve         # Run Firebase emulators
npm run deploy        # Deploy to Firebase
npm run logs          # View function logs
```

### Firebase Deployment

```bash
firebase deploy --only firestore:rules
firebase deploy --only hosting
```

---

## Architecture

### Data Flow
```
ServiceContext → FirebaseService → DataContext → views/hooks
```

- **`IDataService`** (`src/services/IDataService.ts`) — abstract interface for all data operations
- **`FirebaseService`** (`src/services/FirebaseService.ts`) — sole implementation; queries scoped by `professionalName`
- **`DataContext`** — exposes `appointments` (current professional) and `allAppointments` (all professionals)

### Firestore Path Convention
```
artifacts/{appId}/clinics/{CLINIC_ID}/{collection}
```
- `appId` = `lumen-production` (constant, defined in `src/lib/firebase.ts`)
- `CLINIC_ID` = `lumen-general`

### View Routing
No router library. `App.tsx` uses `currentView` state (`View` type) with conditional rendering + `React.lazy()` for code splitting.

---

## Code Style Guidelines

### Imports

```typescript
// Local modules - relative paths
import { Patient } from '../../types';
import { formatPhoneNumber } from '../../lib/utils';

// External libraries - named imports
import { useState, useEffect } from 'react';
import { Mail, Phone, Video } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';

// Type imports
import type { PatientInput, AppointmentInput } from '../../types';
```

### Naming Conventions

- **Components**: PascalCase (`PatientCard`, `AppointmentModal`)
- **Types/Interfaces**: PascalCase (`Patient`, `Appointment`, `View`)
- **Input Types**: PascalCase with `Input` suffix (`PatientInput`, `AppointmentInput`)
- **Hooks**: camelCase with `use` prefix (`usePatients`, `useDataActions`)
- **Functions**: camelCase (`formatPhoneNumber`, `getInitials`)
- **Constants**: SCREAMING_SCAL for env/config (`VITE_FIREBASE_API_KEY`, `CLINIC_ID`)

### TypeScript

- All domain types in `src/types/index.ts`
- Use `Omit<T, 'id'>` for input types (e.g., `PatientInput = Omit<Patient, 'id'>`)
- Enable strict null checks
- Use Firebase Timestamp types where appropriate

### React Patterns

- Use function components with explicit prop typing
- Prefer composition over inheritance
- Extract reusable logic into custom hooks in `src/hooks/`
- Use `React.lazy()` for code splitting views

```typescript
interface PatientCardProps {
    patient: Patient;
    onView: () => void;
    onEdit?: (e: React.MouseEvent) => void;
    onDelete?: (e: React.MouseEvent) => void;
}

export const PatientCard = ({ patient, onView, onEdit, onDelete }: PatientCardProps) => {
    // ...
};
```

### Error Handling

- Wrap Firebase operations in try-catch with user-friendly error messages
- Use service-availability guards in hooks (via `useDataActions`)
- Validate environment variables at startup (`src/lib/firebase.ts`)
- Use `console.warn` for non-critical missing configuration

### Styling

- TailwindCSS exclusively (no CSS modules or styled-components)
- Use `cn()` utility from `src/lib/utils.ts` for conditional classes
- Brand color: `teal-600` for primary actions
- Icons: `lucide-react` exclusively

```typescript
import { cn } from '../../lib/utils';

// Usage
<div className={cn(
    "base-class",
    isActive && "active-class",
    className // allow override
)}>
```

---

## Domain-Specific Rules

### Appointment Statuses (Spanish)
```typescript
type AppointmentStatus = 'programado' | 'completado' | 'cancelado' | 'ausente' | 'presente';
```

### Patient Sources
```typescript
type PatientSource = 'psique' | 'particular';
```

### Psique Billing
- Patients with `patientSource: 'psique'` incur 25% fee
- Individual appointments can opt out via `excludeFromPsique: true`
- Cancelled appointments with `chargeOnCancellation: true` still generate charges

### Firestore Security
- Invoiced appointments (`billingStatus: 'invoiced'`) — only `isPaid` field is mutable
- Payments cannot be deleted
- Billing queue items are write-once (no update/delete)

---

## Testing

### Unit Tests (Vitest)
- Location: `src/lib/__tests__/*.test.ts`
- Framework: Vitest + jsdom + `@testing-library/react`
- Setup: `src/test/setup.ts`

```typescript
import { describe, it, expect } from 'vitest';

describe('formatPhoneNumber', () => {
    it('removes non-numeric characters', () => {
        expect(formatPhoneNumber('+54 11 1234-5678')).toBe('541112345678');
    });
});
```

### E2E Tests (Playwright)
- Location: `tests/*.spec.ts`
- Config: `playwright.config.ts`
- Browser: Chromium only
- Base URL: `http://localhost:5173`

---

## Environment Variables

Required Firebase config (via `VITE_*` prefix):
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

---

## File Structure

```
src/
├── components/          # React components
│   ├── layout/         # Layout components (Sidebar, Header)
│   ├── modals/         # Modal components
│   ├── patients/       # Patient-related components
│   ├── payments/       # Payment components
│   └── ui/             # Shared UI primitives
├── context/            # React Context providers
├── hooks/              # Custom React hooks
├── lib/                # Utilities and Firebase config
│   └── __tests__/     # Unit tests
├── services/          # Data service interfaces
├── test/               # Test setup
├── types/              # TypeScript type definitions
└── App.tsx             # Main app component
```

---

## Key Files

- `src/types/index.ts` — All domain types
- `src/lib/firebase.ts` — Firebase initialization and constants
- `src/lib/utils.ts` — Utility functions including `cn()` helper
- `src/context/DataContext.tsx` — Main data context
- `src/services/FirebaseService.ts` — Firestore operations
