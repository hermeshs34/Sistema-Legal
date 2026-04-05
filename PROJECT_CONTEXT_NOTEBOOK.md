# LegalDoc VE: Contexto para NotebookLM
Este documento sirve como base de conocimientos completa para el desarrollo de la plataforma LegalDoc VE, un sistema Enterprise de Compliance y Gestión Documental con enfoque multi-regional.

## 1. Visión del Proyecto
LegalDoc VE es una plataforma diseñada para automatizar el cumplimiento normativo (Compliance) y la gestión de contratos en Venezuela y el mercado internacional. Utiliza Inteligencia Artificial para el análisis de riesgos, generación de resúmenes legales y auditoría automatizada.

### Objetivos Clave:
- **Cumplimiento Multi-región**: Adaptar formularios y flujos según la legislación del país (Venezuela, España, etc.).
- **Gestión de Riesgos**: Matriz de riesgos legal automatizada.
- **Transparencia**: Logs de auditoría inmutables para cada acción significativa.
- **Eficiencia**: Flujos de trabajo (Workflows) de aprobación de documentos.

## 2. Stack Tecnológico
- **Frontend**: React (Vite) + TypeScript.
- **Estilos**: Framer Motion para animaciones, HSL color system (diseño premium).
- **Backend / DB**: Supabase (Postgres + Auth + Storage + Edge Functions).
- **IA**: Integración con modelos de lenguaje para análisis jurisdiccional y legal.

## 3. Estructura de Datos (Esquema simplificado)
- **`organizations`**: Master data de la empresa subscrita.
- **`profiles`**: Usuarios ligados a organizaciones con roles (Consultor, Abogado, Director).
- **`documents`**: Metadatos de contratos y archivos (Título, Tipo, Riesgo, Estado).
- **`document_analysis`**: Resultados de la IA (Resumen, Riesgos, Sugerencias).
- **`compliance_items`**: Elementos de auditoría y su estado de cumplimiento.
- **`lawyers`**: Directorio de abogados por organización.
- **`audit_logs`**: Trazabilidad completa de operaciones.

## 4. Módulos del Sistema
- **Dashboard**: Vista 360 de la salud legal de la empresa.
- **Dashboard de Cumplimiento**: Monitoreo de riesgos y estados de auditoría.
- **Centro de Documentos**: Creación y (próximamente) carga de documentos legales.
- **Equipo Legal**: Gestión de roles y asignaciones.
- **Configuración (Evolución)**: Manejo de monedas (USD/VES), tasas BCV y regiones legales.

## 5. Roadmap Actual (Puntos Críticos)
1. **Integración Multi-Región**: Permitir que el sistema maneje documentos nacionales e internacionales.
2. **Sistema de Carga**: Implementar la funcionalidad de subir archivos (PDF/Word) a Supabase Storage y ligarlos a la base de datos.
3. **Optimización de IA**: Mejorar la detección de leyes específicas por jurisdicción.

---
*Este documento es generado por Antigravity para optimizar la colaboración con NotebookLM. Úsalo como fuente principal para consultas sobre arquitectura y reglas de negocio.*
