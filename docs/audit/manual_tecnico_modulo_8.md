# 🏛️ LegalDoc VE: Manual Técnico del Módulo 8 (Notificaciones e Inteligencia Legal)

## 📌 Visión General
El Módulo 8 es el centro neurálgico de vigilancia proactiva de LegalDoc VE. Su función es transformar análisis de IA en acciones preventivas legales, asegurando que ningún vencimiento normativo (LOTTT, LOPCYMAT, etc.) pase desapercibido.

## 🛠️ Arquitectura del Sistema

### 1. Motor de Inteligencia (Cerebro)
- **Localización:** `src/modules/documents/ai.service.ts`
- **Capacidad:** Realiza análisis forense de textos legales, infiere nivel de riesgo y cita artículos específicos de leyes venezolanas.

### 2. Capa de Servicios (Lógica)
- **Compliance Service:** `src/modules/compliance/compliance.service.ts`
- **Audit Service:** `src/modules/shared/audit.service.ts` (Validación SHA-256 Resiliente)

### 3. Persistencia (Base de Datos & Blindaje Forense)
- **Motor Forense Nativo (Trigger SHA-256):**
  - **Función:** `audit_trigger_func` (PostgreSQL)
  - **Lógica:** Calcula atómicamente el `checksum` de cada cambio encadenándolo al registro anterior absoluto.
- **`audit_logs`:** Registro maestro inmutable con columnas `previous_hash` y `checksum`.

### 4. Automatización (Serverless)
- **Edge Function:** `daily-alert-engine`

## 🛡️ Trazabilidad Forense SHA-256
1. **Encadenamiento Global:** La cadena es lineal y sistémica. No se filtra por organización para evitar brechas falsas.
2. **Validación Resiliente:** La UI busca hasta el "abuelo" (i+2) para validar el rastro ante colisiones de tiempo.
3. **Salud Forense (LHI):** Monitoreado en tiempo real en el Dashboard.

---
*Este documento es propiedad de LegalDoc-VE - Certificado por Hermes Sanchez 2026*
