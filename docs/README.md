# docs/ — Índice de Documentación

Registro centralizado de auditorías, planes de acción, y revisiones de cierre del proyecto **Lumen Salud Mental**.

---

## Estructura

```text
docs/
  audits/      ← auditorías periódicas de calidad del repositorio
  plans/       ← planes de implementación (tarea a tarea, antes de tocar código)
  reviews/     ← registros de verificación y cierre de fase
  technical/   ← documentación técnica de arquitectura y decisiones de diseño
```

### Convención de nombres

| Carpeta      | Patrón                                 | Ejemplo                                  |
| ------------ | -------------------------------------- | ---------------------------------------- |
| `audits/`    | `YYYY-MM-DD_AUDIT.md`                  | `2026-02-19_AUDIT.md`                    |
| `plans/`     | `YYYY-MM-DD-<fase-o-feature>.md`       | `2026-02-19-phase1-security.md`          |
| `reviews/`   | `YYYY-MM-DD_<tema>-review.md`          | `2026-02-22_phase1-completion-review.md` |
| `technical/` | `v<semver>_TECHNICAL.md` o `<tema>.md` | `v1.0.0_TECHNICAL.md`                    |

---

## Historial de trabajo

### Ciclo 1 — Seguridad (Feb 2026)

```text
Auditoría
  └── 2026-02-19_AUDIT.md  (score C+, 8 hallazgos críticos)
       │
       ├── Plans
       │    ├── 2026-02-19-phase1-security.md          (plan principal, 10 tasks)
       │    └── 2026-02-19-phase1-security-fixes.md    (fixes post code-review, 6 tasks)
       │
       └── Review
            └── 2026-02-22_phase1-completion-review.md  ✓ COMPLETADA
```

### Ciclo 2 — Estabilidad, DX y Arquitectura (Feb 2026)

```text
Auditoría (misma)
  └── 2026-02-19_AUDIT.md  → hallazgos LINT-01, TSC-01, ARCH-01, HOOK-01, TEST-01
       │
       ├── Plans
       │    ├── 2026-02-22-phase2-stability-dx-architecture.md  (plan principal, 14 tasks)
       │    └── 2026-02-23-phase2-fixes.md                     (fixes post-evaluación, 11 tasks)
       │
       └── Review
            └── 2026-02-23_phase2-completion-review.md  ✓ COMPLETADA
```

### Ciclo 3 — Testing & Cleanup (Feb 2026)

```text
Auditoría (misma)
  └── 2026-02-19_AUDIT.md  → hallazgos TEST-01 (continuación), lint pre-existente, useStaff migration
       │
       ├── Plans
       │    ├── 2026-02-23-phase3-testing-cleanup.md  (plan principal, 21 tasks)
       │    └── 2026-02-24-phase3-fixes.md             (fixes post code-review, 3 items)
       │
       └── Review
            └── 2026-02-24_phase3-completion-review.md  ✓ COMPLETADA
```

### Ciclo 4 — Performance, Accesibilidad y Service Layer (Feb 2026)

```text
Auditoría (misma)
  └── 2026-02-19_AUDIT.md  → hallazgos BUILD-01, DATA-01, A11Y-01, ARCH-01 (remanente), TEST-01 (remanente)
       │
       ├── Plan
       │    └── 2026-02-25-phase4-performance-a11y-services.md  (plan principal, 10 tasks)
       │
       └── Review
            └── 2026-02-26_phase4-completion-review.md  ✓ COMPLETADA
```

| Documento                                                                                                                  | Tipo         | Fecha      | Estado                           |
| -------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------- | -------------------------------- |
| [2026-02-19_AUDIT.md](audits/2026-02-19_AUDIT.md)                                                                          | Auditoría    | 19/02/2026 | Referencia base                  |
| [2026-02-19-phase1-security.md](plans/2026-02-19-phase1-security.md)                                                       | Plan         | 19/02/2026 | Ejecutado ✓                      |
| [2026-02-19-phase1-security-fixes.md](plans/2026-02-19-phase1-security-fixes.md)                                           | Plan (fixes) | 19/02/2026 | Ejecutado ✓                      |
| [2026-02-22_phase1-completion-review.md](reviews/2026-02-22_phase1-completion-review.md)                                   | Review       | 22/02/2026 | Cerrado ✓                        |
| [2026-02-22-phase2-stability-dx-architecture.md](plans/2026-02-22-phase2-stability-dx-architecture.md)                     | Plan         | 22/02/2026 | Ejecutado ✓                      |
| [2026-02-23-phase2-fixes.md](plans/2026-02-23-phase2-fixes.md)                                                             | Plan (fixes) | 23/02/2026 | Ejecutado ✓                      |
| [2026-02-23_phase2-completion-review.md](reviews/2026-02-23_phase2-completion-review.md)                                   | Review       | 23/02/2026 | Cerrado ✓                        |
| [2026-02-23-phase3-testing-cleanup.md](plans/2026-02-23-phase3-testing-cleanup.md)                                         | Plan         | 23/02/2026 | Ejecutado ✓                      |
| [2026-02-24-phase3-fixes.md](plans/2026-02-24-phase3-fixes.md)                                                             | Plan (fixes) | 24/02/2026 | Ejecutado ✓                      |
| [2026-02-24_phase3-completion-review.md](reviews/2026-02-24_phase3-completion-review.md)                                   | Review       | 24/02/2026 | Cerrado ✓                        |
| [2026-02-25-phase4-performance-a11y-services.md](plans/2026-02-25-phase4-performance-a11y-services.md)                     | Plan         | 25/02/2026 | Ejecutado ✓                      |
| [2026-02-26_phase4-completion-review.md](reviews/2026-02-26_phase4-completion-review.md)                                   | Review       | 26/02/2026 | Cerrado ✓                        |
| [2026-02-26_AUDIT.md](audits/2026-02-26_AUDIT.md)                                                                          | Auditoría    | 26/02/2026 | Referencia actual (post-4 fases) |
| [2026-02-26-phase5-high-priority-security-architecture.md](plans/2026-02-26-phase5-high-priority-security-architecture.md) | Plan         | 26/02/2026 | Pendiente de ejecución           |

---

## Técnicos

| Documento                                            | Descripción                 |
| ---------------------------------------------------- | --------------------------- |
| [v1.0.0_TECHNICAL.md](technical/v1.0.0_TECHNICAL.md) | Arquitectura técnica v1.0.0 |
| [v1.1.0_TECHNICAL.md](technical/v1.1.0_TECHNICAL.md) | Arquitectura técnica v1.1.0 |

---

## Deuda técnica abierta

Deuda actualizada tras cierre de Fase 3:
→ [2026-02-24_phase3-completion-review.md — Deuda técnica pendiente](reviews/2026-02-24_phase3-completion-review.md#deuda-técnica-pendiente)

| Área                           | IDs                          | Estado                                         |
| ------------------------------ | ---------------------------- | ---------------------------------------------- |
| ~~Testing~~                    | ~~TEST-01~~                  | ~~Fase 2~~ → Ejecutado ✓ (parcial)             |
| ~~Arquitectura~~               | ~~ARCH-01, HOOK-01~~         | ~~Fase 2~~ → Ejecutado ✓                       |
| ~~DX~~                         | ~~LINT-01, TSC-01~~          | ~~Fase 2~~ → Ejecutado ✓                       |
| ~~Coverage expansion~~         | ~~TEST-01 (cont.)~~          | ~~Fase 3~~ → Ejecutado ✓ (4 archivos en scope) |
| ~~Lint cleanup~~               | ~~7 errores pre-existentes~~ | ~~Fase 3~~ → Ejecutado ✓ (0 errors)            |
| ~~useStaff migration~~         | ~~ARCH-01 (remanente)~~      | ~~Fase 4~~ → Ejecutado ✓                       |
| ~~useBillingStatus migration~~ | ~~ARCH-01 (remanente)~~      | ~~Fase 4~~ → Ejecutado ✓                       |
| ~~Performance~~                | ~~BUILD-01, DATA-01~~        | ~~Fase 4~~ → Ejecutado ✓                       |
| ~~Accesibilidad~~              | ~~A11Y-01~~                  | ~~Fase 4~~ → Ejecutado ✓                       |
| ~~FirebaseService tests~~      | ~~TEST-01 (remanente)~~      | ~~Fase 4~~ → Ejecutado ✓                       |

**Todos los hallazgos de la auditoría original han sido resueltos.**

### Deuda de la auditoría 26/02/2026 (post-4 fases)

| Área                 | IDs                                              | Estado               |
| -------------------- | ------------------------------------------------ | -------------------- |
| Seguridad (alta)     | SEC-N01, SEC-N02, SEC-N03, SEC-07                | Fase 5 → Plan creado |
| Arquitectura (alta)  | ARCH-N01, ARCH-N02                               | Fase 5 → Plan creado |
| Seguridad (media)    | SEC-N04, SEC-N05, SEC-06, SEC-10, SEC-11, SEC-13 | Pendiente            |
| Arquitectura (media) | ARCH-N03, ARCH-N04, ARCH-N05, ARCH-N06, ARCH-N07 | Pendiente            |
| Hooks/Componentes    | HOOK-N01..N04, COMP-N01, COMP-N02                | Pendiente            |
| Testing gaps         | 8/10 hooks, 0 componentes, 0 vistas              | Pendiente            |
| Configuración        | Path aliases, engines, sourcemaps, etc.          | Pendiente            |

→ Nueva auditoría post-4 fases: [2026-02-26_AUDIT.md](audits/2026-02-26_AUDIT.md) — Score **B+** con 26 hallazgos nuevos de severidad media-baja.

### Ciclo 5 — Seguridad y Arquitectura: Prioridad Alta (Feb 2026)

```text
Auditoría
  └── 2026-02-26_AUDIT.md  (score B+, 6 hallazgos prioridad alta)
       │
       └── Plan
            └── 2026-02-26-phase5-high-priority-security-architecture.md  (6 tasks)
```
