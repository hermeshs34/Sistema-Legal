# ⚖️ BUSINESS_RULES.md — Reglas de Negocio: LegalDoc VE

> Este documento define las reglas de negocio que el sistema debe respetar siempre. Es la fuente de verdad para la lógica de dominio.

---

## 1. MODELO DE NEGOCIO

LegalDoc VE es una plataforma **multi-tenant SaaS**. Cada empresa (organización) tiene su propio espacio de datos completamente aislado. Los usuarios pertenecen a una sola organización.

---

## 2. REGLAS DE ROLES Y ACCESO

### 2.1 Jerarquía de roles (de mayor a menor privilegio):
```
consultor_general > abogado_senior > consultor_principal > abogado_junior > aprendiz
```

### 2.2 Reglas de acceso por acción:

| Acción | Roles permitidos |
|---|---|
| Ver dashboard completo | consultor_general, abogado_senior, consultor_principal, abogado_junior |
| Ver TODOS los documentos | consultor_general, abogado_senior, consultor_principal |
| Ver solo docs asignados | abogado_junior, aprendiz |
| Crear documento | consultor_general, abogado_senior, abogado_junior |
| Editar documento | consultor_general, abogado_senior, abogado_junior (solo asignados) |
| Archivar documento | consultor_general, abogado_senior |
| **Aprobar contratos** | consultor_general, abogado_senior |
| Gestionar usuarios | consultor_general (único) |
| Exportar reportes | consultor_general, abogado_senior, consultor_principal |
| Ver auditoría completa | consultor_general |
| Ver auditoría parcial | abogado_senior, consultor_principal |

### 2.3 Regla de aislamiento de datos:
> **Todo usuario solo puede ver y manipular datos de su propia organización, sin excepción.**

---

## 3. CICLO DE VIDA DE DOCUMENTOS

### 3.1 Estados y transiciones permitidas:
```
DRAFT → IN_REVIEW → APPROVED → PUBLISHED
                  ↘ ARCHIVED (desde cualquier estado)
                  ↘ EXPIRED  (automático por fecha)
```

### 3.2 Reglas de transición:
- `draft → in_review`: Cualquier usuario con permiso `edit_doc`
- `in_review → approved`: Solo roles con `approve_contracts`
- `approved → published`: Solo `consultor_general` o `abogado_senior`
- `cualquier → archived`: Solo roles con `archive_doc`
- `cualquier → expired`: Automático cuando `expiration_date` < fecha actual

### 3.3 Reglas de inmutabilidad:
- Un documento `PUBLISHED` **no puede ser editado**, solo archivado o versionado
- Todo cambio de estado genera un registro en `audit_logs` (obligatorio)

---

## 4. CICLO DE VIDA DE CONTRATOS

### 4.1 Estados y transiciones:
```
DRAFT → REVIEW → ACTIVE → EXPIRED (automático)
                         → TERMINATED (manual)
                         → CANCELLED  (solo desde DRAFT o REVIEW)
```

### 4.2 Reglas:
- Un contrato `ACTIVE` con `auto_renewal: true` debe generar alerta 30 días antes del `end_date`
- Un contrato `confidential: true` solo puede verlo el `assigned_lawyer` y `consultor_general`
- El valor monetario (`value`) siempre se almacena en la moneda indicada en `currency`

---

## 5. MATRIZ DE RIESGOS (Compliance)

### 5.1 Niveles de riesgo y su significado:

| Nivel | Código | Color | Significado | Acción requerida |
|---|---|---|---|---|
| Bajo | `LOW` | 🟢 Verde | Sin impacto material | Revisión semestral |
| Medio | `MEDIUM` | 🟡 Amarillo | Impacto moderado | Revisión trimestral |
| Alto | `HIGH` | 🟠 Naranja | Impacto significativo | Revisión mensual + Plan |
| Crítico | `CRITICAL` | 🔴 Rojo | Impacto severo / legal | Acción inmediata |

### 5.2 Áreas de compliance:

| Área | Código | Marco regulatorio principal (VE) |
|---|---|---|
| Legal | `LEGAL` | Código de Comercio, Código Civil |
| Fiscal | `TAX` | ISLR, IVA, SENIAT |
| Laboral | `LABOR` | LOTTT, LOPCYMAT, IVSS |
| Regulatorio | `REGULATORY` | SUNDEA, SUDEBAN, CNV |
| Ambiental | `ENVIRONMENTAL` | Ley Orgánica del Ambiente |
| Operacional | `OPERATIONAL` | Políticas internas, ISO |

### 5.3 Regla de escalamiento:
- Si un ítem cambia a `CRITICAL`, se debe notificar automáticamente al `consultor_general`
- Un ítem `NON_COMPLIANT` con riesgo `HIGH` o `CRITICAL` bloquea la publicación de nuevos documentos relacionados (⚠️ pendiente implementar)

---

## 6. ABOGADOS Y REGISTRO PROFESIONAL

### 6.1 Validación de INPREABOGADO:
- El número de **INPREABOGADO** es obligatorio para todos los abogados registrados
- Formato: numérico, entre 4 y 6 dígitos (e.g., 12345, 123456)
- El sistema debe validar que no existan dos abogados con el mismo INPREABOGADO dentro de la misma organización

### 6.2 Tipos de abogado:
- `INTERNAL`: Empleado de la empresa, accede al sistema como usuario
- `EXTERNAL`: Abogado externo/consultor, solo aparece en el directorio

---

## 7. MONEDAS Y TASAS DE CAMBIO

### 7.1 Monedas soportadas:
- **VES** (Bolívar Soberano) — moneda base para Venezuela
- **USD** (Dólar americano) — para contratos internacionales
- **EUR** (Euro) — para contratos con Europa

### 7.2 Reglas de conversión:
- La tasa de cambio VES/USD se obtiene del **BCV** (Banco Central de Venezuela)
- Las tasas se actualizan diariamente via Edge Function
- Todos los montos se almacenan en la moneda original del contrato, nunca convertidos

---

## 8. AUDITORÍA INMUTABLE

### 8.1 Eventos que SIEMPRE generan audit_log:

| Evento | Descripción |
|---|---|
| `login` | Usuario inicia sesión |
| `logout` | Usuario cierra sesión |
| `created` | Creación de cualquier entidad |
| `updated` | Modificación de cualquier entidad |
| `status_change` | Cambio de estado de documento/contrato |
| `exported` | Exportación de reportes o documentos |
| `deleted` | Eliminación (soft-delete) de entidades |

### 8.2 Regla de auditoría:
> **Los `audit_logs` son append-only. Nunca se borran. Nunca se modifican. Son la prueba legal de las operaciones.**

---

## 9. MULTI-REGIÓN

### 9.1 Regiones legales soportadas:
- **Venezuela (VE)**: Marco legal venezolano (LOTTT, SENIAT, SUNDEA, etc.)
- **España (ES)**: Marco legal español (RGPD, Código Mercantil)
- **Internacional**: Sin marco específico, requiere definición manual

### 9.2 Impacto de la región en el sistema:
- Los formularios de compliance muestran diferentes áreas según la región
- La IA ajusta sus sugerencias legales según la jurisdicción del documento
- Los calendarios de cumplimiento consideran festivos locales

---

## 10. NAMING CONVENTIONS (Reglas del dominio)

| Concepto | Español en UI | Código (TypeScript) | DB (SQL) |
|---|---|---|---|
| Documento legal | Documento | `Document` | `documents` |
| Contrato | Contrato | `Contract` | `contracts` |
| Cumplimiento | Compliance | `ComplianceItem` | `compliance_items` |
| Abogado | Abogado | `Lawyer` | `lawyers` |
| Nivel de riesgo | Nivel de Riesgo | `RiskLevel` | `risk_level` |
| Estado | Estado | `status` | `status` |
| Organización | Organización | `Organization` | `organizations` |

---

*Última actualización: 21/03/2026 | Mantenido por: Antigravity*
