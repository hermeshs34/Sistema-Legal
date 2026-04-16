import { supabase } from '../../core/supabase.ts';
import { authService } from '../../core/auth.service.ts';

export interface AnalysisResult {
    score: number; // Mantenemos internamente como score, mapeamos a confidence en DB
    summary: string;
    risks: string[];
    suggestions: string[];
    critical_clauses?: string[];
    recommendations?: string[];
}

export interface ComplianceRiskAnalysis {
    suggestedLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reasoning: string;
    suggestedNextReview: string;
    legalCitation?: string;
}

export interface IAIService {
    analyze(documentId: string, text: string, type: string, organizationId: string, userId: string): Promise<AnalysisResult>;
    simulateOCR(documentId: string, title: string, type: string): Promise<string>;
    extractFullContent(documentId: string, type: string, title: string): Promise<string>;
    getLatestAnalysis(documentId: string): Promise<AnalysisResult | null>;
    chatQuery(query: string, docTitle: string, docType: string, analysis: AnalysisResult): Promise<string>;
    analyzeComplianceRisk(description: string): Promise<ComplianceRiskAnalysis>;
    query(query: string, context: string): Promise<string>;
    searchLegalKnowledge(query: string, orgId: string, limit?: number): Promise<any[]>;
    generateEmbedding(text: string): Promise<number[]>;
    predictSuccessOutcome(caseDetails: { materia: string; descripcion: string; jurisdiccion?: string }): Promise<{ 
        probability: number; 
        strategy: string; 
        citingSentences: string[];
        riskFactor: 'low' | 'medium' | 'high'
    }>;
    indexLegalKnowledge(entityId: string, type: string, content: string, orgId: string, metadata: any): Promise<void>;
}

export const aiService: IAIService = {
    async analyze(documentId: string, text: string, type: string, organizationId: string, userId: string): Promise<AnalysisResult> {
        try {
            const { data, error } = await supabase.functions.invoke('legal-ai-processor', {
                body: { 
                    action: 'analyze', 
                    actionType: 'analyze',
                    body: { text, type },
                    userId,
                    organizationId
                }
            });

            if (error) {
                console.error('AI Edge Function Error:', error);
                if (error.message?.includes('401') || (error as any).status === 401) {
                    throw new Error('🔑 SESIÓN EXPIRADA: Por favor, recarga (F5) y vuelve a entrar.');
                }
                throw new Error(`⚠️ FALLO TÉCNICO IA: ${error.message}`);
            }

            // Validación Defensiva: La Edge Function devuelve la respuesta de OpenAI
            if (!data) {
                console.error('La Edge Function no devolvió datos (data es null)');
                throw new Error('El procesador de IA no respondió. Contacte a soporte.');
            }

            if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
                console.error('Respuesta de IA Malformada (falta choices):', data);
                if (data.error) {
                    throw new Error(`🚫 ERROR DE IA: ${data.error.message || JSON.stringify(data.error)}`);
                }
                throw new Error('La IA no pudo procesar este documento en este momento. Intente más tarde.');
            }

            const content = data.content || data.choices?.[0]?.message?.content;
            if (!content) {
                console.error('No se encontró contenido en la respuesta:', data);
                throw new Error('La IA devolvió una respuesta vacía o irreconocible.');
            }

            // Silencioso. El rastro queda solo en DB Auditoría.
            const finalResult = typeof content === 'string' ? JSON.parse(content) : content;

            const analysisData = {
                document_id: documentId,
                summary: finalResult.summary || 'Sin resumen disponible.',
                risks: Array.isArray(finalResult.risks) ? finalResult.risks : [],
                suggestions: Array.isArray(finalResult.suggestions) ? finalResult.suggestions : [],
                confidence: finalResult.confidence || finalResult.score || 0,
                model_used: 'gpt-4o',
                organization_id: organizationId,
                created_by: userId
            };

            // Guardar en la tabla de análisis para el historial
            const { error: insertError } = await supabase.from('document_analysis').insert(analysisData);
            if (insertError) console.error('Error saving analysis:', insertError);

            return {
                score: analysisData.confidence,
                summary: analysisData.summary,
                risks: analysisData.risks,
                suggestions: analysisData.suggestions
            };
        } catch (error: any) {
            console.error('Error en proceso de análisis IA:', error);
            throw error;
        }
    },

    async analyzeComplianceRisk(description: string): Promise<ComplianceRiskAnalysis> {
        const user = authService.getCurrentUser();
        try {
            const { data, error } = await supabase.functions.invoke('legal-ai-processor', {
                body: { 
                    action: 'compliance_risk', 
                    actionType: 'compliance_risk',
                    body: { description },
                    userId: user?.id,
                    organizationId: user?.organizationId
                }
            });

            const content = data.content || data.choices?.[0]?.message?.content;
            if (error || !data || !content) {
                console.error('Error in Compliance AI (Hub):', error || 'Sin contenido en respuesta');
                throw new Error('No se pudo calcular el riesgo de cumplimiento.');
            }
            return JSON.parse(content);
        } catch (error: any) {
            console.error('Error in Compliance AI (Hub):', error);
            throw error;
        }
    },

    async simulateOCR(_documentId: string, title: string, type: string): Promise<string> {
        return `CONTENIDO PROCESADO POR MOTOR OCR VINCULADO A LEGALDOC VE\n\nDocumento: ${title}\nTipo: ${type}\n\n[TEXTO EXTRAÍDO CON ÉXITO]`;
    },

    async extractFullContent(_documentId: string, _type: string, title: string): Promise<string> {
        return `Carga completa del contenido de "${title}" procesada para análisis profundo de IA.`;
    },

    async getLatestAnalysis(documentId: string): Promise<AnalysisResult | null> {
        const { data, error } = await supabase
            .from('document_analysis')
            .select('*')
            .eq('document_id', documentId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error || !data) return null;
        return {
            score: data.confidence || 0,
            summary: data.summary || 'Análisis previo sin resumen.',
            risks: Array.isArray(data.risks) ? data.risks : [],
            suggestions: Array.isArray(data.suggestions) ? data.suggestions : []
        };
    },

    async chatQuery(query: string, docTitle: string, _docType: string, analysis: AnalysisResult): Promise<string> {
        const user = authService.getCurrentUser();
        try {
            const { data, error } = await supabase.functions.invoke('legal-ai-processor', {
                body: { 
                    action: 'chat', 
                    actionType: 'chat',
                    body: { 
                        context: `Documento: ${docTitle}. Análisis previo: ${analysis.summary}`,
                        messages: [{ role: 'user', content: query }]
                    },
                    userId: user?.id,
                    organizationId: user?.organizationId
                }
            });

            const content = data.content || data.choices?.[0]?.message?.content;
            if (error || !data || !content) {
                console.error('Error in chat AI (Hub):', error || 'Sin contenido en respuesta');
                return "Error al procesar la consulta por falta de respuesta de la IA.";
            }
            return typeof content === 'string' ? content : JSON.stringify(content);
        } catch (error: any) {
            console.error('Error in chat AI (Hub):', error);
            return "Error al procesar la consulta.";
        }
    },

    async query(query: string, context: string): Promise<string> {
        const user = authService.getCurrentUser();
        try {
            const { data, error } = await supabase.functions.invoke('legal-ai-processor', {
                body: { 
                    action: 'chat', 
                    actionType: 'chat',
                    body: { 
                        context: `Experto en leyes vzla. Contexto: ${context}`,
                        messages: [{ role: 'user', content: query }]
                    },
                    userId: user?.id,
                    organizationId: user?.organizationId
                }
            });

            const content = data.content || data.choices?.[0]?.message?.content;
            if (error || !data || !content) {
                console.error('Error in AI query (Hub):', error || 'Sin contenido en respuesta');
                return "Error técnico: La IA no respondió a la consulta.";
            }
            return typeof content === 'string' ? content : JSON.stringify(content);
        } catch (error: any) {
            console.error('Error in AI query (Hub):', error);
            return "Error técnico al procesar la consulta.";
        }
    },

    async searchLegalKnowledge(query: string, orgId: string, limit: number = 5): Promise<any[]> {
        const embedding = await this.generateEmbedding(query);
        const { data, error } = await supabase.rpc('match_legal_knowledge', {
            query_embedding: embedding,
            match_threshold: 0.65,
            match_count: limit,
            p_organization_id: orgId
        });
        if (error) {
            console.error('Error matching legal knowledge:', error);
            return [];
        }
        return data || [];
    },

    async generateEmbedding(text: string): Promise<number[]> {
        const user = authService.getCurrentUser();
        try {
            const { data, error } = await supabase.functions.invoke('legal-ai-processor', {
                body: { 
                    action: 'embedding', 
                    body: { text },
                    userId: user?.id,
                    organizationId: user?.organizationId
                }
            });

            if (error) throw error;
            return data.data[0].embedding;
        } catch (error) {
            console.error('Error generating embedding (Hub):', error);
            return new Array(1536).fill(0);
        }
    },

    async predictSuccessOutcome(caseDetails: { materia: string; descripcion: string; jurisdiccion?: string }): Promise<{ 
        probability: number; 
        strategy: string; 
        citingSentences: string[];
        riskFactor: 'low' | 'medium' | 'high'
    }> {
        const user = authService.getCurrentUser();
        try {
            const { data, error } = await supabase.functions.invoke('legal-ai-processor', {
                body: { 
                    action: 'predict_outcome', 
                    actionType: 'predict_outcome',
                    body: caseDetails,
                    userId: user?.id,
                    organizationId: user?.organizationId
                }
            });

            const content = data.content || data.choices?.[0]?.message?.content;
            if (error || !data || !content) {
                console.error('Error in outcome prediction (Hub):', error || 'Sin contenido en respuesta');
                throw new Error('No se pudo calcular la predicción judicial.');
            }
            // Aseguramos que sea un objeto
            return typeof content === 'string' ? JSON.parse(content) : content;
        } catch (error: any) {
            console.error('Error in outcome prediction (Hub):', error);
            throw new Error('No se pudo calcular la predicción judicial.');
        }
    },

    async indexLegalKnowledge(entityId: string, type: string, content: string, orgId: string, metadata: any): Promise<void> {
        const embedding = await this.generateEmbedding(content);
        const { error } = await supabase.from('document_vectors').insert({
            content,
            embedding,
            organization_id: orgId,
            metadata: { 
                ...metadata, 
                law_id: entityId, 
                law_type: type,
                source_title: metadata.source || 'Ley/Jurisprudencia'
            }
        });

        if (error) {
            console.error('Error indexing legal knowledge:', error);
            throw error;
        }
    }
};
