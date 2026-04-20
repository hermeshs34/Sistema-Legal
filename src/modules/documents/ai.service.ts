import { supabase } from '../../core/supabase.ts';
import { authService } from '../../core/auth.service.ts';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';

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

type DocumentRecord = {
    id: string;
    title: string | null;
    description: string | null;
    type: string | null;
    metadata: Record<string, unknown> | null;
    file_url: string | null;
};

const TEXT_EXTENSIONS = new Set(['txt', 'md', 'csv', 'json', 'xml', 'html', 'htm']);
const MAX_EXTRACT_CHARS = 24000;
const MAX_PDF_PAGES = 25;

const sanitizeWhitespace = (text: string): string =>
    text
        .replace(/\r/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

const truncateForPrompt = (text: string, maxChars: number = MAX_EXTRACT_CHARS): string => {
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars)}\n\n[...contenido truncado para análisis...]`;
};

const resolveExtension = (pathOrUrl: string): string => {
    const cleanPath = pathOrUrl.split('?')[0].split('#')[0];
    const filename = cleanPath.split('/').pop() || '';
    const dotIndex = filename.lastIndexOf('.');
    if (dotIndex === -1) return '';
    return filename.slice(dotIndex + 1).toLowerCase();
};

const extractTextFromPdf = async (buffer: ArrayBuffer): Promise<string> => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    if (pdfjs.GlobalWorkerOptions.workerSrc !== pdfWorkerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
    }

    const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(buffer),
    });
    const pdf = await loadingTask.promise;

    const pagesToRead = Math.min(pdf.numPages, MAX_PDF_PAGES);
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const text = textContent.items
            .map((item) => ('str' in item && typeof item.str === 'string' ? item.str : ''))
            .filter((piece) => piece.length > 0)
            .join(' ');

        if (text.length > 0) pageTexts.push(text);
    }

    return sanitizeWhitespace(pageTexts.join('\n\n'));
};

const resolveDownloadUrl = async (fileUrl: string): Promise<string> => {
    if (!fileUrl) return '';
    if (fileUrl.startsWith('http')) return fileUrl;

    const { data, error } = await supabase.storage
        .from('legal-documents')
        .createSignedUrl(fileUrl, 600);

    if (error || !data?.signedUrl) {
        console.error('No se pudo generar Signed URL para análisis IA:', error);
        return '';
    }

    return data.signedUrl;
};

const extractTextFromStoredFile = async (fileUrl: string): Promise<string> => {
    const ext = resolveExtension(fileUrl);
    if (!ext) return '';

    const signedUrl = await resolveDownloadUrl(fileUrl);
    if (!signedUrl) return '';

    try {
        const response = await fetch(signedUrl);
        if (!response.ok) return '';

        if (ext === 'pdf') {
            const buffer = await response.arrayBuffer();
            return extractTextFromPdf(buffer);
        }

        if (TEXT_EXTENSIONS.has(ext)) {
            const rawText = await response.text();
            return sanitizeWhitespace(rawText);
        }

        return '';
    } catch (error) {
        console.error('Error extrayendo texto del archivo para IA:', error);
        return '';
    }
};

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

    async simulateOCR(documentId: string, title: string, type: string): Promise<string> {
        return this.extractFullContent(documentId, type, title);
    },

    async extractFullContent(documentId: string, type: string, title: string): Promise<string> {
        const user = authService.getCurrentUser();
        const orgId = user?.organizationId;

        const { data, error } = await supabase
            .from('documents')
            .select('id, title, description, type, metadata, file_url')
            .eq('id', documentId)
            .eq('organization_id', orgId)
            .maybeSingle();

        if (error) {
            console.error('Error leyendo documento para análisis IA:', error);
        }

        const dbDoc = (data || null) as DocumentRecord | null;
        const finalTitle = dbDoc?.title || title || 'Documento sin título';
        const finalType = dbDoc?.type || type || 'other';
        const finalDescription = (dbDoc?.description || '').trim();
        const metadata = dbDoc?.metadata ?? {};
        const storagePath = dbDoc?.file_url || '';

        const metadataLines = Object.entries(metadata)
            .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
            .slice(0, 10)
            .map(([key, value]) => {
                if (Array.isArray(value)) return `- ${key}: ${value.join(', ')}`;
                return `- ${key}: ${String(value)}`;
            });

        const extractedFileText = storagePath ? await extractTextFromStoredFile(storagePath) : '';

        const sections = [
            `DOCUMENTO LEGAL A ANALIZAR`,
            `ID: ${documentId}`,
            `Título: ${finalTitle}`,
            `Tipo: ${finalType}`,
        ];

        if (finalDescription) {
            sections.push(`Descripción registrada:\n${finalDescription}`);
        }

        if (metadataLines.length > 0) {
            sections.push(`Metadatos:\n${metadataLines.join('\n')}`);
        }

        if (extractedFileText) {
            sections.push(`Texto extraído del archivo:\n${truncateForPrompt(extractedFileText)}`);
        } else if (storagePath) {
            sections.push(
                `Nota técnica: existe archivo adjunto (${storagePath}), pero no se pudo extraer texto legible en cliente. ` +
                `Analiza con título, descripción y metadatos disponibles, sin inventar cláusulas literales.`
            );
        }

        return sections.join('\n\n');
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
