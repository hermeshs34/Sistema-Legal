-- =============================================================================
-- MIGRACIÓN: 20260518_fase5_innovation.sql
-- Fase 5 — Innovación
--   1. conflict_checks       — Detección de conflictos de interés (deontología)
--   2. client_portal_tokens  — Portal de cliente (acceso externo por token)
--
-- El time tracking ya tiene tabla time_entries en el módulo de honorarios.
-- Script autocontenido e idempotente.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


-- =============================================================================
-- 1. conflict_checks — Detección de conflictos de interés
-- =============================================================================
-- Base deontológica:
--   VE: Código de Ética del Abogado Venezolano, Arts. 28-31
--   ES: Estatuto General de la Abogacía Española, Arts. 33-35
--   UN: Principios Básicos ONU sobre la función de los abogados
--
-- Un conflicto existe cuando una parte de un nuevo asunto coincide (o es
-- sustancialmente similar) con la parte contraria de un asunto anterior o activo
-- de la misma firma.  También cubre conflictos por representación simultánea.

CREATE TABLE IF NOT EXISTS public.conflict_checks (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    -- Datos del asunto que se está evaluando (aún no creado)
    new_matter_title    TEXT        NOT NULL,
    new_client_name     TEXT        NOT NULL,
    new_parte_actora    TEXT        NOT NULL,
    new_parte_demandada TEXT        NOT NULL,
    -- Resultado del análisis
    result              TEXT        NOT NULL DEFAULT 'pending'
                                        CHECK (result IN (
                                            'pending',      -- En curso
                                            'clear',        -- Sin conflicto detectado
                                            'warning',      -- Posible conflicto (requiere revisión)
                                            'conflict'      -- Conflicto confirmado — no aceptar
                                        )),
    conflicts_found     JSONB       DEFAULT '[]',  -- Array de conflictos detectados [{expedienteId, titulo, parte, tipo}]
    risk_score          INTEGER     DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
    waiver_granted      BOOLEAN     NOT NULL DEFAULT FALSE,  -- Consentimiento informado de partes
    waiver_notes        TEXT,
    -- Quién hizo el check y cuándo
    checked_by          UUID        REFERENCES public.profiles(id),
    checked_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes               TEXT,
    -- Si se aprobó y se creó el expediente
    approved_expediente_id  TEXT,   -- Referencia al expediente creado tras aprobación
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conflict_org    ON public.conflict_checks(organization_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_conflict_result ON public.conflict_checks(organization_id, result);
CREATE INDEX IF NOT EXISTS idx_conflict_client ON public.conflict_checks(organization_id, new_client_name);

DROP TRIGGER IF EXISTS conflict_updated_at ON public.conflict_checks;
CREATE TRIGGER conflict_updated_at
    BEFORE UPDATE ON public.conflict_checks
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.conflict_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conflict_org_read"  ON public.conflict_checks;
CREATE POLICY "conflict_org_read" ON public.conflict_checks
    FOR SELECT USING (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "conflict_org_write" ON public.conflict_checks;
CREATE POLICY "conflict_org_write" ON public.conflict_checks
    FOR ALL USING (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN (
            'consultor_general','abogado_senior','compliance_officer','gerente_firma'
        )
    );


-- =============================================================================
-- 2. client_portal_tokens — Portal de cliente con acceso por token
-- =============================================================================
-- Permite al cliente ver el estado de sus expedientes/contratos sin login.
-- Patrón idéntico al ExternalSignView ya implementado.
-- El token es de un solo uso o con TTL configurable.

CREATE TABLE IF NOT EXISTS public.client_portal_tokens (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    token               TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    -- A qué cliente y qué recursos puede ver
    client_id           TEXT        NOT NULL,   -- ID del cliente en tabla clients
    client_name         TEXT        NOT NULL,
    client_email        TEXT        NOT NULL,
    -- Permisos del portal (qué secciones puede ver)
    can_see_expedientes BOOLEAN     NOT NULL DEFAULT TRUE,
    can_see_contratos   BOOLEAN     NOT NULL DEFAULT TRUE,
    can_see_honorarios  BOOLEAN     NOT NULL DEFAULT FALSE,  -- Facturas: opt-in
    can_see_documentos  BOOLEAN     NOT NULL DEFAULT FALSE,
    can_upload_docs     BOOLEAN     NOT NULL DEFAULT FALSE,
    -- Control de acceso
    status              TEXT        NOT NULL DEFAULT 'active'
                                        CHECK (status IN ('active','revoked','expired')),
    expires_at          TIMESTAMPTZ NOT NULL,               -- TTL obligatorio
    last_accessed_at    TIMESTAMPTZ,
    access_count        INTEGER     NOT NULL DEFAULT 0,
    max_accesses        INTEGER,                             -- NULL = ilimitado hasta TTL
    -- Trazabilidad
    created_by          UUID        REFERENCES public.profiles(id),
    revoked_by          UUID        REFERENCES public.profiles(id),
    revoked_at          TIMESTAMPTZ,
    ip_whitelist        TEXT[],                              -- NULL = cualquier IP
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_token  ON public.client_portal_tokens(token) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_portal_org    ON public.client_portal_tokens(organization_id, client_id);
CREATE INDEX IF NOT EXISTS idx_portal_expiry ON public.client_portal_tokens(expires_at) WHERE status = 'active';

DROP TRIGGER IF EXISTS portal_updated_at ON public.client_portal_tokens;
CREATE TRIGGER portal_updated_at
    BEFORE UPDATE ON public.client_portal_tokens
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.client_portal_tokens ENABLE ROW LEVEL SECURITY;

-- El propio sistema (Edge Function) valida tokens sin auth.uid() → policy permisiva para SELECT por token
DROP POLICY IF EXISTS "portal_token_validate" ON public.client_portal_tokens;
CREATE POLICY "portal_token_validate" ON public.client_portal_tokens
    FOR SELECT USING (true);   -- La validación de token se hace en la app, no en RLS

DROP POLICY IF EXISTS "portal_org_manage" ON public.client_portal_tokens;
CREATE POLICY "portal_org_manage" ON public.client_portal_tokens
    FOR ALL USING (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN (
            'consultor_general','abogado_senior','gerente_firma'
        )
    );


-- =============================================================================
-- ROLLBACK:
-- =============================================================================
-- DROP TABLE IF EXISTS public.client_portal_tokens;
-- DROP TABLE IF EXISTS public.conflict_checks;
-- =============================================================================
