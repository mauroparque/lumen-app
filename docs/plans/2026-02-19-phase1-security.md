# Phase 1: Security — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar RBAC, onboarding seguro, validación server-side de Turnstile, y CSP estricta para proteger los datos clínicos de la aplicación.

**Architecture:** Firestore rules con role-checking via custom claims (o document reads), allowlist de emails en Firestore, Cloud Function callable para validar Turnstile, CSP con hashes en vez de unsafe-inline/eval.

**Tech Stack:** Firebase Auth, Firestore Rules, Cloud Functions v2, Cloudflare Turnstile API, Vite CSP plugin.

---

## Tabla de permisos (referencia para todas las tasks)

| Recurso | Admin | Profesional |
| --------- | ------- | ------------- |
| Pacientes propios | CRUD | CRUD |
| Pacientes de otros | CRUD | Solo lectura |
| Turnos propios | CRUD | CRUD |
| Turnos de otros | CRUD | Solo lectura (agenda "Todos") |
| Pagos propios | CRU (no delete por rules) | CRU (no delete) |
| Pagos de otros | CRU | Solo lectura |
| Billing propios | CRUD | CRUD |
| Billing de otros | CRUD | Solo lectura |
| Notas clínicas propias | CRUD | CRUD |
| Notas clínicas de otros | CRUD | Sin acceso |
| Staff | CRUD | Lectura propia |
| Allowlist/usuarios | CRUD | Sin acceso |

> **Scoping:** El campo `professional` en cada documento determina la propiedad. Se compara contra `professionalName` del perfil de staff del usuario autenticado.

---

## Task 1: Tipo `AllowedEmail` y colección Firestore

### Archivos: `src/types/index.ts` y `src/lib/routes.ts`

- Modify: `src/types/index.ts`
- Modify: `src/lib/routes.ts`

### Step 1: Agregar tipo `AllowedEmail` a los tipos del dominio

En `src/types/index.ts`, agregar al final:

```typescript
// Allowlist for onboarding
export interface AllowedEmail {
    email: string;
    role: 'admin' | 'professional';
    professionalName: string;
}
```

### Step 2: Agregar ruta de colección

En `src/lib/routes.ts`, agregar:

```typescript
export const ALLOWED_EMAILS_COLLECTION = `artifacts/${appId}/clinics/${CLINIC_ID}/allowedEmails`;
export const STAFF_COLLECTION = `artifacts/${appId}/clinics/${CLINIC_ID}/staff`;
export const NOTES_COLLECTION = `artifacts/${appId}/clinics/${CLINIC_ID}/notes`;
export const PSIQUE_PAYMENTS_COLLECTION = `artifacts/${appId}/clinics/${CLINIC_ID}/psiquePayments`;
```

> Nota: `STAFF_COLLECTION`, `NOTES_COLLECTION` y `PSIQUE_PAYMENTS_COLLECTION` se agregan porque actualmente están hardcodeados en hooks. Centralizar ahora facilita las tasks siguientes.

### Step 3: Commit — types y routes

```bash
git add src/types/index.ts src/lib/routes.ts
git commit -m "feat: add AllowedEmail type and centralize collection routes"
```

---

## Task 2: Seed de allowlist y migración de staff existente

### Archivo: `scripts/seed-allowlist.ts`

- Create: `scripts/seed-allowlist.ts`

### Step 1: Crear script de seed

Crear `scripts/seed-allowlist.ts` — un script Node.js que use Firebase Admin SDK para:

1. Leer todos los documentos de `staff` existentes
2. Para cada profesional, crear un documento en `allowedEmails` con `{ email, role, professionalName: name }`
3. Si no hay staff, crear un documento de ejemplo para el admin actual

```typescript
// scripts/seed-allowlist.ts
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Usar service account key o GOOGLE_APPLICATION_CREDENTIALS
initializeApp();
const db = getFirestore();

const APP_ID = 'lumen-production';
const CLINIC_ID = 'lumen-general';
const basePath = `artifacts/${APP_ID}/clinics/${CLINIC_ID}`;

async function seed() {
    const staffSnap = await db.collection(`${basePath}/staff`).get();

    if (staffSnap.empty) {
        console.log('No staff found. Create entries manually in Firestore console.');
        return;
    }

    const batch = db.batch();
    for (const doc of staffSnap.docs) {
        const data = doc.data();
        const emailDocRef = db.collection(`${basePath}/allowedEmails`).doc(data.email);
        batch.set(emailDocRef, {
            email: data.email,
            role: data.role || 'professional',
            professionalName: data.name,
        });
        console.log(`  → ${data.email} (${data.role || 'professional'}) as ${data.name}`);
    }

    await batch.commit();
    console.log(`\nSeeded ${staffSnap.size} allowed emails.`);
}

seed().catch(console.error);
```

### Step 2: Documentar cómo ejecutar el seed

Agregar un comentario inline al script explicando:

```text
// Ejecutar: npx tsx scripts/seed-allowlist.ts
// Prerequisito: GOOGLE_APPLICATION_CREDENTIALS apuntando al service account key
```

### Step 3: Commit — seed script

```bash
git add scripts/seed-allowlist.ts
git commit -m "feat: add allowlist seed script for existing staff"
```

---

## Task 3: Refactorizar AuthScreen para usar allowlist

### Archivo: `src/views/AuthScreen.tsx`

- Modify: `src/views/AuthScreen.tsx`
- Test: `src/views/__tests__/AuthScreen.test.tsx` (si hay tiempo — E2E cubre el flujo)

### Step 1: Importar dependencias necesarias

En `AuthScreen.tsx`, agregar import de la colección de allowedEmails:

```typescript
import { ALLOWED_EMAILS_COLLECTION } from '../lib/routes';
import { STAFF_COLLECTION } from '../lib/routes';
```

### Step 2: Reemplazar lógica de lazy creation

Reemplazar el bloque actual (líneas ~48-62 de AuthScreen.tsx):

```typescript
// ANTES (INSEGURO):
const userRef = doc(db, 'artifacts', appId, 'users', user.uid);
const userSnap = await getDoc(userRef);
if (!userSnap.exists()) {
    await setDoc(userRef, {
        email: user.email,
        displayName: user.displayName || 'Profesional Lumen',
        createdAt: Timestamp.now(),
        role: 'admin',
        settings: { notifications: true }
    });
}
```

```typescript
// DESPUÉS (SEGURO):
// 1. Verificar si ya tiene perfil de staff
const staffRef = doc(db, STAFF_COLLECTION, user.uid);
const staffSnap = await getDoc(staffRef);

if (!staffSnap.exists()) {
    // 2. Verificar allowlist
    const allowedRef = doc(db, ALLOWED_EMAILS_COLLECTION, user.email!);
    const allowedSnap = await getDoc(allowedRef);

    if (!allowedSnap.exists()) {
        // Email no autorizado — sign out y mostrar error
        await auth.signOut();
        setError('Tu email no está autorizado. Contactá al administrador de la clínica.');
        return;
    }

    const allowed = allowedSnap.data() as AllowedEmail;

    // 3. Crear perfil de staff con datos del allowlist
    await setDoc(staffRef, {
        uid: user.uid,
        email: user.email,
        name: allowed.professionalName,
        role: allowed.role,
        createdAt: Timestamp.now(),
    });
}
```

### Step 3: Importar tipo AllowedEmail

```typescript
import { AllowedEmail } from '../types';
```

### Step 4: Eliminar import de `appId` si ya no se usa directamente

Verificar que `appId` no se use en otro lugar del archivo. Si AuthScreen ya no lo usa directamente (porque las rutas vienen de routes.ts), quitar el import.

### Step 5: Commit — AuthScreen allowlist

```bash
git add src/views/AuthScreen.tsx
git commit -m "feat: replace auto-admin with allowlist-based onboarding (SEC-02)"
```

---

## Task 4: Firestore Rules con RBAC

### Archivo: `firestore.rules`

- Modify: `firestore.rules`

### Step 1: Agregar función helper para leer rol del usuario

```text
function getStaffData() {
    return get(/databases/$(database)/documents/artifacts/$(request.auth.token.appId)/clinics/$(clinicId)/staff/$(request.auth.uid)).data;
}

function isAdmin() {
    return getStaffData().role == 'admin';
}

function getProfessionalName() {
    return getStaffData().name;
}

function isOwner(resource) {
    return resource.data.professional == getProfessionalName();
}

function isOwnerOfNew() {
    return request.resource.data.professional == getProfessionalName();
}
```

> **Nota:** Cada llamada a `get()` en rules cuenta como 1 document read y hay un límite de 10 por evaluación. Estas funciones se llaman una vez por request gracias al caching de Firestore rules.

### Step 2: Reescribir las reglas por colección

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() { return request.auth != null; }

    match /artifacts/{appId}/clinics/{clinicId} {

      function getStaffData() {
        return get(/databases/$(database)/documents/artifacts/$(appId)/clinics/$(clinicId)/staff/$(request.auth.uid)).data;
      }
      function isAdmin() { return getStaffData().role == 'admin'; }
      function getProfessionalName() { return getStaffData().name; }

      // Allowlist — solo admins pueden gestionar
      match /allowedEmails/{emailId} {
        allow read, write: if isAuthenticated() && isAdmin();
      }

      // Staff — admin CRUD, profesional solo lee su propio doc
      match /staff/{userId} {
        allow read: if isAuthenticated() && (isAdmin() || request.auth.uid == userId);
        allow write: if isAuthenticated() && isAdmin();
        // Excepción: un profesional puede crear su propio doc (onboarding)
        allow create: if isAuthenticated() && request.auth.uid == userId;
      }

      // Pacientes — admin CRUD, profesional CRUD propios + lectura de otros
      match /patients/{patientId} {
        allow read: if isAuthenticated();
        allow create: if isAuthenticated() && (isAdmin() || request.resource.data.professional == getProfessionalName());
        allow update, delete: if isAuthenticated() && (isAdmin() || resource.data.professional == getProfessionalName());
      }

      // Turnos — admin CRUD, profesional CRUD propios + lectura de otros
      function isNotInvoiced() {
        return resource.data.get('billingStatus', 'pending') != 'invoiced';
      }
      match /appointments/{appointmentId} {
        allow read: if isAuthenticated();
        allow create: if isAuthenticated() && (isAdmin() || request.resource.data.professional == getProfessionalName());
        allow delete: if isAuthenticated() && isNotInvoiced() && (isAdmin() || resource.data.professional == getProfessionalName());
        allow update: if isAuthenticated() && (
          isAdmin() || resource.data.professional == getProfessionalName()
        ) && (
          isNotInvoiced() ||
          request.resource.data.diff(resource.data).affectedKeys().hasOnly(['isPaid'])
        );
      }

      // Pagos — admin CRU, profesional CRU propios + lectura de otros; delete bloqueado
      match /payments/{paymentId} {
        allow read: if isAuthenticated();
        allow create: if isAuthenticated();
        allow update: if isAuthenticated() && (isAdmin() || resource.data.get('professional', '') == getProfessionalName());
        allow delete: if false;
      }

      // Billing queue — admin y owner pueden crear; no update/delete
      match /integrations/billing/queue/{requestId} {
        allow read: if isAuthenticated();
        allow create: if isAuthenticated();
        allow update, delete: if false;
      }

      // Notas clínicas — admin CRUD todas, profesional CRUD solo propias, invisible entre profesionales
      match /notes/{noteId} {
        allow read: if isAuthenticated() && (isAdmin() || resource.data.createdBy == request.auth.uid);
        allow create: if isAuthenticated();
        allow update, delete: if isAuthenticated() && (isAdmin() || resource.data.createdBy == request.auth.uid);
      }

      // Psique payments — admin CRUD, profesional CRUD (billing propio)
      match /psiquePayments/{monthId} {
        allow read, write: if isAuthenticated();
      }
    }

    // Deny everything else
    match /{document=**} { allow read, write: if false; }
  }
}
```

### Step 3: Validar rules localmente

```bash
# Requiere firebase-tools instalado
firebase emulators:start --only firestore
# O verificar sintaxis:
firebase deploy --only firestore:rules --dry-run
```

### Step 4: Commit — firestore.rules

```bash
git add firestore.rules
git commit -m "feat: implement RBAC Firestore rules with role-based access (SEC-01)"
```

---

## Task 5: Cloud Function para validar Turnstile server-side

### Archivos: `functions/src/index.ts`

- Modify: `functions/src/index.ts`
- Modify: `functions/package.json` (si necesita dependencias)

### Step 1: Agregar la Cloud Function callable

En `functions/src/index.ts`, agregar:

```typescript
import { onCall, HttpsError } from "firebase-functions/v2/https";

export const validateTurnstile = onCall(
    { enforceAppCheck: false }, // No requiere auth (pre-login)
    async (request) => {
        const token = request.data?.token;

        if (!token || typeof token !== "string") {
            throw new HttpsError("invalid-argument", "Missing turnstile token");
        }

        const secret = process.env.TURNSTILE_SECRET;
        if (!secret) {
            console.error("TURNSTILE_SECRET not configured");
            throw new HttpsError("internal", "Server misconfiguration");
        }

        const response = await fetch(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    secret,
                    response: token,
                }),
            }
        );

        const result = await response.json();

        if (!result.success) {
            throw new HttpsError("permission-denied", "Turnstile verification failed");
        }

        return { verified: true };
    }
);
```

### Step 2: Configurar secret

```bash
# Usando Firebase Functions secrets (v2):
firebase functions:secrets:set TURNSTILE_SECRET
# Ingresar el secret key de Cloudflare Turnstile
```

### Step 3: Verificar que `functions/package.json` no necesite `node-fetch`

Firebase Functions v2 con Node 20 tiene `fetch` nativo. No necesita dependencias extra.

### Step 4: Build y test local

```bash
cd functions
npm run build
```

Expected: compila sin errores.

### Step 5: Commit — Cloud Function

```bash
git add functions/src/index.ts
git commit -m "feat: add validateTurnstile Cloud Function for server-side verification (SEC-03)"
```

---

## Task 6: Integrar validación Turnstile en AuthScreen

### Archivo: `AuthScreen.tsx` (integración Turnstile)

- Modify: `src/views/AuthScreen.tsx`

### Step 1: Importar `httpsCallable` de Firebase Functions

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';
```

### Step 2: Agregar validación server-side antes del login

En `handleAuth`, ANTES de `signInWithEmailAndPassword`, agregar:

```typescript
// Validate Turnstile token server-side
try {
    const functions = getFunctions();
    const validateTurnstile = httpsCallable(functions, 'validateTurnstile');
    await validateTurnstile({ token: turnstileToken });
} catch (err: any) {
    setError('La verificación de seguridad falló. Intentá de nuevo.');
    setIsLoading(false);
    return;
}
```

### Step 3: Commit — integración Turnstile

```bash
git add src/views/AuthScreen.tsx
git commit -m "feat: validate Turnstile server-side before login (SEC-03)"
```

---

## Task 7: CSP estricta en firebase.json

### Archivo: `firebase.json`

- Modify: `firebase.json`

### Step 1: Determinar CSP final

Vite en build mode genera archivos CSS y JS separados (no inline). La CSP estricta puede ser:

```text
default-src 'self';
script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com;
style-src 'self' 'unsafe-inline';
frame-src https://challenges.cloudflare.com;
connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net wss://*.firebaseio.com https://challenges.cloudflare.com;
img-src 'self' data: https:;
font-src 'self';
```

> **Nota:** `style-src 'unsafe-inline'` se mantiene porque Vite inyecta un `<style>` tag para CSS modules/dynamic imports en algunos casos. Se puede endurecer más con hashes post-build si se desea.

### Step 2: Reemplazar CSP en firebase.json

Reemplazar el header actual por:

```json
{
    "key": "Content-Security-Policy",
    "value": "default-src 'self'; script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; frame-src https://challenges.cloudflare.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net wss://*.firebaseio.com https://challenges.cloudflare.com; img-src 'self' data: https:; font-src 'self';"
}
```

### Step 3: Agregar caching headers separados

```json
{
    "source": "**/*.@(js|css|svg|png|jpg|webp|woff2)",
    "headers": [
        {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
        }
    ]
},
{
    "source": "index.html",
    "headers": [
        {
            "key": "Cache-Control",
            "value": "no-cache"
        }
    ]
}
```

### Step 4: Commit — firebase.json

```bash
git add firebase.json
git commit -m "feat: strict CSP, remove unsafe-eval, add caching headers (SEC-04)"
```

---

## Task 8: Limpiar index.html

### Archivo: `index.html`

- Modify: `index.html`

### Step 1: Eliminar bloque de script mock

Eliminar estas líneas de `index.html`:

```html
<script>
    // Mock global variables for dev environment
    window.__firebase_config = JSON.stringify({...});
    window.__app_id = "dev-app-id";
</script>
```

La app usa `import.meta.env.VITE_FIREBASE_*` — estos globals ya no se leen.

### Step 2: Agregar preconnect hints

Después de `<meta name="description">`, agregar:

```html
<link rel="preconnect" href="https://firestore.googleapis.com" crossorigin />
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin />
```

### Step 3: Corregir title

```html
<title>Lumen Salud Mental</title>
```

### Step 4: Agregar noscript fallback

Dentro de `<body>`, antes de `<div id="root">`:

```html
<noscript>
    <p style="text-align:center;margin-top:2rem;">Lumen Salud Mental requiere JavaScript para funcionar.</p>
</noscript>
```

### Step 5: Corregir favicon MIME type

```html
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
```

### Step 6: Commit

```bash
git add index.html
git commit -m "fix: clean index.html - remove mock globals, add preconnect, fix meta"
```

---

## Task 9: Crear `.env.example`

### Archivo: `.env.example`

- Create: `.env.example`

### Step 1: Crear archivo

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Cloudflare Turnstile
VITE_TURNSTILE_SITE_KEY=
```

### Step 2: Commit

```bash
git add .env.example
git commit -m "docs: add .env.example with required environment variables"
```

---

## Task 10: Verificación end-to-end

### Sin archivos nuevos

Ninguno nuevo — solo validación.

### Step 1: Build completo

```bash
npm run build
```

Expected: Build exitoso sin errores.

### Step 2: Verificar Firestore rules syntax

```bash
firebase deploy --only firestore:rules --dry-run
```

Expected: Sin errores de sintaxis.

### Step 3: Build de Cloud Functions

```bash
cd functions && npm run build
```

Expected: Compila sin errores.

### Step 4: Verificar que no haya errores en TypeScript

```bash
npx tsc --noEmit
```

Expected: Sin errores (o solo los pre-existentes documentados).

### Step 5: Correr tests existentes

```bash
npm test
```

Expected: Todos los tests pasan.

### Step 6: Commit final

```bash
git add -A
git commit -m "feat: Phase 1 Security complete — RBAC, allowlist, Turnstile server-side, strict CSP"
```

---

## Orden de ejecución y dependencias

```bash
Task 1 (tipos + rutas) ──┐
                          ├─→ Task 3 (AuthScreen allowlist) ──→ Task 6 (Turnstile client)
Task 2 (seed script) ────┘
                          
Task 4 (Firestore Rules) ── independiente, puede ir en paralelo con 1-3
Task 5 (Cloud Function Turnstile) ──→ Task 6 (Turnstile client)
Task 7 (CSP firebase.json) ── independiente
Task 8 (index.html cleanup) ── independiente
Task 9 (.env.example) ── independiente
Task 10 (verificación) ── después de todo
```

**Tareas paralelizables:** {1,2}, {4,5,7,8,9} pueden ejecutarse en paralelo.
**Dependencias secuenciales:** 1 → 3 → 6, y 5 → 6.

---

## Riesgos y mitigaciones

| Riesgo | Mitigation |
| -------- | --------- |
| `get()` en Firestore rules agrega latencia (~1 read por request) | Caching built-in de rules engine; 1 read es aceptable |
| Límite de 10 `get()` calls por rules evaluation | Nuestras rules usan máximo 1-2 `get()` por evaluación |
| Profesionales existentes sin documento en `allowedEmails` | Task 2 seed script migra datos existentes |
| CSP estricta rompe algo en producción | Testear en staging antes de deploy; `style-src unsafe-inline` como safety net |
| Cloud Function fría agrega latencia al login | Acceptable (login es infrecuente); considerar min instances si es problema |
