import { supabase } from '../../core/supabase.ts';
import type { ComplianceItem, RiskSummary } from './types.ts';
import { authService } from '../../core/auth.service.ts';

export const complianceService = {
    async getAll(): Promise<ComplianceItem[]> {
        const { data, error } = await supabase
            .from('compliance_items')
            .select('*')
            .eq('organization_id', authService.getCurrentUser()?.organizationId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching compliance items:', error);
            return [];
        }

        return (data || []).map(i => ({
            id: i.id,
            title: i.title,
            area: i.area,
            description: i.description,
            status: i.status,
            riskLevel: i.risk_level,
            lastAssessment: i.last_assessment,
            nextReview: i.next_review,
            assignedLawyerId: i.assigned_lawyer_id,
            linkedDocumentId: i.linked_document_id,
            observations: i.observations,
            legalCitation: i.legal_citation,
            organizationId: i.organization_id
        })) as ComplianceItem[];
    },

    async save(item: ComplianceItem) {
        const { error } = await supabase
            .from('compliance_items')
            .upsert({
                id: item.id || undefined, // UUID
                title: item.title,
                area: item.area,
                description: item.description,
                status: item.status,
                risk_level: item.riskLevel,
                last_assessment: item.lastAssessment,
                next_review: item.nextReview,
                assigned_lawyer_id: item.assignedLawyerId,
                linked_document_id: item.linkedDocumentId,
                observations: item.observations,
                legal_citation: item.legalCitation,
                organization_id: item.organizationId || authService.getCurrentUser()?.organizationId,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;

        // Módulo 8: Programar alertas automáticas si hay fecha de revisión
        if (item.nextReview) {
            const alertDate = new Date(item.nextReview);
            alertDate.setDate(alertDate.getDate() - 3); // Alerta 3 días antes del vencimiento
            
            const alertMsg = `[MÓDULO 8 - ALERTA PREVENTIVA]: Se aproxima el vencimiento de '${item.title}' (${item.nextReview}).` + 
                            (item.legalCitation ? ` Fundamento Jurídico: ${item.legalCitation}.` : '');

            await this.scheduleAlert(item.id || '', alertDate.toISOString().split('T')[0], alertMsg);
        }
    },

    async scheduleAlert(itemId: string, date: string, message: string) {
        const orgId = authService.getCurrentUser()?.organizationId;
        if (!itemId || !orgId) return;

        try {
            await supabase
                .from('compliance_alerts')
                .upsert({
                    compliance_item_id: itemId,
                    alert_date: date,
                    status: 'PENDING',
                    message,
                    organization_id: orgId,
                    created_at: new Date().toISOString()
                }, { onConflict: 'compliance_item_id,alert_date' });
        } catch (e) {
            console.warn('Error silente al programar alerta:', e);
        }
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('compliance_items')
            .delete()
            .eq('id', id)
            .eq('organization_id', authService.getCurrentUser()?.organizationId);

        if (error) throw error;
    },

    getSummary(items: ComplianceItem[]): RiskSummary {
        return {
            totalItems: items.length,
            compliantCount: items.filter(i => i.status === 'COMPLIANT').length,
            nonCompliantCount: items.filter(i => i.status === 'NON_COMPLIANT' || i.status === 'EXPIRED').length,
            criticalRiskCount: items.filter(i => i.riskLevel === 'CRITICAL').length,
            highRiskCount: items.filter(i => i.riskLevel === 'HIGH').length,
            pendingTasks: items.filter(i => i.status === 'PENDING' || i.status === 'PARTIAL').length
        };
    },

    async getConsentAuditLogs(): Promise<any[]> {
        const { data, error } = await supabase
            .from('rgpd_consents')
            .select(`
                id,
                policy_version,
                accepted_at,
                withdrawn_at,
                user_agent,
                profiles:user_id (name, email)
            `)
            .eq('organization_id', authService.getCurrentUser()?.organizationId)
            .order('accepted_at', { ascending: false });

        if (error) return [];
        return data || [];
    },

    async getAiUsageLogs(): Promise<any[]> {
        const { data, error } = await supabase
            .from('ai_usage_logs')
            .select(`
                *,
                profiles:user_id (name)
            `)
            .eq('organization_id', authService.getCurrentUser()?.organizationId)
            .order('created_at', { ascending: false });

        if (error) return [];
        return data || [];
    }
};
