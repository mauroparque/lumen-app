# Debug: FirebaseError Missing or insufficient permissions

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Identificar la causa raíz exacta del error "Missing or insufficient permissions" en las operaciones de pago y completar tarea.

**Architecture:** Diagnóstico en 3 fases: evidencia → hipótesis confirmada → fix mínimo.

**Tech Stack:** Firebase Firestore, TypeScript, Firestore Security Rules

**Review de cierre:** [`docs/reviews/2026-03-04_debug-permissions-review.md`](../reviews/2026-03-04_debug-permissions-review.md)

---

## Context

Dos operaciones fallan con `permission-denied` para el usuario `OW27sbzI7aQRnFh5JEHnd7JbWeW2` (`role: admin`, staff doc confirmado en Firestore):

1. **PaymentsView:** `addPayment(paymentData, appointmentId)` — batch de 2 ops:
    - `batch.set(PAYMENTS_COLLECTION/{newId}, {...})` ← CREATE payment
    - `batch.update(APPOINTMENTS_COLLECTION/{appointmentId}, { isPaid: true })` ← UPDATE appointment

2. **TasksView:** `completeTask(noteId, taskIndex)` — transaction:
    - `transaction.get(NOTES_COLLECTION/{noteId})` ← READ
    - `transaction.update(NOTES_COLLECTION/{noteId}, { tasks: [...] })` ← UPDATE

El staff document existe con `role: admin` + `name: "Mauro La Padula"`. Las reglas fueron desplegadas con null check en `getProfessionalName()`. El error persiste.

---

## Análisis de hipótesis

### H1: `isAdmin()` devuelve false — ALTA prioridad

Aunque el documento existe, `getStaffData()` podría fallar si hay algún problema de timing, caché del SDK, o el path `$(appId)/$(clinicId)` al momento de evaluar no coincide exactamente con `lumen-production/lumen-general`.

### H2: Regla de `notes/update` — condición extra bloquea incluso a admins

La regla de notes tiene dos condiciones que se evalúan SIEMPRE, incluso para admins:

```javascript
&& request.resource.data.createdByUid == resource.data.createdByUid
&& request.resource.data.createdBy == resource.data.createdBy
```

Si el documento note no tiene estos campos, o si algo en el SDK los modifica, esto puede fallar.

### H3: Batch falla por el UPDATE de appointment — ALTA prioridad

El appointment podría tener `billingStatus: 'invoiced'`. En ese caso la regla requiere que solo cambie `isPaid`. Pero el `diff()` en Firestore tiene un comportmiento sutil: si el campo `isPaid` NO existía antes (era undefined, no false), la regla puede comportarse distinto.

### H4: `saveNote` llena notes con `createdBy: uid` (string UID en lugar de nombre)

Notas creadas desde AppointmentDetailsModal tienen `createdBy = uid`. La regla para update de notes requiere que no cambie este campo. Si `completeTask` actualiza una nota con `createdBy = uid` y algo en el SDK o regla lo interpreta como conflicto, puede fallar.

### H5: Token de autenticación expirado o no propagado

El usuario quizás tiene un token expirado. El SDK auto-renueva pero en PWA con service worker podría haber un race condition.

---

## Fase 1: Evidencia — agregar logging diagnóstico

### Task 1.1: Logging en FirebaseService.completeTask

Modificar `src/services/FirebaseService.ts`, método `completeTask`:

```typescript
async completeTask(noteId: string, taskIndex: number): Promise<void> {
    const noteRef = doc(db, NOTES_COLLECTION, noteId);
    console.log('[DEBUG completeTask] noteId:', noteId, 'taskIndex:', taskIndex);
    console.log('[DEBUG completeTask] NOTES_COLLECTION path:', NOTES_COLLECTION);

    await runTransaction(db, async (transaction) => {
        const noteSnap = await transaction.get(noteRef);
        if (!noteSnap.exists()) throw new Error('Note not found');

        const noteData = noteSnap.data() as ClinicalNote;
        console.log('[DEBUG completeTask] noteData.createdByUid:', noteData.createdByUid);
        console.log('[DEBUG completeTask] noteData.createdBy:', noteData.createdBy);
        console.log('[DEBUG completeTask] noteData.tasks length:', noteData.tasks?.length);

        const updatedTasks = [...(noteData.tasks || [])];
        if (updatedTasks[taskIndex]) {
            updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], completed: true };
            console.log('[DEBUG completeTask] About to update with:', { tasks: updatedTasks });
            transaction.update(noteRef, { tasks: updatedTasks });
        }
    });
}
```

### Task 1.2: Logging en FirebaseService.addPayment

Modificar `addPayment`:

```typescript
async addPayment(payment: PaymentInput, appointmentId?: string): Promise<string> {
    console.log('[DEBUG addPayment] professionalName:', this.professionalName);
    console.log('[DEBUG addPayment] uid:', this.uid);
    console.log('[DEBUG addPayment] payment:', JSON.stringify({...payment, date: 'Timestamp'}));
    console.log('[DEBUG addPayment] appointmentId:', appointmentId);
    // ... resto del código
}
```

**Luego capturar el error completo en los catch:**

En `PaymentModal.tsx` dentro del catch:

```typescript
} catch (error: unknown) {
    console.error('[DEBUG PaymentModal] Full error:', error);
    console.error('[DEBUG PaymentModal] Error code:', (error as any)?.code);
    console.error('[DEBUG PaymentModal] Error details:', JSON.stringify(error));
    // ...
}
```

### Task 1.3: Separar el batch en dos operaciones individuales para aislar cuál falla

En `FirebaseService.addPayment`, temporalmente reemplazar el batch con operaciones separadas:

```typescript
// TEMPORAL DIAGNÓSTICO — después volver a batch
const paymentRef = doc(collection(db, PAYMENTS_COLLECTION));
try {
    await setDoc(paymentRef, { ...paymentData });
    console.log('[DEBUG] Payment setDoc OK');
} catch (e) {
    console.error('[DEBUG] Payment setDoc FAILED:', e);
    throw e;
}
if (appointmentId) {
    try {
        await updateDoc(doc(db, APPOINTMENTS_COLLECTION, appointmentId), { isPaid: true });
        console.log('[DEBUG] Appointment update OK');
    } catch (e) {
        console.error('[DEBUG] Appointment update FAILED:', e);
        throw e;
    }
}
```

---

## Fase 2: Firebase Rules Playground (sin código)

Ir a [Firebase Console](https://console.firebase.google.com) → proyecto `lumen-app-5426c` → Firestore → Reglas → **Depurador de reglas**.

### Test 2.1: Simular updateDoc en notes

- **Operación:** Update
- **Path:** `artifacts/lumen-production/clinics/lumen-general/notes/{un-noteId-real}`
- **Auth UID:** `OW27sbzI7aQRnFh5JEHnd7JbWeW2`
- **Data:** `{ "tasks": [] }`
- **Resultado esperado:** Allow ✓

Si falla: el problema está en la regla de notes. Notar QUÉ condición específica falla.

### Test 2.2: Simular batch update en appointments

- **Operación:** Update
- **Path:** `artifacts/lumen-production/clinics/lumen-general/appointments/{un-appointmentId-real}`
- **Auth UID:** `OW27sbzI7aQRnFh5JEHnd7JbWeW2`
- **Data:** `{ "isPaid": true }`
- **Resultado esperado:** Allow ✓

### Test 2.3: Simular payment create

- **Operación:** Create
- **Path:** `artifacts/lumen-production/clinics/lumen-general/payments/test-id`
- **Auth UID:** `OW27sbzI7aQRnFh5JEHnd7JbWeW2`
- **Data:** `{ "patientName": "Test", "amount": 100, "concept": "Sesión", "professional": "Mauro La Padula" }`
- **Resultado esperado:** Allow ✓

---

## Fase 3: Fix por hipótesis confirmada

### Fix A (si H1 — isAdmin falla): Agregar isOwner como fallback total

Si `isAdmin()` falla silenciosamente por algún edge case, la regla de notes depende de `resource.data.createdByUid == request.auth.uid`. Esto debería funcionar si el UID es correcto. El problema sería para payments/appointments donde el fallback es `getProfessionalName()`.

Fix: hacer que el usuario sea verificado también por UID en staff doc (not just role):

```javascript
function isSelf() {
    let d = getStaffData();
    return d != null && d.uid == request.auth.uid;
}
```

### Fix B (si H2 — notes rule bloquea admins): Relaxar la regla de notes para admins

Cambio en `firestore.rules`:

```javascript
match /notes/{noteId} {
    allow update: if isAuthenticated() && isAdmin();  // Admin puede hacer cualquier update
    allow update: if isAuthenticated()
        && resource.data.createdByUid == request.auth.uid
        && request.resource.data.createdByUid == resource.data.createdByUid
        && request.resource.data.createdBy == resource.data.createdBy;
}
```

CORRECTO: separar en dos `allow update` con OR implícito:

```javascript
match /notes/{noteId} {
    allow read: if isAuthenticated();
    allow create: if isAuthenticated()
        && request.resource.data.createdByUid == request.auth.uid;
    allow update: if isAuthenticated() && isAdmin();
    allow update: if isAuthenticated()
        && resource.data.createdByUid == request.auth.uid
        && request.resource.data.createdByUid == resource.data.createdByUid
        && request.resource.data.createdBy == resource.data.createdBy;
    allow delete: if isAuthenticated()
        && (isAdmin() || resource.data.createdByUid == request.auth.uid);
}
```

### Fix C (si H3 — appointment diff falla): Quitar la restricción de isNotInvoiced para admins

Cambiar la regla de appointments:

```javascript
match /appointments/{appointmentId} {
    allow update: if isAuthenticated() && isAdmin();  // Admin sin restricciones
    allow update: if isAuthenticated()
        && getProfessionalName() != null
        && resource.data.professional == getProfessionalName()
        && (
            isNotInvoiced() ||
            request.resource.data.diff(resource.data).affectedKeys().hasOnly(['isPaid'])
        );
}
```

### Fix D (si H4 — createdBy inconsistente): Arreglar saveNote

En `FirebaseService.saveNote`, cambiar:

```typescript
createdBy: this.uid,  // BUG: UID en lugar de nombre
```

por:

```typescript
createdBy: this.professionalName || this.uid,
```

---

## Orden de ejecución

1. **Primero** ejecutar Task 1.3 (separar batch) → ver cuál operación falla exactamente
2. **Segundo** ejecutar Tests 2.1-2.3 en Firebase Playground → ver qué regla falla
3. **Tercero** aplicar el Fix correspondiente a la hipótesis confirmada
4. **Cuarto** revertir el logging temporal
5. **Quinto** desplegar reglas si se modificaron: `firebase deploy --only firestore:rules`

---

## Links

- Auditoría de origen: N/A (bug hotfix)
- Review de cierre: pendiente
