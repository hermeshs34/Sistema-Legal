-- Migration: 20260526_rgpd_consents_ip_hint.sql
-- Agrega columna ip_hint a rgpd_consents.
-- La IP real se registra server-side via Edge Function; el cliente envía 'client-side'.

ALTER TABLE public.rgpd_consents
ADD COLUMN IF NOT EXISTS ip_hint text DEFAULT 'client-side';

-- rollback:
-- ALTER TABLE public.rgpd_consents DROP COLUMN IF EXISTS ip_hint;
