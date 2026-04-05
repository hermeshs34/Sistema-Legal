# 🔍 FORENSIC_STANDARDS.md — Estándares Técnicos Forenses y Auditoría Legal

> **Documento de Especificación Técnica.** Define los protocolos de seguridad inmutable y trazabilidad digital para cumplimiento judicial en Venezuela.

---

## 1. PROTOCOLO DE INTEGRIDAD (HASHING)

Todo objeto legal (contratos, anexos, bitácoras) debe poseer un Sello Digital de Integridad:

- **Algoritmo**: `SHA-256` (Seguro, estándar industrial y legal).
- **Entrada del Hash**: Concatenación de (`JSON(content)`, `ISO-Date(timestamp)`, `UUID(user)`, `Base64(biometricPhoto)`).
- **Inmutabilidad**: Una vez generado el `signature_hash`, el sistema bloqueará cualquier `UPDATE` sobre el campo `content_draft` en la base de datos (Supabase RLS o Trigger).

---

## 2. ESTRUCTURA DE LA BITÁCORA FORENSE (`audit_logs`)

Cada acción crítica debe registrar un objeto de detalle estructurado:

```json
{
  "action": "SIGNATURE | APPROVAL | ALERT_OVERRIDE",
  "metadata": {
    "ip": "192.168.x.x",
    "ua": "Mozilla/5.0...",
    "signature_token": "uuid-v4",
    "biometric_captured": true,
    "integrity_check": "PASS | FAIL"
  },
  "_forensics": {
    "hash_v1": "a5b3c4...",
    "legal_authority": "LegalDoc_Forensic_Engine_V1"
  }
}
```

---

## 3. VALIDACIÓN DE FIRMAS (ALGORITMO)

Para verificar un contrato firmado, el motor de auditoría debe seguir este proceso de 4 pasos:

1.  **Recuperación**: Obtener el `content_draft` original de la base de datos.
2.  **Generación de Hash Local**: Re-calcular el hash concatenando los campos originales guardados en el log de auditoría.
3.  **Comparación**: Comparar el Hash calculado con el `signature_hash` persistido.
4.  **Veredicto**:
    - **VERDE (VÁLIDO)**: Hashes idénticos.
    - **ROJO (ALTERADO)**: Hashes diferentes. El sistema debe marcar el documento con una banda roja de "ALTERADO" e inhabilitar su exportación certificada.

---

## 4. EXPORTACIÓN CERTIFICADA (PDF)

El reporte forense exportado debe contener:

- **E-Seal (QR)**: Un código QR con la URL pública de validación: `https://legaldoc.ve/verify/[token]`.
- **Certificado de Marca de Tiempo**: Verificación de la hora atómica del servidor en el momento de la firma.
- **Prueba Biométrica**: Una miniatura de la foto capturada durante el proceso de firma, embebida en el PDF como evidencia visual.

---

## 5. MANTENIMIENTO DE EVIDENCIAS

Las fotos biométricas y hashes se almacenarán en **Supabase Storage** con políticas de acceso `S3_Restricted`. El borrado de evidencias forenses está estrictamente prohibido y solo podrá ser ejecutado por un `consultor_general` previa auditoría interna.

---

*Última actualización: 28/03/2026 | Arquitecto responsable: Antigravity*
