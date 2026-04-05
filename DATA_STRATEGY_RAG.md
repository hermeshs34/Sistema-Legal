# 🧠 DATA_STRATEGY_RAG.md — Estrategia de Datos y Búsqueda Inteligente (RAG)

> **Documento Estratégico para Arquitectos de Datos.** Define la implementación de pgvector y Retrieval-Augmented Generation (RAG) para LegalDoc VE.

---

## 1. OBJETIVO DE LA ESTRATEGIA

LegalDoc VE maneja miles de documentos (jurisprudencia, leyes, contratos previos). Para que la IA responda con precisión, se debe implementar una arquitectura de **RAG (Generación Aumentada por Recuperación)** que permita a los modelos de lenguaje "leer" la base de conocimientos interna de la organización sin necesidad de ser re-entrenados.

---

## 2. ARQUITECTURA TÉCNICA (PGVECTOR)

El backend de base de datos en Supabase ya cuenta con la extensión `pgvector`. Los pasos de implementación son:

1.  **Fragmentación (Chunking)**: Dividir documentos legales largos (leyes o contratos de más de 30 páginas) en fragmentos representativos de 500-1000 tokens con un solapamiento del 10%.
2.  **Embeddings**: Utilizar el modelo `text-embedding-3-small` de OpenAI para convertir cada fragmento de texto en un vector numérico de 1536 dimensiones.
3.  **Supabase Vector Store**: Almacenar estos vectores en una tabla especializada `document_vectors`:
    ```sql
    CREATE TABLE document_vectors (
        id uuid PRIMARY KEY,
        document_id uuid REFERENCES documents(id),
        content text,
        embedding vector(1536),
        metadata jsonb
    );
    ```
4.  **Búsqueda por Similitud (Cosine Similarity)**: El `aiService` realizará búsquedas vectoriales para encontrar los 5-10 fragmentos más relevantes antes de enviar el prompt final al LLM.

---

## 3. FUENTES DE DATOS PARA RAG

La estrategia se divide en tres niveles de conocimiento:

- **Nivel 1 (Público)**: Gaceta Oficial de la República Bolivariana de Venezuela, Leyes Orgánicas, Providencias Administrativas (SUNDDE, SENIAT).
- **Nivel 2 (Sectorial)**: Jurisprudencia del Tribunal Supremo de Justicia (TSJ), Circulares de la SUDEBAN/SUDEASEG.
- **Nivel 3 (Privado)**: El repositorio histórico de contratos y expedientes de la propia organización (tenencia estricta por `organization_id`).

---

## 4. FLUJO DE TRABAJO AGÉNTICO (AGENTIC RAG)

Antes de generar un consejo legal, el agente IA debe:

1.  **Analizar la consulta del usuario** (e.g., "¿Qué dice la LOPCYMAT sobre accidentes laborales?").
2.  **Realizar búsqueda vectorial** en el Nivel 1 y Nivel 2.
3.  **Filtrar el contexto** por relevancia y fecha de vigencia (evitar leyes derogadas).
4.  **Sintetizar la respuesta** citando el artículo exacto recuperado de la base de datos vectorial.

---

## 5. MANTENIMIENTO DEL ÍNDICE

Se implementarán **Edge Functions** de Supabase para:
- Re-indexar documentos automáticamente cuando se suban al storage.
- Limpiar vectores de documentos eliminados o expirados.
- Pruebas A/B sobre las tácticas de *chunking* para mejorar la precisión de las recomendaciones.

---

*Última actualización: 28/03/2026 | Arquitecto responsable: Antigravity*
