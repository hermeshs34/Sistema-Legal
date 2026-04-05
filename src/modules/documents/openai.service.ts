import { supabase } from '../../core/supabase.ts';
import { authService } from '../../core/auth.service.ts';

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export const openAIService = {
    /** 
     * Ejecuta una consulta de chat legal vía Edge Function (Segura/Auditada)
     */
    async chat(messages: ChatMessage[], documentContext?: string): Promise<string> {
        const user = authService.getCurrentUser();
        
        try {
            const { data, error } = await supabase.functions.invoke('legal-ai-processor', {
                body: { 
                    messages, 
                    documentContext,
                    organizationId: user?.organizationId || 'ROOT',
                    userId: user?.id || 'SYSTEM',
                    actionType: 'chat_legal_assistant'
                }
            });

            if (error) {
                console.error('Error invocando Legal-AI-Processor:', error);
                throw new Error('El cerebro legal no está respondiendo. Verifica la configuración en Supabase.');
            }

            return data?.content || 'No se recibió respuesta del asistente.';
        } catch (error: any) {
            console.error('AI Edge Function Error:', error);
            throw error;
        }
    }
};
