// ─── Tipos del Módulo Judicial — LegalDoc VE ───────────────────────────────

export type TipoProceso = 'CIVIL' | 'LABORAL' | 'MERCANTIL' | 'PENAL' | 'ADMINISTRATIVO' | 'CONSTITUCIONAL' | 'ARBITRAJE';
export type NuestraPosicion = 'ACTOR' | 'DEMANDADO' | 'TERCERO' | 'ARBITRO';
export type ExpedienteStatus = 'ACTIVO' | 'SUSPENDIDO' | 'CERRADO' | 'GANADO' | 'PERDIDO' | 'CONCILIADO';
export type RiesgoNivel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TipoActuacion = 'ESCRITO' | 'AUDIENCIA' | 'SENTENCIA' | 'DILIGENCIA' | 'APELACION' | 'NOTIFICACION' | 'PERICIA' | 'CONCILIACION' | 'OTRO';
export type TipoAudiencia = 'INICIAL' | 'ORAL' | 'APELACION' | 'SENTENCIA' | 'CONCILIACION' | 'ORDINARIA' | 'CAUTELAR';
export type AudienciaStatus = 'PENDIENTE' | 'REALIZADA' | 'SUSPENDIDA' | 'DIFERIDA';

export interface Expediente {
    id: string;                         // EXP-001
    organizationId: string;
    titulo: string;
    numeroExpediente?: string;          // Número asignado por el tribunal
    tribunal?: string;
    tipoProceso: TipoProceso;
    materia?: string;
    parteActora: string;
    parteDemandada: string;
    nuestraPosicion: NuestraPosicion;
    status: ExpedienteStatus;
    fechaInicio?: string;               // ISO date
    fechaCierre?: string;
    cuantia?: number;
    currency: 'VES' | 'USD' | 'EUR';
    riesgo: RiesgoNivel;
    assignedLawyerId?: string;
    contractId?: string;                // Vínculo con contrato
    documentId?: string;                // Vínculo con documento
    descripcion?: string;
    region: string;
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
    // Relaciones cargadas opcionalmente
    actuaciones?: Actuacion[];
    audiencias?: Audiencia[];
}

export type ActuacionStatus = 'PENDIENTE' | 'REALIZADA' | 'SUSPENDIDA' | 'DIFERIDA';

export interface Actuacion {
    id: string;
    expedienteId: string;
    organizationId: string;
    fecha: string;                      // ISO date
    tipo: TipoActuacion;
    descripcion: string;
    resultado?: string;
    proximoPaso?: string;
    archivoUrl?: string;
    status: ActuacionStatus;
    createdBy?: string;
    createdAt?: string;
}

export interface Audiencia {
    id: string;
    expedienteId: string;
    organizationId: string;
    fechaHora: string;                  // ISO datetime
    tribunal?: string;
    sala?: string;
    tipo: TipoAudiencia;
    descripcion?: string;
    resultado?: string;
    alertaEnviada: boolean;
    diasAlerta: number;
    status: AudienciaStatus;
    createdAt?: string;
}

// ─── Labels y configuración visual ─────────────────────────────────────────

export const TIPO_PROCESO_LABELS: Record<TipoProceso, string> = {
    CIVIL: '⚖️ Civil',
    LABORAL: '👷 Laboral',
    MERCANTIL: '🏢 Mercantil',
    PENAL: '🔒 Penal',
    ADMINISTRATIVO: '🏛️ Administrativo',
    CONSTITUCIONAL: '📜 Constitucional',
    ARBITRAJE: '🤝 Arbitraje',
};

export const STATUS_CONFIG: Record<ExpedienteStatus, { label: string; color: string; bg: string }> = {
    ACTIVO:     { label: '🟢 Activo',      color: '#16a34a', bg: '#f0fdf4' },
    SUSPENDIDO: { label: '⏸️ Suspendido',  color: '#d97706', bg: '#fffbeb' },
    CERRADO:    { label: '⬛ Cerrado',     color: '#64748b', bg: '#f8fafc' },
    GANADO:     { label: '🏆 Ganado',      color: '#1d4ed8', bg: '#eff6ff' },
    PERDIDO:    { label: '❌ Perdido',     color: '#b91c1c', bg: '#fef2f2' },
    CONCILIADO: { label: '🤝 Conciliado',  color: '#7c3aed', bg: '#f5f3ff' },
};

export const RIESGO_CONFIG: Record<RiesgoNivel, { label: string; color: string }> = {
    LOW:      { label: '🟢 Bajo',     color: '#16a34a' },
    MEDIUM:   { label: '🟡 Medio',    color: '#d97706' },
    HIGH:     { label: '🟠 Alto',     color: '#ea580c' },
    CRITICAL: { label: '🔴 Crítico',  color: '#b91c1c' },
};

export const TIPO_ACTUACION_LABELS: Record<TipoActuacion, string> = {
    ESCRITO:       '📝 Escrito',
    AUDIENCIA:     '🎤 Audiencia',
    SENTENCIA:     '⚖️ Sentencia',
    DILIGENCIA:    '📋 Diligencia',
    APELACION:     '🔁 Apelación',
    NOTIFICACION:  '📨 Notificación',
    PERICIA:       '🔬 Pericia',
    CONCILIACION:  '🤝 Conciliación',
    OTRO:          '📁 Otro',
};
