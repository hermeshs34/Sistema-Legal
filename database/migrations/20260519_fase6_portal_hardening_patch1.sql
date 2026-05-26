-- =============================================================================
-- MIGRACIÓN: 20260519_fase6_portal_hardening_patch1.sql
-- Patch sobre la migración anterior — Fase 6 portal hardening
--
-- Cambios:
--   1. Índice por IP en portal_access_log para que el rate limit por IP
--      sea consultable en O(log n) en vez de scan completo.
--   2. Permitir INSERT en portal_access_log desde service_role (Edge Function)
--      sin policy explícita — pero confirmamos que está abierto.
-- =============================================================================

-- Índice para acelerar el conteo de fallos por IP en ventana de 15 min
CREATE INDEX IF NOT EXISTS idx_portal_log_ip_failures
    ON public.portal_access_log(client_ip, created_at DESC)
    WHERE success = false;

COMMENT ON INDEX public.idx_portal_log_ip_failures IS
    'Acelera el rate limit por IP en la Edge Function validate-portal-token. Consulta típica: WHERE client_ip = X AND success = false AND created_at >= now() - 15 min';


-- =============================================================================
-- ROLLBACK:
-- =============================================================================
-- DROP INDEX IF EXISTS public.idx_portal_log_ip_failures;
-- =============================================================================
