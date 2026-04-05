export type UserRole =
  | 'consultor_general'
  | 'abogado_senior'
  | 'abogado_junior'
  | 'consultor_principal'
  | 'aprendiz';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  isActive: boolean;
  organizationId?: string;
}

export type Permission =
  | 'view_dashboard'
  | 'view_all_docs'
  | 'view_assigned_docs'
  | 'create_doc'
  | 'edit_doc'
  | 'archive_doc'
  | 'view_audit_full'
  | 'view_audit_partial'
  | 'manage_users'
  | 'export_reports'
  | 'approve_contracts';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  consultor_general: [
    'view_dashboard', 'view_all_docs', 'create_doc', 'edit_doc', 'archive_doc',
    'view_audit_full', 'manage_users', 'export_reports', 'approve_contracts'
  ],
  abogado_senior: [
    'view_dashboard', 'view_all_docs', 'create_doc', 'edit_doc', 'archive_doc',
    'view_audit_partial', 'export_reports', 'approve_contracts'
  ],
  abogado_junior: [
    'view_dashboard', 'view_assigned_docs', 'create_doc', 'edit_doc'
  ],
  consultor_principal: [
    'view_dashboard', 'view_all_docs', 'view_audit_partial', 'export_reports'
  ],
  aprendiz: [
    'view_assigned_docs'
  ]
};
