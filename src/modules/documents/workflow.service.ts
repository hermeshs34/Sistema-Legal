import { supabase } from '../../core/supabase.ts';
import { authService } from '../../core/auth.service.ts';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface DocumentApproval {
    id?: string;
    documentId: string;
    stepName: string;
    status: ApprovalStatus;
    assignedRole?: string;
    approverId?: string;
    comments?: string;
    completedAt?: string;
    organizationId?: string;
    createdAt?: string;
}

export const workflowService = {
    async createStep(approval: DocumentApproval): Promise<void> {
        const user = authService.getCurrentUser();
        const { error } = await supabase
            .from('document_approvals')
            .insert({
                document_id: approval.documentId,
                step_name: approval.stepName,
                status: approval.status,
                assigned_role: approval.assignedRole,
                organization_id: user?.organizationId
            });

        if (error) throw error;
    },

    async getByDocument(documentId: string): Promise<DocumentApproval[]> {
        const { data, error } = await supabase
            .from('document_approvals')
            .select('*')
            .eq('document_id', documentId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching approvals:', error);
            return [];
        }

        return (data || []).map(a => ({
            id: a.id,
            documentId: a.document_id,
            stepName: a.step_name,
            status: a.status as ApprovalStatus,
            assignedRole: a.assigned_role,
            approverId: a.approver_id,
            comments: a.comments,
            completedAt: a.completed_at,
            organizationId: a.organization_id,
            createdAt: a.created_at
        }));
    },

    async updateStatus(id: string, status: ApprovalStatus, comments?: string): Promise<void> {
        const user = authService.getCurrentUser();
        const { error } = await supabase
            .from('document_approvals')
            .update({
                status: status,
                comments: comments,
                approver_id: user?.id,
                completed_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;
    }
};
