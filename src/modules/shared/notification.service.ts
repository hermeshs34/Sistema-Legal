import { supabase } from '../../core/supabase.ts';

export interface NotificationPayload {
    recipient: string; // Email o Teléfono
    type: 'email' | 'sms';
    subject?: string;
    message: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * NotificationService.ts
 * Motor de comunicación multicanal para LegalDoc VE.
 * Gestiona el envío de alertas de vencimiento, riesgos legales y auditoría.
 */
export const notificationService = {
    /**
     * Envía una notificación.
     * En producción, esto se integra con Resend/Twilio vía Supabase Edge Functions.
     */
    async send(payload: NotificationPayload): Promise<boolean> {
        console.log(`📡 [NOTIFICACIÓN ENVIADA - ${payload.type.toUpperCase()}]`, payload);
        
        // Simulación de canal de salida
        const success = Math.random() > 0.05; // 95% de éxito simulado
        
        // Registro en tabla de logs de notificaciones (opcional para trazabilidad)
        try {
            await supabase.from('notification_logs').insert({
                recipient: payload.recipient,
                channel: payload.type,
                message: payload.message,
                status: success ? 'sent' : 'failed',
                priority: payload.priority
            });
        } catch (err) {
            console.warn('Error silente al registrar log de notificación:', err);
        }

        return success;
    },

    /**
     * Envia Alerta de Vencimiento < 3 días
     */
    async sendExpirationAlert(email: string, docTitle: string, daysLeft: number) {
        return this.send({
            recipient: email,
            type: 'email',
            subject: '⚠️ ALERTA DE VENCIMIENTO INMINENTE',
            message: `Estimado colega, el documento "${docTitle}" vence en solo ${daysLeft} días. Por favor, tome las medidas necesarias en el módulo de Cumplimiento.`,
            priority: 'critical'
        });
    },

    /**
     * Envia Alerta SMS de Seguridad
     */
    async sendSmsAlert(phone: string, msg: string) {
        return this.send({
            recipient: phone,
            type: 'sms',
            message: `LegalDoc VE: ${msg}`,
            priority: 'high'
        });
    },

    /**
     * Recupera alertas de cumplimiento pendientes para hoy o vencidas.
     */
    async getPendingAlerts(): Promise<any[]> {
        const { data, error } = await supabase
            .from('compliance_alerts')
            .select(`
                *,
                compliance_items (title, risk_level, area)
            `)
            .eq('status', 'PENDING')
            .lte('alert_date', new Date().toISOString().split('T')[0]);

        if (error) {
            console.error('Error fetching pending alerts:', error);
            return [];
        }
        return data || [];
    },

    /**
     * Procesa y "envía" las alertas pendientes (Mock).
     */
    async processDailyAlerts() {
        const alerts = await this.getPendingAlerts();
        console.log(`🕒 [MÓDULO 8] Procesando ${alerts.length} alertas programadas...`);
        
        for (const alert of alerts) {
            const item = alert.compliance_items;
            const message = `REVISIÓN PENDIENTE: El requisito "${item?.title}" (Riesgo: ${item?.risk_level}) debe ser auditado próximamente.`;
            
            const success = await this.send({
                recipient: 'admin@legaldoc.ve', // En real, del perfil asignado
                type: 'email',
                subject: `🔔 ALERTA DE CUMPLIMIENTO: ${item?.title}`,
                message,
                priority: (item?.risk_level === 'CRITICAL' || item?.risk_level === 'HIGH') ? 'critical' : 'medium'
            });

            if (success) {
                await supabase
                    .from('compliance_alerts')
                    .update({ status: 'TRIGGERED' })
                    .eq('id', alert.id);
            }
        }
    }
};
