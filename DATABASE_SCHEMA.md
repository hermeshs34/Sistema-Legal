# 🗄️ DATABASE_SCHEMA.md — Esquema de Base de Datos: LegalDoc VE

> Base de datos: **Supabase (PostgreSQL)**  
> Multi-tenant: Todas las tablas de negocio incluyen `organization_id`.

---

## TABLA: `organizations`

```sql
CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  rif             TEXT,                    -- RIF venezolano (J-XXXXXXXX-X)
  legal_name      TEXT,
  address         TEXT,
  logo_url        TEXT,
  currency        TEXT DEFAULT 'VES',      -- 'VES' | 'USD' | 'EUR'
  legal_region    TEXT DEFAULT 'VE',       -- 'VE' | 'ES' | 'US' | etc.
  subscription    TEXT DEFAULT 'basic',    -- 'basic' | 'pro' | 'enterprise'
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

---

## TABLA: `profiles`

> Extiende `auth.users` de Supabase Auth. El `id` coincide con `auth.users.id`.

```sql
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  name            TEXT NOT NULL,
  avatar_url      TEXT,
  role            TEXT NOT NULL DEFAULT 'aprendiz',
  -- Roles: consultor_general | abogado_senior | abogado_junior | 
  --        consultor_principal | aprendiz
  is_active       BOOLEAN DEFAULT true,
  organization_id UUID REFERENCES organizations(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

**RLS Policy:**
```sql
-- Los usuarios solo pueden ver perfiles de su organización
CREATE POLICY "profiles_org_isolation" ON profiles
  USING (organization_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));
```

---

## TABLA: `documents`

```sql
CREATE TABLE documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  description      TEXT,
  type             TEXT NOT NULL,
  -- Tipos: 'contract' | 'policy' | 'regulatory' | 
  --        'evidence' | 'legal_opinion' | 'other'
  status           TEXT NOT NULL DEFAULT 'draft',
  -- Estados: 'draft' | 'in_review' | 'approved' | 
  --          'published' | 'archived' | 'expired'
  risk_level       TEXT NOT NULL DEFAULT 'low',
  -- Niveles: 'low' | 'medium' | 'high' | 'critical'
  version          TEXT DEFAULT '1.0',
  region           TEXT DEFAULT 'nacional',   -- 'nacional' | 'internacional'
  
  -- Metadata legal
  regulatory_body  TEXT,
  expiration_date  DATE,
  jurisdiction     TEXT,
  linked_entity    TEXT,   -- Cliente, contraparte, etc.
  tags             TEXT[],  -- Array de etiquetas
  
  -- Firma
  signature_status TEXT DEFAULT 'pending',
  -- Estados: 'pending' | 'signed_digitally' | 'notarized' | 'apostilled'
  
  -- Relaciones
  assigned_to      UUID REFERENCES profiles(id),
  organization_id  UUID NOT NULL REFERENCES organizations(id),
  file_url         TEXT,   -- URL en Supabase Storage
  
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
```

---

## TABLA: `document_analysis`

> Resultados del análisis IA (OpenAI) sobre un documento.

```sql
CREATE TABLE document_analysis (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  summary         TEXT,           -- Resumen ejecutivo generado por IA
  risks           JSONB,          -- Array de riesgos detectados
  suggestions     JSONB,          -- Sugerencias de la IA
  jurisdiction    TEXT,           -- Jurisdicción identificada
  applicable_laws TEXT[],         -- Leyes aplicables detectadas
  confidence      NUMERIC(3,2),   -- Score de confianza 0.00-1.00
  model_used      TEXT,           -- 'gpt-4o' | 'gpt-4o-mini'
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

---

## TABLA: `contracts`

```sql
CREATE TABLE contracts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  type              TEXT NOT NULL,
  -- Tipos: 'SERVICE' | 'EMPLOYMENT' | 'NDA' | 
  --        'LEASE' | 'PARTNERSHIP' | 'OTHER'
  status            TEXT NOT NULL DEFAULT 'DRAFT',
  -- Estados: 'DRAFT' | 'REVIEW' | 'ACTIVE' | 
  --          'EXPIRED' | 'TERMINATED' | 'CANCELLED'
  parties           TEXT[],           -- Array de partes involucradas
  start_date        DATE,
  end_date          DATE,
  value             NUMERIC(15,2),
  currency          TEXT DEFAULT 'VES', -- 'VES' | 'USD' | 'EUR'
  description       TEXT,
  content_draft     TEXT,             -- Contenido rich-text (HTML de Quill)
  file_url          TEXT,             -- PDF adjunto en Supabase Storage
  analysis_id       UUID REFERENCES document_analysis(id),
  document_id       TEXT,             -- ID del documento fuente en tabla `documents` (vínculo entre módulos)
  
  -- Firma Electrónica (LDFE Venezuela / eIDAS)
  signature_status  TEXT NOT NULL DEFAULT 'unsigned',
  -- Estados: 'unsigned' | 'pending' | 'signed_basic' | 'signed_advanced'
  signature_hash    TEXT,           -- Huella Digital SHA-256 del contenido
  signature_token   TEXT,           -- Token único de verificación
  signed_at         TIMESTAMPTZ,    -- Estampa de tiempo certificada
  signed_by_name    TEXT,           -- Nombre del signatario
  signed_by_email   TEXT,           -- Email del signatario
  
  -- Metadata y Evidencia Forense
  metadata          JSONB,          
  -- Estructura: {
  --   urgent: boolean, 
  --   autoRenewal: boolean, 
  --   confidential: boolean,
  --   has_biometric: boolean,
  --   biometric_photo: string (Base64), -- Evidencia visual sellada
  --   biometric_timestamp: string
  -- }
  
  -- Relaciones
  assigned_lawyer_id UUID REFERENCES lawyers(id),
  organization_id    UUID NOT NULL REFERENCES organizations(id),
  
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
```

---

## TABLA: `compliance_items`

```sql
CREATE TABLE compliance_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              TEXT NOT NULL,
  area               TEXT NOT NULL,
  -- Áreas: 'LEGAL' | 'TAX' | 'LABOR' | 
  --        'REGULATORY' | 'ENVIRONMENTAL' | 'OPERATIONAL'
  description        TEXT,
  status             TEXT NOT NULL DEFAULT 'PENDING',
  -- Estados: 'COMPLIANT' | 'NON_COMPLIANT' | 
  --          'PARTIAL' | 'PENDING' | 'EXPIRED'
  risk_level         TEXT NOT NULL DEFAULT 'LOW',
  -- Niveles: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  last_assessment    TIMESTAMPTZ,
  next_review        TIMESTAMPTZ,
  observations       TEXT,
  
  -- Relaciones
  assigned_lawyer_id UUID REFERENCES lawyers(id),
  linked_document_id UUID REFERENCES documents(id),
  organization_id    UUID NOT NULL REFERENCES organizations(id),
  
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);
```

---

## TABLA: `lawyers`

```sql
CREATE TABLE lawyers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  inpreabogado    TEXT NOT NULL,  -- Número de INPREABOGADO (obligatorio en VE)
  type            TEXT NOT NULL,  -- 'INTERNAL' | 'EXTERNAL'
  specialty       TEXT,           -- 'Corporativo' | 'Litigio' | 'Compliance' | etc.
  is_active       BOOLEAN DEFAULT true,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

---

## TABLA: `audit_logs` (Motor Forense Inmutable)

> **Integridad Criptográfica**: Cada registro está encadenado al anterior mediante un hash SHA-256 generado en el servidor. Nunca se borran ni se actualizan.

```sql
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action          TEXT NOT NULL,
  -- Acciones: 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EXPORT'
  entity_type     TEXT NOT NULL,         -- 'contracts' | 'documents' | 'system_parameters'
  entity_id       UUID NOT NULL,         -- ID del registro afectado
  details         JSONB,                 -- Metadatos y contexto de la operación
  old_data        JSONB,                 -- Estado anterior (Automático via Trigger)
  new_data        JSONB,                 -- Estado nuevo (Automático via Trigger)
  user_id         UUID REFERENCES profiles(id),
  organization_id UUID REFERENCES organizations(id),
  
  -- Campos Forenses (Motor SHA-256)
  previous_hash   TEXT,                  -- Checksum del registro anterior (Cadena de Custodia)
  checksum        TEXT NOT NULL,         -- Hash SHA-256 del registro actual (Blindaje)
  
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

**Motor de Integridad:**
- **Trigger Nativo**: `audit_trigger_func` (PostgreSQL + `pgcrypto`).
- **Encadenamiento**: Cada inserción consulta el último `checksum` de la tabla para construir su propio hash, garantizando que si se altera un registro antiguo, la cadena se rompa visualmente.

---

## RELACIONES E INTEGRIDAD

```
organizations
    ├── profiles (1:N)
    ├── documents (1:N)
    ├── contracts (1:N)
    ├── compliance_items (1:N)
    ├── lawyers (1:N)
    └── audit_logs (1:N)

documents
    └── document_analysis (1:1)

contracts
    ├── document_analysis (1:1, opcional)
    └── documents (N:1, opcional, via document_id — vínculo entre módulos)
```

---

## NOTAS IMPORTANTES PARA QUERIES

1. **Siempre filtrar por `organization_id`**: Aunque RLS lo hace automáticamente, incluirlo explícitamente en los servicios improve la legibilidad.
2. **`profiles` vs `auth.users`**: Para perfiles de usuario, usar siempre la tabla `profiles`. Supabase Auth maneja `auth.users`.
3. **`audit_logs` es append-only**: Nunca hacer UPDATE ni DELETE en audit_logs.
4. **Fechas**: Siempre en formato ISO 8601 / TIMESTAMPTZ. El frontend las convierte con `new Date().toISOString()`.

---

*Última actualización: 01/04/2026 | Mantenido por: Antigravity*

---

## TABLA: `system_parameters` *(Base Paramétrica Central)*

> Motor de reglas configurables sin tocar código. Los parámetros globales (`organization_id IS NULL`) son del sistema y no editables desde la UI. Los parámetros de organización son personalizables por rol `consultor_general` / `abogado_senior`.

```sql
CREATE TABLE system_parameters (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category         TEXT NOT NULL,
  -- Categorías: 'LAPSOS' | 'ARANCELES' | 'DIVISAS' | 'NOTIFICACIONES'
  --             'IA_CUOTAS' | 'COMPLIANCE' | 'HONORARIOS' | 'SISTEMA' | 'CALENDARIO'
  code             TEXT NOT NULL,         -- Ej: 'LAPSO_APELACION_CIVIL'
  name             TEXT NOT NULL,         -- Nombre legible
  description      TEXT,
  value            TEXT NOT NULL,         -- Siempre TEXT, se castea según value_type
  value_type       TEXT NOT NULL DEFAULT 'text',
  -- Tipos: 'number' | 'boolean' | 'json' | 'text' | 'date' | 'currency'
  unit             TEXT,                  -- 'dias' | 'porcentaje' | 'VES' | 'USD' etc.
  jurisdiction     TEXT NOT NULL DEFAULT 'ALL',
  -- 'ALL' | 'VE' | 'EU' | 'CARIBE' | 'ES' | 'CW' | 'AW'
  process_type     TEXT,                  -- NULL = todos | 'CIVIL' | 'LABORAL' | 'PENAL' | 'MERCANTIL'
  effective_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date      DATE,                  -- NULL = sin vencimiento
  is_active        BOOLEAN NOT NULL DEFAULT true,
  is_system        BOOLEAN NOT NULL DEFAULT false,  -- true = no editable por org
  organization_id  UUID REFERENCES organizations(id),  -- NULL = global del sistema
  sort_order       INTEGER DEFAULT 0,
  created_by       UUID REFERENCES profiles(id),
  updated_by       UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(code, organization_id, jurisdiction)
);
```

**Parámetros semilla disponibles (42 registros):**

| Categoría | Códigos incluidos |
|-----------|-------------------|
| LAPSOS | `LAPSO_APELACION_*`, `LAPSO_CONTESTACION_*`, `LAPSO_PRUEBAS_*`, `LAPSO_CITACION`, `LAPSO_SENTENCIA_DEFINITIVA` |
| ARANCELES | `UNIDAD_TRIBUTARIA_VE`, `ARANCEL_REGISTRO_CONTRATO`, `TIMBRE_FISCAL_PODER`, `TASA_APOSTILLA` |
| DIVISAS | `TASA_USD_VES_BCV`, `TASA_EUR_USD`, `TASA_XCD_USD`, `RETENCION_ISLR_HONORARIOS` |
| NOTIFICACIONES | `DIAS_ALERTA_NIVEL_1/2/3`, `CANAL_EMAIL_ACTIVO`, `CANAL_WHATSAPP_ACTIVO` |
| IA_CUOTAS | `TOKENS_MENSUALES_BASIC/PRO`, `MODELO_IA_DEFAULT`, `COSTO_TOKEN_USD` |
| HONORARIOS | `PORC_HONORARIO_CIVIL/LABORAL/MERCANTIL`, `MINIMO_HONORARIO_USD` |
| COMPLIANCE | `PLAZO_RESPUESTA_RGPD`, `PLAZO_RETENCIÓN_DATOS`, `REVISION_COMPLIANCE_DIAS` |
| SISTEMA | `MONEDA_DEFAULT`, `ZONA_HORARIA_DEFAULT`, `FORMATO_FECHA`, `SESSION_TIMEOUT_MINUTOS`, `MAX_ARCHIVO_MB` |

**Uso en la app:**
```typescript
// Obtener lapso de apelación en materia laboral
const dias = await parametersService.getLapsoApelacion('LABORAL'); // → 5

// Calcular honorario estimado
const h = await parametersService.calcularHonorario(50000, 'CIVIL');
// → { porcentaje: 10, honorarioUSD: 5000, honorarioVES: 182500, minimoUSD: 150 }

// Nivel de alerta por días restantes
const nivel = await parametersService.calcularNivelAlerta(4); // → 'critical'
```
