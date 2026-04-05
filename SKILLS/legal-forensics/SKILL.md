---
name: Legal Forensics & E-Signature Accountability
description: Knowledge for ensuring technical and legal validity of electronic signatures (LDFE Venezuela / eIDAS) and forensic audit logs.
---

# 🔍 LEGAL_FORENSICS.md — Habilidad Forense Legal

> **Este es un Skill especializado.** El agente IA debe activar este conocimiento cuando trabaje en módulos de firma electrónica, trazabilidad técnica o auditoría.

---

## 1. MARCO LEGAL DE REFERENCIA (VENEZUELA)

Toda firma electrónica en LegalDoc VE debe cumplir con la **Ley sobre Mensajes de Datos y Firmas Electrónicas (LDFE, 2001)**:

- **Art. 16: Firma Electrónica**: Validez legal de firmas electrónicas equivalente a la firma manuscrita si cumple con integridad, autoría y no-repudio.
- **Art. 2: Mensaje de Datos**: Toda información en formato digital tiene valor probatorio (e.g., el contenido_draft almacenado en DB).
- **Art. 31: Tercero de Confianza**: LegalDoc VE actúa como el sistema que garantiza la integridad, pero en el futuro se podrá integrar con proveedores de certificados (SUSCERTE).

---

## 2. REQUISITOS TÉCNICOS DE VALIDEZ (BITÁCORA FORENSE)

Para que un contrato firmado sea admisible como prueba en un juicio venezolano, el agente debe asegurar que el código implemente:

| Requisito | Implementación Técnica |
|---|---|
| **Integridad** | Hash SHA-256 del contenido EXACTO firmado. Si el texto cambia, el hash original en la tabla `contracts_new` no coincidirá. |
| **Autoría** | Registro del `user_id`, `email`, `role`, `IP` y `User-Agent` del firmante en el momento exacto (`signed_at`). |
| **No-Repudio** | Captura biométrica (foto facial) integrada en el proceso de firma y vinculada al hash SHA-256. |
| **Marca de Tiempo** | `ISO-8601` persistida en el servidor de base de datos (Supabase), no en el cliente. |

---

## 3. AUDITORÍA AGÉNTICA (ESTÁNDARES)

Al revisar un contrato firmado, el agente debe validar programáticamente:

1.  **Consistencia de Hash**: ¿Coincide el `signature_hash` guardado con un nuevo hash generado del `content_draft` actual? Si no, marcar como **"DOCUMENTO ALTERADO"**.
2.  **Sello Forense**: Verificar la existencia del `signature_token` (UUID único de la transacción).
3.  **Registro de Eventos**: Asegurar que en `audit_logs` exista una entrada tipo `SIGNATURE` con los detalles forenses.

---

## 4. INSTRUCCIONES PARA EL DESARROLLADOR AGENTE

- **NUNCA** permitir la edición de `content_draft` una vez que `signature_status` sea 'signed'.
- **SIEMPRE** forzar la visualización de la evidencia biométrica en el panel "Forense" de los detalles del contrato.
- **AL EXPORTAR PDF**: El PDF final debe incluir una página de **Certificado de Firma** con el código QR de verificación para validación pública fuera de la App.

---

*Última actualización: 28/03/2026 | Arquitecto responsable: Antigravity*
