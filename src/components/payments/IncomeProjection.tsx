import { useState, useMemo } from 'react';
import { Patient } from '../../types';
import { AgendaStats, PatientStats, calculateProjectedIncome } from '../../hooks/useAgendaStats';
import { Users, Building2 } from 'lucide-react';

interface IncomeProjectionProps {
    stats: AgendaStats;
    patients: Patient[];
}

interface ProjectionRow extends PatientStats {
    estimatedSessions: number;
    projectedGross: number;
    projectedNet: number;
    psiqueDiscount: number;
}

export const IncomeProjection = ({ stats, patients }: IncomeProjectionProps) => {
    // State for editable session counts per patient
    const [sessionOverrides, setSessionOverrides] = useState<Record<string, number>>({});

    // Build projection rows with editable sessions
    const projectionRows: ProjectionRow[] = useMemo(() => {
        return stats.patientStats
            .filter((ps) => {
                // Only include patients with a fee set
                const patient = patients.find((p) => p.id === ps.patientId);
                return patient && (patient.fee || 0) > 0;
            })
            .map((ps) => {
                // Use override if set, otherwise use patient's average or global average
                const defaultSessions =
                    ps.avgSessions > 0 ? Math.round(ps.avgSessions) : Math.round(stats.avgSessionsPerPatient);
                const estimatedSessions = sessionOverrides[ps.patientId] ?? defaultSessions;

                const { gross, net, psiqueDiscount } = calculateProjectedIncome(ps.fee, estimatedSessions, ps.isPsique);

                return {
                    ...ps,
                    estimatedSessions,
                    projectedGross: gross,
                    projectedNet: net,
                    psiqueDiscount,
                };
            });
    }, [stats, patients, sessionOverrides]);

    // Calculate totals
    const totals = useMemo(() => {
        return projectionRows.reduce(
            (acc, row) => ({
                sessions: acc.sessions + row.estimatedSessions,
                gross: acc.gross + row.projectedGross,
                net: acc.net + row.projectedNet,
                psiqueDiscount: acc.psiqueDiscount + row.psiqueDiscount,
            }),
            { sessions: 0, gross: 0, net: 0, psiqueDiscount: 0 },
        );
    }, [projectionRows]);

    const handleSessionChange = (patientId: string, value: number) => {
        setSessionOverrides((prev) => ({
            ...prev,
            [patientId]: Math.max(0, value),
        }));
    };

    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthLabel = nextMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    return (
        <div className="space-y-6">
            {/* Projection Summary */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-5 text-white shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <p className="text-emerald-200 text-sm font-medium uppercase tracking-wider mb-1">
                            Proyección {nextMonthLabel}
                        </p>
                        <div className="flex items-center gap-6 text-sm">
                            <div>
                                <span className="text-emerald-200">Sesiones:</span>
                                <span className="ml-2 font-bold">{totals.sessions}</span>
                            </div>
                            <div>
                                <span className="text-emerald-200">Bruto:</span>
                                <span className="ml-2 font-bold">${totals.gross.toLocaleString()}</span>
                            </div>
                            {totals.psiqueDiscount > 0 && (
                                <div>
                                    <span className="text-purple-300">Psique:</span>
                                    <span className="ml-2 font-bold text-purple-300">
                                        -${totals.psiqueDiscount.toLocaleString()}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-emerald-200 text-xs uppercase tracking-wider">Ingreso Neto Estimado</p>
                        <p className="text-3xl font-bold">${totals.net.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* Projection Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {projectionRows.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                        <div className="bg-slate-50 p-4 rounded-full mb-4">
                            <Users size={32} className="text-slate-300" />
                        </div>
                        <p>No hay pacientes activos con honorarios configurados.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                                <tr>
                                    <th className="p-4 pl-6">Paciente</th>
                                    <th className="p-4 text-right">Honorario</th>
                                    <th className="p-4 text-center">Prom. Hist.</th>
                                    <th className="p-4 text-center">Sesiones Est.</th>
                                    <th className="p-4 text-right pr-6">Proyectado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {projectionRows.map((row) => (
                                    <tr key={row.patientId} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 pl-6">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-800">{row.patientName}</span>
                                                {row.isPsique && (
                                                    <span
                                                        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700"
                                                        title="Paciente Psique - 25% descuento"
                                                    >
                                                        <Building2 size={10} className="mr-1" /> P
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right text-slate-600">${row.fee.toLocaleString()}</td>
                                        <td className="p-4 text-center text-slate-500">
                                            {row.avgSessions > 0 ? row.avgSessions : '-'}
                                        </td>
                                        <td className="p-4 text-center">
                                            <input
                                                type="number"
                                                min="0"
                                                max="20"
                                                value={row.estimatedSessions}
                                                onChange={(e) =>
                                                    handleSessionChange(row.patientId, parseInt(e.target.value) || 0)
                                                }
                                                className="w-16 text-center p-1 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                            />
                                        </td>
                                        <td className="p-4 text-right pr-6">
                                            {row.isPsique ? (
                                                <div className="flex flex-col items-end">
                                                    <span className="font-bold text-slate-700">
                                                        ${row.projectedNet.toLocaleString()}
                                                    </span>
                                                    <span className="text-xs text-purple-500">
                                                        (bruto ${row.projectedGross.toLocaleString()})
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="font-bold text-slate-700">
                                                    ${row.projectedGross.toLocaleString()}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-emerald-50 border-t-2 border-emerald-200">
                                <tr>
                                    <td className="p-4 pl-6 font-bold text-emerald-800" colSpan={3}>
                                        Total Proyectado
                                    </td>
                                    <td className="p-4 text-center font-bold text-emerald-800">{totals.sessions}</td>
                                    <td className="p-4 text-right pr-6">
                                        <div className="flex flex-col items-end">
                                            <span className="font-bold text-emerald-800 text-lg">
                                                ${totals.net.toLocaleString()}
                                            </span>
                                            {totals.psiqueDiscount > 0 && (
                                                <span className="text-xs text-slate-500">
                                                    (bruto ${totals.gross.toLocaleString()})
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
