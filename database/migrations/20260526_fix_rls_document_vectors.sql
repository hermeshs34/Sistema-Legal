-- Migration: 20260526_fix_rls_document_vectors.sql
-- Fix RLS policy para document_vectors — permitir INSERT al consultor_general
-- Error previo: "new row violates row-level security policy for table document_vectors"
-- Causa: tabla tenía RLS activo sin política de INSERT para usuarios autenticados admin

-- ── Política de INSERT ────────────────────────────────────────────────────────
-- Solo el consultor_general (admin) puede indexar conocimiento legal
CREATE POLICY "admin_insert_document_vectors"
ON public.document_vectors
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'consultor_general'
          AND profiles.is_active = true
    )
);

-- ── Política de SELECT ────────────────────────────────────────────────────────
-- Todos los usuarios autenticados de la misma organización pueden leer vectores
CREATE POLICY IF NOT EXISTS "authenticated_select_document_vectors"
ON public.document_vectors
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.is_active = true
    )
);

-- ── Política de DELETE ────────────────────────────────────────────────────────
-- Solo admin puede eliminar vectores (re-indexación)
CREATE POLICY "admin_delete_document_vectors"
ON public.document_vectors
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'consultor_general'
          AND profiles.is_active = true
    )
);

-- rollback:
-- DROP POLICY IF EXISTS "admin_insert_document_vectors" ON public.document_vectors;
-- DROP POLICY IF EXISTS "authenticated_select_document_vectors" ON public.document_vectors;
-- DROP POLICY IF EXISTS "admin_delete_document_vectors" ON public.document_vectors;
