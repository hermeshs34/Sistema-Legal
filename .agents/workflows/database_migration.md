---
description: Cómo aplicar migraciones de base de datos en Supabase (LegalDoc VE) de forma segura
---

# Workflow: Migración de Base de Datos (Supabase)

Este workflow aplica cambios al esquema de la base de datos de forma segura y documentada.

## Reglas generales

- **DDL** (CREATE TABLE, ALTER TABLE, CREATE POLICY) → usar `apply_migration`
- **DML** (INSERT, UPDATE con datos) → usar `execute_sql`
- **Siempre** actualizar `DATABASE_SCHEMA.md` después de cada migración
- **Siempre** hacer las policies RLS después de crear cada tabla

## Paso 1: Identificar el proyecto Supabase

Usar el MCP para obtener el ID del proyecto:
```
mcp_supabase-mcp-server_list_projects
```

## Paso 2: Revisar migraciones existentes

Antes de cualquier cambio, revisar el historial:
```
mcp_supabase-mcp-server_list_migrations
  project_id: [ID]
```

## Paso 3: Preparar el SQL de migración

Escribir el SQL completo. Checklist obligatorio:

```sql
-- ✅ 1. Crear la tabla
CREATE TABLE IF NOT EXISTS [nombre_tabla] (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- campos...
  organization_id UUID NOT NULL REFERENCES organizations(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ✅ 2. Habilitar RLS (SIEMPRE)
ALTER TABLE [nombre_tabla] ENABLE ROW LEVEL SECURITY;

-- ✅ 3. Policy de SELECT
CREATE POLICY "[nombre_tabla]_select" ON [nombre_tabla]
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- ✅ 4. Policy de INSERT
CREATE POLICY "[nombre_tabla]_insert" ON [nombre_tabla]
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- ✅ 5. Policy de UPDATE
CREATE POLICY "[nombre_tabla]_update" ON [nombre_tabla]
  FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- ✅ 6. Índices importantes
CREATE INDEX IF NOT EXISTS idx_[nombre_tabla]_org 
  ON [nombre_tabla](organization_id);
```

## Paso 4: Aplicar la migración

```
mcp_supabase-mcp-server_apply_migration
  project_id: [ID]
  name: add_[nombre_tabla]_table
  query: [SQL completo del paso 3]
```

## Paso 5: Verificar la migración

```
mcp_supabase-mcp-server_execute_sql
  project_id: [ID]
  query: SELECT table_name FROM information_schema.tables 
         WHERE table_schema = 'public' 
         AND table_name = '[nombre_tabla]';
```

## Paso 6: Verificar policies RLS

```
mcp_supabase-mcp-server_execute_sql
  project_id: [ID]
  query: SELECT policyname, cmd, qual 
         FROM pg_policies 
         WHERE tablename = '[nombre_tabla]';
```

## Paso 7: Revisar advisors de seguridad

Después de cualquier migración DDL:
```
mcp_supabase-mcp-server_get_advisors
  project_id: [ID]
  type: security
```

Resolver cualquier alerta de seguridad antes de continuar.

## Paso 8: Actualizar DATABASE_SCHEMA.md

Agregar la nueva tabla al archivo `DATABASE_SCHEMA.md` con:
- Definición SQL
- Descripción del propósito
- Policies RLS aplicadas

## Errores comunes

| Error | Causa | Solución |
|---|---|---|
| `relation already exists` | Tabla ya creada | Usar `CREATE TABLE IF NOT EXISTS` |
| `policy already exists` | Policy duplicada | Usar `DROP POLICY IF EXISTS` antes |
| `foreign key violation` | Referencia a tabla inexistente | Verificar orden de creación de tablas |
| `permission denied` | RLS bloqueando | Revisar policies con `pg_policies` |
