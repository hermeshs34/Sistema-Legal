/**
 * eidas.service.ts
 * Firma electrónica bajo eIDAS (Reglamento UE 910/2014) para la jurisdicción ES.
 *
 * Niveles soportados:
 *   SES  — Simple Electronic Signature     (hash SHA-256 interno, LSSI/eIDAS básico)
 *   AdES — Advanced Electronic Signature   (Signaturit — certificado vinculado al firmante)
 *   QES  — Qualified Electronic Signature  (Uanataca / AutoFirma FNMT — máximo valor legal)
 *
 * Proveedor principal: Signaturit (https://docs.signaturit.com/api/v3)
 *   → La API key NUNCA sale del frontend. Toda llamada va por la Edge Function
 *     'legal-ai-processor' (o 'eidas-proxy' si se crea una dedicada).
 *
 * Equivalencia legal:
 *   QES en ES = firma manuscrita (Art. 25.2 eIDAS)
 *   AdES = prueba en juicio válida pero no equiparada a manuscrita
 *   SES  = evidencia electrónica (admisible como prueba, valor limitado)
 *
 * Integración con España:
 *   - Lexnet: los escritos presentados via Lexnet ya llevan firma de certificado
 *             del Colegio de Abogados → el PDF adjunto debe ser AdES mínimo.
 *   - FACe:   las facturas electrónicas requieren XML firmado (XAdES-BES).
 */

import { supabase } from '../../core/supabase.ts';
import { authService } from '../../core/auth.service.ts';
import { auditService } from '../shared/audit.service.ts';

// ── Tipos ────────────────────────────────────────────────────────────────────

export type EidasLevel    = 'SES' | 'AdES' | 'QES';
export type EidasProvider = 'internal' | 'signaturit' | 'uanataca' | 'viafirma' | 'autofirma';
export type EidasStatus   = 'pending' | 'signed' | 'rejected' | 'expired' | 'cancelled';

export interface EidasSignatureRequest {
    contractId:      string;
    contractTitle:   string;
    contractContent: string;          // HTML o texto plano del documento
    signerName:      string;
    signerEmail:     string;
    signerNif?:      string;          // NIF/NIE del firmante (obligatorio para QES)
    level:           EidasLevel;
    provider:        EidasProvider;
    expiresInHours?: number;          // Tiempo para firmar — default 48h
    sendEmailToSigner?: boolean;      // Enviar email de invitación (Signaturit lo gestiona)
    callbackUrl?:    string;          // Webhook cuando se firma
    jurisdiction?:   'ES' | 'EU' | 'VE';
}

export interface EidasSignatureRecord {
    id:                  string;
    contractId:          string;
    signatureLevel:      EidasLevel;
    provider:            EidasProvider;
    providerSignatureId?: string;
    signingUrl?:         string;
    signerName:          string;
    signerEmail:         string;
    signerNif?:          string;
    status:              EidasStatus;
    signatureHash?:      string;
    signedAt?:           string;
    expiresAt?:          string;
    auditTrail?:         Record<string, unknown>;
    legalFramework:      string;
    jurisdiction:        string;
}

export interface EidasSignResult {
    record:     EidasSignatureRecord;
    signingUrl?: string;    // URL a enviar al firmante (para AdES/QES vía Signaturit)
    message:    string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const DEFAULT_EXPIRES_HOURS = 48;

// ── Helpers internos ─────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data    = encoder.encode(text);
    const buf     = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Servicio ─────────────────────────────────────────────────────────────────

class EidasService {

    /**
     * Punto de entrada principal.
     * Redirige al proveedor correcto según level+provider del request.
     */
    async requestSignature(req: EidasSignatureRequest): Promise<EidasSignResult> {
        const user = authService.getCurrentUser();
        if (!user) throw new Error('No hay sesión activa');

        switch (req.provider) {
            case 'signaturit': return this._signaturit(req, user);
            case 'internal':   return this._internalSES(req, user);
            default:
                throw new Error(`Proveedor '${req.provider}' no implementado en esta versión. Use 'signaturit' o 'internal'.`);
        }
    }

    // ── Proveedor: Signaturit (AdES / QES) ───────────────────────────────────
    //
    // Flujo:
    //   1. Llamar a la Edge Function 'eidas-proxy' con el payload
    //   2. La Edge Function llama a la API de Signaturit con la API key
    //   3. Signaturit retorna un signature_id y una signing_url
    //   4. Guardamos el registro en eidas_signatures
    //   5. El frontend muestra la URL al usuario o la envía por email
    //
    // Webhook de Signaturit → Edge Function 'eidas-webhook' → UPDATE eidas_signatures

    private async _signaturit(req: EidasSignatureRequest, user: any): Promise<EidasSignResult> {
        if (req.level === 'QES' && !req.signerNif) {
            throw new Error('QES requiere el NIF/NIE del firmante para vincular el certificado cualificado.');
        }

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + (req.expiresInHours ?? DEFAULT_EXPIRES_HOURS));

        // Llamada a la Edge Function proxy (nunca la API key en el frontend)
        const { data: proxyResult, error: proxyErr } = await supabase.functions.invoke(
            'legal-ai-processor',
            {
                body: {
                    action:     'eidas_signaturit_create',
                    contractId: req.contractId,
                    title:      req.contractTitle,
                    content:    req.contractContent,
                    signer: {
                        name:  req.signerName,
                        email: req.signerEmail,
                        nif:   req.signerNif ?? null,
                    },
                    level:      req.level,
                    expiresAt:  expiresAt.toISOString(),
                    callbackUrl: req.callbackUrl ?? null,
                    sendEmail:  req.sendEmailToSigner ?? true,
                },
            }
        );

        if (proxyErr) {
            throw new Error(`Error al crear firma Signaturit: ${proxyErr.message}`);
        }

        const providerData = proxyResult as {
            signature_id:  string;
            document_id:   string;
            signing_url:   string;
            status:        string;
        };

        // Guardar en BD
        const { data: row, error: dbErr } = await supabase
            .from('eidas_signatures')
            .insert({
                organization_id:       user.organizationId,
                contract_id:           req.contractId,
                signature_level:       req.level,
                provider:              'signaturit',
                provider_signature_id: providerData.signature_id,
                provider_document_id:  providerData.document_id,
                signing_url:           providerData.signing_url,
                signer_name:           req.signerName,
                signer_email:          req.signerEmail,
                signer_nif:            req.signerNif ?? null,
                status:                'pending',
                expires_at:            expiresAt.toISOString(),
                sent_at:               new Date().toISOString(),
                jurisdiction:          req.jurisdiction ?? 'ES',
                legal_framework:       'eIDAS',
                created_by:            user.id,
            })
            .select()
            .single();

        if (dbErr || !row) throw new Error('Error al registrar la firma en BD: ' + dbErr?.message);

        await auditService.log({
            entityType: 'contract', entityId: req.contractId,
            action: 'eidas_sign_requested' as any,
            details: {
                level: req.level, provider: 'signaturit',
                signerId: row.id, signerEmail: req.signerEmail,
            },
            userId: user.id, organizationId: user.organizationId,
        });

        return {
            record:     this._mapRow(row),
            signingUrl: providerData.signing_url,
            message:    `Solicitud de firma eIDAS ${req.level} enviada. El firmante recibirá el enlace en ${req.signerEmail}.`,
        };
    }

    // ── Proveedor: internal (SES — hash SHA-256) ──────────────────────────────
    // Equivalente al sistema actual de firma básica, pero registrado en eidas_signatures
    // con trazabilidad formal.

    private async _internalSES(req: EidasSignatureRequest, user: any): Promise<EidasSignResult> {
        const now        = new Date();
        const canonical  = [
            'LEGALDOC-EIDAS-SES-V1',
            `CONTRACT:${req.contractId}`,
            `TITLE:${req.contractTitle.trim().toUpperCase()}`,
            `SIGNER:${req.signerName.trim()} <${req.signerEmail.trim()}>`,
            `DATE:${now.toISOString().replace('.', '').split('.')[0]}Z`,
            `BODY:`,
            req.contractContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
        ].join('\n');

        const hash = await sha256(canonical);

        const { data: row, error: dbErr } = await supabase
            .from('eidas_signatures')
            .insert({
                organization_id:  user.organizationId,
                contract_id:      req.contractId,
                signature_level:  'SES',
                provider:         'internal',
                signer_name:      req.signerName,
                signer_email:     req.signerEmail,
                signer_nif:       req.signerNif ?? null,
                status:           'signed',
                signature_hash:   hash,
                signed_at:        now.toISOString(),
                sent_at:          now.toISOString(),
                jurisdiction:     req.jurisdiction ?? 'ES',
                legal_framework:  'eIDAS',
                created_by:       user.id,
                audit_trail: {
                    method:    'SHA-256 canonical content',
                    version:   'LEGALDOC-EIDAS-SES-V1',
                    signed_by: `${req.signerName} <${req.signerEmail}>`,
                    ip:        'client-side',
                },
            })
            .select()
            .single();

        if (dbErr || !row) throw new Error('Error al registrar SES: ' + dbErr?.message);

        // También actualizar la tabla contracts para compatibilidad
        await supabase.from('contracts').update({
            signature_status:  'signed',
            signature_hash:    hash,
            signed_at:         now.toISOString(),
            signed_by_name:    req.signerName,
            signed_by_email:   req.signerEmail,
        }).eq('id', req.contractId);

        await auditService.log({
            entityType: 'contract', entityId: req.contractId,
            action: 'eidas_ses_signed' as any,
            details: { hash, signerEmail: req.signerEmail, level: 'SES' },
            userId: user.id, organizationId: user.organizationId,
        });

        return {
            record:  this._mapRow(row),
            message: 'Firma SES (nivel básico eIDAS) registrada correctamente.',
        };
    }

    // ── Obtener historial de firmas de un contrato ────────────────────────────

    async getByContract(contractId: string): Promise<EidasSignatureRecord[]> {
        const user = authService.getCurrentUser();
        if (!user) return [];

        const { data } = await supabase
            .from('eidas_signatures')
            .select('*')
            .eq('contract_id', contractId)
            .eq('organization_id', user.organizationId)
            .order('created_at', { ascending: false });

        return (data ?? []).map(r => this._mapRow(r));
    }

    // ── Webhook: actualizar estado cuando Signaturit notifica ─────────────────
    // Este método se llama desde la Edge Function 'eidas-webhook' tras validar la firma

    async handleWebhook(payload: {
        providerSignatureId:  string;
        status:               EidasStatus;
        signedAt?:            string;
        signatureHash?:       string;
        certificateSerial?:   string;
        certificateIssuer?:   string;
        signedDocumentUrl?:   string;
        tsaTimestamp?:        string;
        auditTrail?:          Record<string, unknown>;
    }): Promise<void> {
        const updates: Record<string, unknown> = {
            status: payload.status,
        };
        if (payload.signedAt)          updates.signed_at           = payload.signedAt;
        if (payload.signatureHash)     updates.signature_hash      = payload.signatureHash;
        if (payload.certificateSerial) updates.certificate_serial  = payload.certificateSerial;
        if (payload.certificateIssuer) updates.certificate_issuer  = payload.certificateIssuer;
        if (payload.signedDocumentUrl) updates.signed_document_url = payload.signedDocumentUrl;
        if (payload.tsaTimestamp)      updates.tsa_timestamp       = payload.tsaTimestamp;
        if (payload.auditTrail)        updates.audit_trail         = payload.auditTrail;

        const { error } = await supabase
            .from('eidas_signatures')
            .update(updates)
            .eq('provider_signature_id', payload.providerSignatureId);

        if (error) throw new Error('Error al procesar webhook eIDAS: ' + error.message);
    }

    // ── Cancelar solicitud de firma ───────────────────────────────────────────

    async cancel(signatureId: string): Promise<void> {
        const user = authService.getCurrentUser();
        if (!user) throw new Error('No autenticado');

        const { data: sig } = await supabase
            .from('eidas_signatures')
            .select('provider, provider_signature_id')
            .eq('id', signatureId)
            .eq('organization_id', user.organizationId)
            .single();

        if (!sig) throw new Error('Firma no encontrada');

        if (sig.provider === 'signaturit' && sig.provider_signature_id) {
            // Cancelar en Signaturit via Edge Function
            await supabase.functions.invoke('legal-ai-processor', {
                body: {
                    action:       'eidas_signaturit_cancel',
                    signatureId:  sig.provider_signature_id,
                },
            });
        }

        await supabase
            .from('eidas_signatures')
            .update({ status: 'cancelled' })
            .eq('id', signatureId)
            .eq('organization_id', user.organizationId);
    }

    // ── Mapper ────────────────────────────────────────────────────────────────

    private _mapRow(row: any): EidasSignatureRecord {
        return {
            id:                  row.id,
            contractId:          row.contract_id,
            signatureLevel:      row.signature_level as EidasLevel,
            provider:            row.provider as EidasProvider,
            providerSignatureId: row.provider_signature_id ?? undefined,
            signingUrl:          row.signing_url ?? undefined,
            signerName:          row.signer_name,
            signerEmail:         row.signer_email,
            signerNif:           row.signer_nif ?? undefined,
            status:              row.status as EidasStatus,
            signatureHash:       row.signature_hash ?? undefined,
            signedAt:            row.signed_at ?? undefined,
            expiresAt:           row.expires_at ?? undefined,
            auditTrail:          row.audit_trail ?? undefined,
            legalFramework:      row.legal_framework,
            jurisdiction:        row.jurisdiction,
        };
    }
}

export const eidasService = new EidasService();

// ── Helpers de display ───────────────────────────────────────────────────────

export const EIDAS_LEVEL_CONFIG: Record<EidasLevel, {
    label: string; color: string; bg: string; border: string;
    legalValue: string; description: string;
}> = {
    SES: {
        label: 'SES — Básica',
        color: '#64748b', bg: '#f8fafc', border: '#cbd5e1',
        legalValue: 'Evidencia electrónica (valor probatorio limitado)',
        description: 'Firma electrónica simple. SHA-256 interno. Válida para comunicaciones ordinarias.',
    },
    AdES: {
        label: 'AdES — Avanzada',
        color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd',
        legalValue: 'Admisible como prueba en juicio (Art. 26 eIDAS)',
        description: 'Firma avanzada vinculada al firmante. Certificado digital personal. Signaturit.',
    },
    QES: {
        label: 'QES — Cualificada',
        color: '#166534', bg: '#f0fdf4', border: '#86efac',
        legalValue: '= Firma manuscrita (Art. 25.2 eIDAS — plena eficacia jurídica)',
        description: 'Firma cualificada con certificado EIDAS. FNMT / Uanataca. Máximo valor legal en la UE.',
    },
};

export const EIDAS_STATUS_CONFIG: Record<EidasStatus, {
    label: string; color: string; bg: string; emoji: string;
}> = {
    pending:   { label: 'Pendiente de firma', color: '#d97706', bg: '#fffbeb', emoji: '⏳' },
    signed:    { label: 'Firmado',            color: '#166534', bg: '#f0fdf4', emoji: '✅' },
    rejected:  { label: 'Rechazado',          color: '#991b1b', bg: '#fef2f2', emoji: '❌' },
    expired:   { label: 'Caducado',           color: '#6b7280', bg: '#f9fafb', emoji: '⏰' },
    cancelled: { label: 'Cancelado',          color: '#374151', bg: '#f3f4f6', emoji: '🚫' },
};
