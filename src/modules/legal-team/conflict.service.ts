/**
 * conflict.service.ts
 * Servicio de detección de conflictos de interés — Fase 5 Innovación
 *
 * Base deontológica:
 *   VE: Código de Ética del Abogado Venezolano, Arts. 28-31
 *   ES: Estatuto General de la Abogacía Española, Arts. 33-35
 *   UN: Principios Básicos ONU sobre la función de los abogados
 *
 * Algoritmo:
 *   1. Normalizar nombres de partes (quitar acentos, lowercasing, tokenizar)
 *   2. Comparar contra partes de todos los expedientes activos/anteriores de la firma
 *   3. Calcular score de similitud (Jaccard sobre tokens)
 *   4. Clasificar resultado: clear / warning / conflict
 */

import { supabase } from '../../core/supabase.ts';
import { authService } from '../../core/auth.service.ts';

// ── Tipos ───────────────────────────────────────────────────────────────────

export type ConflictResult = 'pending' | 'clear' | 'warning' | 'conflict';

export interface ConflictFound {
    expedienteId:  string;
    titulo:        string;
    parte:         string;         // Nombre de la parte coincidente
    tipo:          'parte_actora' | 'parte_demandada' | 'client_match';
    matchScore:    number;         // 0-100
}

export interface ConflictCheck {
    id:                    string;
    organizationId:        string;
    newMatterTitle:        string;
    newClientName:         string;
    newParteActora:        string;
    newParteDemandada:     string;
    result:                ConflictResult;
    conflictsFound:        ConflictFound[];
    riskScore:             number;   // 0-100
    waiverGranted:         boolean;
    waiverNotes?:          string;
    checkedBy?:            string;
    checkedAt:             string;
    notes?:                string;
    approvedExpedienteId?: string;
    createdAt:             string;
    updatedAt:             string;
}

export interface ConflictCheckRequest {
    newMatterTitle:    string;
    newClientName:     string;
    newParteActora:    string;
    newParteDemandada: string;
}

// ── Constantes de umbral ────────────────────────────────────────────────────

/** Similitud >= este valor se considera CONFLICTO confirmado */
const CONFLICT_THRESHOLD = 72;
/** Similitud >= este valor se considera ADVERTENCIA que requiere revisión */
const WARNING_THRESHOLD  = 38;

// ── Utilidades de normalización y comparación ───────────────────────────────

/** Elimina acentos y normaliza a NFD, luego ASCII */
function removeAccents(str: string): string {
    return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Normaliza un nombre de parte para comparación:
 * - Minúsculas
 * - Sin acentos
 * - Sin puntuación irrelevante
 * - Espacios colapsados
 */
function normalize(str: string): string {
    return removeAccents(str)
        .toLowerCase()
        .replace(/[.,\-_/\\()[\]{}'"]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Tokeniza una cadena normalizada, filtrando palabras vacías y stopwords legales.
 * Palabras cortas (<= 2 chars) y stopwords se eliminan para evitar falsos positivos.
 */
const STOPWORDS = new Set([
    'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'e', 'o', 'u',
    'en', 'con', 'por', 'para', 'al', 'lo', 'le', 'su', 'sus',
    'ca', 'sa', 'sl', 'srl', 'cv', 'cia', 'cia', 'nv', 'ag',
    'the', 'and', 'of', 'or',
]);

function tokenize(str: string): string[] {
    return normalize(str)
        .split(' ')
        .filter(t => t.length > 2 && !STOPWORDS.has(t));
}

/**
 * Calcula similitud de Jaccard sobre tokens (0-100).
 * Penaliza si alguno de los conjuntos es vacío.
 */
function jaccardSimilarity(a: string, b: string): number {
    const tokA = new Set(tokenize(a));
    const tokB = new Set(tokenize(b));

    if (tokA.size === 0 || tokB.size === 0) return 0;

    let intersection = 0;
    tokA.forEach(t => { if (tokB.has(t)) intersection++; });

    const union = tokA.size + tokB.size - intersection;
    return Math.round((intersection / union) * 100);
}

/**
 * Compara dos cadenas con múltiples estrategias:
 * 1. Jaccard base
 * 2. Substring: si una contiene a la otra (p.ej. nombre corto vs. razón social)
 * Devuelve el score más alto.
 *
 * Exportado para reuso en el Portal de Cliente (filtrado de recursos por nombre).
 */
export function matchScore(candidate: string, existing: string): number {
    const jaccard = jaccardSimilarity(candidate, existing);

    // Bonus por substring (cuando uno contiene al otro)
    const normCand = normalize(candidate);
    const normExist = normalize(existing);
    const substringBonus = (normCand.includes(normExist) || normExist.includes(normCand)) ? 20 : 0;

    return Math.min(100, jaccard + substringBonus);
}

// ── Motor de análisis ───────────────────────────────────────────────────────

interface ExpedienteRow {
    id:              string;
    titulo:          string;
    parte_actora:    string;
    parte_demandada: string;
}

/**
 * Analiza un conjunto de expedientes en busca de coincidencias con las partes
 * del nuevo asunto. Devuelve la lista de conflictos encontrados y el score máximo.
 */
function analyzeConflicts(
    req: ConflictCheckRequest,
    expedientes: ExpedienteRow[],
): { conflictsFound: ConflictFound[]; maxScore: number } {
    const conflictsFound: ConflictFound[] = [];
    let maxScore = 0;

    for (const exp of expedientes) {
        // Comparar parte actora del NUEVO asunto vs. partes del expediente existente
        const newActoraVsActora    = matchScore(req.newParteActora,    exp.parte_actora);
        const newActoraVsDemandada = matchScore(req.newParteActora,    exp.parte_demandada);
        const newDemandadaVsActora = matchScore(req.newParteDemandada, exp.parte_actora);
        const newDemandadaVsDemandada = matchScore(req.newParteDemandada, exp.parte_demandada);
        // Cliente vs. partes del expediente (conflicto por representación del mismo cliente)
        const clientVsActora       = matchScore(req.newClientName,    exp.parte_actora);
        const clientVsDemandada    = matchScore(req.newClientName,    exp.parte_demandada);

        const scores: Array<[number, string, ConflictFound['tipo']]> = [
            [newActoraVsActora,       exp.parte_actora,    'parte_actora'],
            [newActoraVsDemandada,    exp.parte_demandada, 'parte_demandada'],
            [newDemandadaVsActora,    exp.parte_actora,    'parte_actora'],
            [newDemandadaVsDemandada, exp.parte_demandada, 'parte_demandada'],
            [clientVsActora,          exp.parte_actora,    'client_match'],
            [clientVsDemandada,       exp.parte_demandada, 'client_match'],
        ];

        for (const [score, parte, tipo] of scores) {
            if (score >= WARNING_THRESHOLD) {
                maxScore = Math.max(maxScore, score);
                conflictsFound.push({
                    expedienteId: exp.id,
                    titulo:       exp.titulo,
                    parte,
                    tipo,
                    matchScore:   score,
                });
            }
        }
    }

    // Deduplicar: si el mismo expediente tiene múltiples hits, conservar el de mayor score
    const deduped = new Map<string, ConflictFound>();
    for (const cf of conflictsFound) {
        const key = `${cf.expedienteId}:${cf.tipo}`;
        if (!deduped.has(key) || deduped.get(key)!.matchScore < cf.matchScore) {
            deduped.set(key, cf);
        }
    }

    return {
        conflictsFound: [...deduped.values()].sort((a, b) => b.matchScore - a.matchScore),
        maxScore,
    };
}

function scoreToResult(maxScore: number, hasConflicts: boolean): ConflictResult {
    if (!hasConflicts || maxScore === 0) return 'clear';
    if (maxScore >= CONFLICT_THRESHOLD)  return 'conflict';
    return 'warning';
}

// ── Servicio principal ───────────────────────────────────────────────────────

export const conflictService = {

    /**
     * Ejecuta el análisis de conflictos de interés en tiempo real.
     * NO guarda en base de datos — solo analiza.
     * Usar saveCheck() para persistir el resultado.
     */
    async runCheck(req: ConflictCheckRequest): Promise<{
        result:         ConflictResult;
        conflictsFound: ConflictFound[];
        riskScore:      number;
    }> {
        const user = authService.getCurrentUser();
        if (!user) return { result: 'clear', conflictsFound: [], riskScore: 0 };

        // Obtener todos los expedientes de la organización
        const { data, error } = await supabase
            .from('expedientes')
            .select('id, titulo, parte_actora, parte_demandada')
            .eq('organization_id', user.organizationId);

        if (error || !data) return { result: 'clear', conflictsFound: [], riskScore: 0 };

        const { conflictsFound, maxScore } = analyzeConflicts(req, data as ExpedienteRow[]);
        const result = scoreToResult(maxScore, conflictsFound.length > 0);

        return { result, conflictsFound, riskScore: maxScore };
    },

    /**
     * Guarda el resultado del check en la tabla conflict_checks.
     * Requiere rol con permisos de escritura.
     */
    async saveCheck(
        req: ConflictCheckRequest,
        analysis: { result: ConflictResult; conflictsFound: ConflictFound[]; riskScore: number },
        notes?: string,
    ): Promise<string> {
        const user = authService.getCurrentUser();
        if (!user) throw new Error('Sin sesión activa');

        const WRITE_ROLES = ['consultor_general', 'abogado_senior', 'compliance_officer', 'gerente_firma'];
        if (!WRITE_ROLES.includes(user.role)) {
            throw new Error('No tienes permiso para guardar verificaciones de conflictos');
        }

        const { data, error } = await supabase
            .from('conflict_checks')
            .insert({
                organization_id:     user.organizationId,
                new_matter_title:    req.newMatterTitle,
                new_client_name:     req.newClientName,
                new_parte_actora:    req.newParteActora,
                new_parte_demandada: req.newParteDemandada,
                result:              analysis.result,
                conflicts_found:     analysis.conflictsFound,
                risk_score:          analysis.riskScore,
                waiver_granted:      false,
                checked_by:          user.id,
                checked_at:          new Date().toISOString(),
                notes:               notes ?? null,
            })
            .select('id')
            .single();

        if (error) throw new Error(`Error al guardar check: ${error.message}`);
        return (data as { id: string }).id;
    },

    /**
     * Concede un waiver de conflicto (consentimiento informado de partes).
     * Solo roles senior pueden otorgar waiver.
     */
    async grantWaiver(checkId: string, waiverNotes: string): Promise<void> {
        const user = authService.getCurrentUser();
        if (!user) throw new Error('Sin sesión activa');

        const WAIVER_ROLES = ['consultor_general', 'abogado_senior', 'gerente_firma'];
        if (!WAIVER_ROLES.includes(user.role)) {
            throw new Error('Solo abogados senior o el gerente pueden conceder waivers de conflicto');
        }

        const { error } = await supabase
            .from('conflict_checks')
            .update({
                waiver_granted: true,
                waiver_notes:   waiverNotes,
                updated_at:     new Date().toISOString(),
            })
            .eq('id', checkId)
            .eq('organization_id', user.organizationId);

        if (error) throw new Error(`Error al conceder waiver: ${error.message}`);
    },

    /**
     * Vincula un check aprobado al expediente creado.
     */
    async linkToExpediente(checkId: string, expedienteId: string): Promise<void> {
        const user = authService.getCurrentUser();
        if (!user) return;

        await supabase
            .from('conflict_checks')
            .update({ approved_expediente_id: expedienteId, updated_at: new Date().toISOString() })
            .eq('id', checkId)
            .eq('organization_id', user.organizationId);
    },

    /**
     * Historial de checks de la organización.
     */
    async getHistory(limit = 50): Promise<ConflictCheck[]> {
        const user = authService.getCurrentUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('conflict_checks')
            .select('*')
            .eq('organization_id', user.organizationId)
            .order('checked_at', { ascending: false })
            .limit(limit);

        if (error || !data) return [];

        return (data as Record<string, unknown>[]).map(row => ({
            id:                    row.id as string,
            organizationId:        row.organization_id as string,
            newMatterTitle:        row.new_matter_title as string,
            newClientName:         row.new_client_name as string,
            newParteActora:        row.new_parte_actora as string,
            newParteDemandada:     row.new_parte_demandada as string,
            result:                row.result as ConflictResult,
            conflictsFound:        (row.conflicts_found as ConflictFound[]) ?? [],
            riskScore:             Number(row.risk_score ?? 0),
            waiverGranted:         Boolean(row.waiver_granted),
            waiverNotes:           row.waiver_notes as string | undefined,
            checkedBy:             row.checked_by as string | undefined,
            checkedAt:             row.checked_at as string,
            notes:                 row.notes as string | undefined,
            approvedExpedienteId:  row.approved_expediente_id as string | undefined,
            createdAt:             row.created_at as string,
            updatedAt:             row.updated_at as string,
        }));
    },
};

// ── Configuración visual de resultados ─────────────────────────────────────

export const CONFLICT_RESULT_CONFIG: Record<ConflictResult, {
    label:       string;
    color:       string;
    bg:          string;
    border:      string;
    icon:        string;
    description: string;
}> = {
    pending:  {
        label:       'Analizando…',
        color:       '#64748b',
        bg:          '#f8fafc',
        border:      '#e2e8f0',
        icon:        '⏳',
        description: 'La verificación está en curso.',
    },
    clear: {
        label:       'Sin Conflicto',
        color:       '#15803d',
        bg:          '#f0fdf4',
        border:      '#86efac',
        icon:        '✅',
        description: 'No se detectaron conflictos de interés con los expedientes existentes.',
    },
    warning: {
        label:       'Posible Conflicto',
        color:       '#b45309',
        bg:          '#fffbeb',
        border:      '#fcd34d',
        icon:        '⚠️',
        description: 'Se encontraron similitudes que requieren revisión por abogado senior antes de aceptar el asunto.',
    },
    conflict: {
        label:       'Conflicto Confirmado',
        color:       '#b91c1c',
        bg:          '#fef2f2',
        border:      '#fca5a5',
        icon:        '🚫',
        description: 'Existe un conflicto de interés. No se puede aceptar este asunto sin consentimiento informado de las partes (waiver).',
    },
};
