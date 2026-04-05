---
description: Proceso para actualizar y testear prompts de LLM de forma segura
---

# 🤖 Workflow: Actualización de Prompts legal-tech

Los prompts son la unidad lógica más dinámica en LegalDoc VE. Este flujo asegura que los cambios en la lógica de IA no causen alucinaciones ni errores en contratos críticos.

## 1. PASO: REDACCIÓN DEL NUEVO PROMPT
// turbo
1. Modificar el prompt en `ai.service.ts` o `predictive-ai.service.ts`.
2. Asegurar que el prompt cumpla con las políticas de **AI_GOVERNANCE.md** (anonimización, no-entrenamiento).

## 2. PASO: PRUEBAS EN SANDBOX
- Cargar un contrato de prueba tipo "SERVICE" o "NDA".
- Ejecutar la función de IA con el nuevo prompt.
- Verificar que el resultado mantenga el formato JSON (si es requerido) y cite artículos de ley correctos.

## 3. PASO: PREVENCIÓN DE ALUCINACIONES
- Comparar el resultado con un borrador de control.
- Si el modelo predice probabilidades de éxito extremas (100% o 0%), ajustar la temperatura (`temperature: 0.1`) para mayor conservadurismo judicial.

## 4. PASO: DEPLOY Y LOGGING
- Persistir el cambio en código.
- Registrar un log de auditoría interna indicando la nueva versión del prompt.

---
*Referencia: AI_GOVERNANCE.md | Modelos: gpt-4o / gpt-4o-mini*
