---
name: Advanced AI Orchestration & Agentic Patterns
description: Guidelines for building complex, multi-step agentic workflows and LLM tool integrations in LegalDoc VE.
---

# 🤖 AI_ORCHESTRATION.md — Habilidad de Orquestación de IA

> **Este es un Skill especializado.** El agente IA debe activar este conocimiento cuando trabaje en servicios de IA avanzada o flujos de trabajo autónomos.

---

## 1. PATRÓN AGÉNTICO (TOOL-CALLING)

LegalDoc VE está evolucionando de simples LLM calls a **Flujos Agénticos**. El sistema debe ser capaz de:

1. **Analizar la Intención**: ¿Qué necesita el usuario? (ej. "Revisar si este contrato de $5000 es de alto riesgo").
2. **Consultar Herramientas**: El agente debe disparar consultas a:
   - `predictiveAiService` (para el score de éxito).
   - `complianceService` (para la matriz de riesgo).
   - `bcvService` (para convertir los $5000 a VES y validar la cuantía).
3. **Sintetizar y Razonar**: El agente unifica todos los datos previos en una recomendación final inmutable.

---

## 2. ORQUESTACIÓN DE PROMPTS COMPLEJOS (CHAIN-OF-THOUGHT)

Para el análisis judicial, el agente debe usar la técnica **CoT (Cadena de Pensamiento)**:

- **Instrucción de Sistema**: "Piensa paso a paso: Primero analiza la materia, luego las actuaciones procesales y finalmente detecta contradicciones".
- **Memoria de Contexto**: Utilizar los últimos 10 logs de auditoría para dar contexto al LLM.

---

## 3. FALLBACKS Y ROBUSTEZ (FAIL-SAFE)

Si el modelo `gpt-4o` falla por latencia o cuota:

1. **Re-intento Automático**: Tres intentos con backoff exponencial.
2. **Degradación Elegante**: Cambio automático a `gpt-4o-mini` para no bloquear al usuario.
3. **Cache de Inferencia**: Si la consulta y los datos no han cambiado en 24h, devolver el resultado previo del `document_analysis` en lugar de consumir nuevos tokens.

---

## 4. VERIFICACIÓN DE ALUCINACIONES CORPORATIVAS

El agente debe validar que la IA no invente:
- Artículos de ley inexistentes (Uso de **Self-Reflect**: "¿Estás seguro de que este artículo pertenece a la LOPCYMAT vigente?").
- Nombres de tribunales que no existan en Venezuela.
- Montos de cuantía matemáticamente erróneos.

---

*Última actualización: 28/03/2026 | Arquitecto responsable: Antigravity*
