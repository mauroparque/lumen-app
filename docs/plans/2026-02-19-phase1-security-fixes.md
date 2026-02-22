# Phase 1 Security — Code Review Fixes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Origen:** [Auditoría 2026-02-19](../audits/2026-02-19_AUDIT.md) — hallazgos SEC-01 a SEC-04
**Plan principal:** [2026-02-19-phase1-security.md](./2026-02-19-phase1-security.md)
**Revisión de cierre:** [2026-02-22_phase1-completion-review.md](../reviews/2026-02-22_phase1-completion-review.md)

**Goal:** Corregir los 4 issues encontrados en el code review de `security/phase1`, ordenados por prioridad: 1 critical, 2 important, 1 minor.

**Architecture:** Todos los cambios son en la rama `security/phase1`, worktree en `.worktrees/security-phase1/`. No hay cambios de arquitectura — solo correcciones puntuales.

**Tech Stack:** Firebase Functions v2 (secrets API), Firestore Rules, React, TypeScript.

---

## Contexto

| Severidad | Issue | Archivo |
| ----------- | ------- | --------- |
| **Critical** | Falta `secrets: ["TURNSTILE_SECRET"]` en `onCall` | `functions/src/index.ts` |
| **Important** | `firebase-admin` como devDep en frontend | `package.json` |
| **Important** | `staff` rules mezclan `write` (= create+update+delete) con `create` separado | `firestore.rules` |
| Minor | `getFunctions()` se recrea en cada submit | `src/views/AuthScreen.tsx` |

> **Worktree path:** `.worktrees/security-phase1/`
> Todos los archivos mencionados son relativos a ese path.

---

## Task 1: Fix critical — Declarar `TURNSTILE_SECRET` en Cloud Function v2

**Por qué es crítico:** En Cloud Functions v2, un Secret Manager secret NO se inyecta automáticamente como variable de entorno. Sin la declaración `secrets: ["TURNSTILE_SECRET"]` en el `onCall`, `process.env.TURNSTILE_SECRET` siempre será `undefined` en runtime, haciendo que todos los logins fallen con `"Server misconfiguration"`.

### Archivo: `functions/src/index.ts`

- Modify: `.worktrees/security-phase1/functions/src/index.ts`

### Step 1: Verificar que estamos en el worktree correcto

```bash
cd .worktrees/security-phase1
git branch --show-current
```

Expected: `security/phase1`

### Step 2: Agregar declaración de secret en `onCall`

En `functions/src/index.ts`, reemplazar:

```typescript
export const validateTurnstile = onCall(
    { enforceAppCheck: false },
    async (request) => {
```

Por:

```typescript
export const validateTurnstile = onCall(
    {
        enforceAppCheck: false,
        secrets: ["TURNSTILE_SECRET"],
    },
    async (request) => {
```

### Step 3: Verificar build de Cloud Functions

```bash
cd functions && npm run build
```

Expected: `Compiled successfully` sin errores. El tipo de `secrets` acepta `string[]`, no debería haber type errors.

### Step 4: Commit — `index.ts`

```bash
cd ..
git add functions/src/index.ts
git commit -m "fix: declare TURNSTILE_SECRET in onCall secrets (critical)"
```

---

## Task 2: Fix important — Quitar `firebase-admin` del frontend

**Por qué importa:** `firebase-admin` es un SDK de ~50MB pensado para server-side. No pertenece en el `package.json` del frontend (fue agregado para que el seed script buildee, pero ese script no es parte del bundle de la app). Como `devDependency` no contamina el build de producción, pero sí infla `node_modules` del frontend y es confuso para futuros devs.

### Archivo: `package.json`

- Modify: `.worktrees/security-phase1/package.json`

### Step 1: Quitar `firebase-admin` de devDependencies

En `package.json`, eliminar la línea:

```json
"firebase-admin": "^13.6.1",
```

### Step 2: Verificar que el seed script aún funcione

El script `scripts/seed-allowlist.ts` importa `firebase-admin/app` y `firebase-admin/firestore`. Necesita acceder a `firebase-admin` en runtime. Hay 2 opciones:

- **Opción A (recomendada):** El script usa la instancia de `firebase-admin` que existe en `functions/node_modules`. Agregar al inicio del seed script un comentario que documente esto:

```typescript
// Este script requiere firebase-admin instalado. Ejecutar con:
// npx tsx --tsconfig tsconfig.node.json scripts/seed-allowlist.ts
// Prerequisito: GOOGLE_APPLICATION_CREDENTIALS apuntando a un service account key
// O usar: cd functions && npx tsx ../scripts/seed-allowlist.ts
```

- **Opción B:** Cambiar los imports del seed script para usar el `firebase-admin` de functions:

```bash
# Ejecutar desde root con NODE_PATH apuntando a functions/node_modules
NODE_PATH=./functions/node_modules npx tsx scripts/seed-allowlist.ts
```

Implementar **Opción A**: solo actualizar el comentario del script — no necesita cambios funcionales porque el seed script es un one-shot manual, no parte del CI/CD.

### Step 3: Actualizar comentario en `scripts/seed-allowlist.ts`

En `scripts/seed-allowlist.ts`, reemplazar el comentario inicial:

```typescript
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
```

Por:

```typescript
// Prerequisito: firebase-admin disponible en node_modules o en functions/node_modules
// Ejecutar desde root: NODE_PATH=./functions/node_modules npx tsx scripts/seed-allowlist.ts
// Requiere: GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccount.json
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
```

### Step 4: Verificar que el frontend build no se rompe

```bash
npm run build
```

Expected: Build exitoso. `firebase-admin` no es un import en ningún archivo del frontend (solo en `scripts/`).

### Step 5: Commit

```bash
git add package.json scripts/seed-allowlist.ts
git commit -m "fix: remove firebase-admin from frontend devDeps, document seed usage"
```

---

## Task 3: Fix important — Clarificar reglas de staff en Firestore

**Por qué importa:** La regla actual mezcla `allow write` (que en Firestore = create + update + delete) con un `allow create` separado. Aunque el resultado es correcto (OR entre ambas reglas), el comportamiento no es obvio y puede romperse en futuras ediciones. La forma idiomática es listar cada operación explícitamente.

### Regla actual (confusa)

```text
allow write: if isAuthenticated() && isAdmin();
// Excepción: un profesional puede crear su propio doc (onboarding)
allow create: if isAuthenticated() && request.auth.uid == userId;
```

### Regla nueva (explícita)

```text
allow create: if isAuthenticated() && (isAdmin() || request.auth.uid == userId);
allow update, delete: if isAuthenticated() && isAdmin();
```

### Archivo: `firestore.rules`

- Modify: `.worktrees/security-phase1/firestore.rules`

### Step 1: Reemplazar el bloque de staff

En `firestore.rules`, reemplazar el bloque:

```text
      // Staff — admin CRUD, profesional solo lee su propio doc
      match /staff/{userId} {
        allow read: if isAuthenticated() && (isAdmin() || request.auth.uid == userId);
        allow write: if isAuthenticated() && isAdmin();
        // Excepción: un profesional puede crear su propio doc (onboarding)
        allow create: if isAuthenticated() && request.auth.uid == userId;
      }
```

Por:

```text
      // Staff — admin CRUD, profesional crea su propio doc (onboarding) y lee el propio
      match /staff/{userId} {
        allow read: if isAuthenticated() && (isAdmin() || request.auth.uid == userId);
        allow create: if isAuthenticated() && (isAdmin() || request.auth.uid == userId);
        allow update, delete: if isAuthenticated() && isAdmin();
      }
```

### Step 2: Verificar sintaxis de rules

```bash
# Desde la raíz del worktree:
firebase deploy --only firestore:rules --dry-run
```

Expected: `Deploy complete!` sin errores de sintaxis.

Si no hay firebase-tools instalado globalmente:

```bash
npx firebase-tools deploy --only firestore:rules --dry-run
```

### Step 3: Commit

```bash
git add firestore.rules
git commit -m "fix: clarify staff Firestore rules, replace write+create with explicit create/update/delete"
```

---

## Task 4: Fix minor — Mover `getFunctions()` fuera del handler

**Por qué importa:** `getFunctions()` inicializa el SDK de Firebase Functions. Llamarlo dentro de `handleAuth` recrea el objeto en cada submit del formulario. Es un singleton internamente, pero llamarlo repetidamente es impredecible y más lento que inicializarlo una vez a nivel de módulo.

### Archivo: `src/views/AuthScreen.tsx`

- Modify: `.worktrees/security-phase1/src/views/AuthScreen.tsx`

### Step 1: Mover la inicialización al nivel de módulo

En `AuthScreen.tsx`, agregar después del import de `getFunctions`:

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';
```

Agregar después de `TURNSTILE_SITE_KEY`:

```typescript
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';

// Initialize Firebase Functions once at module level (singleton)
const firebaseFunctions = getFunctions();
const validateTurnstileCallable = httpsCallable(firebaseFunctions, 'validateTurnstile');
```

### Step 2: Actualizar el uso dentro del handler

En `handleAuth`, reemplazar:

```typescript
            // Validate Turnstile token server-side
            try {
                const functions = getFunctions();
                const validateTurnstile = httpsCallable(functions, 'validateTurnstile');
                await validateTurnstile({ token: turnstileToken });
            } catch (turnstileErr: any) {
```

Por:

```typescript
            // Validate Turnstile token server-side
            try {
                await validateTurnstileCallable({ token: turnstileToken });
            } catch (turnstileErr: any) {
```

### Step 3: Verificar que TypeScript no tiene errores

```bash
npx tsc --noEmit
```

Expected: Sin errores nuevos.

### Step 4: Commit — `AuthScreen.tsx`

```bash
git add src/views/AuthScreen.tsx
git commit -m "fix: initialize getFunctions at module level, not on every submit"
```

---

## Task 5: Rebase sobre main

**Por qué:** El branch `security/phase1` fue creado antes del commit `d369dfc` que agregó `.github/copilot-instructions.md` y `AGENTS.md` a main. Para que el merge sea limpio y el PR no muestre esos archivos como eliminados, hay que incorporar esos cambios.

**Files:** Ninguno — solo git.

### Step 1: Rebase sobre main

```bash
git fetch origin
git rebase origin/main
```

Expected: Rebase exitoso sin conflictos. Los únicos cambios de main son los 2 archivos de documentación que no tocan nada del código de la app.

Si hay conflictos (improbable):

```bash
git status  # ver archivos en conflicto
# Resolver conflictos, luego:
git add <archivo>
git rebase --continue
```

### Step 2: Verificar que el historial es limpio

```bash
git log --oneline -15
```

Expected: Los commits de `security/phase1` aparecen después de los de main, incluyendo `d369dfc (Add AGENTS.md and update .gitignore)`.

### Step 3: Verificar que los archivos de main están presentes

```bash
Test-Path .github/copilot-instructions.md
Test-Path AGENTS.md
```

Expected: `True` para ambos.

### Step 4: Push con force-with-lease (necesario después de rebase)

```bash
git push origin security/phase1 --force-with-lease
```

Expected: `Branch 'security/phase1' set up to track remote branch 'security/phase1'`

---

## Task 6: Verificación final

**Files:** Ninguno.

### Step 1: Build completo

```bash
npm run build
```

Expected: Sin errores, sin warnings sobre chunks mayores (o los mismos que antes).

### Step 2: Build de Cloud Functions

```bash
cd functions && npm run build && cd ..
```

Expected: `Compiled successfully`.

### Step 3: Firestore rules dry-run

```bash
firebase deploy --only firestore:rules --dry-run
```

Expected: Sin errores de sintaxis.

### Step 4: Tests

```bash
npm test
```

Expected: 7/7 tests passing (igual que antes — estos fixes no cambian lógica de negocio testeada).

### Step 5: Commit final de verificación (si todo pasa)

```bash
git log --oneline | Select-Object -First 8
```

Expected: Ver todos los commits de fixes antes del commit final de Phase 1.

---

## Orden de ejecución

```bash
Task 1 (Critical: secrets) ──────┐
Task 2 (Important: firebase-admin)├──→ Task 6 (Verificación)
Task 3 (Important: staff rules) ─┤
Task 4 (Minor: getFunctions) ────┘
Task 5 (Rebase) ── al final, después de todos los fixes
```

Tasks 1-4 son independientes entre sí y pueden ejecutarse en cualquier orden. Task 5 siempre al final. Task 6 después de Task 5.

---

## Comandos de deploy post-fixes

Una vez que los fixes pasen verificación:

```bash
# 1. Desplegar reglas de Firestore
firebase deploy --only firestore:rules

# 2. Desplegar Cloud Functions (incluye validateTurnstile)
firebase deploy --only functions

# 3. Configurar el secret de Turnstile (si no está configurado)
firebase functions:secrets:set TURNSTILE_SECRET

# 4. Desplegar hosting
firebase deploy --only hosting
```
