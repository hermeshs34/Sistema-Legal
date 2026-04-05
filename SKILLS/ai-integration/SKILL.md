---
name: ai-integration
description: Integración de IA para análisis de documentos legales en LegalDoc VE. Cubre la arquitectura de los servicios OpenAI, prompts legales, análisis jurisdiccional, y patrones para agregar nuevas funciones de IA.
---

# Skill: AI Integration — LegalDoc VE

## 1. ARQUITECTURA DE SERVICIOS IA

```
Frontend Component
    │
    ▼
documents/ai.service.ts         ← Orquestador principal
    │
    ├──► documents/openai.service.ts   ← Wrapper de la API de OpenAI
    │         │
    │         └──► OpenAI REST API (gpt-4o / gpt-4o-mini)
    │
    └──► Supabase: tabla document_analysis ← Persistencia de resultados
```

---

## 2. SERVICIOS EXISTENTES

### `openai.service.ts` — Cliente OpenAI:
Wrapper que encapsula las llamadas a la API de OpenAI. Maneja:
- Autenticación con API Key
- Modelo selection (gpt-4o para precisión, gpt-4o-mini para velocidad/costo)
- Rate limiting y reintentos
- Parsing de respuestas JSON

### `ai.service.ts` — Lógica de negocio IA:
Orquesta el análisis. Responsabilidades:
- Construir prompts contextualizados con datos del documento
- Llamar a `openai.service.ts`
- Parsear y validar resultados
- Guardar en `document_analysis`

---

## 3. PROMPTS LEGALES — ESTRUCTURA

### Prompt base para análisis de contrato:
```typescript
const buildContractAnalysisPrompt = (contract: Contract, region: string): string => `
Eres un abogado experto en derecho ${region === 'VE' ? 'venezolano' : 'internacional'} 
con especialización en compliance corporativo.

Analiza el siguiente contrato y proporciona:
1. RESUMEN EJECUTIVO (máx. 150 palabras)
2. RIESGOS IDENTIFICADOS (lista con nivel: LOW/MEDIUM/HIGH/CRITICAL)
3. CLÁUSULAS PROBLEMÁTICAS (cita textual + explicación)
4. LEYES APLICABLES (lista de normativas relevantes)
5. SUGERENCIAS DE MEJORA (lista priorizada)

Marco legal a considerar:
${region === 'VE' ? `
- Código de Comercio de Venezuela
- LOTTT (si hay relación laboral)
- SENIAT/ISLR (si hay implicaciones fiscales)
- Código Civil venezolano
` : `
- Derecho internacional privado
- Ley aplicable según cláusula de la sede
`}

CONTRATO A ANALIZAR:
Título: ${contract.title}
Tipo: ${contract.type}
Partes: ${contract.parties.join(', ')}
Valor: ${contract.value ? `${contract.currency} ${contract.value}` : 'No especificado'}
Fecha inicio: ${contract.startDate}
${contract.endDate ? `Fecha fin: ${contract.endDate}` : ''}

CONTENIDO:
${contract.content_draft || contract.description}

Responde SOLO en formato JSON con la estructura:
{
  "summary": "string",
  "risks": [{"description": "string", "level": "LOW|MEDIUM|HIGH|CRITICAL", "article": "string?"}],
  "suggestions": ["string"],
  "applicable_laws": ["string"],
  "confidence": 0.0-1.0
}
`;
```

### Prompt para análisis jurisdiccional:
```typescript
const buildJurisdictionPrompt = (documentText: string, organizationRegion: string): string => `
Determina la jurisdicción legal aplicable al siguiente documento legal.
La empresa está registrada en: ${organizationRegion}

Identifica:
1. Jurisdicción principal
2. Jurisdicciones secundarias (si aplica)
3. Leyes aplicables por categoría
4. Si hay conflicto de leyes

Responde en JSON:
{
  "primary_jurisdiction": "string",
  "secondary_jurisdictions": ["string"],
  "applicable_laws": {"category": "laws[]"},
  "conflict_of_laws": boolean,
  "notes": "string"
}

DOCUMENTO: ${documentText}
`;
```

---

## 4. PATRÓN DE LLAMADA A OPENAI

```typescript
// En openai.service.ts
async analyzeWithAI(prompt: string, model: 'gpt-4o' | 'gpt-4o-mini' = 'gpt-4o-mini'): Promise<unknown> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Eres un experto en derecho venezolano e internacional.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },  // SIEMPRE JSON mode
      temperature: 0.2,   // Baja temperatura para respuestas precisas y consistentes
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API Error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}
```

---

## 5. PERSISTENCIA DE ANÁLISIS IA

```typescript
// En ai.service.ts — Guardar resultado del análisis
async saveAnalysis(documentId: string, analysis: AnalysisResult, model: string): Promise<void> {
  const { error } = await supabase
    .from('document_analysis')
    .upsert({           // upsert para actualizar si ya existe
      document_id: documentId,
      summary: analysis.summary,
      risks: analysis.risks,            // JSONB
      suggestions: analysis.suggestions, // JSONB
      applicable_laws: analysis.applicable_laws,
      jurisdiction: analysis.primary_jurisdiction,
      confidence: analysis.confidence,
      model_used: model,
    }, { onConflict: 'document_id' });

  if (error) throw new Error(error.message);
}
```

---

## 6. VARIABLES DE ENTORNO REQUERIDAS PARA IA

```env
# Agregar al .env (frontend)
VITE_OPENAI_API_KEY=sk-...

# Para Edge Functions (Supabase Vault, no en .env)
OPENAI_API_KEY=sk-...
```

> ⚠️ **Nunca exponer la API Key de OpenAI en código del cliente en producción.** Para producción, la llamada a OpenAI debe hacerse desde una Edge Function.

---

## 7. ARQUITECTURA RECOMENDADA PARA PRODUCCIÓN

```
Frontend → Supabase Edge Function → OpenAI API
              │
              └── Valida JWT del usuario
              └── Verifica límites de uso por organización
              └── Llama a OpenAI con API Key segura (servidor)
              └── Guarda resultado en document_analysis
              └── Retorna al frontend
```

### Edge Function `analyze-document`:
```typescript
// supabase/functions/analyze-document/index.ts
Deno.serve(async (req) => {
  // 1. Verificar JWT (auth del usuario)
  const authHeader = req.headers.get('Authorization');
  
  // 2. Obtener datos del documento
  const { documentId } = await req.json();
  
  // 3. Llamar a OpenAI con clave del servidor
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  
  // 4. Guardar y retornar resultado
});
```

---

## 8. CASOS DE USO IA IMPLEMENTADOS Y FUTUROS

| Feature | Estado | Servicio | Modelo |
|---|---|---|---|
| Análisis de documento legal | ✅ Implementado | `ai.service.ts` | gpt-4o-mini |
| Análisis de contrato | ✅ Implementado | `ai.service.ts` | gpt-4o |
| Detección jurisdiccional | ✅ Implementado | `ai.service.ts` | gpt-4o-mini |
| Sugerencias de compliance | 🔜 Planificado | Pendiente | gpt-4o |
| Generación de cláusulas | 🔜 Planificado | Pendiente | gpt-4o |
| Resumen para directivos | 🔜 Planificado | Pendiente | gpt-4o-mini |
| Alertas inteligentes | 🔜 Planificado | Edge Function | gpt-4o-mini |

---

## 9. MANEJO DE ERRORES IA

```typescript
// Siempre manejar: rate limits, timeouts, JSON inválido
try {
  const result = await aiService.analyzeDocument(document);
  setAnalysis(result);
} catch (error) {
  if (error.message.includes('429')) {
    setError('Límite de análisis alcanzado. Intente en unos minutos.');
  } else if (error.message.includes('JSON')) {
    setError('Error al procesar respuesta de IA. Contacte soporte.');
  } else {
    setError('Error en el análisis. Verifique su conexión.');
  }
}
```

---

*Última actualización: 21/03/2026*
