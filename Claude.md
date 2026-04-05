# Sistema de Gestión Jurídica — LexManager

## Stack
- Frontend: React 18 + TypeScript + Tailwind CSS + Redux Toolkit + React Query
- Backend: Node.js + Express + TypeScript
- DB principal: PostgreSQL (datos) · MongoDB (audit logs) · Redis (sesiones/cache)
- Patrón: Multi-agente con Orquestador central

## Arquitectura de agentes
- OrchestratorAgent → único punto de entrada
- AuthAgent → JWT + RBAC + bcrypt (roles: admin, senior_lawyer, junior_lawyer, legal_director, intern)
- DocumentsAgent → CRUD + versioning + hash SHA-256 + full-text search (pg_trgm)
- AlertsAgent → cron diario, umbrales: 1/3/7/15/30/60/90 días
- ClientsAgent → empresas financieras + casos
- AuditAgent → MongoDB, log inmutable de todos los eventos

## Reglas de código
- TypeScript estricto, sin `any` explícito
- Cada agente hereda de BaseAgent y tiene su propio handle()
- Toda comunicación entre agentes va por EventBus, nunca llamadas directas
- Permisos siempre verificados por AuthAgent ANTES de ejecutar lógica
- AuditAgent siempre al FINAL de cada request

## Base de datos
- Schema en: sql/001_schema.sql
- Funciones en: sql/002_functions.sql
- Función RBAC: check_permission(rol, permiso)
- Búsqueda: search_documents() con pg_trgm

## Fase actual
Fase 1 MVP — construyendo: Auth + Documents + Alerts + Clients básico + Dashboard
```

---

**3. Flujo de trabajo con múltiples instancias paralelas**

Puedes correr múltiples instancias de Claude Code en paralelo en diferentes paneles mientras trabajen en partes distintas del código.  Para tu proyecto, la forma ideal es:

- **Panel izquierdo** → Claude trabajando en el `AuthAgent` o `DocumentsAgent`
- **Panel derecho** → Claude construyendo los componentes de React del frontend
- Usa `/clear` cada vez que cambies de agente o módulo para no desperdiciar contexto

La recomendación es usar `/clear` seguido cada vez que empiezas algo nuevo — el historial viejo consume tokens innecesariamente. 

Y para **cambiar a Opus** cuando necesites razonar sobre arquitectura compleja:
```
/model claude-opus-4-6