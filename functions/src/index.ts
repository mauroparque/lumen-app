import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import axios from 'axios';

const billingUrl = defineString('BILLING_URL');
// BILLING_SECRET se gestiona via Secret Manager (no defineString) para evitar
// exposición accidental en logs o metadata de deploy.
// Declarado en runWith({ secrets }) y accesible via process.env.BILLING_SECRET.

admin.initializeApp();

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return true;
    }

    if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
        return false;
    }

    entry.count++;
    return true;
}

export const validateTurnstile = onCall(
    {
        // TODO: Habilitar enforceAppCheck: true una vez que App Check esté configurado
        // en el proyecto Firebase (SEC-N03). Requiere registrar la app con reCAPTCHA v3
        // o Device Check y activar la aplicación en Firebase Console.
        enforceAppCheck: false,
        secrets: ['TURNSTILE_SECRET'],
    },
    async (request) => {
        const ip = request.rawRequest?.ip || 'unknown';
        if (!checkRateLimit(ip)) {
            throw new HttpsError('resource-exhausted', 'Too many requests. Try again later.');
        }

        const token = request.data?.token;

        if (!token || typeof token !== 'string') {
            throw new HttpsError('invalid-argument', 'Missing turnstile token');
        }

        const secret = process.env.TURNSTILE_SECRET;
        if (!secret) {
            console.error('TURNSTILE_SECRET not configured');
            throw new HttpsError('internal', 'Server misconfiguration');
        }

        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                secret,
                response: token,
            }),
        });

        const result = (await response.json()) as { success: boolean };

        if (!result.success) {
            throw new HttpsError('permission-denied', 'Turnstile verification failed');
        }

        return { verified: true };
    },
);

export const triggerInvoiceGeneration = functions
    .runWith({ secrets: ['BILLING_SECRET'] })
    .firestore.document('artifacts/{appId}/clinics/{clinicId}/integrations/billing/queue/{docId}')
    .onCreate(async (snap, context) => {
        const data = snap.data();
        const { docId } = context.params;

        // 1. Validar estado inicial
        if (data.status !== 'pending') return null;

        // 2. Obtener configuración
        const url = billingUrl.value();
        const secret = process.env.BILLING_SECRET;

        if (!url || !secret) {
            console.error('Falta configuración de billing (BILLING_URL o BILLING_SECRET)');
            return snap.ref.update({ status: 'error_config' });
        }

        // 3. Sanitizar: solo campos permitidos del billing queue
        const allowedFields = {
            type: data.type,
            appointmentIds: data.appointmentIds,
            patientId: data.patientId,
            patientName: data.patientName,
            patientDni: data.patientDni,
            patientEmail: data.patientEmail,
            totalPrice: data.totalPrice,
            lineItems: data.lineItems,
            requestedAt: data.requestedAt,
            requestedBy: data.requestedBy,
            status: data.status,
        };

        try {
            // 4. Marcar como procesando
            await snap.ref.update({ status: 'processing' });

            // 5. Enviar a n8n con Header de Seguridad — solo campos sanitizados
            await axios.post(
                url,
                {
                    queueDocId: docId,
                    ...allowedFields,
                },
                {
                    headers: { 'x-lumen-secret': secret },
                },
            );

            console.log(`Solicitud enviada a n8n para docId: ${docId}`);
            return null;
        } catch (error: any) {
            console.error('Error enviando a n8n:', error.message);
            return snap.ref.update({
                status: 'error_sending',
                debugError: error.message,
            });
        }
    });
