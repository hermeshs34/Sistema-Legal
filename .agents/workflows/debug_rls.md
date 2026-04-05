---
description: Cómo diagnosticar y resolver problemas de Row Level Security (RLS) en Supabase para LegalDoc VE
---

# Workflow: Debug de Políticas RLS

Cuando una query devuelve datos vacíos sin error, o lanza `violates row-level security policy`, seguir este workflow.

## Síntomas comunes

- Query devuelve `[]` o `null` sin error cuando debería devolver datos
- Error: `new row violates row-level security policy for table "X"`
- Error: `permission denied for table X`
- Los datos existen en Supabase Dashboard pero no llegan al frontend

## Paso 1: Confirmar que el problema es RLS

```sql
-- Ejecutar en SQL Editor de Supabase (bypasea RLS):
SELECT * FROM [tabla_problema] LIMIT 5;
```

Si devuelve datos aquí pero no en el frontend → Definitivamente es RLS.

## Paso 2: Verificar el estado de RLS en la tabla

```sql
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = '[tabla_problema]';
```

- `rowsecurity = true` → RLS activo
- `rowsecurity = false` → RLS desactivado (cualquiera puede leer, no debería ocurrir)

## Paso 3: Listar todas las policies existentes

```sql
SELECT 
  policyname,
  cmd,        -- SELECT, INSERT, UPDATE, DELETE, ALL
  qual,       -- condición USING
  with_check  -- condición WITH CHECK
FROM pg_policies
WHERE tablename = '[tabla_problema]';
```

## Paso 4: Simular qué ve el usuario actual

```sql
-- Verificar qué UID tiene el usuario autenticado
SELECT auth.uid();

-- Verificar el organization_id del perfil activo
SELECT organization_id FROM profiles WHERE id = auth.uid();

-- Simular la query con RLS activo (como el usuario)
SET local role authenticated;
SET local "request.jwt.claims" = '{"sub": "[USER_ID]"}';
SELECT * FROM [tabla_problema];
```

## Paso 5: Diagnóstico de causa raíz

### Causa A: No hay policies (tabla creada sin RLS)
```sql
-- Solución: Crear las policies necesarias
CREATE POLICY "[tabla]_select" ON [tabla]
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );
```

### Causa B: El `organization_id` del registro no coincide con el del usuario
```sql
-- Verificar el organization_id de los registros
SELECT id, organization_id FROM [tabla] LIMIT 10;

-- Verificar el organization_id del usuario actual
SELECT organization_id FROM profiles WHERE id = '[USER_ID]';
```

Si no coinciden → El INSERT original no incluyó `organization_id` correctamente.

### Causa C: El usuario no tiene perfil en la tabla `profiles`
```sql
SELECT * FROM profiles WHERE id = auth.uid();
```

Si no existe → Crear el perfil o sincronizar con `auth.users`.

### Causa D: Policy mal escrita
```sql
-- Policy incorrecta (referencia circular):
USING (organization_id = auth.uid())  -- ❌ compara org_id con user_id

-- Policy correcta:
USING (
  organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
)  -- ✅
```

### Causa E: RLS no habilitado en la tabla
```sql
ALTER TABLE [tabla] ENABLE ROW LEVEL SECURITY;
```

## Paso 6: Corrección y verificación

### Recrear policies problemáticas:
```sql
-- Eliminar policy incorrecta
DROP POLICY IF EXISTS "[nombre_policy]" ON [tabla];

-- Crear policy correcta
CREATE POLICY "[tabla]_select" ON [tabla]
  FOR SELECT USING (
    organization_id = (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
```

### Verificar corrección:
```sql
-- Después de corregir, volver a verificar
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = '[tabla]';
```

## Paso 7: Verificar en el frontend

En el servicio TypeScript correspondiente, verificar que:

```typescript
// ✅ Correcto: incluir organization_id en el filtro
const { data } = await supabase
  .from('tabla')
  .select('*')
  .eq('organization_id', user.organizationId);  // seguridad extra

// ❌ Incorrecto: confiar solo en RLS sin filtro explícito
const { data } = await supabase.from('tabla').select('*');
```

## Paso 8: Revisar advisors de seguridad

```
mcp_supabase-mcp-server_get_advisors
  project_id: [ID]
  type: security
```

Cualquier tabla marcada como "RLS disabled" en advisors → riesgo crítico.

## Referencia rápida de errores

| Mensaje | Causa | Acción |
|---|---|---|
| `row-level security policy violation` | No existe policy de INSERT/UPDATE | Crear policy WITH CHECK |
| `permission denied` | RLS activo sin policies, o policy demasiado restrictiva | Revisar pg_policies |
| `PGRST301` (JWT expired) | Token expirado | `supabase.auth.refreshSession()` |
| Datos vacíos, sin error | Policy SELECT muy restrictiva | Pasos 2-5 de este workflow |
