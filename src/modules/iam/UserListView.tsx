import React, { useState, useEffect } from 'react';
import {
    Users,
    UserPlus,
    Search,
    Edit2,
    Trash2,
    Shield,
    Mail,
    CheckCircle,
    XCircle,
    MoreVertical,
    Filter
} from 'lucide-react';
import { userService } from './user.service.ts';
import { UserForm } from './UserForm';
import type { User, UserRole } from '../../core/user.types.ts';

export const UserListView: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        const data = await userService.getAll();
        setUsers(data);
    };

    const handleAddUser = () => {
        setEditingUser(null);
        setIsFormOpen(true);
    };

    const handleEditUser = (user: User) => {
        setEditingUser(user);
        setIsFormOpen(true);
    };

    const handleDeleteUser = async (id: string) => {
        if (window.confirm('¿Está seguro de que desea eliminar este usuario?')) {
            await userService.delete(id);
            await loadUsers();
        }
    };

    const handleToggleStatus = async (user: User) => {
        const updatedUser = { ...user, isActive: !user.isActive };
        await userService.save(updatedUser);
        await loadUsers();
    };

    const handleFormSubmit = async () => {
        setIsFormOpen(false);
        setEditingUser(null);
        await loadUsers();
    };

    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.replace('_', ' ').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getRoleBadgeStyle = (role: UserRole) => {
        switch (role) {
            case 'consultor_general': return { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' };
            case 'abogado_senior': return { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' };
            case 'abogado_junior': return { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' };
            case 'consultor_principal': return { bg: '#faf5ff', color: '#6b21a8', border: '#e9d5ff' };
            default: return { bg: '#f9fafb', color: '#374151', border: '#e5e7eb' };
        }
    };

    return (
        <div style={{
            animation: 'fadeIn 0.5s ease-out',
            display: 'flex',
            flexDirection: 'column',
            gap: '2rem'
        }}>
            {/* Header Section */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                flexWrap: 'wrap',
                gap: '1.5rem'
            }}>
                <div>
                    <h2 style={{
                        fontSize: '2rem',
                        fontWeight: 800,
                        color: '#1e3a8a',
                        marginBottom: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                    }}>
                        <Users size={32} />
                        Gestión de Usuarios
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '1rem' }}>
                        Administre el acceso, roles y permisos de los miembros de su equipo legal.
                    </p>
                </div>

                <button
                    onClick={handleAddUser}
                    style={{
                        padding: '0.875rem 1.5rem',
                        background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(37, 99, 235, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(37, 99, 235, 0.3)';
                    }}
                >
                    <UserPlus size={20} />
                    Crear Usuario
                </button>
            </div>

            {/* Quick Stats */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.5rem'
            }}>
                {[
                    { label: 'Total Usuarios', value: users.length, icon: Users, color: '#2563eb' },
                    { label: 'Usuarios Activos', value: users.filter(u => u.isActive).length, icon: CheckCircle, color: '#059669' },
                    { label: 'Roles Definidos', value: 5, icon: Shield, color: '#7c3aed' },
                    { label: 'Acciones Pendientes', value: 0, icon: Filter, color: '#ea580c' }
                ].map((stat, i) => (
                    <div key={i} className="premium-card" style={{
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 600 }}>{stat.label}</span>
                            <stat.icon size={20} color={stat.color} />
                        </div>
                        <span style={{ fontSize: '2rem', fontWeight: 800, color: '#1e293b' }}>{stat.value}</span>
                    </div>
                ))}
            </div>

            {/* Filter & Search Bar */}
            <div className="premium-card" style={{
                padding: '1rem',
                display: 'flex',
                gap: '1rem',
                alignItems: 'center'
            }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, email o cargo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.75rem 1rem 0.75rem 3rem',
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            fontSize: '0.95rem',
                            outline: 'none'
                        }}
                    />
                </div>
                <button style={{
                    padding: '0.75rem 1rem',
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: '#64748b',
                    fontWeight: 600,
                    cursor: 'pointer'
                }}>
                    <Filter size={18} />
                    Filtros
                </button>
            </div>

            {/* Users Table */}
            <div className="premium-card" style={{ overflow: 'hidden', padding: 0 }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <tr>
                                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#64748b' }}>Usuario</th>
                                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#64748b' }}>Rol / Cargo</th>
                                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#64748b' }}>Estado</th>
                                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#64748b' }}>Permisos</th>
                                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#64748b', textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length > 0 ? filteredUsers.map((user) => {
                                const roleStyle = getRoleBadgeStyle(user.role);
                                return (
                                    <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '50%',
                                                    background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: 700,
                                                    color: '#3730a3',
                                                    overflow: 'hidden'
                                                }}>
                                                    {user.avatar ? <img src={user.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : user.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{user.name}</div>
                                                    <div style={{ fontSize: '0.8125rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                        <Mail size={12} />
                                                        {user.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <span style={{
                                                padding: '0.375rem 0.75rem',
                                                borderRadius: '20px',
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                backgroundColor: roleStyle.bg,
                                                color: roleStyle.color,
                                                border: `1px solid ${roleStyle.border}`,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.025em'
                                            }}>
                                                {user.role.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <button
                                                onClick={() => handleToggleStatus(user)}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    padding: '0.375rem 0.75rem',
                                                    borderRadius: '8px',
                                                    background: user.isActive ? '#dcfce7' : '#fee2e2',
                                                    color: user.isActive ? '#166534' : '#991b1b',
                                                    border: 'none',
                                                    fontSize: '0.8125rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {user.isActive ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                                {user.isActive ? 'Activo' : 'Inactivo'}
                                            </button>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem' }}>
                                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                <div title="Acceso a Dashboard" style={{ padding: '4px', borderRadius: '4px', background: '#f1f5f9' }}><Shield size={14} color="#64748b" /></div>
                                                <div title="Ver Documentos" style={{ padding: '4px', borderRadius: '4px', background: '#f1f5f9' }}><Shield size={14} color="#64748b" /></div>
                                                {user.role === 'consultor_general' && <div title="Super Admin" style={{ padding: '4px', borderRadius: '4px', background: '#dbeafe' }}><Shield size={14} color="#2563eb" /></div>}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                                <button
                                                    onClick={() => handleEditUser(user)}
                                                    style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer' }}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #fee2e2', background: 'white', color: '#ef4444', cursor: 'pointer' }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                                <button style={{ padding: '0.5rem', border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                                                    <MoreVertical size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={5} style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <Search size={48} style={{ opacity: 0.2 }} />
                                        </div>
                                        <p>No se encontraron usuarios que coincidan con su búsqueda.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Form Modal */}
            {isFormOpen && (
                <UserForm
                    user={editingUser}
                    onClose={() => setIsFormOpen(false)}
                    onSave={handleFormSubmit}
                />
            )}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};
