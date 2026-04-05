import { Request, Response } from 'express';

interface AnalysisResult {
  summary: string;
  risks: string[];
  suggestions: string[];
  score: number;
}

export const analyzeDocument = async (req: Request, res: Response) => {
  try {
    const { text, type } = req.body;

    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const analysis: AnalysisResult = {
      summary: '',
      risks: [],
      suggestions: [],
      score: 85
    };

    // Advanced Mock Logic (Rule-based AI)
    const content = (text || '').toLowerCase();

    // 1. Análisis de Resumen
    analysis.summary = `El documento parece ser un ${type || 'texto legal'} de ${content.length} caracteres. Se detecta un tono formal y estructura jurídica estándar.`;

    // 2. Detección de Riesgos
    if (content.includes('dólares') || content.includes('usd') || content.includes('divisas')) {
      analysis.risks.push('Riesgo Cambiario: Se mencionan monedas extranjeras. Verificar cumplimiento con Convenio Cambiario N° 1 y normativa del BCV.');
      analysis.score -= 5;
    }
    
    if (!content.includes('confidencialidad') && type === 'contract') {
      analysis.risks.push('Protección de Datos: No se detecta cláusula de confidencialidad explícita.');
      analysis.score -= 10;
    }

    if (content.includes('indefinido') || content.includes('renovación automática')) {
      analysis.risks.push('Vigencia: Cláusula de renovación automática detectada. Riesgo de perpetuidad no deseada.');
    }

    // 3. Sugerencias (Contexto Venezuela)
    if (!content.includes('arbitraje') && !content.includes('tribunales')) {
      analysis.suggestions.push('Resolución de Conflictos: Se recomienda incluir cláusula de Arbitraje Comercial (CEDCA o Cámara de Caracas) para mayor celeridad.');
    }

    if (type === 'contract' && !content.includes('domicilio especial')) {
      analysis.suggestions.push('Jurisdicción: Definir domicilio especial procesal (ej. "Ciudad de Caracas") para evitar litigios en jurisdicciones remotas.');
    }

    res.json(analysis);

  } catch (error) {
    res.status(500).json({ message: 'Error analyzing document', error });
  }
};
