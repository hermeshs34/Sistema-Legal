# 🤖 AGENT.md — LegalDoc VE: Instrucciones para Agentes IA

> **Este es el documento maestro.** Todo agente IA que trabaje en este proyecto DEBE leer este archivo antes de hacer cualquier cambio. Reemplaza al antiguo `Claude.md`.

---

## 1. DESCRIPCIÓN DEL PROYECTO

**LegalDoc VE** es una plataforma SaaS de nivel enterprise para **Compliance Legal y Gestión Documental**, diseñada para el mercado venezolano e internacional.

- **Nombre comercial:** LegalDoc VE
- **Sector:** LegalTech / Compliance
- **Mercado objetivo:** Empresas venezolanas con obligaciones regulatorias (SUNDEA, LOPCYMAT, SENIAT, etc.) y operaciones internacionales
- **Fase actual:** MVP Estabilizando → Fase 2 (Multi-región)

---

## 2. STACK TECNOLÓGICO (CANON)

```
Frontend:  React 18 + Vite + TypeScript (strict)
Estilos:   CSS Variables (sistema HSL) + Framer Motion
Backend:   Supabase (Postgres + Auth + Storage + Edge Functions)
Auth:      Supabase Auth + JWT + RLS (Row Level Security)
IA:        OpenAI API (contratos y análisis jurisdiccional)
```

### ⚠️ IMPORTANTE — Backend Legacy (EN PROCESO DE ELIMINACIÓN):
Existe una carpeta `server/` con Express + Prisma + SQLite. **NO añadir código nuevo ahí.** Todo nuevo desarrollo va en Supabase. Esa carpeta está pendiente de eliminación.

---

## 3. ARQUITECTURA DE MÓDULOS

```
src/
├── core/                    # Servicios transversales
│   ├── supabase.ts          # Cliente Supabase (único punto de conexión)
│   ├── auth.service.ts      # Autenticación + sesión (localStorage)
│   ├── user.types.ts        # Tipos: User, UserRole, Permission
│   └── api.ts               # Cliente Axios (legacy, a deprecar)
│
├── modules/
│   ├── iam/                 # Identity & Access Management
│   │   ├── LoginView.tsx
│   │   ├── UserListView.tsx
│   │   ├── UserForm.tsx
│   │   └── user.service.ts
│   │
│   ├── dashboard/           # Vista 360 de salud legal
│   │   └── DashboardView.tsx
│   │
│   ├── documents/           # Centro de documentos legales
│   │   ├── DocumentListView.tsx
│   │   ├── DocumentForm.tsx
│   │   ├── DocumentAnalysisModal.tsx
│   │   ├── documents.service.ts    # CRUD → Supabase
│   │   ├── ai.service.ts           # Análisis IA de documentos
│   │   ├── openai.service.ts       # Integración OpenAI
│   │   ├── workflow.service.ts     # Flujo de aprobación
│   │   └── types.ts
│   │
│   ├── contracts/           # Gestión de contratos
│   │   ├── ContractListView.tsx
│   │   ├── ContractEditor.tsx      # Editor rich-text con Quill
│   │   ├── ContractForm.tsx
│   │   ├── ContractDetailsModal.tsx
│   │   ├── contract.service.ts     # CRUD → Supabase
│   │   └── types.ts
│   │
│   ├── compliance/          # Auditoría y riesgos
│   │   ├── ComplianceView.tsx
│   │   ├── ComplianceForm.tsx
│   │   ├── RiskMatrixView.tsx
│   │   ├── compliance.service.ts   # CRUD → Supabase
│   │   └── types.ts
│   │
│   ├── legal-team/          # Directorio de abogados
│   │   ├── LawyerListView.tsx
│   │   ├── LawyerForm.tsx
│   │   ├── LawyerDossierModal.tsx
│   │   ├── lawyers.service.ts      # CRUD → Supabase
│   │   └── types.ts
│   │
│   └── shared/              # Servicios compartidos
│       ├── audit.service.ts        # Logs de auditoría inmutables
│       └── i18n.service.ts         # Internacionalización (es/en)
│
└── ui/
    └── layouts/
        └── MainLayout.tsx   # Shell principal con navegación lateral
```

---

## 4. MODELO DE DATOS (Supabase / Postgres)

Ver `DATABASE_SCHEMA.md` para el esquema completo. Resumen:

| Tabla | Propósito |
|---|---|
| `organizations` | Multi-tenant: empresa suscrita |
| `profiles` | Usuarios del sistema, ligados a `auth.users` |
| `documents` | Metadatos de contratos y archivos legales |
| `document_analysis` | Resultados de análisis IA |
| `contracts` | Contratos con editor rich-text |
| `compliance_items` | Ítems de auditoría |
| `lawyers` | Directorio de abogados por organización |
| `audit_logs` | Trazabilidad inmutable de operaciones |

---

## 5. SISTEMA DE ROLES Y PERMISOS

Definido en `src/core/user.types.ts`:

| Rol | Descripción | Permisos Clave |
|---|---|---|
| `consultor_general` | Super-admin de la plataforma | Todo |
| `abogado_senior` | Abogado con permisos de aprobación | Ver todo, crear, editar, archivar, aprobar contratos |
| `abogado_junior` | Abogado inicial | Ver docs asignados, crear, editar |
| `consultor_principal` | Consultor externo con vista de lectura | Ver todo, ver auditoría parcial, exportar |
| `aprendiz` | Acceso mínimo | Solo ver docs asignados |

> Siempre usar `authService.hasPermission(user, 'nombre_permiso')` antes de renderizar acciones sensibles.

---

## 6. REGLAS DE CÓDIGO (OBLIGATORIAS)

1. **TypeScript estricto**: Sin `any` explícito. Usar tipos definidos en `types.ts` de cada módulo.
2. **Importaciones con extensión**: Siempre incluir `.ts` o `.tsx` en los imports (requerido por Vite).
3. **Datos → Supabase**: Todo acceso a datos usa el cliente de `src/core/supabase.ts`. NO usar `server/`.
4. **Estado de sesión → localStorage**: El usuario activo se guarda en `localStorage` bajo la clave `legal_user`.
5. **Auditoría**: Toda acción relevante (crear, modificar, cambiar estado) debe registrarse vía `audit.service.ts`.
6. **Multi-tenant**: Todas las queries a Supabase DEBEN incluir filtro por `organization_id` del usuario actual.
7. **Sin `console.log`** en producción. Usar errores tipados con `throw new Error(...)`.
8. **Estilos**: Usar las clases CSS del sistema de diseño en `src/assets/styles/global.css`. NO usar estilos inline arbitrarios.

---

## 7. VARIABLE DE ENTORNO REQUERIDAS

```env
VITE_SUPABASE_URL=https://[proyecto].supabase.co
VITE_SUPABASE_ANON_KEY=[anon-key]
```

---

## 8. CONTEXTO LEGAL Y DE NEGOCIO

Ver `BUSINESS_RULES.md` para reglas de negocio detalladas y `SKILLS/legal-compliance/SKILL.md` para el contexto legal venezolano.

---

## 9. SKILLS DISPONIBLES

Los siguientes skills amplían las capacidades del agente en áreas específicas:

| Skill | Ruta | Cuándo usar |
|---|---|---|
| Supabase Patterns | `SKILLS/supabase-patterns/SKILL.md` | DB, Auth, RLS, Edge Functions |
| Legal Compliance | `SKILLS/legal-compliance/SKILL.md` | Reglas de negocio legales venezolanas |
| React Components | `SKILLS/react-components/SKILL.md` | UI, componentes, diseño |
| Document Workflow | `SKILLS/document-workflow/SKILL.md` | Flujos de aprobación y estados |
| AI Integration | `SKILLS/ai-integration/SKILL.md` | OpenAI, análisis de contratos |
| **Testing** | `SKILLS/testing/SKILL.md` | **Antes de cualquier deploy o migración de BD** |

---

## 10. WORKFLOWS DISPONIBLES

| Workflow | Ruta | Descripción |
|---|---|---|
| Nuevo Módulo | `.agents/workflows/new_module.md` | Cómo crear un módulo completo |
| Migración BD | `.agents/workflows/database_migration.md` | Migraciones Supabase |
| Debug RLS | `.agents/workflows/debug_rls.md` | Depurar políticas de seguridad |
| Deploy Edge Function | `.agents/workflows/deploy_edge_function.md` | Desplegar lógica en Supabase |

---

## 11. PROBLEMAS CONOCIDOS Y DEUDA TÉCNICA

1. ~~**Bypass de seguridad activo**: `auth.service.ts` tenía password master `MasterLegal2026`.~~ ✅ **ELIMINADO 24/03/2026**
2. ~~**`organization_id` hardcodeado**: En auth, había un UUID hardcoded como fallback.~~ ✅ **ELIMINADO 24/03/2026**
3. **Double backend**: `server/` (Express+SQLite) y Supabase coexisten. Consolidar en Supabase.
4. **`README.md` desactualizado**: Es el template por defecto de Vite. Pendiente reemplazar.
5. **Usuarios de prueba en BD**: ✅ **ELIMINADOS 24/03/2026** (Carlos Mendoza, Ana Torrealba, Juan Perez)
6. **Datos limpios** ✅ (24/03/2026): BD lista para producción.

---

*Última actualización: 24/03/2026 | Mantenido por: Antigravity*
