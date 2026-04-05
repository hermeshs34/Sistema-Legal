# 🔐 Módulo de Firma Electrónica — LegalDoc VE

> **Marco legal:** Ley de Datos y Firmas Electrónicas (LDFE) de Venezuela · Decreto N° 1.204 · Compatible con eIDAS (UE)

---

## 1. Arquitectura General

El módulo implementa **Firma Básica SHA-256** como Fase 1, con base extensible a firma avanzada (eIDAS/DocuSign).

```
┌─────────────────────────────────────────────────────────────┐
│                     FLUJO DE FIRMA                          │
│                                                             │
│  Usuario       SignaturePanel      signature.service.ts     │
│    │                │                       │               │
│    │  Clic "Firmar" │                       │               │
│    │───────────────>│                       │               │
│    │                │  signBasic(req)       │               │
│    │                │──────────────────────>│               │
│    │                │                       │ SHA-256 hash  │
│    │                │                       │ del contenido │
│    │                │                       │               │
│    │                │                       │ UPDATE        │
│    │                │                       │ contracts_new │
│    │                │                       │ (hash+token)  │
│    │                │                       │               │
│    │                │  onSigned() callback  │               │
│    │                │<──────────────────────│               │
│    │                │ reloadContract()      │               │
│    │ UI actualizada │                       │               │
│    │<───────────────│                       │               │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. ¿Qué se firma exactamente?

El hash SHA-256 se calcula sobre la **concatenación** de:

```
LEGALDOC-VE-CONTRACT
ID: CTR-XXXXXX-XXXX
TITULO: [título del contrato]
FIRMANTE: [nombre] <[email]>
FECHA: [ISO timestamp]
CONTENIDO:
[texto plano del contrato, sin etiquetas HTML]
```

> Esto garantiza no repudio: el hash es único para esa combinación de contenido + firmante + fecha.

---

## 3. Base de Datos

### Tabla principal: `contracts_new`

Los datos de firma se almacenan **dentro del contrato** (no en tabla separada):

| Columna | Tipo | Descripción |
|---|---|---|
| `signature_status` | TEXT | `unsigned` / `pending` / `signed_basic` / `signed_advanced` |
| `signature_hash` | TEXT | Hash SHA-256 completo (64 caracteres hex) |
| `signature_token` | TEXT | Token único `LDV-{ts}-{uuid12}` para verificación pública |
| `signed_at` | TIMESTAMPTZ | Fecha y hora exacta con zona horaria |
| `signed_by_name` | TEXT | Nombre completo del firmante |
| `signed_by_email` | TEXT | Email del firmante |

### Tabla secundaria: `signature_verifications`

Se llena **cada vez que se hace clic en "Verificar Integridad"**:

| Columna | Descripción |
|---|---|
| `contract_id` | ID del contrato verificado |
| `result` | `'valid'` o `'invalid'` |
| `created_at` | Timestamp de la verificación |

```sql
-- Consultar historial de verificaciones de un contrato
SELECT result, created_at
FROM signature_verifications
WHERE contract_id = 'CTR-MN63Y6BN-1866'
ORDER BY created_at DESC;
```

---

## 4. Flujo de Verificación de Integridad

```
 1. Usuario abre el contrato firmado
 2. Clic en "Verificar Integridad del Documento"
 3. Se recalcula el hash con el contenido ACTUAL
 4. Se compara contra el hash almacenado en BD

   Coinciden:
     ✅ "Firma válida. Firmado por X el DD/MM/YYYY"
        signature_verifications: result='valid'

   No coinciden:
     ❌ "La firma no es válida. El contenido fue
        modificado después de firmarse."
        signature_verifications: result='invalid'
```

> [!WARNING]
> Si la verificación devuelve **invalid**, significa que el contrato fue editado **después de ser firmado**. Esto invalida la firma legalmente bajo el Art. 16 de la LDFE.

---

## 5. Archivos del Módulo

```
src/modules/contracts/
├── signature.service.ts      ← Lógica de firma, verificación y revocación
├── SignaturePanel.tsx         ← UI del panel (firmar, verificar, revocar)
├── ContractDetailsModal.tsx   ← Contiene la pestaña "Firma"
└── types.ts                  ← Tipo Contract con campos de firma
```

---

## 6. API del Servicio

```typescript
import { signatureService } from './signature.service.ts';

// Firmar un contrato
await signatureService.signBasic({
    contractId:      'CTR-XXXX',
    contractTitle:   'Política de Ética',
    contractContent: '...texto plano...',
    signerName:      'Hermes Sanchez',
    signerEmail:     'hersan@company.com',
    userId:          'uuid-del-usuario',
    organizationId:  'uuid-de-la-org',
});

// Verificar integridad
const result = await signatureService.verify('CTR-XXXX', contenidoActual);
// result.valid    → boolean
// result.message  → string (mensaje para mostrar al usuario)
// Registra automáticamente en signature_verifications

// Revocar firma (solo consultor_general)
await signatureService.revoke('CTR-XXXX', userId, organizationId);
// Limpia todos los campos de firma en contracts_new
// Registra en audit_logs
```

---

## 7. Estados Visuales del Panel

| Estado de firma | Color | Descripción |
|---|---|---|
| `unsigned` | Gris | Sin firmar |
| `pending` | Amarillo | Firma pendiente |
| `signed_basic` | Verde | Firmado SHA-256 (LDFE básico) |
| `signed_advanced` | Azul | Firmado con certificado avanzado (futuro) |

**Resultado de verificación:**

| Resultado | Color | Significado |
|---|---|---|
| `valid` | Verde | El documento no fue alterado tras la firma |
| `invalid` | Rojo | El documento fue modificado después de firmarse |
| `error` | Amarillo | Error técnico en la verificación |

---

## 8. Marco Legal Venezolano

| Artículo | Cumplimiento |
|---|---|
| **Art. 6, LDFE** — Define firma electrónica | ✅ Datos lógicamente asociados al mensaje |
| **Art. 16, LDFE** — Integridad y autenticidad | ✅ Hash SHA-256 garantiza integridad |
| **Art. 17, LDFE** — No repudio | ✅ Hash incluye identidad del firmante + timestamp |
| **Decreto 1.204** — Algoritmos aprobados | ✅ SHA-256 (NIST FIPS 180-4) |

> [!NOTE]
> La **firma básica SHA-256** es válida para uso interno y relaciones B2B bajo la LDFE. Para instrumentos ante entes reguladores (SUDEBAN, SUDEASEG), se requerirá **firma avanzada con certificado de Autoridad Certificadora (AC)** — Fase 2 planificada.

---

## 9. Hoja de Ruta (Roadmap)

| Fase | Estado | Descripción |
|---|---|---|
| **Fase 1** | ✅ Implementado | Firma básica SHA-256, verificación de integridad, revocación |
| **Fase 2** | 📋 Planificado | Firma avanzada con AC venezolana (SUSCERTE) |
| **Fase 3** | 📋 Planificado | Integración eIDAS para contratos internacionales |
| **Fase 4** | 📋 Planificado | Firma múltiple (flujo con N firmantes) |
| **Fase 5** | 📋 Planificado | QR de verificación pública sin login |

---

## 10. Dato Real en BD (Ejemplo)

```json
{
  "id":               "CTR-MN63Y6BN-1866",
  "title":            "Politicas de Etica",
  "signature_status": "signed_basic",
  "signature_hash":   "606fc1df45f2d7515cd0f964aa200889...",
  "signature_token":  "LDV-MN7D81K0-E31032AE6320",
  "signed_at":        "2026-03-26T11:04:37.332+00:00",
  "signed_by_name":   "Hermes Sanchez",
  "signed_by_email":  "hersan_romero@yahoo.com"
}
```

---

*Última actualización: 2026-03-26 · LegalDoc VE — Módulo de Firma Electrónica v1.0*
