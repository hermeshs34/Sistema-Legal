-- =============================================================================
-- MIGRACIÓN: 20260518_fase3_feriados_ve.sql
-- Fase 3 — Adaptación VE Profunda
--   1. Tabla judicial_holidays (si no existe) + seeds completos Venezuela 2026-2027
--   2. Tabla inpreabogado_verifications — trazabilidad validación INPRE
-- Aplicar en Supabase SQL Editor
-- rollback: Ver sección ROLLBACK al final
-- =============================================================================

-- ── 1. Tabla de Feriados Judiciales ──────────────────────────────────────────
-- Jurisdicciones:
--   ALL     = aplica en todo el territorio
--   VE      = Venezuela (nacional)
--   VE-CAR  = Caracas / Distrito Capital
--   VE-ZUL  = Zulia / Maracaibo
--   VE-ARA  = Aragua / Maracay
--   VE-CAR-TSJ = Vacaciones TSJ (todo el país — suspenden despacho)

CREATE TABLE IF NOT EXISTS public.judicial_holidays (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    holiday_date  DATE        NOT NULL,
    name          TEXT        NOT NULL,
    type          TEXT        NOT NULL CHECK (type IN (
                                'national',   -- Feriado nacional (Gaceta Oficial)
                                'regional',   -- Feriado regional / estadal
                                'judicial',   -- Receso TSJ / vacaciones judiciales
                                'religious',  -- Semana Santa, Corpus Christi
                                'custom'      -- Definido por la firma
                              )),
    jurisdiction  TEXT        NOT NULL DEFAULT 'VE',
    is_recurring  BOOLEAN     NOT NULL DEFAULT FALSE,  -- TRUE = se repite cada año (misma fecha)
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_holiday_date_juris
    ON public.judicial_holidays(holiday_date, jurisdiction)
    WHERE NOT is_recurring;

CREATE INDEX IF NOT EXISTS idx_holiday_active ON public.judicial_holidays(is_active, holiday_date);

-- RLS
ALTER TABLE public.judicial_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "holidays_read_all" ON public.judicial_holidays
    FOR SELECT USING (true);
CREATE POLICY "holidays_write_admin" ON public.judicial_holidays
    FOR ALL USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('consultor_general')
    );


-- ── 2. Seeds — Feriados Nacionales Venezuela 2026 (Ley de Fiestas Nacionales) ─

INSERT INTO public.judicial_holidays (holiday_date, name, type, jurisdiction, is_recurring, notes)
VALUES

-- ── Feriados Nacionales Recurrentes (fija en calendario) ─────────────────────
('2026-01-01', 'Año Nuevo',                              'national', 'VE', TRUE,  'Art. 1 Ley de Fiestas Nacionales'),
('2026-04-19', 'Declaración de Independencia',           'national', 'VE', TRUE,  'Jueves Santo puede coincidir — predomina feriado nacional'),
('2026-05-01', 'Día Internacional del Trabajador',       'national', 'VE', TRUE,  'Ley Orgánica del Trabajo LOTTT Art. 190'),
('2026-06-24', 'Batalla de Carabobo',                   'national', 'VE', TRUE,  NULL),
('2026-07-05', 'Día de la Independencia',               'national', 'VE', TRUE,  NULL),
('2026-07-24', 'Natalicio del Libertador Simón Bolívar','national', 'VE', TRUE,  NULL),
('2026-10-12', 'Día de la Resistencia Indígena',        'national', 'VE', TRUE,  'Anteriormente "Día de la Raza"'),
('2026-12-24', 'Nochebuena',                            'national', 'VE', TRUE,  'Feriado bancario y laboral'),
('2026-12-25', 'Navidad',                               'national', 'VE', TRUE,  NULL),
('2026-12-31', 'Fin de Año',                            'national', 'VE', TRUE,  'Feriado bancario y laboral'),

-- ── Feriados Religiosos 2026 (variables — Semana Santa) ──────────────────────
('2026-02-16', 'Lunes de Carnaval',                     'religious', 'VE', FALSE, 'Carnaval 2026'),
('2026-02-17', 'Martes de Carnaval',                    'religious', 'VE', FALSE, 'Carnaval 2026'),
('2026-04-02', 'Jueves Santo',                          'religious', 'VE', FALSE, 'Semana Santa 2026'),
('2026-04-03', 'Viernes Santo',                         'religious', 'VE', FALSE, 'Semana Santa 2026'),

-- ── Feriados Nacionales 2027 ──────────────────────────────────────────────────
('2027-01-01', 'Año Nuevo',                              'national', 'VE', TRUE,  NULL),
('2027-04-19', 'Declaración de Independencia',           'national', 'VE', TRUE,  NULL),
('2027-05-01', 'Día Internacional del Trabajador',       'national', 'VE', TRUE,  NULL),
('2027-06-24', 'Batalla de Carabobo',                   'national', 'VE', TRUE,  NULL),
('2027-07-05', 'Día de la Independencia',               'national', 'VE', TRUE,  NULL),
('2027-07-24', 'Natalicio del Libertador Simón Bolívar','national', 'VE', TRUE,  NULL),
('2027-10-12', 'Día de la Resistencia Indígena',        'national', 'VE', TRUE,  NULL),
('2027-12-24', 'Nochebuena',                            'national', 'VE', TRUE,  NULL),
('2027-12-25', 'Navidad',                               'national', 'VE', TRUE,  NULL),
('2027-12-31', 'Fin de Año',                            'national', 'VE', TRUE,  NULL),

-- ── Feriados Religiosos 2027 ──────────────────────────────────────────────────
('2027-03-08', 'Lunes de Carnaval',                     'religious', 'VE', FALSE, 'Carnaval 2027'),
('2027-03-09', 'Martes de Carnaval',                    'religious', 'VE', FALSE, 'Carnaval 2027'),
('2027-03-25', 'Jueves Santo',                          'religious', 'VE', FALSE, 'Semana Santa 2027'),
('2027-03-26', 'Viernes Santo',                         'religious', 'VE', FALSE, 'Semana Santa 2027'),

-- ── Recesos Judiciales TSJ — Vacaciones de Agosto 2026 ───────────────────────
-- LPTSJSPP Art. 201 — Los tribunales no despachan durante agosto
-- y del 24/12 al 06/01 del año siguiente (Resolución TSJ)
('2026-08-01', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, 'Receso TSJ agosto 2026. Sin despacho en todos los tribunales del país.'),
('2026-08-02', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-03', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-04', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-05', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-06', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-07', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-08', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-09', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-10', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-11', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-12', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-13', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-14', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-15', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-16', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-17', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-18', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-19', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-20', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-21', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-22', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-23', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-24', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-25', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-26', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-27', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-28', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-29', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-30', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-08-31', 'Vacaciones Judiciales — Agosto',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),

-- ── Receso Navideño TSJ 2026 (24/12/2026 — 07/01/2027) ──────────────────────
('2026-12-26', 'Receso Navideño TSJ',  'judicial', 'VE-CAR-TSJ', FALSE, 'Receso navideño TSJ 2026-2027. Sin despacho.'),
('2026-12-27', 'Receso Navideño TSJ',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-12-28', 'Receso Navideño TSJ',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-12-29', 'Receso Navideño TSJ',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2026-12-30', 'Receso Navideño TSJ',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2027-01-02', 'Receso Navideño TSJ',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2027-01-03', 'Receso Navideño TSJ',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2027-01-04', 'Receso Navideño TSJ',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2027-01-05', 'Receso Navideño TSJ',  'judicial', 'VE-CAR-TSJ', FALSE, NULL),
('2027-01-06', 'Receso Navideño TSJ',  'judicial', 'VE-CAR-TSJ', FALSE, 'Día de Reyes — último día receso navideño'),

-- ── Feriados Regionales — Caracas / Distrito Capital ─────────────────────────
('2026-07-25', 'Día de Santiago Apóstol (Caracas)',  'regional', 'VE-CAR', TRUE,
    'Patrono del Distrito Capital'),
('2027-07-25', 'Día de Santiago Apóstol (Caracas)',  'regional', 'VE-CAR', TRUE, NULL),

-- ── Feriados Regionales — Zulia / Maracaibo ──────────────────────────────────
('2026-01-24', 'Día del Lago de Maracaibo',  'regional', 'VE-ZUL', TRUE,
    'Efeméride zuliana. Feriado local en Maracaibo y municipios ribereños.'),
('2026-10-28', 'Día del Estado Zulia',        'regional', 'VE-ZUL', TRUE,
    'Aniversario segregación del Gran Estado Trujillo 1856'),
('2027-01-24', 'Día del Lago de Maracaibo',  'regional', 'VE-ZUL', TRUE, NULL),
('2027-10-28', 'Día del Estado Zulia',        'regional', 'VE-ZUL', TRUE, NULL),

-- ── Feriados Regionales — Aragua / Maracay ───────────────────────────────────
('2026-04-24', 'Día de Maracay',  'regional', 'VE-ARA', TRUE,
    'Aniversario fundación de Maracay (1701)'),
('2027-04-24', 'Día de Maracay',  'regional', 'VE-ARA', TRUE, NULL)

ON CONFLICT DO NOTHING;


-- ── 3. Tabla de Verificaciones INPRE ─────────────────────────────────────────
-- Ley de Abogados (G.O. 26.781 - 1967) Art. 4: solo los inscritos en
-- el INPREABOGADO pueden ejercer la profesión en Venezuela.
-- Esta tabla rastrea el ciclo de verificación manual del registro INPRE.

CREATE TABLE IF NOT EXISTS public.inpreabogado_verifications (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    -- lawyer_id es TEXT porque la tabla lawyers usa TEXT como PK (generado con crypto.randomUUID())
    lawyer_id         TEXT        NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
    inpreabogado      TEXT        NOT NULL,           -- Número INPRE tal como se registró
    status            TEXT        NOT NULL DEFAULT 'no_verificado'
                                    CHECK (status IN (
                                        'activo',         -- Verificado y habilitado para el ejercicio
                                        'suspendido',     -- Sancionado disciplinariamente por el TSJ o INPRE
                                        'inhabilitado',   -- Sanción grave — inhabilitación permanente o temporal
                                        'fallecido',      -- Registro cerrado por fallecimiento
                                        'no_verificado'   -- Sin verificar aún
                                    )),
    verified_by       UUID        REFERENCES public.profiles(id),
    verified_at       TIMESTAMPTZ,
    next_review       TIMESTAMPTZ,         -- Recordatorio próxima verificación (1 año por defecto)
    evidence_url      TEXT,                -- URL del documento de respaldo (Storage)
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (lawyer_id, organization_id)    -- Solo una verificación activa por abogado
);

CREATE INDEX IF NOT EXISTS idx_inpre_org     ON public.inpreabogado_verifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_inpre_review  ON public.inpreabogado_verifications(next_review)
    WHERE status = 'activo';

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_inpre_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS inpre_verif_updated_at ON public.inpreabogado_verifications;
CREATE TRIGGER inpre_verif_updated_at
    BEFORE UPDATE ON public.inpreabogado_verifications
    FOR EACH ROW EXECUTE FUNCTION update_inpre_timestamp();

-- RLS
ALTER TABLE public.inpreabogado_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inpre_org_read" ON public.inpreabogado_verifications
    FOR SELECT USING (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "inpre_compliance_write" ON public.inpreabogado_verifications
    FOR ALL USING (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN (
            'consultor_general', 'abogado_senior', 'compliance_officer', 'gerente_firma'
        )
    );


-- =============================================================================
-- ROLLBACK (ejecutar en orden inverso):
-- =============================================================================
-- DROP TRIGGER IF EXISTS inpre_verif_updated_at ON public.inpreabogado_verifications;
-- DROP TABLE IF EXISTS public.inpreabogado_verifications;
-- DELETE FROM public.judicial_holidays WHERE jurisdiction IN ('VE','VE-CAR','VE-ZUL','VE-ARA','VE-CAR-TSJ');
-- DROP TABLE IF EXISTS public.judicial_holidays;  -- solo si no existía antes
-- =============================================================================
