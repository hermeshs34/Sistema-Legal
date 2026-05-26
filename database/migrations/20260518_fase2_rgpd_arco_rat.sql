-- =============================================================================
-- MIGRACIÓN: 20260518_fase2_rgpd_arco_rat.sql
-- Fase 2 — RGPD completo: ARCO+ requests + RAT + roles nuevos
-- Aplicar en Supabase SQL Editor
-- rollback: Ver sección ROLLBACK al final
-- =============================================================================

-- ── 1. Tabla de Solicitudes ARCO+ ────────────────────────────────────────────
-- RGPD Arts. 15-22: Acceso, Rectificación, Supresión, Limitación,
--                   Portabilidad, Oposición
-- Plazo legal de respuesta: 30 días hábiles (Art. 12.3)

CREATE TABLE IF NOT EXISTS public.rgpd_arco_requests (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id  UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    type             TEXT        NOT NULL CHECK (type IN (
                                    'access',        -- Art. 15 Acceso
                                    'rectification', -- Art. 16 Rectificación
                                    'erasure',       -- Art. 17 Supresión
                                    'restriction',   -- Art. 18 Limitación
                                    'portability',   -- Art. 20 Portabilidad
                                    'opposition'     -- Art. 21 Oposición
                                 )),
    status           TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending','in_review','resolved','rejected')),
    description      TEXT        NOT NULL,
    resolution       TEXT,
    deadline         TIMESTAMPTZ NOT NULL,       -- 30 días desde created_at
    resolved_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para el DPO: solicitudes urgentes primero
CREATE INDEX IF NOT EXISTS idx_arco_org_status    ON public.rgpd_arco_requests(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_arco_deadline      ON public.rgpd_arco_requests(deadline)
    WHERE status IN ('pending', 'in_review');
CREATE INDEX IF NOT EXISTS idx_arco_user          ON public.rgpd_arco_requests(user_id);

-- Trigger: updated_at automático
CREATE OR REPLACE FUNCTION update_arco_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS arco_requests_updated_at ON public.rgpd_arco_requests;
CREATE TRIGGER arco_requests_updated_at
    BEFORE UPDATE ON public.rgpd_arco_requests
    FOR EACH ROW EXECUTE FUNCTION update_arco_timestamp();

-- RLS
ALTER TABLE public.rgpd_arco_requests ENABLE ROW LEVEL SECURITY;

-- El usuario solo ve sus propias solicitudes
CREATE POLICY "arco_user_own" ON public.rgpd_arco_requests
    FOR SELECT USING (
        user_id = (SELECT id FROM public.profiles WHERE id = auth.uid())
    );

-- El usuario puede crear sus propias solicitudes
CREATE POLICY "arco_user_insert" ON public.rgpd_arco_requests
    FOR INSERT WITH CHECK (
        user_id = (SELECT id FROM public.profiles WHERE id = auth.uid())
        AND organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );

-- compliance_officer y consultor_general pueden ver todas las solicitudes de su org
CREATE POLICY "arco_compliance_view" ON public.rgpd_arco_requests
    FOR SELECT USING (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN (
            'compliance_officer', 'consultor_general'
        )
    );

-- Solo compliance_officer y consultor_general pueden resolver solicitudes
CREATE POLICY "arco_compliance_update" ON public.rgpd_arco_requests
    FOR UPDATE USING (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN (
            'compliance_officer', 'consultor_general'
        )
    );


-- ── 2. RAT — Registro de Actividades de Tratamiento ──────────────────────────
-- RGPD Art. 30 — Obligatorio para responsables del tratamiento
-- Contiene: nombre del tratamiento, finalidad, base jurídica, categorías de datos,
--           destinatarios, plazos de conservación, medidas de seguridad,
--           transferencias internacionales

CREATE TABLE IF NOT EXISTS public.rgpd_rat (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id          UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name                     TEXT        NOT NULL,                    -- Nombre del tratamiento
    purpose                  TEXT        NOT NULL,                    -- Finalidad del tratamiento
    legal_basis              TEXT        NOT NULL,                    -- Base jurídica (consentimiento / interés legítimo / contrato / ley)
    data_categories          TEXT[]      NOT NULL DEFAULT '{}',       -- Ej: ['nombre', 'email', 'RIF', 'datos_judiciales']
    special_categories       TEXT[]      DEFAULT '{}',                -- Datos sensibles: salud, origen racial, etc.
    data_subjects            TEXT[]      DEFAULT '{}',                -- Colectivos: clientes, empleados, proveedores
    recipients               TEXT[]      DEFAULT '{}',                -- Destinatarios de los datos
    third_country_transfers  TEXT,                                    -- Transferencias fuera del EEE / Venezuela
    retention_period         TEXT        NOT NULL,                    -- Ej: '5 años desde fin de relación contractual'
    security_measures        TEXT        NOT NULL,                    -- Cifrado, RLS, auditoría, etc.
    dpo_contact              TEXT,                                    -- Datos de contacto del DPO
    is_active                BOOLEAN     NOT NULL DEFAULT TRUE,
    last_review              TIMESTAMPTZ,
    next_review              TIMESTAMPTZ,
    created_by               UUID        REFERENCES public.profiles(id),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rat_org ON public.rgpd_rat(organization_id);

-- RLS
ALTER TABLE public.rgpd_rat ENABLE ROW LEVEL SECURITY;

-- Solo compliance_officer y consultor_general pueden gestionar el RAT
CREATE POLICY "rat_compliance_all" ON public.rgpd_rat
    FOR ALL USING (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN (
            'compliance_officer', 'consultor_general', 'auditor_externo', 'gerente_firma'
        )
    );


-- ── 3. Actualizar tabla profiles — nuevos roles ───────────────────────────────
-- Ampliar el CHECK constraint de roles para incluir los 3 nuevos

-- Primero eliminar el constraint existente (si existe)
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Recrear con los 8 roles
ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check CHECK (role IN (
        'consultor_general',
        'abogado_senior',
        'abogado_junior',
        'consultor_principal',
        'aprendiz',
        'compliance_officer',
        'auditor_externo',
        'gerente_firma'
    ));


-- ── 4. Semillas RAT — actividades de tratamiento estándar para bufetes ────────

-- Se insertan solo si la organización ROOT existe (datos demo)
-- En producción, cada organización crea sus propias entradas

INSERT INTO public.rgpd_rat (
    organization_id, name, purpose, legal_basis,
    data_categories, special_categories, data_subjects, recipients,
    retention_period, security_measures, created_by
)
SELECT
    o.id,
    'Gestión de expedientes judiciales',
    'Tramitación y seguimiento de procedimientos legales de clientes',
    'Ejecución de contrato (Art. 6.1.b RGPD) / Obligación legal (Art. 6.1.c RGPD)',
    ARRAY['nombre','email','RIF/NIF','datos_procesales','contratos'],
    ARRAY['datos_judiciales_penales'],
    ARRAY['clientes','partes_procesales'],
    ARRAY['juzgados','registros_publicos','notarias'],
    '10 años desde el archivo definitivo del expediente',
    'Cifrado AES-256, RLS PostgreSQL, auditoría SHA-256, acceso por roles',
    NULL
FROM public.organizations o
WHERE o.name = 'Demo Legal Firm'
ON CONFLICT DO NOTHING;


-- =============================================================================
-- ROLLBACK (ejecutar en orden inverso si se necesita revertir):
-- =============================================================================
-- ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
-- ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN (
--     'consultor_general','abogado_senior','abogado_junior',
--     'consultor_principal','aprendiz'
-- ));
-- DROP TABLE IF EXISTS public.rgpd_rat;
-- DROP TABLE IF EXISTS public.rgpd_arco_requests;
-- =============================================================================
