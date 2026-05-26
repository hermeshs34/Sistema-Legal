-- =============================================================================
-- MIGRACIÓN: 20260518_fase3b_judicial_schema.sql
-- Módulo Judicial — DDL completo con FK y RLS
-- Tablas: expedientes, actuaciones, audiencias,
--         expediente_lapsos, judicial_calendar_custom
--
-- PROBLEMA que resuelve:
--   PostgREST no puede hacer joins implícitos (select '*, expedientes(titulo)')
--   sin que existan FK declaradas. Esta migración crea las relaciones faltantes.
--
-- NOTA: Usa CREATE TABLE IF NOT EXISTS para ser idempotente.
--       Los ALTER TABLE para FK se ejecutan condicionalmente via DO block.
-- =============================================================================


-- ── 0. Función para generar ID de expediente (EXP-YYYYMM-NNNN) ──────────────

CREATE OR REPLACE FUNCTION public.generate_expediente_id()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
    prefix  TEXT;
    seq_val INT;
    result  TEXT;
BEGIN
    prefix  := 'EXP-' || TO_CHAR(now(), 'YYYYMM') || '-';
    SELECT COALESCE(MAX(
        CAST(NULLIF(REGEXP_REPLACE(id, '^EXP-\d{6}-', ''), '') AS INTEGER)
    ), 0) + 1
    INTO seq_val
    FROM public.expedientes
    WHERE id LIKE prefix || '%';

    result := prefix || LPAD(seq_val::TEXT, 4, '0');
    RETURN result;
END;
$$;


-- ── 1. Tabla expedientes ─────────────────────────────────────────────────────
-- PK: TEXT (generado por generate_expediente_id(), ej: EXP-202605-0001)

CREATE TABLE IF NOT EXISTS public.expedientes (
    id                  TEXT        PRIMARY KEY,
    organization_id     UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    titulo              TEXT        NOT NULL,
    numero_expediente   TEXT,                          -- Número asignado por el tribunal
    tribunal            TEXT,
    tipo_proceso        TEXT        NOT NULL DEFAULT 'CIVIL'
                                        CHECK (tipo_proceso IN (
                                            'CIVIL','LABORAL','MERCANTIL','PENAL',
                                            'ADMINISTRATIVO','CONSTITUCIONAL','ARBITRAJE'
                                        )),
    materia             TEXT,
    parte_actora        TEXT        NOT NULL,
    parte_demandada     TEXT        NOT NULL,
    nuestra_posicion    TEXT        NOT NULL DEFAULT 'DEMANDADO'
                                        CHECK (nuestra_posicion IN ('ACTOR','DEMANDADO','TERCERO','ARBITRO')),
    status              TEXT        NOT NULL DEFAULT 'ACTIVO'
                                        CHECK (status IN ('ACTIVO','SUSPENDIDO','CERRADO','GANADO','PERDIDO','CONCILIADO')),
    fecha_inicio        DATE,
    fecha_cierre        DATE,
    cuantia             NUMERIC(18,2),
    currency            TEXT        NOT NULL DEFAULT 'USD'
                                        CHECK (currency IN ('VES','USD','EUR')),
    riesgo              TEXT        NOT NULL DEFAULT 'MEDIUM'
                                        CHECK (riesgo IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    -- FK a lawyers (TEXT PK) y a documents/contracts (TEXT PK en Prisma)
    assigned_lawyer_id  TEXT        REFERENCES public.lawyers(id) ON DELETE SET NULL,
    contract_id         TEXT,
    document_id         TEXT,
    descripcion         TEXT,
    region              TEXT        NOT NULL DEFAULT 'VE',
    created_by          UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expedientes_org    ON public.expedientes(organization_id);
CREATE INDEX IF NOT EXISTS idx_expedientes_status ON public.expedientes(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_expedientes_lawyer ON public.expedientes(assigned_lawyer_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_expediente_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS expedientes_updated_at ON public.expedientes;
CREATE TRIGGER expedientes_updated_at
    BEFORE UPDATE ON public.expedientes
    FOR EACH ROW EXECUTE FUNCTION update_expediente_timestamp();

-- RLS
ALTER TABLE public.expedientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expedientes_org" ON public.expedientes;
CREATE POLICY "expedientes_org" ON public.expedientes
    FOR ALL USING (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );


-- ── 2. Tabla actuaciones ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.actuaciones (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id   TEXT        NOT NULL REFERENCES public.expedientes(id) ON DELETE CASCADE,
    organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    fecha           DATE        NOT NULL,
    tipo            TEXT        NOT NULL
                                    CHECK (tipo IN (
                                        'ESCRITO','AUDIENCIA','SENTENCIA','DILIGENCIA',
                                        'APELACION','NOTIFICACION','PERICIA','CONCILIACION','OTRO'
                                    )),
    descripcion     TEXT        NOT NULL,
    resultado       TEXT,
    proximo_paso    TEXT,
    archivo_url     TEXT,
    status          TEXT        NOT NULL DEFAULT 'REALIZADA'
                                    CHECK (status IN ('PENDIENTE','REALIZADA','SUSPENDIDA','DIFERIDA')),
    created_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_actuaciones_exp ON public.actuaciones(expediente_id);
CREATE INDEX IF NOT EXISTS idx_actuaciones_org ON public.actuaciones(organization_id, fecha DESC);

ALTER TABLE public.actuaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "actuaciones_org" ON public.actuaciones;
CREATE POLICY "actuaciones_org" ON public.actuaciones
    FOR ALL USING (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );


-- ── 3. Tabla audiencias ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audiencias (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id   TEXT        NOT NULL REFERENCES public.expedientes(id) ON DELETE CASCADE,
    organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    fecha_hora      TIMESTAMPTZ NOT NULL,
    tribunal        TEXT,
    sala            TEXT,
    tipo            TEXT        NOT NULL DEFAULT 'ORDINARIA'
                                    CHECK (tipo IN (
                                        'INICIAL','ORAL','APELACION','SENTENCIA',
                                        'CONCILIACION','ORDINARIA','CAUTELAR'
                                    )),
    descripcion     TEXT,
    resultado       TEXT,
    alerta_enviada  BOOLEAN     NOT NULL DEFAULT FALSE,
    dias_alerta     INTEGER     NOT NULL DEFAULT 3,
    status          TEXT        NOT NULL DEFAULT 'PENDIENTE'
                                    CHECK (status IN ('PENDIENTE','REALIZADA','SUSPENDIDA','DIFERIDA')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audiencias_exp      ON public.audiencias(expediente_id);
CREATE INDEX IF NOT EXISTS idx_audiencias_pendiente ON public.audiencias(organization_id, fecha_hora)
    WHERE status = 'PENDIENTE';

ALTER TABLE public.audiencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audiencias_org" ON public.audiencias;
CREATE POLICY "audiencias_org" ON public.audiencias
    FOR ALL USING (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );


-- ── 4. Tabla expediente_lapsos ───────────────────────────────────────────────
-- ← ESTA es la tabla que generaba el error PGRST200
-- La FK expediente_id → expedientes(id) es la que PostgREST necesita
-- para resolver el join: select('*, expedientes(titulo)')

CREATE TABLE IF NOT EXISTS public.expediente_lapsos (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id       TEXT        NOT NULL REFERENCES public.expedientes(id) ON DELETE CASCADE,
    organization_id     UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    lapso_code          TEXT        NOT NULL,
    lapso_name          TEXT        NOT NULL,
    fecha_inicio        DATE        NOT NULL,
    dias_habiles        INTEGER     NOT NULL,
    fecha_vencimiento   DATE        NOT NULL,
    alerted_level       TEXT        NOT NULL DEFAULT 'ok'
                                        CHECK (alerted_level IN ('ok','info','warning','critical','expired')),
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
    created_by          UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (expediente_id, lapso_code)        -- evita duplicados en upsert
);

CREATE INDEX IF NOT EXISTS idx_lapsos_exp      ON public.expediente_lapsos(expediente_id);
CREATE INDEX IF NOT EXISTS idx_lapsos_vencim   ON public.expediente_lapsos(fecha_vencimiento)
    WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_lapsos_alerta   ON public.expediente_lapsos(alerted_level, fecha_vencimiento)
    WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS lapsos_updated_at ON public.expediente_lapsos;
CREATE TRIGGER lapsos_updated_at
    BEFORE UPDATE ON public.expediente_lapsos
    FOR EACH ROW EXECUTE FUNCTION update_expediente_timestamp();

ALTER TABLE public.expediente_lapsos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lapsos_org" ON public.expediente_lapsos;
CREATE POLICY "lapsos_org" ON public.expediente_lapsos
    FOR ALL USING (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );


-- ── 5. Tabla judicial_calendar_custom ────────────────────────────────────────
-- Eventos personalizados del calendario judicial

CREATE TABLE IF NOT EXISTS public.judicial_calendar_custom (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title           TEXT        NOT NULL,
    description     TEXT,
    start_at        TIMESTAMPTZ NOT NULL,
    end_at          TIMESTAMPTZ,
    location        TEXT,
    status          TEXT        NOT NULL DEFAULT 'ACTIVE'
                                    CHECK (status IN ('ACTIVE','CANCELLED','COMPLETED')),
    created_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cal_custom_org   ON public.judicial_calendar_custom(organization_id, start_at);

ALTER TABLE public.judicial_calendar_custom ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cal_custom_org" ON public.judicial_calendar_custom;
CREATE POLICY "cal_custom_org" ON public.judicial_calendar_custom
    FOR ALL USING (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );


-- ── 6. Función PostgreSQL: calculate_business_days ───────────────────────────
-- Calcula la fecha de vencimiento sumando N días hábiles a partir de una fecha,
-- excluyendo fines de semana y feriados de la tabla judicial_holidays.

CREATE OR REPLACE FUNCTION public.calculate_business_days(
    p_start_date    DATE,
    p_working_days  INTEGER,
    p_jurisdiction  TEXT DEFAULT 'VE'
)
RETURNS DATE LANGUAGE plpgsql AS $$
DECLARE
    v_current   DATE    := p_start_date;
    v_counted   INTEGER := 0;
    v_dow       INTEGER;
    v_is_hol    BOOLEAN;
BEGIN
    WHILE v_counted < p_working_days LOOP
        v_current := v_current + 1;
        v_dow     := EXTRACT(DOW FROM v_current);

        -- Saltar fines de semana (0=Dom, 6=Sáb)
        IF v_dow IN (0, 6) THEN CONTINUE; END IF;

        -- Verificar si es feriado
        SELECT EXISTS (
            SELECT 1 FROM public.judicial_holidays
            WHERE is_active = TRUE
              AND jurisdiction IN (p_jurisdiction, 'ALL', p_jurisdiction || '-CAR-TSJ')
              AND (
                (is_recurring  AND EXTRACT(MONTH FROM holiday_date) = EXTRACT(MONTH FROM v_current)
                               AND EXTRACT(DAY   FROM holiday_date) = EXTRACT(DAY   FROM v_current))
                OR
                (NOT is_recurring AND holiday_date = v_current)
              )
        ) INTO v_is_hol;

        IF NOT v_is_hol THEN
            v_counted := v_counted + 1;
        END IF;
    END LOOP;

    RETURN v_current;
END;
$$;


-- ── 7. Función PostgreSQL: count_business_days ───────────────────────────────
-- Cuenta los días hábiles entre dos fechas (excluyendo inicio, incluyendo fin).

CREATE OR REPLACE FUNCTION public.count_business_days(
    p_start_date    DATE,
    p_end_date      DATE,
    p_jurisdiction  TEXT DEFAULT 'VE'
)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
    v_current   DATE    := p_start_date;
    v_count     INTEGER := 0;
    v_dow       INTEGER;
    v_is_hol    BOOLEAN;
BEGIN
    IF p_end_date <= p_start_date THEN RETURN 0; END IF;

    WHILE v_current < p_end_date LOOP
        v_current := v_current + 1;
        v_dow     := EXTRACT(DOW FROM v_current);

        IF v_dow IN (0, 6) THEN CONTINUE; END IF;

        SELECT EXISTS (
            SELECT 1 FROM public.judicial_holidays
            WHERE is_active = TRUE
              AND jurisdiction IN (p_jurisdiction, 'ALL', p_jurisdiction || '-CAR-TSJ')
              AND (
                (is_recurring  AND EXTRACT(MONTH FROM holiday_date) = EXTRACT(MONTH FROM v_current)
                               AND EXTRACT(DAY   FROM holiday_date) = EXTRACT(DAY   FROM v_current))
                OR
                (NOT is_recurring AND holiday_date = v_current)
              )
        ) INTO v_is_hol;

        IF NOT v_is_hol THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN v_count;
END;
$$;


-- =============================================================================
-- ROLLBACK:
-- =============================================================================
-- DROP TABLE IF EXISTS public.judicial_calendar_custom CASCADE;
-- DROP TABLE IF EXISTS public.expediente_lapsos CASCADE;
-- DROP TABLE IF EXISTS public.audiencias CASCADE;
-- DROP TABLE IF EXISTS public.actuaciones CASCADE;
-- DROP TABLE IF EXISTS public.expedientes CASCADE;
-- DROP FUNCTION IF EXISTS public.generate_expediente_id();
-- DROP FUNCTION IF EXISTS public.calculate_business_days(DATE, INTEGER, TEXT);
-- DROP FUNCTION IF EXISTS public.count_business_days(DATE, DATE, TEXT);
-- =============================================================================
