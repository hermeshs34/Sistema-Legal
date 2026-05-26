// ─── Roles del sistema ───────────────────────────────────────────────────────
// Al agregar un rol nuevo seguir el checklist en CLAUDE.md §Roles

export type UserRole =
    // ── Roles originales ──────────────────────────────────────────────────────
    | 'consultor_general'    // Administrador — CRUD completo + gestión usuarios
    | 'abogado_senior'       // R/W: contratos, expedientes, compliance, reportes
    | 'abogado_junior'       // R limitado: docs asignados + carga de actuaciones
    | 'consultor_principal'  // Solo lectura + exportación de reportes
    | 'aprendiz'             // Solo lectura de docs asignados, sin exportación
    // ── Roles nuevos (Fase 1 — Mayo 2026) ────────────────────────────────────
    | 'compliance_officer'   // R/W: AML, compliance, reportes regulatorios (SUDEBAN/SUGEF)
    | 'auditor_externo'      // Solo lectura de TODO + exportación. Sin acceso a datos de cliente
    | 'gerente_firma';       // Supervisión total sin edición — ve todo, no modifica

// ─── Permisos granulares ─────────────────────────────────────────────────────

export type Permission =
    | 'view_dashboard'
    | 'view_all_docs'
    | 'view_assigned_docs'
    | 'create_doc'
    | 'edit_doc'
    | 'archive_doc'
    | 'delete_doc'
    | 'view_audit_full'
    | 'view_audit_partial'
    | 'manage_users'
    | 'export_reports'
    | 'approve_contracts'
    | 'view_compliance'
    | 'edit_compliance'
    | 'view_honorarios'
    | 'edit_honorarios'
    | 'view_expedientes'
    | 'edit_expedientes'
    | 'manage_parameters';

// ─── Matriz de permisos por rol ───────────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    // Administrador total
    consultor_general: [
        'view_dashboard', 'view_all_docs', 'create_doc', 'edit_doc', 'archive_doc', 'delete_doc',
        'view_audit_full', 'manage_users', 'export_reports', 'approve_contracts',
        'view_compliance', 'edit_compliance',
        'view_honorarios', 'edit_honorarios',
        'view_expedientes', 'edit_expedientes',
        'manage_parameters',
    ],

    // Abogado con experiencia — todo excepto gestión de usuarios y parámetros
    abogado_senior: [
        'view_dashboard', 'view_all_docs', 'create_doc', 'edit_doc', 'archive_doc',
        'view_audit_partial', 'export_reports', 'approve_contracts',
        'view_compliance', 'edit_compliance',
        'view_honorarios', 'edit_honorarios',
        'view_expedientes', 'edit_expedientes',
    ],

    // Abogado en formación — solo su trabajo asignado
    abogado_junior: [
        'view_dashboard', 'view_assigned_docs', 'create_doc', 'edit_doc',
        'view_expedientes', 'edit_expedientes',
    ],

    // Consultor de lectura + exportación
    consultor_principal: [
        'view_dashboard', 'view_all_docs', 'view_audit_partial', 'export_reports',
        'view_compliance', 'view_honorarios', 'view_expedientes',
    ],

    // Solo lectura mínima
    aprendiz: [
        'view_assigned_docs', 'view_expedientes',
    ],

    // Oficial de Cumplimiento (SUDEBAN, SUGEF, AML/CFT)
    // Acceso a compliance y auditoría, sin acceso a contratos ni honorarios
    compliance_officer: [
        'view_dashboard', 'view_all_docs', 'view_audit_full',
        'export_reports', 'view_compliance', 'edit_compliance',
        'view_expedientes',
    ],

    // Auditor externo (Big4, reguladores) — lectura total, sin escritura, sin datos de cliente
    // MFA obligatorio. Los componentes deben ocultar datos personales para este rol.
    auditor_externo: [
        'view_dashboard', 'view_all_docs', 'view_audit_full',
        'export_reports', 'view_compliance', 'view_honorarios',
        'view_expedientes', 'view_audit_partial',
    ],

    // Gerente de firma — supervisión estratégica, sin modificación
    gerente_firma: [
        'view_dashboard', 'view_all_docs', 'view_audit_full',
        'export_reports', 'view_compliance',
        'view_honorarios', 'view_expedientes',
    ],
};

// ─── Metadatos de rol (para UI) ───────────────────────────────────────────────

export interface RolMeta {
    label:       string;
    description: string;
    color:       string;  // badge color (Tailwind / hex)
    mfaRequired: boolean;
}

export const ROL_META: Record<UserRole, RolMeta> = {
    consultor_general:  { label: 'Consultor General',   description: 'Administrador del sistema',          color: '#7c3aed', mfaRequired: true  },
    abogado_senior:     { label: 'Abogado Senior',       description: 'Abogado con firma propia',           color: '#1d4ed8', mfaRequired: true  },
    abogado_junior:     { label: 'Abogado Junior',       description: 'Abogado en formación',               color: '#0369a1', mfaRequired: false },
    consultor_principal:{ label: 'Consultor Principal',  description: 'Consultor de lectura y reportes',    color: '#0f766e', mfaRequired: false },
    aprendiz:           { label: 'Aprendiz',             description: 'Acceso de observación',              color: '#6b7280', mfaRequired: false },
    compliance_officer: { label: 'Compliance Officer',   description: 'AML/CFT y cumplimiento regulatorio', color: '#b45309', mfaRequired: true  },
    auditor_externo:    { label: 'Auditor Externo',      description: 'Auditoría externa — solo lectura',   color: '#374151', mfaRequired: true  },
    gerente_firma:      { label: 'Gerente de Firma',     description: 'Supervisión total sin edición',      color: '#1e3a8a', mfaRequired: true  },
};

// ─── Interfaz de usuario ──────────────────────────────────────────────────────

export interface User {
    id:              string;
    name:            string;
    email:           string;
    role:            UserRole;
    avatar?:         string;
    isActive:        boolean;
    organizationId?: string;
}
