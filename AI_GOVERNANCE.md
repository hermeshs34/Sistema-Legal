# ⚖️ AI_GOVERNANCE.md — Gobernanza de Inteligencia Artificial

> **Documento Estratégico para CIO/CTO.** Regula el uso de modelos generativos, costos, privacidad de datos y ética en LegalDoc VE.

---

## 1. POLÍTICA DE PRIVACIDAD Y SEGURIDAD (IA)

En LegalDoc VE se maneja información legal sensible. El uso de LLMs (GPT-4o, etc.) sigue estas reglas estrictas:

- **Anonimización**: Antes de enviar cualquier documento a los servicios de IA, se deben anonimizar nombres propios de personas naturales, Cédulas, RIFs y montos exactos si no son estrictamente necesarios para el análisis.
- **No-Entrenamiento de Modelos**: Se prohíbe el uso de datos del cliente (contratos, expedientes) para el entrenamiento de modelos de terceros. Toda llamada a la API de OpenAI debe realizarse con el flag de privacidad activo si está disponible comercialmente.
- **Residencia de Datos**: Los resultados del análisis de IA se almacenan exclusivamente en la instancia de Supabase de la organización correspondiente.

---

## 2. GESTIÓN DE COSTOS Y CUOTAS (CFO/CIO)

Para mantener la sostenibilidad del SaaS, se implementan los siguientes límites por organización:

| Nivel de Suscripción | Cuota Mensual de Análisis | Modelo Utilizado |
|---|---|---|
| **Básico** | 50 análisis / mes | gpt-4o-mini |
| **Enterprise** | 500 análisis / mes + 10 predictivos | gpt-4o |
| **Judicial Pro** | Ilimitado (bajo política de uso justo) | gpt-4o |

### Monitoreo:
- El `aiService` debe registrar el consumo de tokens en la tabla `ai_usage_logs` vinculado a la `organization_id`.
- Al llegar al 90% de la cuota, el sistema enviará una notificación automática al administrador de la cuenta.

---

## 3. ESTÁNDARES DE CALIDAD Y PUNTUACIÓN (AI-SCORE)

Todo resultado generado por IA debe incluir un **Score de Confianza**:

1.  **Verificación Humana**: "Este contenido ha sido generado por IA. Requiere revisión de un abogado senior antes de su firma."
2.  **Referencia a Fuentes**: El motor de IA debe citar las cláusulas exactas o artículos de ley en los que basa su conclusión.
3.  **Manejo de Alucinaciones**: Si el modelo devuelve un resultado con probabilidad de certeza < 70%, el sistema debe marcarlo como "Análisis Inconcluso - Requiere Intervención Humana".

---

## 4. ROLES CON ACCESO A IA

No todos los usuarios pueden ejecutar acciones de IA costosas:

- `abogado_senior`: Acceso total a análisis y predicciones.
- `abogado_junior`: Solo análisis de borradores.
- `aprendiz`: Solo lectura de resultados previos.

---

*Última actualización: 28/03/2026 | Arquitecto responsable: Antigravity*
