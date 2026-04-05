/**
 * signature.service.ts
 * FASE 1 — Firma Electrónica Básica para LegalDoc VE
 */

import { supabase } from '../../core/supabase.ts';
import { auditService } from '../shared/audit.service.ts';

export interface SignatureRequest {
    contractId: string;
    contractTitle: string;
    contractContent: string;   
    signerName: string;
    signerEmail: string;
    userId: string;
    organizationId: string;
    biometricPhoto?: string;   
    metadata?: Record<string, any>;
}

export interface SignatureResult {
    hash: string;
    token: string;
    signedAt: string;
}

class SignatureService {
    private async generateHash(content: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    private generateToken(): string {
        const uuid = crypto.randomUUID().replace(/-/g, '');
        const ts = Date.now().toString(36).toUpperCase();
        return `LDV-${ts}-${uuid.slice(0, 12).toUpperCase()}`;
    }

    private buildCanonicalContent(contract: any, contentBody: string): string {
        let signedAt = 'UNSET';
        const d_at = contract.signed_at || contract.signedAt;
        if (d_at) {
            signedAt = new Date(d_at).toISOString().split('.')[0] + 'Z';
        }

        const bioLen = contract.metadata?.biometric_length || contract.biometricLength || 'NONE';
        const realId = contract.id || contract.contractId || 'UNKNOWN';
        const realTitle = (contract.title || contract.contractTitle || '').trim().toUpperCase();

        const cleanBody = contentBody
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&[a-z]+;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        return [
            `LEGALDOC-VE-V2`,
            `ID:${realId}`,
            `TITLE:${realTitle}`,
            `SIGNER:${(contract.signed_by_name || contract.signerName || '').trim()} <${(contract.signed_by_email || contract.signerEmail || '').trim()}>`,
            `DATE:${signedAt}`,
            `BIO:${bioLen}`,
            `BODY:`,
            cleanBody
        ].join('\n');
    }

    async signBasic(req: SignatureRequest): Promise<SignatureResult> {
        // FETCH PREVIO: Necesitamos los metadatos actuales para no machacarlos
        const { data: current } = await supabase.from('contracts').select('*').eq('id', req.contractId).single();

        const now = new Date();
        now.setMilliseconds(0);
        const signedAt = now.toISOString();
        const bioLength = req.biometricPhoto ? req.biometricPhoto.length : null;

        const contentToHash = this.buildCanonicalContent(
            { ...req, signed_at: signedAt, biometricLength: bioLength },
            req.contractContent
        );

        // Silencioso. El rastro queda solo en DB Auditoría.
        const hash = await this.generateHash(contentToHash);
        const token = this.generateToken();

        const { error } = await supabase
            .from('contracts') // Tabla de producción
            .update({
                signature_status: 'signed_basic',
                signature_hash: hash,
                signature_token: token,
                signed_at: signedAt,
                signed_by_name: req.signerName,
                signed_by_email: req.signerEmail,
                metadata: {
                    ...(current?.metadata || {}),
                    ...(req.metadata || {}),
                    has_biometric: !!req.biometricPhoto,
                    biometric_photo: req.biometricPhoto, // GUARDAMOS LA EVIDENCIA VISUAL
                    biometric_length: bioLength,
                    biometric_timestamp: !!req.biometricPhoto ? signedAt : null
                }
            })
            .eq('id', req.contractId);

        if (error) throw new Error(`Error al registrar la firma: ${error.message}`);

        await auditService.log({
            entityType: 'contract',
            entityId: req.contractId,
            action: 'status_change',
            details: { 
                action: 'signed_basic', 
                signerName: req.signerName, 
                hash: hash.slice(0, 16) + '…',
                evidence: 'GEO+IP+BIO'
            },
            userId: req.userId,
            organizationId: req.organizationId,
        });

        return { hash, token, signedAt };
    }

    async verify(contractId: string, currentContent: string): Promise<{
        valid: boolean;
        contract: any;
        message: string;
    }> {
        const { data: contract, error } = await supabase.from('contracts').select('*').eq('id', contractId).single();

        if (error || !contract) return { valid: false, contract: null, message: 'Contrato no encontrado.' };
        if (contract.signature_status === 'unsigned') return { valid: false, contract, message: 'Este documento carece de firma.' };

        const contentToVerify = this.buildCanonicalContent(contract, currentContent);
        const recalculatedHash = await this.generateHash(contentToVerify);
        
        if (recalculatedHash === contract.signature_hash) {
            return {
                valid: true,
                contract,
                message: `✅ CERTIFICADO DE INTEGRIDAD VÁLIDO: El documento no ha sido alterado.`
            };
        } else {
            return {
                valid: false,
                contract,
                message: `ALERTA DE ALTERACION: Los hashes no coinciden.`
            };
        }
    }

    async revoke(contractId: string, userId: string, organizationId: string): Promise<void> {
        const { error } = await supabase
            .from('contracts') // Tabla de producción
            .update({
                signature_status: 'unsigned',
                signature_hash: null,
                signature_token: null,
                signed_at: null,
                signed_by_name: null,
                signed_by_email: null,
            })
            .eq('id', contractId);

        if (error) throw new Error(`Error al revocar la firma: ${error.message}`);

        await auditService.log({
            entityType: 'contract',
            entityId: contractId,
            action: 'status_change',
            details: { action: 'signature_revoked' },
            userId,
            organizationId,
        });
    }
}

export const signatureService = new SignatureService();
