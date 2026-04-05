---
description: Cómo validar técnicamente la integridad de una firma electrónica
---

# 🔍 Workflow: Validación Forense de Firma (LDFE)

Este flujo permite a un agente o desarrollador verificar si un contrato firmado ha sido alterado o si mantiene su validez probatoria.

## 1. PASO: RECOLECCIÓN DE PRUEBAS
// turbo
1. Obtener el `signature_hash` y el `content_draft` de la tabla `contracts_new`.
2. Obtener el Log de Auditoría (`audit_logs`) con la entrada de la firma para extraer la `capturedPhoto_hash` y el `timestamp`.

## 2. PASO: RELEVAMIENTO DE HASH
Re-calcular el hash concatenando los valores originales:
- Contenido del contrato (texto plano)
- ISO-Date de la firma
- Email del firmante
- Base64 de la foto biométrica (si existe)

## 3. PASO: COMPARACIÓN TÉCNICA
- Comparar el hash recalculado con el persistido en DB.
- **Si coinciden**: El documento es íntegro ✅.
- **Si NO coinciden**: Marcar como "ALTERADO / VIOLACIÓN DE INTEGRIDAD" ❌ e informar al `consultor_general`.

## 4. PASO: REVISIÓN DE AUTORIDAD
- Verificar que el `user_id` en el log de auditoría coincida con el perfil registrado en Supabase Auth.
- Validar que la organización del contrato coincida con la del usuario (`organization_id`).

---
*Referencia: FORENSIC_STANDARDS.md | LDFE Art. 16*
