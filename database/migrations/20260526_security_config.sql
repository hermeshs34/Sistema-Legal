-- Migration: 20260526_security_config.sql
-- Tabla de parámetros de seguridad configurables por el administrador global

CREATE TABLE IF NOT EXISTS public.security_config (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- ── MFA por rol ──────────────────────────────────────────────────────────
    -- Roles con MFA siempre ON (hardcoded regulatorio — no modificable desde UI)
    mfa_roles_hardcoded     text[] NOT NULL DEFAULT ARRAY[
        'compliance_officer', 'auditor_externo'
    ],
    -- Roles con MFA configurable por admin
    mfa_roles_enabled       text[] NOT NULL DEFAULT ARRAY[
        'consultor_general', 'abogado_senior', 'gerente_firma'
    ],

    -- ── Sesión ───────────────────────────────────────────────────────────────
    session_timeout_minutos integer NOT NULL DEFAULT 90
        CHECK (session_timeout_minutos BETWEEN 15 AND 480),

    -- ── Contraseña ───────────────────────────────────────────────────────────
    password_vigencia_dias  integer NOT NULL DEFAULT 90
        CHECK (password_vigencia_dias BETWEEN 30 AND 365),
    password_aviso_dias     integer NOT NULL DEFAULT 15
        CHECK (password_aviso_dias BETWEEN 5 AND 30),

    -- ── Auditoría ────────────────────────────────────────────────────────────
    updated_at              timestamptz NOT NULL DEFAULT now(),
    updated_by              uuid REFERENCES public.profiles(id)
);

-- Una sola fila por organización
CREATE UNIQUE INDEX IF NOT EXISTS security_config_org_unique
    ON public.security_config (organization_id);

-- RLS
ALTER TABLE public.security_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_security_config"
ON public.security_config
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.organization_id = security_config.organization_id
          AND profiles.role = 'consultor_general'
          AND profiles.is_active = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.organization_id = security_config.organization_id
          AND profiles.role = 'consultor_general'
          AND profiles.is_active = true
    )
);

CREATE POLICY "authenticated_read_security_config"
ON public.security_config
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.organization_id = security_config.organization_id
          AND profiles.is_active = true
    )
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_security_config_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_security_config_updated
    BEFORE UPDATE ON public.security_config
    FOR EACH ROW EXECUTE FUNCTION public.set_security_config_updated();

-- rollback:
-- DROP TABLE IF EXISTS public.security_config CASCADE;
-- DROP FUNCTION IF EXISTS public.set_security_config_updated();
