import React, { useState } from 'react';
import { Appointment, Payment, PaymentInput } from '../../types';
import { ModalOverlay } from '../ui';
import { DollarSign, CheckCircle, Save, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDataActions } from '../../hooks/useDataActions';

interface PaymentModalProps {
    appointment?: Appointment;
    existingPayment?: Payment;
    isPsiquePatient?: boolean;
    mode?: 'create' | 'edit';
    onClose: () => void;
}

const PSIQUE_RATE = 0.25;

export const PaymentModal = ({
    appointment,
    existingPayment,
    isPsiquePatient = false,
    mode = 'create',
    onClose,
}: PaymentModalProps) => {
    const [amount, setAmount] = useState(
        mode === 'edit' && existingPayment ? existingPayment.amount.toString() : appointment?.price?.toString() || '',
    );
    const [concept, setConcept] = useState(
        mode === 'edit' && existingPayment
            ? existingPayment.concept
            : `Sesión del ${appointment ? new Date(appointment.date).toLocaleDateString() : ''}`,
    );
    const { addPayment, updatePayment, updateAppointment } = useDataActions();

    const parsedAmount = parseFloat(amount) || 0;
    const psiqueDiscount = isPsiquePatient ? parsedAmount * PSIQUE_RATE : 0;
    const netAmount = parsedAmount - psiqueDiscount;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (mode === 'edit' && existingPayment) {
                // Update existing payment
                await updatePayment(existingPayment.id, {
                    amount: parsedAmount,
                    concept: concept,
                });

                // Also update the appointment's price to keep them in sync
                if (appointment) {
                    await updateAppointment(appointment.id, {
                        price: parsedAmount,
                    });
                }

                toast.success('Pago actualizado correctamente');
            } else if (appointment) {
                // Create new payment
                const paymentData: PaymentInput = {
                    appointmentId: appointment.id,
                    patientId: appointment.patientId,
                    patientName: appointment.patientName,
                    amount: parsedAmount,
                    concept: concept,
                    date: null, // Will be set by service as Timestamp.now()
                };

                await addPayment(paymentData, appointment.id);
                toast.success('Pago registrado correctamente');
            }
            onClose();
        } catch (error: unknown) {
            console.error(error);
            // Handle permission errors specifically
            if (error && typeof error === 'object' && 'code' in error && error.code === 'permission-denied') {
                toast.error('No tienes permisos para modificar este turno facturado');
            } else {
                toast.error(mode === 'edit' ? 'Error al actualizar el pago' : 'Error al registrar el pago');
            }
        }
    };

    const patientName = mode === 'edit' ? existingPayment?.patientName : appointment?.patientName;
    const originalDate =
        mode === 'edit' && existingPayment?.date
            ? new Date(existingPayment.date.seconds * 1000).toLocaleDateString()
            : appointment
              ? new Date(appointment.date).toLocaleDateString()
              : '';

    return (
        <ModalOverlay onClose={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                <h2 className="text-xl font-bold mb-2 text-slate-800">
                    {mode === 'edit' ? 'Editar Pago' : 'Regularizar Sesión'}
                </h2>
                <p className="text-sm text-slate-500 mb-6">
                    {mode === 'edit'
                        ? 'Modifica los detalles del pago registrado.'
                        : 'Esto registrará un cobro y marcará el turno como pagado.'}
                </p>

                <div className="bg-slate-50 p-4 rounded-lg mb-4 border border-slate-100">
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-500">Paciente:</span>
                        <div className="flex items-center gap-2">
                            <span className="font-medium">{patientName}</span>
                            {isPsiquePatient && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                                    <Building2 size={10} className="mr-1" /> Psique
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Fecha Original:</span>
                        <span className="font-medium">{originalDate}</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-700 mb-1">Monto a cobrar</label>
                        <div className="relative">
                            <DollarSign size={16} className="absolute left-3 top-3 text-slate-400" />
                            <input
                                autoFocus
                                type="number"
                                className="w-full pl-9 p-2 border rounded-lg"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Psique discount display */}
                    {isPsiquePatient && parsedAmount > 0 && (
                        <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
                            <div className="flex justify-between text-sm text-purple-700 mb-1">
                                <span>Monto bruto:</span>
                                <span className="font-medium">${parsedAmount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm text-purple-600 mb-1">
                                <span>Descuento Psique (25%):</span>
                                <span className="font-medium">-${psiqueDiscount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold text-purple-800 pt-1 border-t border-purple-200">
                                <span>Neto a recibir:</span>
                                <span>${netAmount.toLocaleString()}</span>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm text-slate-700 mb-1">Concepto</label>
                        <input
                            className="w-full p-2 border rounded-lg"
                            value={concept}
                            onChange={(e) => setConcept(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-end space-x-3 mt-6">
                        <button type="button" onClick={onClose} className="text-slate-500 px-4 py-2">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700 shadow-sm flex items-center"
                        >
                            {mode === 'edit' ? (
                                <>
                                    <Save size={16} className="mr-2" /> Guardar Cambios
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={16} className="mr-2" /> Confirmar Pago
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </ModalOverlay>
    );
};
