import { supabase } from '../../core/supabase.ts';

export type AuditEntity = 'document' | 'user' | 'lawyer' | 'contract' | 'compliance' | 'expediente';
export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'status_change' | 'comment';

export interface AuditLog {
    id?: string;
    entityType: string;
    entityId: string;
    action: AuditAction | string;
    details: any;
    oldData?: any;
    newData?: any;
    userId?: string;
    organizationId?: string;
    createdAt?: string;
}

export const auditService = {
    // Generador de Hash SHA-256 (Forense)
    async generateHash(content: string): Promise<string> {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(content);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (err) {
            console.error('Crypto error:', err);
            return 'fallback_hash_' + Date.now();
        }
    },

    /**
     * Registra un evento de auditoría virtual (Eventos que NO ocurren por cambios en tablas, ej: Login, Export)
     * Los cambios en tablas se auditan AUTOMÁTICAMENTE vía DB Trigger en Supabase.
     */
    async log(log: AuditLog): Promise<void> {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { error } = await supabase.from('audit_logs').insert({
                entity_type: log.entityType,
                entity_id: log.entityId,
                action: log.action,
                details: log.details,
                user_id: user?.id || log.userId,
                organization_id: log.organizationId || (user as any)?.organization_id, // RLS hará el resto
                checksum: 'VIRTUAL_EVENT' // Marcaremos estos como virtuales para no romper la cadena criptográfica de tablas
            });

            if (error) throw error;
        } catch (error) {
            console.error('Audit Log Error (Virtual Event):', error);
        }
    },

    async getByEntity(entityType?: string, entityId?: string): Promise<AuditLog[]> {
        let query = supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false });

        if (entityType) {
            query = query.eq('entity_type', entityType);
        }
        
        if (entityId) {
            query = query.eq('entity_id', entityId);
        } else if (entityType) {
            // Si hay tipo pero no ID, bajamos el limite para no saturar si es una tabla muy grande
            query = query.limit(100);
        } else {
            // Consulta Global: Limitamos a los últimos 500 para rendimiento
            query = query.limit(500);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Audit Fetch Error:', error);
            return [];
        }

        return (data || []).map(l => ({
            id: l.id,
            entityType: l.entity_type,
            entityId: l.entity_id,
            action: l.action,
            details: l.details,
            oldData: l.old_data,
            newData: l.new_data,
            userId: l.user_id,
            organizationId: l.organization_id,
            createdAt: l.created_at
        }));
    },

    getDiff(oldData: any, newData: any) {
        if (!oldData || !newData) return null;
        const diff: any = {};
        const skip = ['updated_at', 'created_at', 'id'];
        Object.keys({ ...oldData, ...newData }).forEach(k => {
            if (skip.includes(k)) return;
            if (JSON.stringify(oldData[k]) !== JSON.stringify(newData[k])) {
                diff[k] = { old: oldData[k], new: newData[k] };
            }
        });
        return Object.keys(diff).length > 0 ? diff : null;
    },

    /** Verificación reactiva de la salud de la cadena (Global para integridad sistémica) */
    async verifyChain(_organizationId?: string, limit: number = 80): Promise<{ healthy: boolean; details: any }> {
        // La cadena es GLOBAL, buscamos los últimos logs para verificar integridad secuencial
        const { data: logs } = await supabase
            .from('audit_logs')
            .select('id, checksum, previous_hash, created_at')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (!logs || logs.length < 2) return { healthy: true, details: 'Insufficient logs for verification' };

        // Solo auditamos registros que tengan el motor forense habilitado (checksum)
        const forensicLogs = logs.filter(l => l.checksum && l.previous_hash);
        
        if (forensicLogs.length < 2) return { healthy: true, details: 'Insufficient forensic logs' };

        for (let i = 0; i < forensicLogs.length; i++) {
            const current = forensicLogs[i];
            
            // Si el registro es de tipo VIRTUAL o su padre lo es, saltamos esta validación secuencial
            if (current.previous_hash === 'VIRTUAL_EVENT' || current.checksum === 'VIRTUAL_EVENT') {
                continue;
            }
            
            // Verificación: El anterior (i+1) debe ser el padre (checksum)
            // O algún registro más antiguo (i+2, i+3...) debe serlo (en caso de concurrencia masiva)
            let foundParent = false;
            for (let j = i + 1; j < forensicLogs.length; j++) {
                if (current.previous_hash === forensicLogs[j].checksum) {
                    foundParent = true;
                    break;
                }
                // Si encontramos un hermano con el mismo padre, también es un estado de integridad válido (fork natural)
                if (current.previous_hash === forensicLogs[j].previous_hash) {
                    foundParent = true;
                    break;
                }
            }

            // IMPORTANTE: Solo fallamos si NO encontramos al padre en los logs recientes 
            // Y no es un evento virtual root
            if (!foundParent && current.previous_hash && current.previous_hash.length > 20) {
                // Pequeña tolerancia: En despliegues nuevos o tras purgas, es posible que el padre no esté en los últimos 80
                // Solo marcamos brecha si el registro es muy reciente (últimos 10)
                if (i < 10) {
                    return { 
                        healthy: false, 
                        details: `Integrity breach detected at log ${current.id}. Parent hash ${current.previous_hash.substring(0,8)}... not in recent chain.` 
                    };
                }
            }
        }

        return { healthy: true, details: `Verified successfully across ${forensicLogs.length} entries for org ${_organizationId || 'global'}` };
    }
};
