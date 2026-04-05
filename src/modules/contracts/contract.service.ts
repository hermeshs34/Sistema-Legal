import { supabase } from '../../core/supabase.ts';
import type { Contract } from './types.ts';
import { authService } from '../../core/auth.service.ts';

export const contractService = {
    async getAll(): Promise<Contract[]> {
        const { data, error } = await supabase
            .from('contracts')
            .select('*')
            .eq('organization_id', authService.getCurrentUser()?.organizationId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching contracts:', error);
            return [];
        }

        return (data || []).map(c => ({
            id: c.id,
            title: c.title,
            type: c.type,
            status: c.status,
            parties: c.parties,
            startDate: c.start_date,
            endDate: c.end_date,
            value: Number(c.value),
            currency: c.currency,
            assignedLawyerId: c.assigned_lawyer_id,
            assignedLawyerName: c.assigned_lawyer_name || undefined,
            description: c.description,
            content_draft: c.content_draft,
            file_url: c.file_url,
            analysis_id: c.analysis_id,
            document_id: c.document_id,
            metadata: c.metadata,
            organizationId: c.organization_id,
            // Campos de firma electrónica
            signature_status: c.signature_status || 'unsigned',
            signature_hash: c.signature_hash || undefined,
            signature_token: c.signature_token || undefined,
            signed_at: c.signed_at || undefined,
            signed_by_name: c.signed_by_name || undefined,
            signed_by_email: c.signed_by_email || undefined,
        })) as Contract[];
    },

    async save(contract: Contract): Promise<void> {
        // La detección de auditoría ahora es automática en DB

        const dbData = {
            id: contract.id,
            title: contract.title,
            type: contract.type,
            status: contract.status,
            parties: contract.parties,
            start_date: contract.startDate,
            end_date: contract.endDate,
            value: contract.value,
            currency: contract.currency,
            assigned_lawyer_id: contract.assignedLawyerId,
            assigned_lawyer_name: contract.assignedLawyerName || null,
            description: contract.description,
            content_draft: contract.content_draft || null,
            file_url: contract.file_url || null,
            document_id: contract.document_id || null,
            metadata: contract.metadata,
            organization_id: contract.organizationId || authService.getCurrentUser()?.organizationId
        };

        const { error } = await supabase
            .from('contracts')
            .upsert(dbData);

        if (error) throw error;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('contracts')
            .delete()
            .eq('id', id)
            .eq('organization_id', authService.getCurrentUser()?.organizationId);

        if (error) throw error;
    },

    generateId(): string {
        return crypto.randomUUID();
    },

    /** Verifica si ya existe un contrato vinculado al document_id dado */
    async findByDocumentId(documentId: string): Promise<string | null> {
        const { data } = await supabase
            .from('contracts')
            .select('id')
            .eq('document_id', documentId)
            .eq('organization_id', authService.getCurrentUser()?.organizationId)
            .maybeSingle();
        return data?.id ?? null;
    },

    async getMetadata(id: string): Promise<any> {
        const { data } = await supabase.from('contracts').select('metadata').eq('id', id).single();
        return data?.metadata || {};
    }
};
