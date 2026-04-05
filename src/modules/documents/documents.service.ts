import { supabase } from '../../core/supabase.ts';
import type { Document, DocumentFilter } from './types.ts';
import { authService } from '../../core/auth.service.ts';

class DocumentService {
    async getAll(filter?: DocumentFilter): Promise<Document[]> {
        const user = authService.getCurrentUser();
        const orgId = user?.organizationId;

        let query = supabase
            .from('documents')
            .select('*')
            .eq('organization_id', orgId) // Filtro Multi-tenant Explícito (Doble Candado)
            .order('created_at', { ascending: false });

        if (filter) {
            if (filter.type) query = query.eq('type', filter.type);
            if (filter.status) query = query.eq('status', filter.status);
            if (filter.riskLevel) query = query.eq('risk_level', filter.riskLevel);
            if (filter.assignedTo) query = query.eq('assigned_to', filter.assignedTo);
            if (filter.search) {
                query = query.or(`title.ilike.%${filter.search}%,description.ilike.%${filter.search}%`);
            }
        }

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching documents:', error);
            return [];
        }

        return (data || []).map(d => ({
            id: d.id,
            title: d.title,
            description: d.description,
            type: d.type,
            status: d.status,
            riskLevel: d.risk_level,
            version: d.version,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
            assignedTo: d.assigned_to,
            metadata: d.metadata,
            signatureStatus: d.signature_status,
            organizationId: d.organization_id,
            region: d.region,
            fileUrl: d.file_url,
            createdBy: d.created_by
        })) as Document[];
    }

    async getById(id: string): Promise<Document | null> {
        const orgId = authService.getCurrentUser()?.organizationId;
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('id', id)
            .eq('organization_id', orgId) // Filtro Multi-tenant Explícito
            .single();

        if (error || !data) return null;

        return {
            id: data.id,
            title: data.title,
            description: data.description,
            type: data.type,
            status: data.status,
            riskLevel: data.risk_level,
            version: data.version,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            assignedTo: data.assigned_to,
            metadata: data.metadata,
            signatureStatus: data.signature_status,
            organizationId: data.organization_id,
            region: data.region,
            fileUrl: data.file_url,
            createdBy: data.created_by
        } as Document;
    }

    async save(doc: Document): Promise<void> {
        const user = authService.getCurrentUser();
        const orgId = doc.organizationId || user?.organizationId;

        const dbDoc = {
            id: doc.id,
            title: doc.title,
            description: doc.description,
            type: doc.type,
            status: doc.status,
            risk_level: doc.riskLevel,
            version: doc.version,
            assigned_to: doc.assignedTo,
            metadata: doc.metadata,
            signature_status: doc.signatureStatus,
            organization_id: orgId,
            region: doc.region,
            file_url: doc.fileUrl,
            created_by: doc.createdBy || user?.id,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('documents')
            .upsert(dbDoc);

        if (error) throw error;
        // Auditoría automática via DB Trigger (SHA-256)
    }

    async delete(id: string): Promise<void> {
        const orgId = authService.getCurrentUser()?.organizationId;
        const { error } = await supabase
            .from('documents')
            .delete()
            .eq('id', id)
            .eq('organization_id', orgId); // Filtro Multi-tenant Explícito

        if (error) throw error;
        // Auditoría automática via DB Trigger (SHA-256)
    }

    async uploadFile(file: File, path: string): Promise<string> {
        const { data, error } = await supabase.storage
            .from('legal-documents')
            .upload(path, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (error) throw error;
        
        // Retornamos el PATH interno del storage, NO una URL pública.
        // La URL de acceso temporal se genera bajo demanda con getDownloadUrl().
        return data.path;
    }

    /** 
     * Genera una URL de acceso temporal (60 min) para visualizar documentos privados 
     */
    async getDownloadUrl(path: string): Promise<string> {
        if (!path) return '';
        const { data, error } = await supabase.storage
            .from('legal-documents')
            .createSignedUrl(path, 3600); // URL válida por 1 hora

        if (error) {
            console.error('Error generating Signed URL:', error);
            return '';
        }

        return data.signedUrl;
    }

    generateId(): string {
        return crypto.randomUUID();
    }
}

export const documentService = new DocumentService();
