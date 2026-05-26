-- =============================================================================
-- MIGRACIÓN: 20260518_fase4_spain_es.sql
-- Fase 4 — Adaptación España (ES)
--   1. Feriados nacionales + CCAA 2026-2027
--   2. Tabla eidas_signatures  — firmas eIDAS (Reglamento UE 910/2014)
--   3. Tabla face_invoices     — facturación electrónica FACe / FacturaE 3.2.2
--   4. Seeds system_parameters — Plazos LEC, LRJS, LJCA e IVA
--
-- Script autocontenido: se puede ejecutar solo sin depender de otras migraciones.
-- Idempotente: CREATE TABLE IF NOT EXISTS + ON CONFLICT DO NOTHING.
-- =============================================================================


-- ── 0. Función genérica updated_at (autocontenida) ───────────────────────────
-- Usa CREATE OR REPLACE para no fallar si ya existe de una migración anterior.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


-- =============================================================================
-- 1. FERIADOS ESPAÑA 2026-2027
-- =============================================================================
-- Requiere que la tabla judicial_holidays exista (creada en fase3_feriados_ve.sql).
-- Si aún no existe, ejecuta primero esa migración.
-- ON CONFLICT DO NOTHING = idempotente, se puede re-ejecutar sin duplicar.

INSERT INTO public.judicial_holidays
    (holiday_date, name, type, jurisdiction, is_recurring, notes)
VALUES

-- ── Feriados Nacionales España 2026 (BOE) ────────────────────────────────────
('2026-01-01', 'Año Nuevo',                           'national', 'ES', TRUE,  'Art. 37 ET — Festivo nacional'),
('2026-01-06', 'Día de Reyes (Epifanía del Señor)',   'national', 'ES', TRUE,  'Festivo nacional retribuido'),
('2026-05-01', 'Día Internacional del Trabajo',        'national', 'ES', TRUE,  'Art. 37.2 ET'),
('2026-08-15', 'Asunción de la Virgen',               'national', 'ES', TRUE,  'Festivo nacional'),
('2026-10-12', 'Fiesta Nacional de España',           'national', 'ES', TRUE,  'Día de la Hispanidad — Ley 18/1987'),
('2026-11-01', 'Todos los Santos',                    'national', 'ES', TRUE,  NULL),
('2026-12-06', 'Día de la Constitución Española',     'national', 'ES', TRUE,  'Conmemoración promulgación CE 1978'),
('2026-12-08', 'Inmaculada Concepción',               'national', 'ES', TRUE,  NULL),
('2026-12-25', 'Navidad',                             'national', 'ES', TRUE,  NULL),

-- Semana Santa 2026 (fechas variables — nacional: solo Jueves y Viernes Santo)
('2026-04-02', 'Jueves Santo',  'religious', 'ES', FALSE, 'Semana Santa 2026'),
('2026-04-03', 'Viernes Santo', 'religious', 'ES', FALSE, 'Semana Santa 2026'),

-- ── Feriados Nacionales España 2027 ──────────────────────────────────────────
('2027-01-01', 'Año Nuevo',                           'national', 'ES', TRUE,  NULL),
('2027-01-06', 'Día de Reyes',                        'national', 'ES', TRUE,  NULL),
('2027-05-01', 'Día Internacional del Trabajo',        'national', 'ES', TRUE,  NULL),
('2027-08-15', 'Asunción de la Virgen',               'national', 'ES', TRUE,  NULL),
('2027-10-12', 'Fiesta Nacional de España',           'national', 'ES', TRUE,  NULL),
('2027-11-01', 'Todos los Santos',                    'national', 'ES', TRUE,  NULL),
('2027-12-06', 'Día de la Constitución Española',     'national', 'ES', TRUE,  NULL),
('2027-12-08', 'Inmaculada Concepción',               'national', 'ES', TRUE,  NULL),
('2027-12-25', 'Navidad',                             'national', 'ES', TRUE,  NULL),
('2027-03-25', 'Jueves Santo',  'religious', 'ES', FALSE, 'Semana Santa 2027'),
('2027-03-26', 'Viernes Santo', 'religious', 'ES', FALSE, 'Semana Santa 2027'),

-- ── Comunidad de Madrid 2026 ──────────────────────────────────────────────────
('2026-03-19', 'San José',                          'regional', 'ES-MAD', FALSE, 'Festivo CCAA Madrid 2026'),
('2026-05-02', 'Fiesta de la Comunidad de Madrid',  'regional', 'ES-MAD', TRUE,  'Aniversario levantamiento 1808'),
('2026-07-25', 'Santiago Apóstol',                  'regional', 'ES-MAD', TRUE,  NULL),
('2026-11-09', 'Nuestra Señora de la Almudena',     'regional', 'ES-MAD', TRUE,  'Patrona de Madrid'),

-- ── Cataluña 2026 ─────────────────────────────────────────────────────────────
('2026-04-06', 'Lunes de Pascua',            'regional', 'ES-CAT', FALSE, 'Dilluns de Pasqua Florida 2026'),
('2026-06-24', 'Sant Joan',                  'regional', 'ES-CAT', TRUE,  'Festivitat de Sant Joan'),
('2026-09-11', 'Diada Nacional de Catalunya','regional', 'ES-CAT', TRUE,  'Commemoració caiguda Barcelona 1714'),
('2026-09-24', 'La Mercè (Barcelona)',        'regional', 'ES-CAT', TRUE,  'Patrona de Barcelona'),

-- ── Andalucía 2026 ────────────────────────────────────────────────────────────
('2026-02-28', 'Día de Andalucía',  'regional', 'ES-AND', TRUE,  'Aniversario referéndum autonomía 1980'),
('2026-04-06', 'Lunes de Pascua',   'regional', 'ES-AND', FALSE, 'Semana Santa 2026'),

-- ── Comunitat Valenciana 2026 ─────────────────────────────────────────────────
('2026-03-19', 'Sant Josep — Falles',          'regional', 'ES-VAL', TRUE,  'Día de la Comunitat Valenciana'),
('2026-04-06', 'Lunes de Pascua',              'regional', 'ES-VAL', FALSE, 'Dilluns de Pasqua 2026'),
('2026-10-09', 'Dia de la Comunitat Valenciana','regional', 'ES-VAL', TRUE, 'Aniversari entrada Jaume I 1238')

ON CONFLICT DO NOTHING;


-- =============================================================================
-- 2. TABLA eidas_signatures
-- Trazabilidad de firmas electrónicas bajo eIDAS (Reglamento UE 910/2014).
-- Niveles: SES (simple) / AdES (avanzada) / QES (cualificada).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.eidas_signatures (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    contract_id             TEXT        NOT NULL,
    signature_level         TEXT        NOT NULL DEFAULT 'SES'
                                            CHECK (signature_level IN ('SES','AdES','QES')),
    provider                TEXT        NOT NULL DEFAULT 'internal'
                                            CHECK (provider IN (
                                                'internal','signaturit','uanataca','viafirma','autofirma'
                                            )),
    provider_signature_id   TEXT,
    provider_document_id    TEXT,
    signing_url             TEXT,
    signer_name             TEXT        NOT NULL,
    signer_email            TEXT        NOT NULL,
    signer_nif              TEXT,
    signer_ip               TEXT,
    status                  TEXT        NOT NULL DEFAULT 'pending'
                                            CHECK (status IN (
                                                'pending','signed','rejected','expired','cancelled'
                                            )),
    certificate_serial      TEXT,
    certificate_issuer      TEXT,
    signature_hash          TEXT,
    signed_document_url     TEXT,
    tsa_timestamp           TEXT,
    ltvl_enabled            BOOLEAN     NOT NULL DEFAULT FALSE,
    sent_at                 TIMESTAMPTZ,
    signed_at               TIMESTAMPTZ,
    expires_at              TIMESTAMPTZ,
    audit_trail             JSONB,
    jurisdiction            TEXT        NOT NULL DEFAULT 'ES',
    legal_framework         TEXT        NOT NULL DEFAULT 'eIDAS'
                                            CHECK (legal_framework IN (
                                                'eIDAS','LSSI','VE-LEY-TELEMATICA','OTRO'
                                            )),
    created_by              UUID        REFERENCES public.profiles(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eidas_org      ON public.eidas_signatures(organization_id);
CREATE INDEX IF NOT EXISTS idx_eidas_contract ON public.eidas_signatures(contract_id);
CREATE INDEX IF NOT EXISTS idx_eidas_status   ON public.eidas_signatures(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_eidas_provider ON public.eidas_signatures(provider, provider_signature_id);

DROP TRIGGER IF EXISTS eidas_updated_at ON public.eidas_signatures;
CREATE TRIGGER eidas_updated_at
    BEFORE UPDATE ON public.eidas_signatures
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.eidas_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eidas_org_select" ON public.eidas_signatures;
CREATE POLICY "eidas_org_select" ON public.eidas_signatures
    FOR SELECT USING (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "eidas_org_insert" ON public.eidas_signatures;
CREATE POLICY "eidas_org_insert" ON public.eidas_signatures
    FOR INSERT WITH CHECK (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "eidas_org_update" ON public.eidas_signatures;
CREATE POLICY "eidas_org_update" ON public.eidas_signatures
    FOR UPDATE USING (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );


-- =============================================================================
-- 3. TABLA face_invoices
-- Facturación electrónica FACe / FacturaE 3.2.2 para España.
-- Ley 25/2013 — Ley Crea y Crece (Ley 18/2022).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.face_invoices (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    numero_factura      TEXT          NOT NULL,
    serie_factura       TEXT          NOT NULL DEFAULT 'LEG',
    fecha_emision       DATE          NOT NULL,
    fecha_vencimiento   DATE          NOT NULL,
    nif_emisor          TEXT          NOT NULL,
    nombre_emisor       TEXT          NOT NULL,
    nif_receptor        TEXT          NOT NULL,
    nombre_receptor     TEXT          NOT NULL,
    codigo_organ        TEXT,                         -- Código DIR3 órgano gestor (AAPP)
    total_bruto         NUMERIC(12,2) NOT NULL,       -- Base imponible
    total_iva           NUMERIC(12,2) NOT NULL,
    total_neto          NUMERIC(12,2) NOT NULL,       -- Total a pagar
    xml_content         TEXT,                         -- XML FacturaE 3.2.2 generado
    xml_url             TEXT,                         -- URL Storage (XML firmado XAdES)
    face_registro       TEXT,                         -- Número registro contable FACe
    status              TEXT          NOT NULL DEFAULT 'draft'
                                          CHECK (status IN (
                                              'draft','generated','signed',
                                              'submitted','registered','paid',
                                              'rejected','cancelled'
                                          )),
    contract_id         TEXT,
    expediente_id       TEXT,
    payload_json        JSONB,                        -- Payload completo para regeneración
    created_by          UUID          REFERENCES public.profiles(id),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    UNIQUE (organization_id, numero_factura)
);

CREATE INDEX IF NOT EXISTS idx_face_org    ON public.face_invoices(organization_id, fecha_emision DESC);
CREATE INDEX IF NOT EXISTS idx_face_status ON public.face_invoices(organization_id, status);

DROP TRIGGER IF EXISTS face_updated_at ON public.face_invoices;
CREATE TRIGGER face_updated_at
    BEFORE UPDATE ON public.face_invoices
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.face_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "face_org" ON public.face_invoices;
CREATE POLICY "face_org" ON public.face_invoices
    FOR ALL USING (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );


-- =============================================================================
-- 4. SEEDS system_parameters — España
-- Plazos LEC, LRJS, LJCA + IVA + honorarios turno de oficio.
-- ON CONFLICT DO NOTHING = seguro para re-ejecuciones.
-- =============================================================================

INSERT INTO public.system_parameters (
    category, code, name, description,
    value, value_type, unit,
    jurisdiction, process_type,
    effective_date, is_active, is_system, sort_order
)
VALUES

-- ── LEC — Proceso Ordinario (Ley 1/2000 LEC) ─────────────────────────────────
('LAPSOS', 'LAPSO_CONTESTACION_CIVIL_ES',
    'Contestación — Proceso Ordinario (LEC Art. 404)',
    'Plazo para contestar la demanda en proceso ordinario',
    '20', 'number', 'días hábiles', 'ES', 'CIVIL', CURRENT_DATE, TRUE, TRUE, 10),

('LAPSOS', 'LAPSO_CONTESTACION_RECONVENCION_ES',
    'Contestación a la Reconvención (LEC Art. 404)',
    'Plazo para contestar a la reconvención formulada por el demandado',
    '20', 'number', 'días hábiles', 'ES', 'CIVIL', CURRENT_DATE, TRUE, TRUE, 11),

('LAPSOS', 'LAPSO_APELACION_CIVIL_ES',
    'Recurso de Apelación (LEC Art. 458)',
    'Plazo para interponer recurso de apelación contra sentencias',
    '20', 'number', 'días hábiles', 'ES', 'CIVIL', CURRENT_DATE, TRUE, TRUE, 12),

('LAPSOS', 'LAPSO_CASACION_ES',
    'Recurso de Casación — Preparación (LEC Art. 479)',
    'Plazo para preparar el recurso de casación ante el Tribunal Supremo',
    '5', 'number', 'días hábiles', 'ES', 'CIVIL', CURRENT_DATE, TRUE, TRUE, 13),

('LAPSOS', 'LAPSO_REPOSICION_ES',
    'Recurso de Reposición (LEC Art. 452)',
    'Plazo para interponer recurso de reposición contra providencias y autos',
    '5', 'number', 'días hábiles', 'ES', 'CIVIL', CURRENT_DATE, TRUE, TRUE, 14),

('LAPSOS', 'LAPSO_PRUEBA_ES',
    'Periodo de Prueba (LEC Art. 429)',
    'Duración del periodo para proposición y práctica de la prueba',
    '20', 'number', 'días hábiles', 'ES', 'CIVIL', CURRENT_DATE, TRUE, TRUE, 15),

-- ── LEC — Proceso Verbal (LEC Art. 437 ss) ───────────────────────────────────
('LAPSOS', 'LAPSO_CONTESTACION_VERBAL_ES',
    'Contestación — Proceso Verbal (LEC Art. 438)',
    'Contestación escrita en proceso verbal (Reforma LEC 2015)',
    '10', 'number', 'días hábiles', 'ES', 'CIVIL', CURRENT_DATE, TRUE, TRUE, 20),

-- ── LEC — Proceso Monitorio (LEC Art. 812 ss) ────────────────────────────────
('LAPSOS', 'LAPSO_MONITORIO_PAGO_ES',
    'Pago u Oposición — Proceso Monitorio (LEC Art. 815)',
    'Plazo del deudor para pagar o formular oposición en proceso monitorio',
    '20', 'number', 'días hábiles', 'ES', 'CIVIL', CURRENT_DATE, TRUE, TRUE, 25),

-- ── LRJS — Proceso Laboral (Ley 36/2011) ─────────────────────────────────────
('LAPSOS', 'LAPSO_CONTESTACION_LABORAL_ES',
    'Emplazamiento — Demanda Laboral (LRJS Art. 82)',
    'Plazo de citación al acto del juicio oral (el demandado contesta en el acto)',
    '10', 'number', 'días hábiles', 'ES', 'LABORAL', CURRENT_DATE, TRUE, TRUE, 30),

('LAPSOS', 'LAPSO_APELACION_LABORAL_ES',
    'Recurso de Suplicación — Anuncio (LRJS Art. 194)',
    'Plazo para anunciar el recurso de suplicación ante el TSJ',
    '5', 'number', 'días hábiles', 'ES', 'LABORAL', CURRENT_DATE, TRUE, TRUE, 31),

('LAPSOS', 'LAPSO_CASACION_LABORAL_ES',
    'Recurso de Casación para Unificación (LRJS Art. 221)',
    'Plazo para preparar el recurso de casación para unificación de doctrina',
    '10', 'number', 'días hábiles', 'ES', 'LABORAL', CURRENT_DATE, TRUE, TRUE, 32),

-- ── LJCA — Proceso Contencioso-Administrativo (Ley 29/1998) ──────────────────
('LAPSOS', 'LAPSO_CONTESTACION_ADMIN_ES',
    'Contestación Demanda C-A (LJCA Art. 54)',
    'Plazo para contestar la demanda contencioso-administrativa',
    '20', 'number', 'días hábiles', 'ES', 'ADMINISTRATIVO', CURRENT_DATE, TRUE, TRUE, 40),

('LAPSOS', 'LAPSO_APELACION_ADMIN_ES',
    'Recurso de Apelación C-A (LJCA Art. 85)',
    'Plazo para interponer recurso de apelación en vía contencioso-administrativa',
    '15', 'number', 'días hábiles', 'ES', 'ADMINISTRATIVO', CURRENT_DATE, TRUE, TRUE, 41),

-- ── Parámetros fiscales y operativos España ───────────────────────────────────
('SISTEMA', 'IVA_GENERAL_ES',
    'IVA General España',
    'Tipo general del Impuesto sobre el Valor Añadido — Ley 37/1992 Art. 90',
    '21', 'number', '%', 'ES', NULL, CURRENT_DATE, TRUE, TRUE, 60),

('SISTEMA', 'IVA_REDUCIDO_ES',
    'IVA Reducido España',
    'Tipo reducido IVA (aplicable a determinados servicios jurídicos — criterio DGT)',
    '10', 'number', '%', 'ES', NULL, CURRENT_DATE, TRUE, TRUE, 61),

('HONORARIOS', 'TURNO_OFICIO_GUARDIA_ES',
    'Guardia Turno de Oficio — Honorarios base (ES)',
    'Retribución orientativa turno de oficio de guardia — baremo Colegio de Abogados',
    '150', 'number', 'EUR', 'ES', NULL, CURRENT_DATE, TRUE, TRUE, 70),

('CALENDARIO', 'VACACIONES_JUDICIALES_AGOSTO_ES',
    'Vacaciones Judiciales Agosto (ES)',
    'En España no existe receso judicial generalizado en agosto (a diferencia de VE). Cada CCAA regula sus periodos inhábiles.',
    'false', 'boolean', NULL, 'ES', NULL, CURRENT_DATE, TRUE, TRUE, 50)

ON CONFLICT DO NOTHING;


-- =============================================================================
-- ROLLBACK (ejecutar en orden inverso si se necesita revertir):
-- =============================================================================
-- DROP TABLE IF EXISTS public.face_invoices;
-- DROP TABLE IF EXISTS public.eidas_signatures;
-- DELETE FROM public.system_parameters WHERE jurisdiction = 'ES';
-- DELETE FROM public.judicial_holidays  WHERE jurisdiction LIKE 'ES%';
-- DROP FUNCTION IF EXISTS public.set_updated_at();
-- =============================================================================
