# LegalDoc VE — Plataforma Enterprise de Compliance Legal

> **Plataforma SaaS** para la gestión de compliance normativo, honorarios y contratos legales en Venezuela y mercados internacionales. Powered by React 19, Supabase y OpenAI.

---

## 🎯 ¿Qué es LegalDoc VE?

LegalDoc VE automatiza el cumplimiento regulatorio empresarial mediante:
- **Gestión centralizada** de contratos y documentos legales
- **Matriz de riesgos** legal con categorización por área (LOTTT, SENIAT, SUNDEA, etc.)
- **Análisis IA** de contratos y documentos con detección de riesgos
- **Flujos de aprobación** con auditoría inmutable
- **Multi-organización**: Cada empresa tiene su espacio de datos completamente aislado

---

## 📋 Documentación para Agentes IA

> Si eres un agente IA trabajando en este proyecto, empieza aquí:

| Documento | Propósito |
|---|---|
| [`AGENT.md`](./AGENT.md) | **← Leer primero.** Instrucciones maestras, stack, módulos y reglas |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Diagramas técnicos, flujos de datos, sistema de diseño |
| [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) | Esquema completo de Supabase con todas las tablas y policies RLS |
| [`BUSINESS_RULES.md`](./BUSINESS_RULES.md) | Reglas de negocio: roles, estados, compliance venezolano |

### Skills disponibles:
| Skill | Cuándo usarlo |
|---|---|
| [`SKILLS/supabase-patterns/`](./SKILLS/supabase-patterns/SKILL.md) | Queries, RLS, Auth, Storage, Edge Functions |
| [`SKILLS/legal-compliance/`](./SKILLS/legal-compliance/SKILL.md) | Marco legal venezolano, INPREABOGADO, calendarios |
| [`SKILLS/react-components/`](./SKILLS/react-components/SKILL.md) | Componentes, diseño HSL, Framer Motion |
| [`SKILLS/document-workflow/`](./SKILLS/document-workflow/SKILL.md) | Ciclos de vida, aprobaciones, auditoría |
| [`SKILLS/ai-integration/`](./SKILLS/ai-integration/SKILL.md) | OpenAI, prompts legales, Edge Functions IA |

### Workflows disponibles:
| Workflow | Descripción |
|---|---|
| [`.agents/workflows/new_module.md`](./.agents/workflows/new_module.md) | Crear un nuevo módulo completo |
| [`.agents/workflows/database_migration.md`](./.agents/workflows/database_migration.md) | Migraciones seguras en Supabase |
| [`.agents/workflows/debug_rls.md`](./.agents/workflows/debug_rls.md) | Depurar políticas de seguridad RLS |
| [`.agents/workflows/deploy_edge_function.md`](./.agents/workflows/deploy_edge_function.md) | Desplegar Edge Functions |

---

## 🏗️ Stack Tecnológico

```
Frontend:  React 19 + Vite 7 + TypeScript (strict)
Estilos:   CSS Variables HSL + Framer Motion (animaciones)
Backend:   Supabase (Postgres + Auth + Storage + Edge Functions)
IA:        OpenAI API (análisis de contratos y compliance)
Reportes:  jsPDF + jsPDF-AutoTable (PDFs certificados)
Gráficos:  Recharts (Dashboard y métricas financieras)
```

---

## 📦 Módulos del Sistema

| Módulo | Ruta | Descripción |
|---|---|---|
| Dashboard | `/dashboard` | Vista 360 de salud legal de la empresa |
| Documentos | `/documents` | Centro de documentos con análisis IA |
| Contratos | `/contracts` | Editor rich-text, firma electrónica, visor PDF seguro |
| Compliance | `/compliance` | Auditoría, ítems de cumplimiento |
| Matriz de Riesgos | `/risks` | Visualización de riesgos por área |
| Equipo Legal | `/lawyers` | Directorio de abogados con INPREABOGADO |
| Expedientes | `/judicial` | Gestión de expedientes judiciales, actuaciones y audiencias |
| Honorarios | `/honorarios` | Facturación, time tracking, gastos y sistema multi-moneda (USD/EUR/VES) |
| Calendario | `/calendar` | Agenda legal con eventos y audiencias |
| Parámetros | `/parameters` | Configuración del sistema y tasas de cambio |
| Usuarios | `/users` | IAM: gestión de usuarios y roles |

---

## 🚀 Inicio Rápido

### Prerrequisitos:
- Node.js >= 18
- npm >= 9
- Cuenta en [Supabase](https://supabase.com)

### Instalación:
```bash
# Instalar dependencias del frontend
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Supabase

# Iniciar servidor de desarrollo
npm run dev
```

### Variables de entorno requeridas:
```env
VITE_SUPABASE_URL=https://[tu-proyecto].supabase.co
VITE_SUPABASE_ANON_KEY=[tu-anon-key]
```

---

## 👥 Roles de Usuario

| Rol | Descripción |
|---|---|
| `consultor_general` | Administrador con acceso total |
| `abogado_senior` | Puede aprobar contratos y ver todo |
| `abogado_junior` | Puede crear y editar sus documentos |
| `consultor_principal` | Lectura y exportación únicamente |
| `aprendiz` | Solo ve documentos asignados |

---

## 📅 Roadmap

Ver [`ROADMAP_EVOLUTION.md`](./ROADMAP_EVOLUTION.md) para el plan de evolución completo.

**Fase actual:** MVP Estabilización → Multi-región

---

*LegalDoc VE — Construido con Antigravity AI*
