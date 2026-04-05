---
description: Cómo crear un nuevo módulo completo en LegalDoc VE (servicio + tipos + vistas + formulario)
---

# Workflow: Crear Nuevo Módulo

Seguir estos pasos en orden para agregar un nuevo módulo al sistema. Ejemplo: `notifications`.

## Paso 1: Crear la estructura de carpetas y tipos

Crear `src/modules/[nombre-modulo]/types.ts`:

```typescript
// Define todos los tipos, enums y constantes del módulo
export type NombreStatus = 'ACTIVE' | 'INACTIVE';

export interface Nombre {
  id: string;
  // ... campos
  organization_id?: string;
  created_at: string;
  updated_at: string;
}
```

## Paso 2: Crear el servicio de datos

Crear `src/modules/[nombre-modulo]/nombre.service.ts`:

```typescript
import { supabase } from '../../core/supabase.ts';
import type { Nombre } from './types.ts';
import type { User } from '../../core/user.types.ts';

class NombreService {
  private TABLE = 'nombres'; // nombre de la tabla en Supabase

  async getAll(organizationId: string): Promise<Nombre[]> {
    const { data, error } = await supabase
      .from(this.TABLE)
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async create(payload: Omit<Nombre, 'id' | 'created_at' | 'updated_at'>, user: User): Promise<Nombre> {
    const { data, error } = await supabase
      .from(this.TABLE)
      .insert({
        ...payload,
        organization_id: user.organizationId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Registrar en auditoría
    await supabase.from('audit_logs').insert({
      action: 'created',
      entity_type: this.TABLE,
      entity_id: data.id,
      details: `Creado: ${data.id}`,
      user_id: user.id,
      organization_id: user.organizationId,
    });

    return data;
  }

  async update(id: string, payload: Partial<Nombre>, user: User): Promise<void> {
    const { error } = await supabase
      .from(this.TABLE)
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', user.organizationId);

    if (error) throw new Error(error.message);

    await supabase.from('audit_logs').insert({
      action: 'updated',
      entity_type: this.TABLE,
      entity_id: id,
      details: `Actualizado: ${id}`,
      user_id: user.id,
      organization_id: user.organizationId,
    });
  }

  async delete(id: string, user: User): Promise<void> {
    const { error } = await supabase
      .from(this.TABLE)
      .delete()
      .eq('id', id)
      .eq('organization_id', user.organizationId);

    if (error) throw new Error(error.message);
  }
}

export const nombreService = new NombreService();
```

## Paso 3: Crear la migración en Supabase

Usar el MCP de Supabase para crear la tabla:

```sql
CREATE TABLE nombres (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- campos del módulo
  organization_id UUID NOT NULL REFERENCES organizations(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE nombres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nombres_org_select" ON nombres
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "nombres_org_insert" ON nombres
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "nombres_org_update" ON nombres
  FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );
```

## Paso 4: Crear la vista de lista (NombreListView.tsx)

Seguir el patrón en `SKILLS/react-components/SKILL.md` sección 3.

## Paso 5: Crear el formulario (NombreForm.tsx)

Seguir el patrón en `SKILLS/react-components/SKILL.md` sección 4.

## Paso 6: Registrar la vista en App.tsx

```typescript
// 1. Importar el componente
import { NombreListView } from './modules/nombre-modulo/NombreListView.tsx';

// 2. Agregar al switch de vistas
case 'nombres':
  return <NombreListView />;
```

## Paso 7: Agregar al menú en MainLayout.tsx

```typescript
// Agregar en el array de items del menú lateral
{ id: 'nombres', label: 'Nombres', icon: '📋', permission: 'view_dashboard' }
```

## Paso 8: Actualizar AGENT.md y DATABASE_SCHEMA.md

Documentar el nuevo módulo en ambos archivos para mantener la documentación al día.
