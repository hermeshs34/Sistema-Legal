# 🧠 SKILL: Gestión y Mantenimiento de Cumplimiento IA (Módulo 8)

## 🛡️ Estructura de Datos Forense
- `previous_hash` & `checksum`: SHA-256 obligatorios en `audit_logs`.
- **Regla de Oro:** El motor forense reside en el servidor (`audit_trigger_func`). **NO realizar logs manuales** en JS/TS para CRUD en tablas protegidas.

## 🧱 Mantenimiento de la Cadena
1. **Diagnóstico:** Ejecutar `auditService.verifyChain()` sin filtros de organización.
2. **Lógica de Resiliencia:** El sistema tolera "hermanos" y busca hasta el "abuelo" (i+2).
3. **Cura SQL:** Usar el script de "Sutura Total" si la cadena se rompe por manipulación manual externa.

## 🛠️ Requisitos de Infraestructura
- **Extensión:** `pgcrypto` v1.3+ instalada en Supabase.
- **Triggers:** Tablas críticas (`contracts_new`, `system_parameters`) vinculadas a `audit_trigger_func`.

---
*Protocolo de Integridad LegalDoc-VE - Certificado por Hermes Sanchez 2026*
