# 🛡️ SECURITY_RLS_DEEP_DIVE.md — Guía de Seguridad y Row Level Security (RLS)

> **Documento de Máxima Seguridad para Ingenieros de DevOps y Backend.** Establece la arquitectura de aislamiento de datos en Supabase para LegalDoc VE.

---

## 1. PRINCIPIO DE AISLAMIENTO TOTAL (TENANCY)

LegalDoc VE es una plataforma **SaaS Multi-Tenant**. Cada cliente (organización) maneja documentos legales altamente confidenciales. Bajo ninguna circunstancia un usuario de la `Org_A` debe poder ver datos de la `Org_B`.

### Implementación Core:
- Cada tabla en la base de datos (Postgres) DEBE incluir una columna `organization_id (uuid)`.
- RLS en Supabase es el guardián físico de estos datos, actuando a nivel de motor de base de datos (`kernel`), no solo en la App.

---

## 2. POLÍTICAS RLS ESTÁNDAR (DML)

Para cada tabla del sistema (`documents`, `contracts`, `compliance_items`, etc.), se deben aplicar las siguientes políticas de Postgres:

### SELECT (Lectura)
```sql
CREATE POLICY "Users can only read documents from their organization" 
ON documents 
FOR SELECT 
USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
```

### INSERT / UPDATE (Escritura)
- El usuario debe pertenecer a la organización de destino.
- El rol del usuario debe tener el permiso correspondiente (ej. `abogado_junior` para editar contratos asignados).

---

## 3. SEGURIDAD DE ROLES Y PERMISOS (RBAC)

No basta con el aislamiento por organización. Se debe cumplir la jerarquía de roles definida en `AGENT.md`:

| Rol | Restricción RLS Adicional |
|---|---|
| **consultor_general** | `USING (organization_id = profile.org)` |
| **abogado_senior** | Acceso total dentro de la organización |
| **abogado_junior** | Restricción opcional a solo documentos donde el usuario sea co-autor o el abogado asignado. |

---

## 4. AUDITORIA DE SEGURIDAD (PEN-TESTING INTERNO)

Periódicamente, el equipo de ingeniería debe ejecutar el workflow `.agents/workflows/debug_rls.md` para:
1. Intentar acceder a un UUID de otra organización.
2. Comprobar que el motor de Supabase devuelve **Empty Set** (Error 404 o lista vacía) y no error de permisos (para evitar enumeración de recursos).
3. Validar que las **Edge Functions** también hereden el contexto del usuario autenticado vía el `Authorization: Bearer [JWT]`.

---

## 5. SEGURIDAD DE ARCHIVOS (STORAGE)

Las políticas RLS también se aplican a los buckets de **Supabase Storage**:
- Los PDFs de contratos solo son legibles si el `path` del archivo coincide con `organization_id`.
- Se prefieren URLs firmadas con expiración corta (5-15 min) para evitar exposición de enlaces públicos.

---

*Última actualización: 28/03/2026 | Arquitecto responsable: Antigravity*
