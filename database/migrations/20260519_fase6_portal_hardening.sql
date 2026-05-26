-- =============================================================================
-- MIGRACIÓN: 20260519_fase6_portal_hardening.sql
-- Fase 6 — QA + Hardening — Endurecimiento del Portal de Cliente
--
-- Cambios:
--   1. Añade campos de rate limiting a client_portal_tokens
--   2. Crea tabla portal_access_log para auditoría forense
--   3. Endurece la policy SELECT de client_portal_tokens
--      (de USING(true) público a solo service_role / personal de la org)
--
-- IMPORTANTE: Después de ejecutar esta migración, el portal SOLO funciona
--             a través de la Edge Function validate-portal-token.
--             La validación directa desde el cliente con anon key ya no es posible.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


-- =============================================================================
-- 1. Rate limiting en client_portal_tokens
-- =============================================================================

ALTER TABLE public.client_portal_tokens
    ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.client_portal_tokens
    ADD COLUMN IF NOT EXISTS last_failed_attempt_at TIMESTAMPTZ;

COMMENT ON COLUMN public.client_portal_tokens.failed_attempts IS
    'Contador de intentos fallidos en la ventana de rate limiting (15 min). Se resetea al primer acceso exitoso.';

COMMENT ON COLUMN public.client_portal_tokens.last_failed_attempt_at IS
    'Timestamp del último intento fallido. Junto con failed_attempts implementa rate limiting.';


-- =============================================================================
-- 2. portal_access_log — Auditoría forense de accesos al portal
-- =============================================================================
-- Registra TODOS los intentos de validación de token (exitosos y fallidos)
-- para soporte de auditoría regulatoria (SUDEBAN / RGPD / ISO 27001).

CREATE TABLE IF NOT EXISTS public.portal_access_log (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id        UUID        REFERENCES public.client_portal_tokens(id) ON DELETE SET NULL,
    organization_id UUID        REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_ip       TEXT,                              -- IP del cliente (X-Forwarded-For)
    user_agent      TEXT,                              -- User-Agent del navegador
    success         BOOLEAN     NOT NULL,              -- true = acceso válido, false = rechazado
    reason          TEXT        NOT NULL,              -- 'valid_access' | 'rate_limited' | 'expired' | 'revoked' | 'invalid_token' | 'max_accesses_reached'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_log_token
    ON public.portal_access_log(token_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_log_org_date
    ON public.portal_access_log(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_log_failures
    ON public.portal_access_log(success, created_at DESC) WHERE success = false;

COMMENT ON TABLE public.portal_access_log IS
    'Log forense de TODOS los accesos al portal de cliente. Inmutable. Retención mínima: 5 años por SUDEBAN.';

ALTER TABLE public.portal_access_log ENABLE ROW LEVEL SECURITY;

-- Solo lectura desde la org. Inserción solo desde service_role (Edge Function).
DROP POLICY IF EXISTS "portal_log_org_read" ON public.portal_access_log;
CREATE POLICY "portal_log_org_read" ON public.portal_access_log
    FOR SELECT USING (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN (
            'consultor_general', 'compliance_officer', 'auditor_externo', 'gerente_firma'
        )
    );

-- No se permite UPDATE ni DELETE — el log es inmutable por requisito de auditoría
DROP POLICY IF EXISTS "portal_log_immutable" ON public.portal_access_log;
CREATE POLICY "portal_log_immutable" ON public.portal_access_log
    FOR UPDATE USING (false);


-- =============================================================================
-- 3. Endurecer policy SELECT de client_portal_tokens
-- =============================================================================
-- ANTES: SELECT USING (true) — cualquiera con anon key podía leer todos los tokens
-- AHORA: SELECT restringido a personal autorizado de la org
--        La Edge Function valida tokens usando service_role_key (que bypassa RLS)

DROP POLICY IF EXISTS "portal_token_validate" ON public.client_portal_tokens;

-- Solo personal autorizado de la org puede VER tokens en el panel admin
DROP POLICY IF EXISTS "portal_token_admin_read" ON public.client_portal_tokens;
CREATE POLICY "portal_token_admin_read" ON public.client_portal_tokens
    FOR SELECT USING (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN (
            'consultor_general', 'abogado_senior', 'gerente_firma', 'compliance_officer'
        )
    );

-- La policy "portal_org_manage" para INSERT/UPDATE/DELETE permanece igual


-- =============================================================================
-- 4. Vista de resumen para dashboards de seguridad
-- =============================================================================
CREATE OR REPLACE VIEW public.portal_access_summary AS
SELECT
    t.id                              AS token_id,
    t.organization_id,
    t.client_name,
    t.status,
    t.expires_at,
    t.access_count,
    t.failed_attempts,
    t.last_accessed_at,
    COUNT(l.id) FILTER (WHERE l.success)        AS successful_accesses,
    COUNT(l.id) FILTER (WHERE NOT l.success)    AS failed_accesses,
    COUNT(DISTINCT l.client_ip)                 AS unique_ips,
    MAX(l.created_at) FILTER (WHERE NOT l.success) AS last_failure_at
FROM public.client_portal_tokens t
LEFT JOIN public.portal_access_log l ON l.token_id = t.id
GROUP BY t.id;

COMMENT ON VIEW public.portal_access_summary IS
    'Resumen consolidado de uso de tokens del portal. Útil para dashboards de seguridad y detección de patrones sospechosos.';


-- =============================================================================
-- ROLLBACK:
-- =============================================================================
-- DROP VIEW IF EXISTS public.portal_access_summary;
-- DROP POLICY IF EXISTS "portal_token_admin_read" ON public.client_portal_tokens;
-- -- Restaurar policy permisiva (NO HACER en producción):
-- -- CREATE POLICY "portal_token_validate" ON public.client_portal_tokens FOR SELECT USING (true);
-- DROP TABLE IF EXISTS public.portal_access_log;
-- ALTER TABLE public.client_portal_tokens DROP COLUMN IF EXISTS failed_attempts;
-- ALTER TABLE public.client_portal_tokens DROP COLUMN IF EXISTS last_failed_attempt_at;
-- =============================================================================
