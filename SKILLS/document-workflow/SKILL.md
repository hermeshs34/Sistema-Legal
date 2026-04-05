---
name: document-workflow
description: Ciclo de vida y flujos de aprobación de documentos y contratos en LegalDoc VE. Cubre estados, transiciones válidas, reglas de negocio de workflow, y cómo implementar cambios de estado correctamente con auditoría.
---

# Skill: Document Workflow — LegalDoc VE

## 1. CICLO DE VIDA DE UN DOCUMENTO

```
                    ┌──────────────┐
                    │    DRAFT     │ ← Estado inicial al crear
                    └──────┬───────┘
                           │ (cualquier usuario con edit_doc)
                           ▼
                    ┌──────────────┐
                    │  IN_REVIEW   │ ← Enviado para revisión
                    └──────┬───────┘
                           │ (approve_contracts)
                    ┌──────┴───────┐
                    │              │
                    ▼              ▼
             ┌──────────┐   ┌──────────┐
             │ APPROVED │   │REJECTED* │ ← Vuelve a DRAFT
             └────┬─────┘   └──────────┘
                  │ (abogado_senior / consultor_general)
                  ▼
            ┌───────────┐
            │ PUBLISHED │ ← Inmutable
            └───────────┘
                  │
        ┌────────►│◄────────┐
        │         │         │
   ARCHIVED    ARCHIVED   EXPIRED
  (manual)     (manual)  (automático)
```

> *REJECTED no es un estado propio; el documento vuelve a DRAFT con comentario en el audit_log.

---

## 2. TRANSICIONES DE ESTADO — IMPLEMENTACIÓN

### Función genérica de cambio de estado:
```typescript
// En documents.service.ts
async changeStatus(
  documentId: string,
  newStatus: DocumentStatus,
  user: User,
  notes?: string
): Promise<void> {
  // 1. Obtener estado actual
  const { data: doc } = await supabase
    .from('documents')
    .select('status, title')
    .eq('id', documentId)
    .single();

  if (!doc) throw new Error('Documento no encontrado');

  // 2. Validar transición permitida
  const validTransitions: Record<DocumentStatus, DocumentStatus[]> = {
    'draft':      ['in_review', 'archived'],
    'in_review':  ['approved', 'draft', 'archived'],    // draft = rechazo
    'approved':   ['published', 'archived'],
    'published':  ['archived'],
    'archived':   [],  // estado final
    'expired':    ['archived'],
  };

  if (!validTransitions[doc.status]?.includes(newStatus)) {
    throw new Error(
      `Transición no válida: ${doc.status} → ${newStatus}`
    );
  }

  // 3. Verificar permisos según la transición
  if (newStatus === 'approved' || newStatus === 'published') {
    if (!authService.hasPermission(user, 'approve_contracts')) {
      throw new Error('Sin permisos para aprobar documentos');
    }
  }

  // 4. Actualizar estado
  const { error } = await supabase
    .from('documents')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .eq('organization_id', user.organizationId);

  if (error) throw new Error(error.message);

  // 5. Registrar en auditoría (SIEMPRE)
  await supabase.from('audit_logs').insert({
    action: 'status_change',
    entity_type: 'document',
    entity_id: documentId,
    details: `"${doc.title}": ${doc.status} → ${newStatus}${notes ? `. Nota: ${notes}` : ''}`,
    user_id: user.id,
    organization_id: user.organizationId,
  });
}
```

---

## 3. CICLO DE VIDA DE UN CONTRATO

```
DRAFT → REVIEW → ACTIVE → EXPIRED (automático por end_date)
                         → TERMINATED (rescisión manual)
  ↑ CANCELLED ← DRAFT o REVIEW (solo antes de activarse)
```

### Diferencias clave vs Documento:
| Aspecto | Documento | Contrato |
|---|---|---|
| Estado inicial | `draft` (minúscula) | `DRAFT` (mayúscula) |
| Tiene valor monetario | No | Sí (`value` + `currency`) |
| Tiene partes | No | Sí (`parties[]`) |
| Tiene fechas | Solo vencimiento | `start_date` + `end_date` |
| Auto-renovación | No | Sí (`auto_renewal: boolean`) |
| Editor rich-text | No | Sí (Quill en `content_draft`) |

---

## 4. FLUJO DE APROBACIÓN MULTI-PASO (FUTURO)

Para contratos de alto valor (> $10,000 USD), el roadmap define:

```
Abogado Junior / Abogado Senior
    │ crea contrato
    ▼
[IN_REVIEW]
    │ Abogado Senior aprueba primera instancia
    ▼
[PENDING_DIRECTOR_APPROVAL]    ← A implementar en Fase 3
    │ Consultor General / Director aprueba
    ▼
[APPROVED] → [ACTIVE]
```

> Para implementar esto, se necesita una tabla `workflow_steps` o un campo `approval_chain` en `contracts`.

---

## 5. EXPIRACIÓN AUTOMÁTICA

Los documentos y contratos con `expiration_date` o `end_date` en el pasado deben marcarse como `expired`/`EXPIRED`.

### Opciones de implementación:
1. **Edge Function programada** (recomendado): Cron diario que actualiza estados
2. **Query al cargar**: Verificar en el servicio y actualizar si expired
3. **Database trigger**: PostgreSQL trigger en Supabase

### Ejemplo de Edge Function para expiración:
```typescript
// Actualizar documentos expirados
const { error } = await supabase
  .from('documents')
  .update({ status: 'expired' })
  .lt('metadata->>expiration_date', new Date().toISOString())
  .in('status', ['published', 'approved']);
```

---

## 6. ESTADOS EN LA UI — VISUALIZACIÓN

### Mapeo de estados a colores/badges:
```typescript
export const STATUS_CONFIG = {
  // Documentos
  draft:      { label: 'Borrador',      class: 'status-draft',     icon: '📝' },
  in_review:  { label: 'En Revisión',   class: 'status-in-review', icon: '🔍' },
  approved:   { label: 'Aprobado',      class: 'status-approved',  icon: '✅' },
  published:  { label: 'Publicado',     class: 'status-published', icon: '🌐' },
  archived:   { label: 'Archivado',     class: 'status-archived',  icon: '📦' },
  expired:    { label: 'Vencido',       class: 'status-expired',   icon: '⏰' },

  // Contratos
  DRAFT:      { label: 'Borrador',      class: 'status-draft',     icon: '📝' },
  REVIEW:     { label: 'En Revisión',   class: 'status-in-review', icon: '🔍' },
  ACTIVE:     { label: 'Activo',        class: 'status-approved',  icon: '✅' },
  EXPIRED:    { label: 'Vencido',       class: 'status-expired',   icon: '⏰' },
  TERMINATED: { label: 'Terminado',     class: 'status-archived',  icon: '🚫' },
  CANCELLED:  { label: 'Cancelado',     class: 'status-archived',  icon: '❌' },
};
```

---

## 7. AUDIT LOG — FORMATO ESTÁNDAR

Todo cambio de estado DEBE generar un registro. El formato del campo `details` debe ser legible:

```
"[Título del documento]": [estado_anterior] → [estado_nuevo]. [Notas opcionales]

Ejemplos:
"Contrato Marco ABC Corp": DRAFT → REVIEW
"Política de Privacidad v2.1": in_review → approved. Revisado por Dirección Legal
"NDA Acuerdo XYZ": published → archived. Documento sustituido por versión 2.0
```

---

*Última actualización: 21/03/2026*
