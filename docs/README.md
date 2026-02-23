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

| Carpeta | Patrón | Ejemplo |
| --- | --- | --- |
| `audits/` | `YYYY-MM-DD_AUDIT.md` | `2026-02-19_AUDIT.md` |
| `plans/` | `YYYY-MM-DD-<fase-o-feature>.md` | `2026-02-19-phase1-security.md` |
| `reviews/` | `YYYY-MM-DD_<tema>-review.md` | `2026-02-22_phase1-completion-review.md` |
| `technical/` | `v<semver>_TECHNICAL.md` o `<tema>.md` | `v1.0.0_TECHNICAL.md` |

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
       ├── Plan
       │    └── 2026-02-22-phase2-stability-dx-architecture.md  (14 tasks)
       │
       └── Fixes
            └── 2026-02-23-phase2-fixes.md  (11 tasks, correcciones post-evaluación)
```

| Documento | Tipo | Fecha | Estado |
| --- | --- | --- | --- |
| [2026-02-19_AUDIT.md](audits/2026-02-19_AUDIT.md) | Auditoría | 19/02/2026 | Referencia base |
| [2026-02-19-phase1-security.md](plans/2026-02-19-phase1-security.md) | Plan | 19/02/2026 | Ejecutado ✓ |
| [2026-02-19-phase1-security-fixes.md](plans/2026-02-19-phase1-security-fixes.md) | Plan (fixes) | 19/02/2026 | Ejecutado ✓ |
| [2026-02-22_phase1-completion-review.md](reviews/2026-02-22_phase1-completion-review.md) | Review | 22/02/2026 | Cerrado ✓ |
| [2026-02-22-phase2-stability-dx-architecture.md](plans/2026-02-22-phase2-stability-dx-architecture.md) | Plan | 22/02/2026 | Pendiente |
| [2026-02-23-phase2-fixes.md](plans/2026-02-23-phase2-fixes.md) | Plan (fixes) | 23/02/2026 | Pendiente |

---

## Técnicos

| Documento | Descripción |
| --- | --- |
| [v1.0.0_TECHNICAL.md](technical/v1.0.0_TECHNICAL.md) | Arquitectura técnica v1.0.0 |

---

## Deuda técnica abierta

Los hallazgos pendientes de la auditoría inicial están priorizados en el review de cierre de Fase 1:
→ [2026-02-22_phase1-completion-review.md — Deuda técnica pendiente](reviews/2026-02-22_phase1-completion-review.md#deuda-técnica-pendiente-fuera-del-scope-de-fase-1)

| Área | IDs | Próxima fase sugerida |
| --- | --- | --- |
| ~~Testing~~ | ~~TEST-01~~ | ~~Fase 2~~ → Plan creado |
| ~~Arquitectura~~ | ~~ARCH-01, HOOK-01~~ | ~~Fase 2~~ → Plan creado |
| ~~DX~~ | ~~LINT-01, TSC-01~~ | ~~Fase 2~~ → Plan creado |
| Performance | BUILD-01, DATA-01 | Fase 3 |
| Accesibilidad | A11Y-01 | Fase 3 |
