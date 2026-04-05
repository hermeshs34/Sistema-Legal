import { supabase } from '../../core/supabase.ts';
import type { Lawyer } from './types.ts';
import { authService } from '../../core/auth.service.ts';

class LawyerService {
    async getAll(): Promise<Lawyer[]> {
        const user = authService.getCurrentUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('lawyers')
            .select('*')
            .eq('organization_id', user.organizationId)
            .order('name');

        if (error) {
            console.error('Error fetching lawyers:', error);
            return [];
        }

        return (data || []).map(l => ({
            id: l.id,
            name: l.name,
            email: l.email,
            phone: l.phone,
            inpreabogado: l.inpreabogado,
            type: l.type,
            specialty: l.specialty,
            isActive: l.is_active,
            organizationId: l.organization_id
        }));
    }

    async getById(id: string): Promise<Lawyer | null> {
        const user = authService.getCurrentUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('lawyers')
            .select('*')
            .eq('id', id)
            .eq('organization_id', user.organizationId)
            .single();

        if (error || !data) return null;

        return {
            id: data.id,
            name: data.name,
            email: data.email,
            phone: data.phone,
            inpreabogado: data.inpreabogado,
            type: data.type,
            specialty: data.specialty,
            isActive: data.is_active,
            organizationId: data.organization_id
        };
    }

    async save(lawyer: Lawyer): Promise<void> {
        const user = authService.getCurrentUser();
        const dbData = {
            id: lawyer.id,
            name: lawyer.name,
            email: lawyer.email,
            phone: lawyer.phone,
            inpreabogado: lawyer.inpreabogado,
            type: lawyer.type,
            specialty: lawyer.specialty,
            is_active: lawyer.isActive,
            organization_id: lawyer.organizationId || user?.organizationId
        };

        const { error } = await supabase
            .from('lawyers')
            .upsert(dbData);

        if (error) throw error;
    }

    async delete(id: string): Promise<void> {
        const user = authService.getCurrentUser();
        if (!user) return;

        const { error } = await supabase
            .from('lawyers')
            .delete()
            .eq('id', id)
            .eq('organization_id', user.organizationId);

        if (error) throw error;
    }

    generateId(): string {
        return crypto.randomUUID();
    }
}

export const lawyerService = new LawyerService();
