---
name: supabase-patterns
description: Patrones y mejores prácticas para trabajar con Supabase en el proyecto LegalDoc VE. Cubre autenticación, Row Level Security (RLS), Edge Functions, Storage y consultas Postgres.
---

# Skill: Supabase Patterns para LegalDoc VE

## 1. CLIENTE SUPABASE

El cliente único está en `src/core/supabase.ts`. **Siempre importar de ahí, nunca crear un nuevo cliente.**

```typescript
import { supabase } from '../../core/supabase.ts';
```

---

## 2. ESTRUCTURA DE QUERIES ESTÁNDAR

### SELECT con filtro de organización (SIEMPRE incluirlo):
```typescript
const { data, error } = await supabase
  .from('documents')
  .select('*')
  .eq('organization_id', user.organizationId)
  .order('created_at', { ascending: false });

if (error) throw new Error(`Error al cargar documentos: ${error.message}`);
```

### INSERT con audit log:
```typescript
// 1. Insertar el dato
const { data: newDoc, error } = await supabase
  .from('documents')
  .insert({
    title,
    type,
    status: 'draft',
    organization_id: user.organizationId,
    created_at: new Date().toISOString(),
  })
  .select()
  .single();

if (error) throw new Error(error.message);

// 2. Registrar en auditoría (OBLIGATORIO)
await supabase.from('audit_logs').insert({
  action: 'created',
  entity_type: 'document',
  entity_id: newDoc.id,
  details: `Documento "${title}" creado`,
  user_id: user.id,
  organization_id: user.organizationId,
});
```

### UPDATE con validación de organización:
```typescript
const { error } = await supabase
  .from('documents')
  .update({ status: newStatus, updated_at: new Date().toISOString() })
  .eq('id', documentId)
  .eq('organization_id', user.organizationId); // Seguridad extra

if (error) throw new Error(error.message);
```

---

## 3. ROW LEVEL SECURITY (RLS)

### Patrón de policy estándar para multi-tenant:
```sql
-- Política de SELECT: solo ver datos de la propia organización
CREATE POLICY "[tabla]_org_select" ON [tabla]
  FOR SELECT
  USING (
    organization_id = (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid()
    )
  );

-- Política de INSERT: solo insertar en la propia organización
CREATE POLICY "[tabla]_org_insert" ON [tabla]
  FOR INSERT
  WITH CHECK (
    organization_id = (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid()
    )
  );
```

### Debugging de RLS (cuando una query devuelve vacío sin error):
1. Verificar que RLS esté habilitado: `ALTER TABLE [tabla] ENABLE ROW LEVEL SECURITY;`
2. Verificar el `auth.uid()` con: `SELECT auth.uid();` en SQL Editor
3. Verificar el `organization_id` del perfil activo
4. Usar el **Supabase Dashboard → Table Editor** para ver datos sin RLS
5. Referir al workflow `.agents/workflows/debug_rls.md`

---

## 4. AUTENTICACIÓN

### Verificar sesión activa:
```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) { /* redirigir al login */ }
```

### Listener de cambios de sesión (solo en componente raíz):
```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (event === 'SIGNED_OUT') setUser(null);
    }
  );
  return () => subscription.unsubscribe();
}, []);
```

### ⚠️ Bypass de emergencia (PENDIENTE ELIMINAR):
El `auth.service.ts` tiene un bypass con password `MasterLegal2026`. **No depender de esto. Usar Supabase Auth real.**

---

## 5. SUPABASE STORAGE

### Subir un archivo (PDF de contrato):
```typescript
const filePath = `${user.organizationId}/contracts/${contractId}/${file.name}`;

const { error: uploadError } = await supabase.storage
  .from('legal-documents')  // nombre del bucket
  .upload(filePath, file, {
    cacheControl: '3600',
    upsert: false
  });

if (uploadError) throw new Error(uploadError.message);

// Obtener URL pública (si el bucket es público) o URL firmada
const { data: urlData } = supabase.storage
  .from('legal-documents')
  .getPublicUrl(filePath);

const fileUrl = urlData.publicUrl;
```

### Convención de rutas en Storage:
```
legal-documents/
└── {organization_id}/
    ├── documents/
    │   └── {document_id}/{filename}.pdf
    └── contracts/
        └── {contract_id}/{filename}.pdf
```

---

## 6. EDGE FUNCTIONS

### Estructura básica de una Edge Function (Deno):
```typescript
// supabase/functions/[nombre-función]/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // Service role para bypasear RLS
    );

    const { data } = await req.json();
    
    // Lógica aquí...
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
```

### Edge Functions planeadas para LegalDoc VE:
- `update-exchange-rates`: Actualiza tasas BCV diariamente
- `send-compliance-alerts`: Notificaciones de vencimiento
- `analyze-document`: Proxy hacia OpenAI con validación

---

## 7. ERRORES COMUNES Y SOLUCIONES

| Error | Causa probable | Solución |
|---|---|---|
| `PGRST116` (row not found) | Query con `.single()` sin resultado | Usar `.maybeSingle()` |
| Data vacía sin error | RLS bloqueando | Ver sección 3 de debugging |
| `JWT expired` | Token vencido | `supabase.auth.refreshSession()` |
| `Storage: Object not found` | Ruta incorrecta | Verificar convención de rutas |
| `violates row-level security` | INSERT sin organization_id o policy faltante | Agregar `organization_id` al payload |

---

## 8. MIGRACIONES

Usar el MCP de Supabase para aplicar migraciones DDL:
```
mcp_supabase-mcp-server_apply_migration
  project_id: [ID del proyecto]
  name: [nombre_en_snake_case]
  query: [SQL DDL]
```

Para DML (insertar datos), usar `execute_sql`.

---

*Última actualización: 21/03/2026*
