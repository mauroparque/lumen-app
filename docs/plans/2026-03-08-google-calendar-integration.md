# Google Calendar Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrar Google Calendar de forma bidireccional con Lumen usando Domain-Wide Delegation, auto-generando Google Meet links para turnos online.

**Architecture:** Cloud Functions v2 con Firestore triggers (`onCreate`/`onUpdate`) envían cambios a Google Calendar API via Service Account con Domain-Wide Delegation. Un webhook HTTP recibe push notifications de Google Calendar y actualiza Firestore. Loop prevention via `_syncTimestamp`. Frontend muestra indicadores de sync en CalendarView y AppointmentDetailsModal.

**Tech Stack:** Firebase Cloud Functions v2, googleapis SDK, google-auth-library, Firestore triggers, Google Calendar API v3, Vitest (unit tests)

**Documento de diseño:** `/home/mauro/Descargas/google-integration-strategy.md` (v3)

---

## Pre-requisitos (manual, admin del dominio)

Estos pasos NO son automatizables por código — los debe hacer el admin de `@lumensaludmental.com`:

1. **Google Cloud Console** — Habilitar Calendar API, crear Service Account, descargar JSON key
2. **Google Workspace Admin** — Domain-Wide Delegation con scope `https://www.googleapis.com/auth/calendar.events`
3. **Firebase** — `firebase functions:secrets:set GOOGLE_SERVICE_ACCOUNT_KEY` con el JSON key

---

## FASE 1 — Infraestructura + Calendar Sync Unidireccional (Lumen → Google)

### Task 1: Instalar dependencias en Cloud Functions

**Files:**

- Modify: `functions/package.json`

**Step 1: Agregar dependencias**

Agregar `googleapis` y `google-auth-library` a `functions/package.json` bajo `dependencies`:

```json
{
    "dependencies": {
        "axios": "^1.13.2",
        "firebase-admin": "^13.6.0",
        "firebase-functions": "^7.0.5",
        "google-auth-library": "^9.15.1",
        "googleapis": "^148.0.0"
    }
}
```

**Step 2: Instalar**

```bash
cd functions && npm install
```

Expected: `added 2 packages` (o más transitive deps). Sin errores.

**Step 3: Verificar build**

```bash
cd functions && npm run build
```

Expected: Compila sin errores (el código existente no cambia).

**Step 4: Commit**

```bash
git add functions/package.json functions/package-lock.json
git commit -m "chore(functions): add googleapis and google-auth-library"
```

---

### Task 2: Crear `googleAuth.ts` — Factory de clientes autenticados

**Files:**

- Create: `functions/src/google/googleAuth.ts`
- Test: `functions/src/__tests__/googleAuth.test.ts`

**Context:** Este módulo es el corazón de la integración. Crea un cliente de Google Calendar autenticado como un profesional específico usando Domain-Wide Delegation. El Service Account JSON se lee desde Firebase Secret Manager (`GOOGLE_SERVICE_ACCOUNT_KEY`).

**Step 1: Escribir el test**

```typescript
// functions/src/__tests__/googleAuth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock google-auth-library antes de importar
vi.mock('google-auth-library', () => {
    const mockAuthorize = vi.fn().mockResolvedValue(undefined);
    const mockJWT = vi.fn().mockImplementation(() => ({
        authorize: mockAuthorize,
        createScoped: vi.fn().mockReturnThis(),
    }));
    return { JWT: mockJWT };
});

// Mock de process.env para el secret
const MOCK_SERVICE_ACCOUNT_KEY = JSON.stringify({
    type: 'service_account',
    project_id: 'test-project',
    private_key_id: 'key-id',
    private_key: '-----BEGIN RSA PRIVATE KEY-----\nMOCK\n-----END RSA PRIVATE KEY-----\n',
    client_email: 'sa@test-project.iam.gserviceaccount.com',
    client_id: '123456789',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
});

describe('googleAuth', () => {
    beforeEach(() => {
        vi.resetModules();
        process.env.GOOGLE_SERVICE_ACCOUNT_KEY = MOCK_SERVICE_ACCOUNT_KEY;
    });

    it('creates a Calendar client impersonating the given email', async () => {
        const { getCalendarClient } = await import('../google/googleAuth');
        const client = await getCalendarClient('profesional@lumensaludmental.com');
        expect(client).toBeDefined();
        expect(client.events).toBeDefined();
    });

    it('throws if GOOGLE_SERVICE_ACCOUNT_KEY is not set', async () => {
        delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        const { getCalendarClient } = await import('../google/googleAuth');
        await expect(getCalendarClient('test@lumensaludmental.com')).rejects.toThrow(
            'GOOGLE_SERVICE_ACCOUNT_KEY not configured',
        );
    });

    it('validates that the email belongs to lumensaludmental.com domain', async () => {
        const { getCalendarClient } = await import('../google/googleAuth');
        await expect(getCalendarClient('hacker@evil.com')).rejects.toThrow(
            'Email must belong to lumensaludmental.com domain',
        );
    });
});
```

**Step 2: Configurar Vitest para functions** (si no existe)

Crear `functions/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/__tests__/**/*.test.ts'],
    },
});
```

Y agregar scripts a `functions/package.json`:

```json
{
    "scripts": {
        "test": "vitest run",
        "test:watch": "vitest"
    },
    "devDependencies": {
        "typescript": "^5.7.3",
        "vitest": "^3.0.0"
    }
}
```

**Step 3: Ejecutar test — verificar que falla**

```bash
cd functions && npm test -- src/__tests__/googleAuth.test.ts
```

Expected: FAIL — `Cannot find module '../google/googleAuth'`

**Step 4: Implementar `googleAuth.ts`**

```typescript
// functions/src/google/googleAuth.ts
import { JWT } from 'google-auth-library';
import { google, calendar_v3 } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];
const ALLOWED_DOMAIN = 'lumensaludmental.com';

/**
 * Crea un cliente autenticado de Google Calendar que actúa en nombre
 * de un profesional del dominio lumensaludmental.com.
 *
 * Usa Domain-Wide Delegation: el Service Account impersona al usuario
 * sin necesidad de OAuth manual.
 */
export async function getCalendarClient(userEmail: string): Promise<calendar_v3.Calendar> {
    // Validar dominio — seguridad: el SA solo debe impersonar usuarios del dominio
    const domain = userEmail.split('@')[1];
    if (domain !== ALLOWED_DOMAIN) {
        throw new Error(`Email must belong to ${ALLOWED_DOMAIN} domain`);
    }

    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!keyJson) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured');
    }

    const key = JSON.parse(keyJson);

    const auth = new JWT({
        email: key.client_email,
        key: key.private_key,
        scopes: SCOPES,
        subject: userEmail, // Impersonation via DWD
    });

    await auth.authorize();

    return google.calendar({ version: 'v3', auth });
}
```

**Step 5: Ejecutar test — verificar que pasa**

```bash
cd functions && npm test -- src/__tests__/googleAuth.test.ts
```

Expected: 3 tests PASS

**Step 6: Commit**

```bash
git add functions/src/google/googleAuth.ts functions/src/__tests__/googleAuth.test.ts functions/vitest.config.ts
git commit -m "feat(functions): add googleAuth factory with domain validation"
```

---

### Task 3: Crear `appointmentMapper.ts` — Mapeo Appointment ↔ Google Calendar Event

**Files:**

- Create: `functions/src/utils/appointmentMapper.ts`
- Test: `functions/src/__tests__/appointmentMapper.test.ts`

**Context:** Este módulo convierte entre el tipo `Appointment` de Firestore y `calendar_v3.Schema$Event` de Google Calendar. Hardcodea timezone `America/Argentina/Buenos_Aires`. Es una función pura (sin side effects) — ideal para TDD.

**Step 1: Escribir los tests**

```typescript
// functions/src/__tests__/appointmentMapper.test.ts
import { describe, it, expect } from 'vitest';
import { toGoogleEvent, fromGoogleEvent } from '../utils/appointmentMapper';

describe('appointmentMapper', () => {
    describe('toGoogleEvent', () => {
        const baseAppointment = {
            id: 'appt-1',
            patientId: 'pat-1',
            patientName: 'Juan Pérez',
            date: '2026-03-10',
            time: '14:30',
            duration: 50,
            type: 'online' as const,
            status: 'programado' as const,
            professional: 'Dra. García',
        };

        it('maps appointment to Google Event with correct timezone', () => {
            const event = toGoogleEvent(baseAppointment);

            expect(event.summary).toBe('Juan Pérez — Lumen');
            expect(event.start?.dateTime).toBe('2026-03-10T14:30:00');
            expect(event.start?.timeZone).toBe('America/Argentina/Buenos_Aires');
            expect(event.end?.dateTime).toBe('2026-03-10T15:20:00');
            expect(event.end?.timeZone).toBe('America/Argentina/Buenos_Aires');
        });

        it('requests Google Meet conference for online appointments', () => {
            const event = toGoogleEvent(baseAppointment);

            expect(event.conferenceData?.createRequest).toBeDefined();
            expect(event.conferenceData?.createRequest?.conferenceSolutionKey?.type).toBe('hangoutsMeet');
        });

        it('does NOT request Google Meet for presencial appointments', () => {
            const event = toGoogleEvent({ ...baseAppointment, type: 'presencial' });

            expect(event.conferenceData).toBeUndefined();
        });

        it('handles duration that crosses hour boundary', () => {
            const event = toGoogleEvent({ ...baseAppointment, time: '23:30', duration: 60 });

            expect(event.end?.dateTime).toBe('2026-03-11T00:30:00');
        });

        it('sets status to cancelled for cancelled appointments', () => {
            const event = toGoogleEvent({ ...baseAppointment, status: 'cancelado' });

            expect(event.status).toBe('cancelled');
        });

        it('includes appointment ID in extendedProperties', () => {
            const event = toGoogleEvent(baseAppointment);

            expect(event.extendedProperties?.private?.lumenAppointmentId).toBe('appt-1');
        });
    });

    describe('fromGoogleEvent', () => {
        it('extracts date and time from Google Event', () => {
            const event = {
                start: { dateTime: '2026-03-10T14:30:00-03:00' },
                end: { dateTime: '2026-03-10T15:20:00-03:00' },
                status: 'confirmed',
            };

            const result = fromGoogleEvent(event);

            expect(result.date).toBe('2026-03-10');
            expect(result.time).toBe('14:30');
            expect(result.duration).toBe(50);
        });

        it('maps cancelled status correctly', () => {
            const event = {
                start: { dateTime: '2026-03-10T14:30:00-03:00' },
                end: { dateTime: '2026-03-10T15:20:00-03:00' },
                status: 'cancelled',
            };

            const result = fromGoogleEvent(event);
            expect(result.status).toBe('cancelado');
        });

        it('returns null for all-day events (no dateTime)', () => {
            const event = {
                start: { date: '2026-03-10' },
                end: { date: '2026-03-11' },
            };

            const result = fromGoogleEvent(event);
            expect(result).toBeNull();
        });
    });
});
```

**Step 2: Ejecutar test — verificar que falla**

```bash
cd functions && npm test -- src/__tests__/appointmentMapper.test.ts
```

Expected: FAIL — `Cannot find module '../utils/appointmentMapper'`

**Step 3: Implementar `appointmentMapper.ts`**

```typescript
// functions/src/utils/appointmentMapper.ts
import { calendar_v3 } from 'googleapis';

const TIMEZONE = 'America/Argentina/Buenos_Aires';

interface AppointmentData {
    id: string;
    patientName: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
    duration: number; // minutes
    type: 'presencial' | 'online';
    status: string;
    professional?: string;
}

interface ParsedEventData {
    date: string;
    time: string;
    duration: number;
    status: 'cancelado' | 'programado';
}

/**
 * Convierte un Appointment de Lumen a un Google Calendar Event.
 * Hardcodea timezone America/Argentina/Buenos_Aires.
 */
export function toGoogleEvent(appointment: AppointmentData): calendar_v3.Schema$Event {
    const startDateTime = `${appointment.date}T${appointment.time}:00`;
    const endDateTime = addMinutes(startDateTime, appointment.duration);

    const event: calendar_v3.Schema$Event = {
        summary: `${appointment.patientName} — Lumen`,
        description: `Profesional: ${appointment.professional || 'No asignado'}\nTipo: ${appointment.type}`,
        start: { dateTime: startDateTime, timeZone: TIMEZONE },
        end: { dateTime: endDateTime, timeZone: TIMEZONE },
        extendedProperties: {
            private: { lumenAppointmentId: appointment.id },
        },
    };

    // Google Meet solo para turnos online
    if (appointment.type === 'online') {
        event.conferenceData = {
            createRequest: {
                requestId: `lumen-${appointment.id}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
        };
    }

    // Status mapping
    if (appointment.status === 'cancelado') {
        event.status = 'cancelled';
    }

    return event;
}

/**
 * Extrae date, time, duration y status de un Google Calendar Event.
 * Retorna null si es un evento all-day (sin dateTime).
 */
export function fromGoogleEvent(event: calendar_v3.Schema$Event): ParsedEventData | null {
    const startStr = event.start?.dateTime;
    const endStr = event.end?.dateTime;

    // All-day events no tienen dateTime — no los soportamos
    if (!startStr || !endStr) return null;

    // Extraer date y time del ISO string (puede tener offset e.g. -03:00)
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);

    const date = startStr.substring(0, 10); // YYYY-MM-DD
    const time = startStr.substring(11, 16); // HH:mm

    const durationMs = endDate.getTime() - startDate.getTime();
    const duration = Math.round(durationMs / 60000);

    const status = event.status === 'cancelled' ? 'cancelado' : 'programado';

    return { date, time, duration, status };
}

/**
 * Suma minutos a un datetime string ISO (sin offset).
 * Formato esperado: YYYY-MM-DDTHH:mm:ss
 */
function addMinutes(dateTimeStr: string, minutes: number): string {
    const d = new Date(dateTimeStr);
    d.setMinutes(d.getMinutes() + minutes);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const secs = String(d.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${mins}:${secs}`;
}
```

**Step 4: Ejecutar test — verificar que pasa**

```bash
cd functions && npm test -- src/__tests__/appointmentMapper.test.ts
```

Expected: 7 tests PASS

**Step 5: Commit**

```bash
git add functions/src/utils/appointmentMapper.ts functions/src/__tests__/appointmentMapper.test.ts
git commit -m "feat(functions): add appointmentMapper with TZ hardcoded to Buenos Aires"
```

---

### Task 4: Agregar tipos de sync a `Appointment`

**Files:**

- Modify: `src/types/index.ts:51-78` (interface Appointment)

**Context:** Agregar los campos de sync status requeridos por la integración. Los campos `_syncOrigin` y `_syncTimestamp` son internos (escritos solo por Cloud Functions), no por el frontend.

**Step 1: Agregar campos al tipo Appointment**

Después de `excludeFromPsique?: boolean;` (línea ~78 actual), agregar:

```typescript
    // --- Google Calendar Sync (escritos por Cloud Functions) ---
    googleSyncStatus?: 'synced' | 'syncing' | 'error' | 'pending';
    googleSyncError?: string;
    _syncOrigin?: 'lumen' | 'google';
    _syncTimestamp?: Timestamp;
```

**Step 2: Verificar build del frontend**

```bash
npm run type-check
```

Expected: Sin errores (los campos son opcionales, no rompen nada).

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add googleSyncStatus and sync tracking fields to Appointment"
```

---

### Task 5: Actualizar Firestore security rules para `integrations/google/`

**Files:**

- Modify: `firestore.rules`

**Context:** El subcollection `integrations/google/sync/{uid}` almacena tokens de push notifications y sync state. Solo el Admin SDK (Cloud Functions) debe escribir aquí — nunca el frontend. Las reglas de `integrations/billing/` no deben cambiar.

**Step 1: Agregar regla para Google sync state**

Después del bloque de `integrations/billing/queue/{requestId}` (línea ~109), agregar:

```javascript
      // Google Calendar sync state — SOLO Admin SDK (Cloud Functions)
      // Los tokens de push notifications y sync state no deben ser
      // accesibles desde el frontend.
      match /integrations/google/{collection}/{docId} {
        allow read, write: if false;
      }
```

**Step 2: Verificar que la regla de billing sigue intacta**

Leer el archivo completo y confirmar que el bloque:

```javascript
match /integrations/billing/queue/{requestId} {
    allow read: if isAuthenticated();
    allow create: if isAuthenticated();
    allow update, delete: if false;
}
```

No fue modificado.

**Step 3: Deploy de rules (o guardar para deploy conjunto)**

> **Nota:** No deployar individualmente — se hará deploy conjunto al final de Fase 1.

**Step 4: Commit**

```bash
git add firestore.rules
git commit -m "sec(rules): add integrations/google/* deny-all rule for Calendar sync state"
```

---

### Task 6: Actualizar `isValidAppointment()` en Firestore rules

**Files:**

- Modify: `firestore.rules:40-47` (función `isValidAppointment`)

**Context:** Las Firestore rules actuales validan schema en `create`. Los nuevos campos de sync (`googleSyncStatus`, `_syncOrigin`, etc.) son escritos por Cloud Functions usando Admin SDK, que **bypasea reglas de seguridad**. Sin embargo, el frontend podría intentar escribir estos campos manualmente — la regla de `update` en appointments ya permite actualización general para profesionales autorizados.

**Decisión:** NO agregar los campos de sync a `isValidAppointment()` porque:

1. Los campos de sync son escritos por Admin SDK (bypasa rules)
2. El frontend no debe escribir `_syncOrigin` ni `_syncTimestamp`
3. La regla de `create` no necesita validar campos que no estarán presentes en la creación

**Acción:** No modificar `isValidAppointment()`. Documentar esta decisión en un comentario:

Después de `isValidAppointment()`, agregar comentario:

```javascript
// NOTA: los campos de sync con Google Calendar (googleSyncStatus, _syncOrigin,
// _syncTimestamp, googleEventId, googleMeetLink) son escritos exclusivamente
// por Cloud Functions (Admin SDK) y no necesitan validación en security rules.
```

**Step 1: Agregar comentario**

**Step 2: Commit**

```bash
git add firestore.rules
git commit -m "docs(rules): document Google Calendar sync fields bypass via Admin SDK"
```

---

### Task 7: Crear `calendarSync.ts` — Trigger `onCreate`

**Files:**

- Create: `functions/src/google/calendarSync.ts`
- Test: `functions/src/__tests__/calendarSync.test.ts`

**Context:** Este es el trigger principal. Cuando se crea un appointment en Firestore, la Cloud Function:

1. Verifica que el appointment no esté ya sincronizado (guard de idempotencia)
2. Busca el email institucional del profesional en `staff/{uid}`
3. Crea un evento en Google Calendar del profesional
4. Si es turno online, genera link de Google Meet
5. Actualiza el appointment con `googleEventId`, `googleMeetLink`, `googleSyncStatus`

**Step 1: Escribir tests**

```typescript
// functions/src/__tests__/calendarSync.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de googleAuth
const mockCalendarInsert = vi.fn();
vi.mock('../google/googleAuth', () => ({
    getCalendarClient: vi.fn().mockResolvedValue({
        events: {
            insert: mockCalendarInsert,
        },
    }),
}));

// Mock de appointmentMapper
vi.mock('../utils/appointmentMapper', () => ({
    toGoogleEvent: vi.fn().mockReturnValue({
        summary: 'Test — Lumen',
        start: { dateTime: '2026-03-10T14:30:00', timeZone: 'America/Argentina/Buenos_Aires' },
        end: { dateTime: '2026-03-10T15:20:00', timeZone: 'America/Argentina/Buenos_Aires' },
        conferenceData: {
            createRequest: { requestId: 'lumen-appt-1', conferenceSolutionKey: { type: 'hangoutsMeet' } },
        },
    }),
}));

// Mock de firebase-admin
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockGetStaffDoc = vi.fn();
vi.mock('firebase-admin', () => ({
    firestore: () => ({
        collection: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                    get: mockGetStaffDoc,
                }),
            }),
        }),
    }),
}));

import { handleAppointmentCreate } from '../google/calendarSync';

describe('handleAppointmentCreate', () => {
    const mockSnap = {
        id: 'appt-1',
        ref: { update: mockUpdate },
        data: () => ({
            patientName: 'Juan Pérez',
            date: '2026-03-10',
            time: '14:30',
            duration: 50,
            type: 'online',
            status: 'programado',
            professional: 'Dra. García',
        }),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetStaffDoc.mockResolvedValue({
            empty: false,
            docs: [{ data: () => ({ email: 'garcia@lumensaludmental.com', name: 'Dra. García' }) }],
        });
        mockCalendarInsert.mockResolvedValue({
            data: {
                id: 'google-event-123',
                hangoutLink: 'https://meet.google.com/abc-defg-hij',
            },
        });
    });

    it('skips if appointment already has googleEventId (idempotency)', async () => {
        const snapWithId = {
            ...mockSnap,
            data: () => ({
                ...mockSnap.data(),
                googleEventId: 'already-synced',
            }),
        };

        await handleAppointmentCreate(snapWithId as any);
        expect(mockCalendarInsert).not.toHaveBeenCalled();
    });

    it('creates Google Calendar event and updates appointment', async () => {
        await handleAppointmentCreate(mockSnap as any);

        expect(mockCalendarInsert).toHaveBeenCalledTimes(1);
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                googleEventId: 'google-event-123',
                googleMeetLink: 'https://meet.google.com/abc-defg-hij',
                googleSyncStatus: 'synced',
                _syncOrigin: 'lumen',
            }),
        );
    });

    it('skips if no staff profile found for professional', async () => {
        mockGetStaffDoc.mockResolvedValue({ empty: true, docs: [] });

        await handleAppointmentCreate(mockSnap as any);

        expect(mockCalendarInsert).not.toHaveBeenCalled();
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                googleSyncStatus: 'error',
                googleSyncError: expect.stringContaining('staff profile'),
            }),
        );
    });

    it('handles Calendar API errors gracefully', async () => {
        mockCalendarInsert.mockRejectedValue(new Error('Calendar API quota exceeded'));

        await handleAppointmentCreate(mockSnap as any);

        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                googleSyncStatus: 'error',
                googleSyncError: 'Calendar API quota exceeded',
            }),
        );
    });
});
```

**Step 2: Ejecutar tests — verificar que fallan**

```bash
cd functions && npm test -- src/__tests__/calendarSync.test.ts
```

Expected: FAIL — `Cannot find module '../google/calendarSync'`

**Step 3: Implementar `calendarSync.ts`**

```typescript
// functions/src/google/calendarSync.ts
import * as admin from 'firebase-admin';
import { getCalendarClient } from './googleAuth';
import { toGoogleEvent } from '../utils/appointmentMapper';

// Campos que, al cambiar, implican actualización en Google Calendar.
// Otros cambios (isPaid, billingStatus, hasNotes) se ignoran.
const CALENDAR_RELEVANT_FIELDS = ['date', 'time', 'duration', 'type', 'status', 'patientName'];

interface AppointmentData {
    id: string;
    patientName: string;
    date: string;
    time: string;
    duration: number;
    type: 'presencial' | 'online';
    status: string;
    professional?: string;
    googleEventId?: string;
    googleMeetLink?: string;
    googleSyncStatus?: string;
    _syncOrigin?: string;
    _syncTimestamp?: admin.firestore.Timestamp;
}

/**
 * Busca el email del profesional en la colección staff.
 * Retorna null si no lo encuentra.
 */
async function getStaffEmail(professionalName: string): Promise<string | null> {
    const db = admin.firestore();
    // Buscar por campo 'name' en staff collection
    // Path: artifacts/{appId}/clinics/{clinicId}/staff — se extrae de los params del trigger
    const staffSnap = await db.collectionGroup('staff').where('name', '==', professionalName).limit(1).get();

    if (staffSnap.empty) return null;
    return staffSnap.docs[0].data().email || null;
}

/**
 * Handler para onCreate de appointments.
 * Exportado como función separada del trigger para facilitar testing.
 */
export async function handleAppointmentCreate(snap: admin.firestore.QueryDocumentSnapshot): Promise<void> {
    const data = snap.data() as AppointmentData;
    const appointmentId = snap.id;

    // IDEMPOTENCY GUARD: si ya tiene googleEventId, otro trigger ya lo procesó
    if (data.googleEventId) {
        console.log(`Appointment ${appointmentId} already synced, skipping`);
        return;
    }

    // Buscar email del profesional
    const professionalName = data.professional;
    if (!professionalName) {
        console.warn(`Appointment ${appointmentId} has no professional, skipping sync`);
        await snap.ref.update({
            googleSyncStatus: 'error',
            googleSyncError: 'No professional assigned',
        });
        return;
    }

    const staffEmail = await getStaffEmail(professionalName);
    if (!staffEmail) {
        console.warn(`No staff profile found for professional: ${professionalName}`);
        await snap.ref.update({
            googleSyncStatus: 'error',
            googleSyncError: `No staff profile found for ${professionalName}`,
        });
        return;
    }

    try {
        // Marcar como syncing
        await snap.ref.update({ googleSyncStatus: 'syncing' });

        // Crear cliente de Calendar impersonando al profesional
        const calendar = await getCalendarClient(staffEmail);

        // Mapear appointment a Google Event
        const event = toGoogleEvent({ ...data, id: appointmentId });

        // Crear evento en Google Calendar
        const response = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: event,
            conferenceDataVersion: data.type === 'online' ? 1 : 0,
        });

        const googleEvent = response.data;

        // Actualizar appointment con datos de Google
        await snap.ref.update({
            googleEventId: googleEvent.id,
            googleMeetLink: googleEvent.hangoutLink || null,
            googleSyncStatus: 'synced',
            _syncOrigin: 'lumen',
            _syncTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Appointment ${appointmentId} synced to Google Calendar: ${googleEvent.id}`);
    } catch (error: any) {
        console.error(`Failed to sync appointment ${appointmentId}:`, error.message);
        await snap.ref.update({
            googleSyncStatus: 'error',
            googleSyncError: error.message,
        });
    }
}

/**
 * Handler para onUpdate de appointments.
 * Solo sincroniza cambios en campos relevantes para Calendar.
 */
export async function handleAppointmentUpdate(
    change: admin.firestore.Change<admin.firestore.QueryDocumentSnapshot>,
): Promise<void> {
    const before = change.before.data() as AppointmentData;
    const after = change.after.data() as AppointmentData;

    // LOOP PREVENTION: si _syncTimestamp cambió, el update vino de nuestro propio
    // sync process (ya sea lumen→google o google→lumen). Ignorar.
    const beforeTs = before._syncTimestamp?.toMillis?.() ?? 0;
    const afterTs = after._syncTimestamp?.toMillis?.() ?? 0;
    if (afterTs > beforeTs) {
        return;
    }

    // Si no hay googleEventId, no hay nada que actualizar en Google
    if (!after.googleEventId) return;

    // Solo sincronizar si cambió un campo relevante para Calendar
    const hasRelevantChange = CALENDAR_RELEVANT_FIELDS.some(
        (field) => (before as any)[field] !== (after as any)[field],
    );
    if (!hasRelevantChange) return;

    // Buscar email del profesional
    const professionalName = after.professional;
    if (!professionalName) return;

    const staffEmail = await getStaffEmail(professionalName);
    if (!staffEmail) return;

    try {
        const calendar = await getCalendarClient(staffEmail);

        // Si se canceló, eliminar el evento
        if (after.status === 'cancelado' && before.status !== 'cancelado') {
            await calendar.events.delete({
                calendarId: 'primary',
                eventId: after.googleEventId,
            });
            await change.after.ref.update({
                googleEventId: null,
                googleMeetLink: null,
                googleSyncStatus: 'synced',
                _syncOrigin: 'lumen',
                _syncTimestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`Appointment ${change.after.id} cancelled — Google event deleted`);
            return;
        }

        // Actualizar evento existente
        const event = toGoogleEvent({ ...after, id: change.after.id });
        await calendar.events.patch({
            calendarId: 'primary',
            eventId: after.googleEventId,
            requestBody: event,
        });

        await change.after.ref.update({
            googleSyncStatus: 'synced',
            _syncOrigin: 'lumen',
            _syncTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Appointment ${change.after.id} updated in Google Calendar`);
    } catch (error: any) {
        console.error(`Failed to update Google event for ${change.after.id}:`, error.message);
        await change.after.ref.update({
            googleSyncStatus: 'error',
            googleSyncError: error.message,
        });
    }
}
```

**Step 4: Ejecutar tests — verificar que pasan**

```bash
cd functions && npm test -- src/__tests__/calendarSync.test.ts
```

Expected: 4 tests PASS

**Step 5: Commit**

```bash
git add functions/src/google/calendarSync.ts functions/src/__tests__/calendarSync.test.ts
git commit -m "feat(functions): add calendarSync handlers with idempotency and loop prevention"
```

---

### Task 8: Registrar triggers en `functions/src/index.ts`

**Files:**

- Modify: `functions/src/index.ts`

**Context:** Exportar los Firestore triggers que disparan la sincronización. Usan Cloud Functions v2 via `onDocumentCreated` y `onDocumentUpdated`. El path del trigger es `artifacts/{appId}/clinics/{clinicId}/appointments/{appointmentId}`.

**Step 1: Agregar imports y exports**

Al final de `functions/src/index.ts`, agregar:

```typescript
// --- Google Calendar Sync ---
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { handleAppointmentCreate, handleAppointmentUpdate } from './google/calendarSync';

export const onAppointmentCreated = onDocumentCreated(
    {
        document: 'artifacts/{appId}/clinics/{clinicId}/appointments/{appointmentId}',
        secrets: ['GOOGLE_SERVICE_ACCOUNT_KEY'],
    },
    async (event) => {
        if (!event.data) return;
        await handleAppointmentCreate(event.data);
    },
);

export const onAppointmentUpdated = onDocumentUpdated(
    {
        document: 'artifacts/{appId}/clinics/{clinicId}/appointments/{appointmentId}',
        secrets: ['GOOGLE_SERVICE_ACCOUNT_KEY'],
    },
    async (event) => {
        if (!event.data) return;
        await handleAppointmentUpdate(event.data);
    },
);
```

**Step 2: Verificar build**

```bash
cd functions && npm run build
```

Expected: Sin errores de compilación.

**Step 3: Commit**

```bash
git add functions/src/index.ts
git commit -m "feat(functions): register Google Calendar sync triggers in index.ts"
```

---

### Task 9: Test de integración del trigger `onUpdate` — guards

**Files:**

- Modify: `functions/src/__tests__/calendarSync.test.ts`

**Context:** Agregar tests para `handleAppointmentUpdate`: loop prevention, filtro de campos relevantes, cancelación.

**Step 1: Agregar tests para onUpdate**

Agregar al archivo de test existente:

```typescript
describe('handleAppointmentUpdate', () => {
    const makeChange = (before: any, after: any) => ({
        before: { data: () => before, id: 'appt-1' },
        after: { data: () => after, id: 'appt-1', ref: { update: mockUpdate } },
    });

    const baseData = {
        patientName: 'Juan Pérez',
        date: '2026-03-10',
        time: '14:30',
        duration: 50,
        type: 'online',
        status: 'programado',
        professional: 'Dra. García',
        googleEventId: 'google-event-123',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetStaffDoc.mockResolvedValue({
            empty: false,
            docs: [{ data: () => ({ email: 'garcia@lumensaludmental.com' }) }],
        });
    });

    it('skips if _syncTimestamp increased (loop prevention)', async () => {
        const before = { ...baseData, _syncTimestamp: { toMillis: () => 1000 } };
        const after = { ...baseData, _syncTimestamp: { toMillis: () => 2000 } };

        await handleAppointmentUpdate(makeChange(before, after) as any);
        expect(mockCalendarInsert).not.toHaveBeenCalled();
    });

    it('skips if no calendar-relevant fields changed', async () => {
        const before = { ...baseData, isPaid: false };
        const after = { ...baseData, isPaid: true };

        await handleAppointmentUpdate(makeChange(before, after) as any);
        expect(mockCalendarInsert).not.toHaveBeenCalled();
    });

    it('skips if googleEventId is missing', async () => {
        const before = { ...baseData, googleEventId: undefined };
        const after = { ...baseData, googleEventId: undefined, time: '15:00' };

        await handleAppointmentUpdate(makeChange(before, after) as any);
        expect(mockCalendarInsert).not.toHaveBeenCalled();
    });
});
```

Importar `handleAppointmentUpdate` al inicio del archivo:

```typescript
import { handleAppointmentCreate, handleAppointmentUpdate } from '../google/calendarSync';
```

**Step 2: Ejecutar tests**

```bash
cd functions && npm test -- src/__tests__/calendarSync.test.ts
```

Expected: 7 tests PASS (4 onCreate + 3 onUpdate)

**Step 3: Commit**

```bash
git add functions/src/__tests__/calendarSync.test.ts
git commit -m "test(functions): add onUpdate guard tests for loop prevention and field filtering"
```

---

### Task 10: Agregar ruta para Google sync state en `routes.ts`

**Files:**

- Modify: `src/lib/routes.ts`

**Context:** Aunque el frontend no escribe en `integrations/google/sync/`, necesita la ruta para futuras consultas read-only de estado (Fase 2 UI). Agregar por consistencia con el patrón existente.

**Step 1: Agregar constante**

```typescript
export const GOOGLE_SYNC_COLLECTION = `artifacts/${appId}/clinics/${CLINIC_ID}/integrations/google/sync`;
```

**Step 2: Commit**

```bash
git add src/lib/routes.ts
git commit -m "feat(routes): add GOOGLE_SYNC_COLLECTION path"
```

---

### Task 11: Deploy de Firestore rules + Cloud Functions

**Files:** (ninguno nuevo — deploy de lo existente)

**Context:** Deployar reglas de Firestore y Cloud Functions juntos.

> ⚠️ **Prerequisito:** El Service Account JSON debe estar subido a Secret Manager:
>
> ```bash
> firebase functions:secrets:set GOOGLE_SERVICE_ACCOUNT_KEY
> ```
>
> Y las APIs habilitadas en Google Cloud Console.

**Step 1: Deploy de rules**

```bash
firebase deploy --only firestore:rules
```

Expected: `✔ firestore: Released rules`

**Step 2: Deploy de functions**

```bash
cd functions && npm run build && cd .. && firebase deploy --only functions
```

Expected: `✔ functions: Finished running predeploy script` + deploy exitoso de `onAppointmentCreated`, `onAppointmentUpdated`, `validateTurnstile`, `triggerInvoiceGeneration`.

**Step 3: Verificar en Firebase Console**

Ir a Functions → verificar que `onAppointmentCreated` y `onAppointmentUpdated` aparecen como v2 functions.

**Step 4: Commit tag**

```bash
git tag -a fase1-google-calendar -m "Fase 1: Google Calendar integration (Lumen → Google)"
```

---

## FASE 2 — Sync Bidireccional (Google → Lumen) + UI

### Task 12: Crear `calendarWebhook.ts` — HTTP endpoint para push notifications

**Files:**

- Create: `functions/src/google/calendarWebhook.ts`
- Test: `functions/src/__tests__/calendarWebhook.test.ts`

**Context:** Google Calendar envía push notifications a una URL HTTP cuando un evento cambia. Este endpoint:

1. Valida el `X-Goog-Channel-Token` (secreto compartido)
2. Lee el `X-Goog-Resource-Id` y `X-Goog-Channel-Id` para identificar qué canal disparó
3. Llama a `calendar.events.get()` para obtener el cambio real
4. Busca el appointment en Firestore por `googleEventId`
5. Actualiza el appointment con los cambios (date, time, status)
6. Marca `_syncOrigin: 'google'` para evitar loop

**Step 1: Escribir tests**

```typescript
// functions/src/__tests__/calendarWebhook.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockFirestoreGet = vi.fn();

vi.mock('firebase-admin', () => ({
    firestore: () => ({
        collectionGroup: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                    get: mockFirestoreGet,
                }),
            }),
        }),
    }),
}));

vi.mock('../utils/appointmentMapper', () => ({
    fromGoogleEvent: vi.fn().mockReturnValue({
        date: '2026-03-11',
        time: '16:00',
        duration: 50,
        status: 'programado',
    }),
}));

const mockEventsGet = vi.fn();
vi.mock('../google/googleAuth', () => ({
    getCalendarClient: vi.fn().mockResolvedValue({
        events: { get: mockEventsGet },
    }),
}));

import { handleCalendarWebhook } from '../google/calendarWebhook';

describe('handleCalendarWebhook', () => {
    const mockReq = {
        headers: {
            'x-goog-channel-token': 'valid-secret-token',
            'x-goog-resource-id': 'resource-123',
            'x-goog-channel-id': 'channel-abc',
            'x-goog-resource-state': 'update',
        },
        query: {},
    };
    const mockRes = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.GOOGLE_WEBHOOK_TOKEN = 'valid-secret-token';
    });

    it('rejects requests with invalid channel token', async () => {
        const badReq = {
            ...mockReq,
            headers: { ...mockReq.headers, 'x-goog-channel-token': 'wrong-token' },
        };

        await handleCalendarWebhook(badReq as any, mockRes as any);

        expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('returns 200 for sync notifications (initial subscription confirmation)', async () => {
        const syncReq = {
            ...mockReq,
            headers: { ...mockReq.headers, 'x-goog-resource-state': 'sync' },
        };

        await handleCalendarWebhook(syncReq as any, mockRes as any);

        expect(mockRes.status).toHaveBeenCalledWith(200);
    });
});
```

**Step 2: Ejecutar tests — verificar que fallan**

```bash
cd functions && npm test -- src/__tests__/calendarWebhook.test.ts
```

Expected: FAIL — `Cannot find module`

**Step 3: Implementar `calendarWebhook.ts`**

```typescript
// functions/src/google/calendarWebhook.ts
import * as admin from 'firebase-admin';
import { getCalendarClient } from './googleAuth';
import { fromGoogleEvent } from '../utils/appointmentMapper';

interface WebhookRequest {
    headers: Record<string, string | undefined>;
    query: Record<string, string | undefined>;
}

interface WebhookResponse {
    status: (code: number) => WebhookResponse;
    send: (body: string) => void;
}

/**
 * Handler para push notifications de Google Calendar.
 * Exportado separado del trigger para facilitar testing.
 */
export async function handleCalendarWebhook(req: WebhookRequest, res: WebhookResponse): Promise<void> {
    // 1. Validar token secreto
    const channelToken = req.headers['x-goog-channel-token'];
    const expectedToken = process.env.GOOGLE_WEBHOOK_TOKEN;

    if (!expectedToken || channelToken !== expectedToken) {
        console.warn('Invalid or missing webhook channel token');
        res.status(403).send('Forbidden');
        return;
    }

    // 2. Google envía un "sync" notification al crear la suscripción — responder 200
    const resourceState = req.headers['x-goog-resource-state'];
    if (resourceState === 'sync') {
        res.status(200).send('OK');
        return;
    }

    // 3. Solo procesar "update" y "exists" (cambios reales)
    if (resourceState !== 'update' && resourceState !== 'exists') {
        res.status(200).send('Ignored');
        return;
    }

    const channelId = req.headers['x-goog-channel-id'];
    if (!channelId) {
        res.status(400).send('Missing channel ID');
        return;
    }

    try {
        const db = admin.firestore();

        // 4. Buscar el sync state para este canal — obtener el email del profesional
        const syncSnap = await db.collectionGroup('sync').where('channelId', '==', channelId).limit(1).get();

        if (syncSnap.empty) {
            console.warn(`No sync state found for channel ${channelId}`);
            res.status(200).send('Channel not found');
            return;
        }

        const syncDoc = syncSnap.docs[0];
        const syncData = syncDoc.data();
        const staffEmail = syncData.staffEmail;

        if (!staffEmail) {
            res.status(200).send('No staff email');
            return;
        }

        // 5. Obtener eventos modificados desde Google
        const calendar = await getCalendarClient(staffEmail);
        const updatedToken = syncData.lastSyncToken;

        // Usar syncToken para incremental sync
        const eventsResponse = await calendar.events.list({
            calendarId: 'primary',
            syncToken: updatedToken || undefined,
            showDeleted: true,
        });

        const events = eventsResponse.data.items || [];

        // 6. Guardar el nuevo syncToken
        if (eventsResponse.data.nextSyncToken) {
            await syncDoc.ref.update({
                lastSyncToken: eventsResponse.data.nextSyncToken,
            });
        }

        // 7. Procesar cada evento modificado
        for (const event of events) {
            // Solo procesar eventos creados por Lumen
            const lumenId = event.extendedProperties?.private?.lumenAppointmentId;
            if (!lumenId) continue; // No es un evento de Lumen

            // Buscar appointment en Firestore
            const apptSnap = await db
                .collectionGroup('appointments')
                .where('googleEventId', '==', event.id)
                .limit(1)
                .get();

            if (apptSnap.empty) continue;

            const apptDoc = apptSnap.docs[0];
            const apptData = apptDoc.data();

            // Parsear datos del evento de Google
            if (event.status === 'cancelled') {
                // Solo cancelar si no estaba ya cancelado
                if (apptData.status !== 'cancelado') {
                    await apptDoc.ref.update({
                        status: 'cancelado',
                        googleSyncStatus: 'synced',
                        _syncOrigin: 'google',
                        _syncTimestamp: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
                continue;
            }

            const parsed = fromGoogleEvent(event);
            if (!parsed) continue; // All-day event, skip

            // Solo actualizar si realmente cambió algo
            const changed =
                apptData.date !== parsed.date || apptData.time !== parsed.time || apptData.duration !== parsed.duration;

            if (changed) {
                await apptDoc.ref.update({
                    date: parsed.date,
                    time: parsed.time,
                    duration: parsed.duration,
                    googleSyncStatus: 'synced',
                    _syncOrigin: 'google',
                    _syncTimestamp: admin.firestore.FieldValue.serverTimestamp(),
                });
                console.log(`Appointment ${apptDoc.id} updated from Google Calendar event ${event.id}`);
            }
        }

        res.status(200).send('OK');
    } catch (error: any) {
        console.error('Webhook handler error:', error.message);
        // Siempre retornar 200 para que Google no reintente infinitamente
        res.status(200).send('Error processed');
    }
}
```

**Step 4: Ejecutar tests — verificar que pasan**

```bash
cd functions && npm test -- src/__tests__/calendarWebhook.test.ts
```

Expected: 2 tests PASS

**Step 5: Commit**

```bash
git add functions/src/google/calendarWebhook.ts functions/src/__tests__/calendarWebhook.test.ts
git commit -m "feat(functions): add calendarWebhook handler with token validation"
```

---

### Task 13: Registrar webhook endpoint y channel renewal en `index.ts`

**Files:**

- Modify: `functions/src/index.ts`

**Context:** Registrar el endpoint HTTP para el webhook y la función scheduled para renovar el canal cada 5 días.

**Step 1: Agregar imports y exports**

```typescript
// --- Google Calendar Webhook ---
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { handleCalendarWebhook } from './google/calendarWebhook';

export const calendarWebhook = onRequest(
    {
        secrets: ['GOOGLE_SERVICE_ACCOUNT_KEY', 'GOOGLE_WEBHOOK_TOKEN'],
    },
    async (req, res) => {
        await handleCalendarWebhook(req, res);
    },
);
```

> **Nota:** La función `calendarChannelRenewal` (Cloud Scheduler para renovar los canales de push cada 5 días) se implementa en Task 14.

**Step 2: Verificar build**

```bash
cd functions && npm run build
```

Expected: Sin errores.

**Step 3: Commit**

```bash
git add functions/src/index.ts
git commit -m "feat(functions): register calendarWebhook HTTP endpoint"
```

---

### Task 14: Crear función de renovación de canal y setup de push notifications

**Files:**

- Create: `functions/src/google/calendarChannelRenewal.ts`
- Modify: `functions/src/index.ts`

**Context:** Google Calendar push notification channels expiran cada 7 días. Una Cloud Scheduler function corre cada 5 días para renovar los canales activos de todos los profesionales con sync habilitado.

**Step 1: Implementar `calendarChannelRenewal.ts`**

```typescript
// functions/src/google/calendarChannelRenewal.ts
import * as admin from 'firebase-admin';
import { getCalendarClient } from './googleAuth';
import { randomUUID } from 'crypto';

const WEBHOOK_BASE_URL = process.env.FUNCTIONS_URL || '';

/**
 * Crea o renueva el canal de push notifications de Google Calendar
 * para un profesional específico.
 */
export async function setupCalendarChannel(
    staffEmail: string,
    staffUid: string,
    webhookUrl: string,
    webhookToken: string,
): Promise<void> {
    const calendar = await getCalendarClient(staffEmail);
    const channelId = `lumen-${staffUid}-${randomUUID().substring(0, 8)}`;

    const response = await calendar.events.watch({
        calendarId: 'primary',
        requestBody: {
            id: channelId,
            type: 'web_hook',
            address: webhookUrl,
            token: webhookToken,
            params: {
                // TTL: 7 días (máximo permitido por Google)
                ttl: String(7 * 24 * 60 * 60),
            },
        },
    });

    const db = admin.firestore();
    // Guardar en integrations/google/sync/{uid}
    // Path exacto depende de cómo se configure el clinicId — usar constante
    const syncRef = db.doc(`artifacts/lumen-production/clinics/lumen-general/integrations/google/sync/${staffUid}`);

    await syncRef.set(
        {
            staffEmail,
            channelId,
            channelResourceId: response.data.resourceId,
            channelExpiration: new Date(Number(response.data.expiration)),
            enabled: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
    );

    console.log(`Calendar channel created for ${staffEmail}: ${channelId}`);
}

/**
 * Detiene un canal de push notifications existente.
 */
export async function stopCalendarChannel(staffEmail: string, channelId: string, resourceId: string): Promise<void> {
    const calendar = await getCalendarClient(staffEmail);
    await calendar.channels.stop({
        requestBody: {
            id: channelId,
            resourceId: resourceId,
        },
    });
    console.log(`Calendar channel stopped: ${channelId}`);
}

/**
 * Renueva todos los canales activos de push notifications.
 * Se ejecuta via Cloud Scheduler cada 5 días.
 */
export async function renewAllChannels(): Promise<void> {
    const db = admin.firestore();
    const webhookToken = process.env.GOOGLE_WEBHOOK_TOKEN;
    const webhookUrl = process.env.CALENDAR_WEBHOOK_URL;

    if (!webhookToken || !webhookUrl) {
        console.error('Missing GOOGLE_WEBHOOK_TOKEN or CALENDAR_WEBHOOK_URL');
        return;
    }

    // Buscar todos los sync docs con enabled: true
    const syncSnap = await db
        .collection('artifacts/lumen-production/clinics/lumen-general/integrations/google/sync')
        .where('enabled', '==', true)
        .get();

    for (const doc of syncSnap.docs) {
        const data = doc.data();
        const uid = doc.id;

        try {
            // Detener canal anterior si existe
            if (data.channelId && data.channelResourceId) {
                await stopCalendarChannel(data.staffEmail, data.channelId, data.channelResourceId);
            }

            // Crear nuevo canal
            await setupCalendarChannel(data.staffEmail, uid, webhookUrl, webhookToken);
        } catch (error: any) {
            console.error(`Failed to renew channel for ${data.staffEmail}:`, error.message);
        }
    }
}
```

**Step 2: Registrar en index.ts**

```typescript
import { renewAllChannels } from './google/calendarChannelRenewal';

export const calendarChannelRenew = onSchedule(
    {
        schedule: 'every 5 days',
        secrets: ['GOOGLE_SERVICE_ACCOUNT_KEY', 'GOOGLE_WEBHOOK_TOKEN'],
    },
    async () => {
        await renewAllChannels();
    },
);
```

**Step 3: Verificar build**

```bash
cd functions && npm run build
```

**Step 4: Commit**

```bash
git add functions/src/google/calendarChannelRenewal.ts functions/src/index.ts
git commit -m "feat(functions): add calendar channel renewal scheduled function"
```

---

### Task 15: Frontend — Componente `GoogleSyncIndicator`

**Files:**

- Create: `src/components/ui/GoogleSyncIndicator.tsx`

**Context:** Pequeño badge que muestra el estado de sincronización con Google Calendar en cada appointment del CalendarView. Estados: `synced` (✅), `syncing` (🔄), `error` (⚠️), `pending` (⏳), sin valor (no mostrar nada).

**Step 1: Crear el componente**

```typescript
// src/components/ui/GoogleSyncIndicator.tsx
import { CheckCircle, RefreshCw, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface GoogleSyncIndicatorProps {
    status?: 'synced' | 'syncing' | 'error' | 'pending';
    error?: string;
    size?: 'sm' | 'md';
    className?: string;
}

const config = {
    synced: {
        icon: CheckCircle,
        color: 'text-green-500',
        label: 'Sincronizado con Google',
    },
    syncing: {
        icon: RefreshCw,
        color: 'text-blue-500 animate-spin',
        label: 'Sincronizando...',
    },
    error: {
        icon: AlertTriangle,
        color: 'text-amber-500',
        label: 'Error de sincronización',
    },
    pending: {
        icon: Clock,
        color: 'text-slate-400',
        label: 'Pendiente de sincronización',
    },
} as const;

export const GoogleSyncIndicator = ({ status, error, size = 'sm', className }: GoogleSyncIndicatorProps) => {
    if (!status) return null;

    const { icon: Icon, color, label } = config[status];
    const iconSize = size === 'sm' ? 10 : 14;

    return (
        <span
            className={cn('inline-flex items-center', className)}
            title={error ? `${label}: ${error}` : label}
        >
            <Icon size={iconSize} className={color} />
        </span>
    );
};
```

**Step 2: Verificar type-check**

```bash
npm run type-check
```

Expected: Sin errores.

**Step 3: Commit**

```bash
git add src/components/ui/GoogleSyncIndicator.tsx
git commit -m "feat(ui): add GoogleSyncIndicator component for calendar sync status"
```

---

### Task 16: Frontend — Integrar `GoogleSyncIndicator` en CalendarView

**Files:**

- Modify: `src/views/CalendarView.tsx`

**Context:** Agregar el indicador de sync junto al ícono de `Video`/`MapPin` en cada appointment card del calendario semana. El indicador se muestra inline, al lado de los íconos existentes.

**Step 1: Agregar import**

En los imports de CalendarView.tsx, agregar:

```typescript
import { GoogleSyncIndicator } from '../components/ui/GoogleSyncIndicator';
```

**Step 2: Agregar indicador en la card del appointment**

En la sección de la card del appointment (semana view), después del bloque del `AlertCircle` de notas (alrededor de línea ~525), agregar:

```tsx
{
    /* Google Sync Indicator */
}
{
    appt.googleSyncStatus && <GoogleSyncIndicator status={appt.googleSyncStatus} error={appt.googleSyncError} />;
}
```

**Step 3: Verificar build**

```bash
npm run build
```

Expected: Build exitoso sin warnings.

**Step 4: Commit**

```bash
git add src/views/CalendarView.tsx
git commit -m "feat(calendar): show Google sync indicator on appointment cards"
```

---

### Task 17: Frontend — Mejorar AppointmentDetailsModal con sync status

**Files:**

- Modify: `src/components/modals/AppointmentDetailsModal.tsx`

**Context:** El modal ya muestra `googleMeetLink` y `googleEventId` (líneas 356-382). Mejorar:

1. Mostrar `GoogleSyncIndicator` con status detallado
2. Agregar link "Ver en Google Calendar" si tiene `googleEventId`
3. Mostrar error de sync si hay uno

**Step 1: Agregar import**

```typescript
import { GoogleSyncIndicator } from '../ui/GoogleSyncIndicator';
import { ExternalLink } from 'lucide-react';
```

**Step 2: Mejorar bloque de Google Calendar info**

Reemplazar el bloque existente (líneas ~369-381) donde dice `appointment.googleEventId && (`:

```tsx
{
    /* Google Calendar Sync Status */
}
{
    appointment.googleSyncStatus && (
        <div className="flex items-center mt-1 gap-1.5">
            <GoogleSyncIndicator status={appointment.googleSyncStatus} error={appointment.googleSyncError} size="md" />
            <span
                className={cn(
                    'text-xs font-medium',
                    appointment.googleSyncStatus === 'synced' && 'text-green-600',
                    appointment.googleSyncStatus === 'syncing' && 'text-blue-600',
                    appointment.googleSyncStatus === 'error' && 'text-amber-600',
                )}
            >
                {appointment.googleSyncStatus === 'synced' && 'Sincronizado con Google'}
                {appointment.googleSyncStatus === 'syncing' && 'Sincronizando...'}
                {appointment.googleSyncStatus === 'error' &&
                    `Error: ${appointment.googleSyncError || 'Error desconocido'}`}
                {appointment.googleSyncStatus === 'pending' && 'Pendiente de sincronización'}
            </span>
        </div>
    );
}
{
    appointment.googleEventId && (
        <a
            href={`https://calendar.google.com/calendar/event?eid=${btoa(appointment.googleEventId)}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-teal-600 hover:underline flex items-center gap-1 mt-1"
        >
            <ExternalLink size={12} />
            Ver en Google Calendar
        </a>
    );
}
```

**Step 3: Agregar import de `cn`**

Si no existe ya, agregar:

```typescript
import { cn } from '../../lib/utils';
```

**Step 4: Verificar build**

```bash
npm run build
```

Expected: Sin errores.

**Step 5: Commit**

```bash
git add src/components/modals/AppointmentDetailsModal.tsx
git commit -m "feat(modal): show Google Calendar sync status and direct link in appointment details"
```

---

### Task 18: Deploy de Fase 2

**Step 1: Deploy functions**

```bash
cd functions && npm run build && cd .. && firebase deploy --only functions
```

**Step 2: Configurar secrets para webhook**

```bash
firebase functions:secrets:set GOOGLE_WEBHOOK_TOKEN
# Ingresar un token secreto aleatorio (e.g. openssl rand -hex 32)

firebase functions:secrets:set CALENDAR_WEBHOOK_URL
# Ingresar la URL del webhook: https://<region>-<project>.cloudfunctions.net/calendarWebhook
```

**Step 3: Setup inicial de canales**

Para cada profesional, trigger manual de `setupCalendarChannel()` via Firebase Shell o un script one-off.

**Step 4: Deploy frontend**

```bash
npm run build && firebase deploy --only hosting
```

**Step 5: Tag**

```bash
git tag -a fase2-google-calendar-bidirectional -m "Fase 2: Bidirectional Google Calendar sync + UI indicators"
```

---

## FASE 3 — Google Drive (diferido)

### Task 19: Placeholder — Diseño detallado de Drive integration

**Este task NO se implementa ahora.** Se incluye como placeholder para que el plan esté completo.

**Scope futuro:**

- Cloud Function: crear carpeta Drive por paciente al crear el primer adjunto
- Cloud Function: subir attachments a Drive via `driveService.ts`
- Frontend: toggle "Guardar también en Google Drive" en notas clínicas
- Scope adicional en Domain-Wide Delegation: `drive.file`

**Prerequisitos:**

- Fase 1 y 2 completas y estabilizadas (min 2 semanas en producción)
- Agregar scope `https://www.googleapis.com/auth/drive.file` en Google Workspace Admin

---

## FASE 4 — Refinamiento (diferido)

### Task 20: Placeholder — Mejoras post-estabilización

**Scope futuro:**

- Sync de series recurrentes como una unidad (no 20 triggers individuales)
- Dashboard admin: monitor de estado de sincronización de todos los profesionales
- Retry automático con exponential backoff para syncs fallidos (Cloud Tasks)
- Métricas y logging estructurado
- Deprecación formal de `meetLink` (migration script + UI cleanup)

---

## Notas de arquitectura para el implementador

### Patrón de Cloud Functions

- Toda función v2 debe declarar `secrets` para acceder a Secret Manager
- Los handlers se exportan como funciones separadas del trigger para facilitar unit testing
- Mock de `firebase-admin` y `googleapis` en tests

### Decisiones explícitas documentadas

| Decisión                                               | Razón                                                                       |
| ------------------------------------------------------ | --------------------------------------------------------------------------- |
| Timezone hardcoded `America/Argentina/Buenos_Aires`    | Clínica opera en Buenos Aires, no hay sedes en otras zonas                  |
| `StaffProfile.email` para impersonation                | El email de login ya es el institucional (`@lumensaludmental.com`)          |
| `meetLink` deprecado, no eliminado                     | Backward compatibility — UI ya hace fallback `googleMeetLink \|\| meetLink` |
| Scope `calendar.events` (no `calendar`)                | Mínimo privilegio — no necesitamos acceso a settings de calendario          |
| Firestore rules `if false` para `integrations/google/` | Solo Admin SDK escribe sync state                                           |
| `_syncTimestamp` como guard de loop                    | Un solo campo cubre ambas direcciones (lumen→google y google→lumen)         |

### Series recurrentes en Fase 1

Cuando se crea una serie recurrente, cada appointment se crea individualmente → cada uno dispara `onCreate` → se crean N eventos independientes en Google Calendar (no como serie recurrente de Google). Esto es el comportamiento esperado para Fase 1. En Fase 4 se evaluará crear una recurrence rule en Google Calendar.
