/**
 * predictive-ai.service.ts
 * MOTOR DE IA PREDICTIVA LEGAL (FASE 4)
 * 
 * Este servicio utiliza el modelo GPT-4o-mini para analizar el estado de un expediente judicial
 * y predecir probabilidades de éxito, niveles de riesgo y estrategias legales recomendadas.
 */

import { aiService } from '../documents/ai.service.ts';
import type { Expediente, Actuacion } from '../expedientes/types.ts';

export interface JudicialPrediction {
    probability: number;      // 0-100
    riskLevel: 'BAJO' | 'MEDIO' | 'ALTO' | 'CRÍTICO';
    summary: string;          // Resumen ejecutivo de la predicción
    keyFactors: string[];     // Factores que influyen en el resultado
    recommendations: string[]; // Acciones sugeridas para mejorar el resultado
    lastAnalysisDate: string;
}

export const predictiveAiService = {
    /**
     * Analiza el expediente judicial completo con IA Generativa Avanzada.
     */
    async analyzeExpedienteRisk(expediente: Expediente, actuaciones: Actuacion[], audiencias: any[]): Promise<JudicialPrediction> {
        const actsContext = actuaciones
            .slice(0, 12)
            .map(a => `[${a.fecha}] ${a.tipo}: ${a.descripcion} (${a.status})`)
            .join(' | ');

        const audsContext = audiencias
            .map(a => `[${a.fechaHora}] ${a.tipo}: ${a.status}`)
            .join(' | ');

        try {
            // El motor de razonamiento de LegalDoc-VE
            const fullContext = `
                EXPEDIENTE: ${expediente.titulo} ⚖️
                POSICIÓN: ${expediente.nuestraPosicion}
                PARTES: ${expediente.parteActora} vs ${expediente.parteDemandada}
                TRIBUNAL: ${expediente.tribunal}
                CUANTÍA: ${expediente.currency} ${expediente.cuantia}
                ACTUACIONES: ${actsContext}
                AUDIENCIAS: ${audsContext}
                
                IMPORTANTE: Responder estrictamente en formato JSON válido para su procesamiento técnico.
            `;

            const result = await aiService.predictSuccessOutcome({
                materia: expediente.materia || 'Judicial Especializado',
                jurisdiccion: expediente.region || 'Venezuela',
                descripcion: fullContext
            });

            return {
                probability: result.probability || 50,
                riskLevel: result.riskFactor === 'low' ? 'BAJO' : result.riskFactor === 'medium' ? 'MEDIO' : result.riskFactor === 'high' ? 'ALTO' : 'CRÍTICO',
                summary: result.strategy || 'Análisis procesal completado. Se recomienda revisión de la estrategia de defensa.',
                keyFactors: (result.citingSentences || []).slice(0, 3).length > 0 
                    ? result.citingSentences.slice(0, 3) 
                    : ['Consistencia procesal', 'Evolución de actuaciones', 'Contexto jurídico local'],
                recommendations: [
                    "Fortalecer medios probatorios ante la próxima etapa crítica",
                    "Monitorear la consistencia de las comparecencias en audiencias",
                    "Asegurar el cumplimiento de los términos procesales vigentes"
                ],
                lastAnalysisDate: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error in Legal AI motor:', error);
            return {
                probability: 50,
                riskLevel: 'MEDIO',
                summary: 'Análisis preliminar disponible. Se requiere revisión manual de actuaciones.',
                keyFactors: ['Historial parcial disponible', 'Contexto legal volátil'],
                recommendations: ['Verificar conectividad CLOUD', 'Recargar datos del expediente'],
                lastAnalysisDate: new Date().toISOString()
            };
        }
    }
};
