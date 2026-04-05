# Plan de Evolución: LegalDoc VE (Enterprise & Global)

Este documento detalla el roadmap para transformar el sistema actual en una plataforma robusta, multi-región y de nivel empresarial.

## 🔴 Próxima Sesión — Contratos (pendiente desde 21/03/2026)
*   **Botón "Descargar PDF Certificado"**: Sin lógica. Debe descargar el PDF adjunto (file_url) o generar uno con los datos del contrato si no hay PDF. Ver `ContractDetailsModal.tsx` línea ~182.
*   **Botón "Bitácora de Auditoría"**: Sin lógica. Debe consultar `audit_logs` por `entity_id = contract.id` y mostrar el historial en un panel. Ver `ContractDetailsModal.tsx` línea ~185.
*   **Editor de Contratos mejorado**: Agregar panel de comentarios, garantizar que `content_draft` se guarda en Supabase correctamente, e indicador de "cambios sin guardar". Ver `ContractEditor.tsx`.
*   **Fix menor**: `assignedLawyerId` muestra el ID UUID crudo en lugar del nombre del abogado. Cruzar con tabla `lawyers`.

---


## 🟢 Fase 1: Estabilización y Seguridad (Prioridad para Mañana)
*   **Corrección de Autenticación**: Eliminar el bypass de seguridad (`MasterLegal2026`) y sincronizar correctamente Supabase Auth con los Perfiles.
*   **Ajuste Fino de RLS**: Realizar una auditoría de base de datos para asegurar que ninguna consulta "filtre" datos entre organizaciones.
*   **Limpieza de Código**: Eliminar advertencias de linter y variables no utilizadas generadas durante la refactorización rápida.

## 🟡 Fase 2: Experiencia Multi-Regional & Settings
*   **Panel de Configuración de Organización**: Interfaz para que cada empresa suba su logo, defina su moneda base y su región legal.
*   **Gestión de Tasas de Cambio**: Implementar un proceso (Edge Function) que actualice automáticamente las tasas de cambio (BCV, BCE) cada mañana.
*   **Selector de Organización (Super-Admin)**: Para usuarios con rol "Consultor General", permitir cambiar de vista entre diferentes empresas.

## 🟠 Fase 3: Inteligencia Legal & Automatización
*   **Calendarios de Cumplimiento Dinámicos**: Generar fechas de vencimiento basadas en leyes locales (ej. festivos de Venezuela vs España).
*   **IA para Análisis Jurisdiccional**: Mejorar el servicio de IA para que sugiera leyes específicas basadas en el país de la organización.
*   **Workflows Complejos**: Permitir que los flujos de aprobación tengan múltiples pasos y ramificaciones (ej. si el contrato > $10k, requiere firma de Dirección).

## 🔵 Fase 4: Reportes y Auditoría Avanzada
*   **Dashboard Global**: KPIs consolidados para directivos que supervisan múltiples regiones.
*   **Exportación Legal**: Generar PDFs de auditoría certificados que incluyan el historial de aprobación y la marca de tiempo i18n.
*   **Notificaciones**: Sistema de alertas por correo cuando un paso de aprobación está pendiente o un contrato está por vencer.

---
### 📅 Tareas Pendientes para Mañana:
1.  **Sincronización Auth**: Re-habilitar el flujo normal de Supabase Auth sin bypass.
2.  **QA de Moneda**: Probar la conversión en el módulo de Compliance (Risk Matrix).
3.  **Primer Workflow Real**: Crear un documento real y completar todo el ciclo de aprobación/rechazo para verificar la integridad de los logs.
