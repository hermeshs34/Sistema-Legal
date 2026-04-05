---
name: Data Privacy & Security Compliance (Venezuela/Global)
description: Knowledge for ensuring LegalDoc VE handles sensitive legal and personal data with highest standards (LOPCYMAT/GDPR/SENIAT).
---

# 🕵️ PRIVACY_SECURITY.md — Habilidad de Privacidad y Cumplimiento

> **Este es un Skill especializado.** El agente IA debe activar este conocimiento cuando trabaje en servicios de datos personales, autenticación o protección de documentos.

---

## 1. MARCO DE PROTECCIÓN DE DATOS (PERSONAL DATA)

LegalDoc VE opera en el cumplimiento de la **Constitución de la República Bolivariana de Venezuela (Art. 28)** sobre el control de datos personales (habeas data):

- **Principio de Finalidad**: Los datos (nombres, cargos, sueldos) solo se usan para la redacción de contratos y gestión de casos.
- **Principio de Calidad**: El sistema debe proveer mecanismos para que el usuario pueda corregir errores en sus datos maestros.
- **Almacenamiento**: No persistir datos de identificación personal (PII) innecesarios en logs de errores externos.

---

## 2. GESTIÓN DE SEGURIDAD EN EL CÓDIGO (SECURITY-BY-DESIGN)

El desarrollador agente debe cumplir con estos tres pilares de seguridad:

1.  **Detección de Secretos**: Prohibido usar llaves de API (`VITE_SUPABASE_OR_OPENAI`) en código duro. Solo variables de entorno (`.env`).
2.  **Saneamiento (Sanitization)**: Todo input del usuario debe sanearse ante ataques de Inyección SQL y XSS antes de persistirse.
3.  **Encripción en Reposo**: Asegurar que el storage de Supabase (S3) esté cifrado por defecto (estándar Supabase) y que el acceso solo sea vía URLs firmadas con `signedUrl`.

---

## 3. CUMPLIMIENTO REGULATORIO INTERNACIONAL (GDPR/LOPCYMAT)

Para clientes internacionales (Fase 2 en `AGENT.md`):
- **Derecho al Olvido (Eliminación)**: Implementar la eliminación lógica (`soft delete`) o física coordinada de todos los documentos y vectores vinculados.
- **Portabilidad**: Exportación íntegra de todos los datos en JSON/CSV para el cliente.
- **LOPCYMAT (Salud Laboral)**: Los módulos de cumplimiento asociados a inspecciones del INPSASEL deben tener una capa extra de protección por tratarse de datos sensibles de salud.

---

## 4. AUDITORÍAS DE ACCESO (MFA/AUTH)

En el futuro, el sistema debe evolucionar hacia:
- **Autenticación Multi-Factor (MFA)** para usuarios `abogado_senior` y `consultor_general`.
- **Alertas de Intrusión**: Registro de intentos de login fallidos sospechosos.

---

*Última actualización: 28/03/2026 | Arquitecto responsable: Antigravity*
