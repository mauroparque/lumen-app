import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/firebase', () => ({
    db: { __db: true },
    storage: {},
    appId: 'test-app',
    CLINIC_ID: 'test-clinic',
}));

vi.mock('firebase/storage', () => ({
    ref: vi.fn(),
    uploadBytes: vi.fn(),
    getDownloadURL: vi.fn(),
}));

vi.mock('firebase/firestore', () => {
    const collection = vi.fn((...args: unknown[]) => ({ __type: 'collection', args }));
    let docCounter = 0;
    const doc = vi.fn((...args: unknown[]) => {
        docCounter += 1;
        return { __type: 'doc', args, id: `mock-doc-${docCounter}` };
    });
    const query = vi.fn((...args: unknown[]) => ({ __type: 'query', args }));
    const where = vi.fn((...args: unknown[]) => ({ __type: 'where', args }));
    const orderBy = vi.fn((...args: unknown[]) => ({ __type: 'orderBy', args }));
    const limit = vi.fn((...args: unknown[]) => ({ __type: 'limit', args }));
    const onSnapshot = vi.fn(() => vi.fn());

    const addDoc = vi.fn();
    const updateDoc = vi.fn();
    const deleteDoc = vi.fn();

    const batchSet = vi.fn();
    const batchUpdate = vi.fn();
    const batchDelete = vi.fn();
    const batchCommit = vi.fn();
    const writeBatch = vi.fn(() => ({
        set: batchSet,
        update: batchUpdate,
        delete: batchDelete,
        commit: batchCommit,
    }));

    const serverTimestamp = vi.fn(() => ({ __type: 'serverTimestamp' }));
    const Timestamp = {
        now: vi.fn(() => ({ __type: 'timestampNow' })),
    };

    const getDocs = vi.fn();
    const getDoc = vi.fn();
    const setDoc = vi.fn();

    return {
        collection,
        doc,
        query,
        where,
        orderBy,
        limit,
        onSnapshot,
        addDoc,
        updateDoc,
        deleteDoc,
        writeBatch,
        serverTimestamp,
        Timestamp,
        getDocs,
        getDoc,
        setDoc,
    };
});

import {
    getDownloadURL,
    ref,
    uploadBytes,
} from 'firebase/storage';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    Timestamp,
    updateDoc,
    where,
    writeBatch,
} from 'firebase/firestore';
import { FirebaseService } from '../FirebaseService';

const mockedAddDoc = vi.mocked(addDoc);
const mockedCollection = vi.mocked(collection);
const mockedDeleteDoc = vi.mocked(deleteDoc);
const mockedGetDownloadURL = vi.mocked(getDownloadURL);
const mockedDoc = vi.mocked(doc);
const mockedGetDoc = vi.mocked(getDoc);
const mockedGetDocs = vi.mocked(getDocs);
const mockedLimit = vi.mocked(limit);
const mockedOnSnapshot = vi.mocked(onSnapshot);
const mockedOrderBy = vi.mocked(orderBy);
const mockedQuery = vi.mocked(query);
const mockedRef = vi.mocked(ref);
const mockedSetDoc = vi.mocked(setDoc);
const mockedTimestamp = vi.mocked(Timestamp.now);
const mockedUpdateDoc = vi.mocked(updateDoc);
const mockedUploadBytes = vi.mocked(uploadBytes);
const mockedWhere = vi.mocked(where);
const mockedWriteBatch = vi.mocked(writeBatch);

const makeSnapshot = (docs: Array<{ id: string; data: Record<string, unknown> }>) => ({
    empty: docs.length === 0,
    docs: docs.map((item) => ({
        id: item.id,
        data: () => item.data,
        ref: { id: item.id },
    })),
});

describe('FirebaseService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('subscribeToPatients crea query filtrada y delega en onSnapshot', () => {
        const service = new FirebaseService('uid-1', 'Dr. Test');
        const onData = vi.fn();
        const unsubscribe = vi.fn();
        mockedOnSnapshot.mockReturnValue(unsubscribe);

        const returnedUnsubscribe = service.subscribeToPatients(onData);

        expect(mockedCollection).toHaveBeenCalled();
        expect(mockedWhere).toHaveBeenCalledWith('professional', '==', 'Dr. Test');
        expect(mockedQuery).toHaveBeenCalled();
        expect(mockedOnSnapshot).toHaveBeenCalledWith(
            expect.objectContaining({ __type: 'query' }),
            expect.any(Function),
            expect.any(Function),
        );
        expect(returnedUnsubscribe).toBe(unsubscribe);
    });

    it('addPatient agrega createdByUid y retorna id', async () => {
        const service = new FirebaseService('uid-2', 'Dr. Test');
        mockedAddDoc.mockResolvedValue({ id: 'patient-1' } as never);

        const id = await service.addPatient({
            name: 'Paciente Uno',
            email: 'p1@test.com',
            phone: '123',
            isActive: true,
        });

        expect(mockedCollection).toHaveBeenCalled();
        expect(mockedAddDoc).toHaveBeenCalledWith(
            expect.objectContaining({ __type: 'collection' }),
            expect.objectContaining({
                name: 'Paciente Uno',
                createdByUid: 'uid-2',
            }),
        );
        expect(id).toBe('patient-1');
    });

    it('updatePatient llama updateDoc con ref y data', async () => {
        const service = new FirebaseService('uid-1', 'Dr. Test');
        mockedUpdateDoc.mockResolvedValue(undefined);

        await service.updatePatient('patient-2', { phone: '999' });

        expect(mockedDoc).toHaveBeenCalled();
        expect(mockedUpdateDoc).toHaveBeenCalledWith(
            expect.objectContaining({ __type: 'doc' }),
            { phone: '999' },
        );
    });

    it('deletePatient llama deleteDoc con la referencia correcta', async () => {
        const service = new FirebaseService('uid-1', 'Dr. Test');
        mockedDeleteDoc.mockResolvedValue(undefined);

        await service.deletePatient('patient-3');

        expect(mockedDoc).toHaveBeenCalled();
        expect(mockedDeleteDoc).toHaveBeenCalledWith(expect.objectContaining({ __type: 'doc' }));
    });

    it('addAppointment agrega defaults y createdByUid, y retorna id', async () => {
        const service = new FirebaseService('uid-3', 'Dr. House');
        mockedAddDoc.mockResolvedValue({ id: 'appt-1' } as never);

        const id = await service.addAppointment({
            patientId: 'patient-1',
            patientName: 'Paciente Uno',
            date: '2026-02-26',
            time: '10:00',
            duration: 50,
            type: 'presencial',
            status: 'programado',
        });

        expect(mockedAddDoc).toHaveBeenCalledWith(
            expect.objectContaining({ __type: 'collection' }),
            expect.objectContaining({
                patientId: 'patient-1',
                status: 'programado',
                createdByUid: 'uid-3',
            }),
        );
        expect(id).toBe('appt-1');
    });

    it('updateAppointment llama updateDoc con la referencia y patch', async () => {
        const service = new FirebaseService('uid-1');
        mockedUpdateDoc.mockResolvedValue(undefined);

        await service.updateAppointment('appt-2', { status: 'completado' });

        expect(mockedUpdateDoc).toHaveBeenCalledWith(
            expect.objectContaining({ __type: 'doc' }),
            { status: 'completado' },
        );
    });

    it('deleteAppointment llama deleteDoc con la referencia', async () => {
        const service = new FirebaseService('uid-1');
        mockedDeleteDoc.mockResolvedValue(undefined);

        await service.deleteAppointment('appt-3');

        expect(mockedDeleteDoc).toHaveBeenCalledWith(expect.objectContaining({ __type: 'doc' }));
    });

    it('addPayment usa batch y marca turno pago cuando recibe appointmentId', async () => {
        const service = new FirebaseService('uid-10', 'Dr. Test');

        const paymentId = await service.addPayment(
            {
                patientName: 'Paciente Pago',
                amount: 15000,
                date: null,
                concept: 'Sesión',
            },
            'appt-9',
        );

        const firstBatchCall = mockedWriteBatch.mock.results[0];
        expect(firstBatchCall?.type).toBe('return');
        if (!firstBatchCall || firstBatchCall.type !== 'return') {
            throw new Error('writeBatch no devolvió un batch válido');
        }

        const activeBatch = firstBatchCall.value as unknown as {
            set: ReturnType<typeof vi.fn>;
            update: ReturnType<typeof vi.fn>;
            commit: ReturnType<typeof vi.fn>;
        };

        expect(mockedWriteBatch).toHaveBeenCalled();
        expect(activeBatch.set).toHaveBeenCalledTimes(1);
        expect(activeBatch.update).toHaveBeenCalledTimes(1);
        expect(activeBatch.commit).toHaveBeenCalledTimes(1);
        expect(paymentId).toMatch(/^mock-doc-/);
    });

    it('subscribeToAppointments registra query por ventana de fechas', () => {
        const service = new FirebaseService('uid-1');
        const onData = vi.fn();

        service.subscribeToAppointments('2026-01-01', '2026-12-31', onData);

        expect(mockedWhere).toHaveBeenCalledWith('date', '>=', '2026-01-01');
        expect(mockedWhere).toHaveBeenCalledWith('date', '<=', '2026-12-31');
        expect(mockedQuery).toHaveBeenCalled();
    });

    it('subscribeToMyAppointments sin professional delega en subscribeToAppointments', () => {
        const service = new FirebaseService('uid-1');
        const onData = vi.fn();

        service.subscribeToMyAppointments('2026-01-01', '2026-01-31', onData);

        expect(mockedQuery).toHaveBeenCalled();
        expect(mockedOnSnapshot).toHaveBeenCalled();
    });

    it('subscribeToFinance filtra cancelados sin cobro y ordena por fecha desc', () => {
        const service = new FirebaseService('uid-1', 'Dr. Test');
        const onUnpaid = vi.fn();
        const onPayments = vi.fn();

        service.subscribeToFinance(onUnpaid, onPayments);

        const unpaidCallback = mockedOnSnapshot.mock.calls[0][1] as (snapshot: ReturnType<typeof makeSnapshot>) => void;
        unpaidCallback(
            makeSnapshot([
                { id: 'a1', data: { status: 'cancelado', chargeOnCancellation: false, date: '2026-02-01' } },
                { id: 'a2', data: { status: 'programado', date: '2026-02-03' } },
                { id: 'a3', data: { status: 'cancelado', chargeOnCancellation: true, date: '2026-02-02' } },
            ]),
        );

        expect(onUnpaid).toHaveBeenCalledTimes(1);
        const payload = onUnpaid.mock.calls[0][0] as Array<{ id: string; date: string }>;
        expect(payload.map((item) => item.id)).toEqual(['a2', 'a3']);
    });

    it('deleteRecurringSeries borra docs cuando hay coincidencias', async () => {
        const service = new FirebaseService('uid-1');
        const firstBatchCall = mockedWriteBatch.mock.results[0]?.value as
            | { delete: ReturnType<typeof vi.fn>; commit: ReturnType<typeof vi.fn> }
            | undefined;

        mockedGetDocs.mockResolvedValue(
            {
                empty: false,
                docs: [
                    { ref: { id: 'r1' } },
                    { ref: { id: 'r2' } },
                ],
            } as never,
        );

        const deleted = await service.deleteRecurringSeries('rec-1');
        const activeBatch = firstBatchCall ?? (mockedWriteBatch.mock.results[0]?.value as { delete: ReturnType<typeof vi.fn>; commit: ReturnType<typeof vi.fn> });

        expect(activeBatch.delete).toHaveBeenCalledTimes(2);
        expect(activeBatch.commit).toHaveBeenCalledTimes(1);
        expect(deleted).toBe(2);
    });

    it('deleteRecurringFromDate borra solo desde fromDate', async () => {
        const service = new FirebaseService('uid-1');
        const firstBatchCall = mockedWriteBatch.mock.results[0]?.value as
            | { delete: ReturnType<typeof vi.fn>; commit: ReturnType<typeof vi.fn> }
            | undefined;

        mockedGetDocs.mockResolvedValue(
            {
                docs: [
                    { ref: { id: 'd1' }, data: () => ({ date: '2026-01-01' }) },
                    { ref: { id: 'd2' }, data: () => ({ date: '2026-02-10' }) },
                ],
            } as never,
        );

        const deleted = await service.deleteRecurringFromDate('rec-1', '2026-02-01');
        const activeBatch = firstBatchCall ?? (mockedWriteBatch.mock.results[0]?.value as { delete: ReturnType<typeof vi.fn>; commit: ReturnType<typeof vi.fn> });

        expect(activeBatch.delete).toHaveBeenCalledTimes(1);
        expect(activeBatch.commit).toHaveBeenCalledTimes(1);
        expect(deleted).toBe(1);
    });

    it('requestBatchInvoice crea item con total y lineItems', async () => {
        const service = new FirebaseService('uid-77');
        mockedAddDoc.mockResolvedValue({ id: 'queue-1' } as never);

        const requestId = await service.requestBatchInvoice(
            [
                { id: 'a1', price: 1000, date: '2026-01-01' } as never,
                { id: 'a2', price: 2500, consultationType: 'Control', date: '2026-01-08' } as never,
            ],
            { id: 'p1', name: 'Paciente Uno', email: 'p@test.com' },
        );

        expect(mockedAddDoc).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ totalPrice: 3500, patientId: 'p1', requestedBy: 'uid-77' }),
        );
        expect(requestId).toBe('queue-1');
    });

    it('subscribeToBillingStatus emite estado cuando existe el doc', () => {
        const service = new FirebaseService('uid-1');
        const onData = vi.fn();

        service.subscribeToBillingStatus('req-1', onData);

        const snapshotCallback = mockedOnSnapshot.mock.calls[mockedOnSnapshot.mock.calls.length - 1][1] as (
            snap: { exists: () => boolean; data: () => Record<string, unknown> },
        ) => void;
        snapshotCallback({
            exists: () => true,
            data: () => ({ status: 'completed', invoiceUrl: 'http://invoice', invoiceNumber: 'F-001' }),
        });

        expect(onData).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'completed', invoiceNumber: 'F-001' }),
        );
    });

    it('saveNote crea nota nueva y marca hasNotes en appointment', async () => {
        const service = new FirebaseService('uid-1');
        mockedAddDoc.mockResolvedValue({ id: 'note-1' } as never);
        mockedUpdateDoc.mockResolvedValue(undefined);

        await service.saveNote({ content: 'nota' } as never, 'appt-1');

        expect(mockedAddDoc).toHaveBeenCalled();
        expect(mockedUpdateDoc).toHaveBeenCalledWith(
            expect.objectContaining({ __type: 'doc' }),
            expect.objectContaining({ hasNotes: true }),
        );
    });

    it('saveNote actualiza nota existente cuando recibe existingNoteId', async () => {
        const service = new FirebaseService('uid-1');
        mockedUpdateDoc.mockResolvedValue(undefined);

        await service.saveNote({ content: 'nota editada' } as never, 'appt-1', 'note-existing');

        expect(mockedUpdateDoc).toHaveBeenCalled();
    });

    it('updateNote agrega updatedAt al patch', async () => {
        const service = new FirebaseService('uid-1');
        mockedUpdateDoc.mockResolvedValue(undefined);
        mockedTimestamp.mockReturnValue({ __type: 'ts' } as never);

        await service.updateNote('note-1', { content: 'texto' } as never);

        expect(mockedUpdateDoc).toHaveBeenCalledWith(
            expect.objectContaining({ __type: 'doc' }),
            expect.objectContaining({ content: 'texto', updatedAt: { __type: 'ts' } }),
        );
    });

    it('completeTask marca completada la tarea si existe', async () => {
        const service = new FirebaseService('uid-1');
        mockedGetDoc.mockResolvedValue(
            {
                exists: () => true,
                data: () => ({ tasks: [{ text: 't1', completed: false }] }),
            } as never,
        );
        mockedUpdateDoc.mockResolvedValue(undefined);

        await service.completeTask('note-1', 0);

        expect(mockedUpdateDoc).toHaveBeenCalled();
    });

    it('addTask crea una note tipo task y retorna id', async () => {
        const service = new FirebaseService('uid-1');
        mockedAddDoc.mockResolvedValue({ id: 'task-1' } as never);

        const id = await service.addTask({
            patientId: 'p1',
            professional: 'Dr. Test',
            content: 'Llamar paciente',
            createdBy: 'dr@test.com',
            createdByUid: 'uid-1',
        });

        expect(mockedAddDoc).toHaveBeenCalled();
        expect(id).toBe('task-1');
    });

    it('updateTask actualiza texto y subtasks', async () => {
        const service = new FirebaseService('uid-1');
        mockedGetDoc.mockResolvedValue(
            {
                exists: () => true,
                data: () => ({ tasks: [{ text: 'old', completed: false }] }),
            } as never,
        );
        mockedUpdateDoc.mockResolvedValue(undefined);

        await service.updateTask('note-1', 0, { text: 'new text', subtasks: [{ text: 's1', completed: false }] });

        expect(mockedUpdateDoc).toHaveBeenCalled();
    });

    it('toggleSubtaskCompletion invierte completed de subtask', async () => {
        const service = new FirebaseService('uid-1');
        mockedGetDoc.mockResolvedValue(
            {
                exists: () => true,
                data: () => ({ tasks: [{ text: 't', completed: false, subtasks: [{ text: 's', completed: false }] }] }),
            } as never,
        );
        mockedUpdateDoc.mockResolvedValue(undefined);

        await service.toggleSubtaskCompletion('note-1', 0, 0);

        expect(mockedUpdateDoc).toHaveBeenCalled();
    });

    it('markPsiquePaymentAsPaid hace setDoc merge true', async () => {
        const service = new FirebaseService('uid-1');
        mockedSetDoc.mockResolvedValue(undefined);

        await service.markPsiquePaymentAsPaid('2026-02', {
            month: '2026-02',
            totalAmount: 5000,
            isPaid: true,
            professional: 'Dr. Test',
        });

        expect(mockedSetDoc).toHaveBeenCalledWith(
            expect.objectContaining({ __type: 'doc' }),
            expect.objectContaining({ month: '2026-02', isPaid: true }),
            { merge: true },
        );
    });

    it('subscribeToPatientAppointments usa where por patientId y orderBy date desc', () => {
        const service = new FirebaseService('uid-1');

        service.subscribeToPatientAppointments('p-1', vi.fn());

        expect(mockedWhere).toHaveBeenCalledWith('patientId', '==', 'p-1');
        expect(mockedOrderBy).toHaveBeenCalledWith('date', 'desc');
        expect(mockedQuery).toHaveBeenCalled();
    });

    it('subscribeToFinance usa limit(50) para pagos', () => {
        const service = new FirebaseService('uid-1');
        service.subscribeToFinance(vi.fn(), vi.fn());

        expect(mockedLimit).toHaveBeenCalledWith(50);
    });

    it('createStaffProfile y updateStaffProfile delegan en setDoc', async () => {
        const service = new FirebaseService('uid-1');
        mockedSetDoc.mockResolvedValue(undefined);

        await service.createStaffProfile('uid-1', {
            uid: 'uid-1',
            email: 'staff@test.com',
            name: 'Dr Staff',
            role: 'professional',
            createdAt: { seconds: 0 } as never,
        });
        await service.updateStaffProfile('uid-1', { specialty: 'Clínica' } as never);

        expect(mockedSetDoc).toHaveBeenCalledTimes(2);
    });

    it('addRecurringAppointments crea un batch por cada fecha y hace commit', async () => {
        const service = new FirebaseService('uid-1');
        const firstBatchCall = mockedWriteBatch.mock.results[0]?.value as
            | { set: ReturnType<typeof vi.fn>; commit: ReturnType<typeof vi.fn> }
            | undefined;

        await service.addRecurringAppointments(
            {
                patientId: 'p1',
                patientName: 'Paciente',
                date: '2026-01-01',
                time: '10:00',
                duration: 50,
                type: 'presencial',
                status: 'programado',
            },
            ['2026-01-01', '2026-01-08'],
        );

        const activeBatch = firstBatchCall ?? (mockedWriteBatch.mock.results[0]?.value as { set: ReturnType<typeof vi.fn>; commit: ReturnType<typeof vi.fn> });
        expect(activeBatch.set).toHaveBeenCalledTimes(2);
        expect(activeBatch.commit).toHaveBeenCalledTimes(1);
    });

    it('deleteRecurringSeries devuelve 0 cuando snapshot está vacío', async () => {
        const service = new FirebaseService('uid-1');
        mockedGetDocs.mockResolvedValue({ empty: true, docs: [] } as never);

        const deleted = await service.deleteRecurringSeries('rec-empty');

        expect(deleted).toBe(0);
    });

    it('deleteRecurringFromDate devuelve 0 cuando no hay docs >= fromDate', async () => {
        const service = new FirebaseService('uid-1');
        mockedGetDocs.mockResolvedValue(
            {
                docs: [{ data: () => ({ date: '2026-01-01' }) }],
            } as never,
        );

        const deleted = await service.deleteRecurringFromDate('rec', '2026-02-01');
        expect(deleted).toBe(0);
    });

    it('subscribeToBillingStatus ignora snapshots inexistentes', () => {
        const service = new FirebaseService('uid-1');
        const onData = vi.fn();

        service.subscribeToBillingStatus('req-1', onData);
        const callback = mockedOnSnapshot.mock.calls[mockedOnSnapshot.mock.calls.length - 1][1] as (
            snap: { exists: () => boolean },
        ) => void;

        callback({ exists: () => false });
        expect(onData).not.toHaveBeenCalled();
    });

    it('subscribeToBillingStatus emite error en callback de snapshot error', () => {
        const service = new FirebaseService('uid-1');
        const onData = vi.fn();

        service.subscribeToBillingStatus('req-1', onData);
        const errorCallback = mockedOnSnapshot.mock.calls[mockedOnSnapshot.mock.calls.length - 1][2] as unknown as (
            err: { message: string },
        ) => void;

        errorCallback({ message: 'network error' });
        expect(onData).toHaveBeenCalledWith({ status: 'error', error: 'network error' });
    });

    it('subscribeToClinicalNote emite la nota cuando snapshot no está vacío', () => {
        const service = new FirebaseService('uid-1');
        const onData = vi.fn();

        service.subscribeToClinicalNote('appt-1', onData);
        const callback = mockedOnSnapshot.mock.calls[mockedOnSnapshot.mock.calls.length - 1][1] as (
            snap: ReturnType<typeof makeSnapshot>,
        ) => void;

        callback(makeSnapshot([{ id: 'note-1', data: { content: 'hola' } }]));
        expect(onData).toHaveBeenCalledWith(expect.objectContaining({ id: 'note-1', content: 'hola' }));
    });

    it('subscribeToClinicalNote emite null cuando snapshot está vacío', () => {
        const service = new FirebaseService('uid-1');
        const onData = vi.fn();

        service.subscribeToClinicalNote('appt-1', onData);
        const callback = mockedOnSnapshot.mock.calls[mockedOnSnapshot.mock.calls.length - 1][1] as (
            snap: ReturnType<typeof makeSnapshot>,
        ) => void;

        callback(makeSnapshot([]));
        expect(onData).toHaveBeenCalledWith(null);
    });

    it('subscribeToPatientNotes ordena por createdAt desc', () => {
        const service = new FirebaseService('uid-1');
        const onData = vi.fn();

        service.subscribeToPatientNotes('p1', onData);
        const callback = mockedOnSnapshot.mock.calls[mockedOnSnapshot.mock.calls.length - 1][1] as (
            snap: ReturnType<typeof makeSnapshot>,
        ) => void;

        callback(
            makeSnapshot([
                { id: 'n1', data: { createdAt: { toDate: () => new Date('2026-01-01') } } },
                { id: 'n2', data: { createdAt: { toDate: () => new Date('2026-02-01') } } },
            ]),
        );

        const sorted = onData.mock.calls[0][0] as Array<{ id: string }>;
        expect(sorted[0].id).toBe('n2');
    });

    it('uploadNoteAttachment sube archivo y devuelve URL', async () => {
        const service = new FirebaseService('uid-1');
        mockedRef.mockReturnValue({ __storageRef: true } as never);
        mockedUploadBytes.mockResolvedValue({} as never);
        mockedGetDownloadURL.mockResolvedValue('https://file-url');

        const file = new File(['x'], 'note.txt', { type: 'text/plain' });
        const url = await service.uploadNoteAttachment(file, 'patient-1');

        expect(mockedRef).toHaveBeenCalled();
        expect(mockedUploadBytes).toHaveBeenCalledWith(expect.anything(), file);
        expect(url).toBe('https://file-url');
    });

    it('subscribeToAllNotes emite notas del snapshot', () => {
        const service = new FirebaseService('uid-1');
        const onData = vi.fn();

        service.subscribeToAllNotes(onData);
        const callback = mockedOnSnapshot.mock.calls[mockedOnSnapshot.mock.calls.length - 1][1] as (
            snap: ReturnType<typeof makeSnapshot>,
        ) => void;

        callback(makeSnapshot([{ id: 'n1', data: { content: 'task' } }]));
        expect(onData).toHaveBeenCalledWith([expect.objectContaining({ id: 'n1' })]);
    });

    it('completeTask lanza error cuando no existe la nota', async () => {
        const service = new FirebaseService('uid-1');
        mockedGetDoc.mockResolvedValue({ exists: () => false } as never);

        await expect(service.completeTask('note-x', 0)).rejects.toThrow('Note not found');
    });

    it('updateTask lanza error si taskIndex no existe', async () => {
        const service = new FirebaseService('uid-1');
        mockedGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ tasks: [] }) } as never);

        await expect(service.updateTask('note', 0, { text: 'x' })).rejects.toThrow('Task at index 0 not found');
    });

    it('toggleSubtaskCompletion lanza error si subtask no existe', async () => {
        const service = new FirebaseService('uid-1');
        mockedGetDoc.mockResolvedValue(
            { exists: () => true, data: () => ({ tasks: [{ text: 't', completed: false, subtasks: [] }] }) } as never,
        );

        await expect(service.toggleSubtaskCompletion('note', 0, 0)).rejects.toThrow('Subtask at index 0 not found');
    });

    it('subscribeToPsiquePayments emite record indexado por doc.id', () => {
        const service = new FirebaseService('uid-1');
        const onData = vi.fn();

        service.subscribeToPsiquePayments('Dr. Test', onData);
        const callback = mockedOnSnapshot.mock.calls[mockedOnSnapshot.mock.calls.length - 1][1] as (
            snap: ReturnType<typeof makeSnapshot>,
        ) => void;

        callback(makeSnapshot([{ id: '2026-02', data: { month: '2026-02', totalAmount: 100, isPaid: false } }]));
        expect(onData).toHaveBeenCalledWith({
            '2026-02': expect.objectContaining({ id: '2026-02', month: '2026-02' }),
        });
    });

    it('subscribeToPatientPayments usa where por patientId y orderBy date desc', () => {
        const service = new FirebaseService('uid-1');

        service.subscribeToPatientPayments('p-2', vi.fn());

        expect(mockedWhere).toHaveBeenCalledWith('patientId', '==', 'p-2');
        expect(mockedOrderBy).toHaveBeenCalledWith('date', 'desc');
    });

    it('subscribeToStaffProfile emite profile cuando existe', () => {
        const service = new FirebaseService('uid-1');
        const onData = vi.fn();

        service.subscribeToStaffProfile('uid-1', onData);
        const callback = mockedOnSnapshot.mock.calls[mockedOnSnapshot.mock.calls.length - 1][1] as (
            snap: { exists: () => boolean; data: () => Record<string, unknown> },
        ) => void;

        callback({ exists: () => true, data: () => ({ uid: 'uid-1', name: 'Dr' }) });
        expect(onData).toHaveBeenCalledWith(expect.objectContaining({ uid: 'uid-1' }));
    });

    it('subscribeToStaffProfile emite null cuando no existe', () => {
        const service = new FirebaseService('uid-1');
        const onData = vi.fn();

        service.subscribeToStaffProfile('uid-1', onData);
        const callback = mockedOnSnapshot.mock.calls[mockedOnSnapshot.mock.calls.length - 1][1] as (
            snap: { exists: () => boolean },
        ) => void;

        callback({ exists: () => false });
        expect(onData).toHaveBeenCalledWith(null);
    });

    it('subscribeToStaffProfile maneja error callback emitiendo null', () => {
        const service = new FirebaseService('uid-1');
        const onData = vi.fn();

        service.subscribeToStaffProfile('uid-1', onData);
        const errorCallback = mockedOnSnapshot.mock.calls[mockedOnSnapshot.mock.calls.length - 1][2] as (
            err: unknown,
        ) => void;

        errorCallback(new Error('boom'));
        expect(onData).toHaveBeenCalledWith(null);
    });

    it('subscribeToMyAppointments con professional agrega filtro por professional', () => {
        const service = new FirebaseService('uid-1', 'Dra. P');

        service.subscribeToMyAppointments('2026-01-01', '2026-12-31', vi.fn());

        expect(mockedWhere).toHaveBeenCalledWith('professional', '==', 'Dra. P');
    });

    it('subscribeToAppointments transforma docs y los envía a onData', () => {
        const service = new FirebaseService('uid-1');
        const onData = vi.fn();

        service.subscribeToAppointments('2026-01-01', '2026-01-31', onData);
        const callback = mockedOnSnapshot.mock.calls[mockedOnSnapshot.mock.calls.length - 1][1] as (
            snap: ReturnType<typeof makeSnapshot>,
        ) => void;

        callback(makeSnapshot([{ id: 'a1', data: { patientName: 'P' } }]));
        expect(onData).toHaveBeenCalledWith([expect.objectContaining({ id: 'a1' })]);
    });

    it('subscribeToAppointments ejecuta error callback sin romper', () => {
        const service = new FirebaseService('uid-1');
        service.subscribeToAppointments('2026-01-01', '2026-01-31', vi.fn());

        const errorCallback = mockedOnSnapshot.mock.calls[mockedOnSnapshot.mock.calls.length - 1][2] as (
            err: unknown,
        ) => void;

        errorCallback(new Error('snapshot error'));
        expect(errorCallback).toBeTypeOf('function');
    });

    it('subscribeToPatients ejecuta error callback sin romper', () => {
        const service = new FirebaseService('uid-1', 'Dr');
        service.subscribeToPatients(vi.fn());

        const errorCallback = mockedOnSnapshot.mock.calls[mockedOnSnapshot.mock.calls.length - 1][2] as (
            err: unknown,
        ) => void;

        errorCallback(new Error('patients error'));
        expect(errorCallback).toBeTypeOf('function');
    });

    it('subscribeToPatientPayments transforma docs y envía onData', () => {
        const service = new FirebaseService('uid-1');
        const onData = vi.fn();

        service.subscribeToPatientPayments('p-9', onData);
        const callback = mockedOnSnapshot.mock.calls[mockedOnSnapshot.mock.calls.length - 1][1] as (
            snap: ReturnType<typeof makeSnapshot>,
        ) => void;

        callback(makeSnapshot([{ id: 'pay-1', data: { amount: 2000 } }]));
        expect(onData).toHaveBeenCalledWith([expect.objectContaining({ id: 'pay-1', amount: 2000 })]);
    });

    it('deletePayment y updatePayment delegan en deleteDoc/updateDoc', async () => {
        const service = new FirebaseService('uid-1');
        mockedDeleteDoc.mockResolvedValue(undefined);
        mockedUpdateDoc.mockResolvedValue(undefined);

        await service.deletePayment('pay-1');
        await service.updatePayment('pay-1', { concept: 'Ajuste' } as never);

        expect(mockedDeleteDoc).toHaveBeenCalled();
        expect(mockedUpdateDoc).toHaveBeenCalledWith(expect.objectContaining({ __type: 'doc' }), { concept: 'Ajuste' });
    });
});
