import { supabase } from './supabase.ts';
import { ROLE_PERMISSIONS, type User } from './user.types.ts';

class AuthService {
    private userKey = 'legal_user';

    async login(email: string, password: string): Promise<User> {
        const cleanEmail = email.trim().toLowerCase();

        // Autenticación EXCLUSIVAMENTE via Supabase Auth — sin bypasses ni passwords maestros
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password
        });

        if (authError) {
            if (authError.message.includes('Invalid login credentials')) {
                throw new Error('Credenciales incorrectas. Verifique su correo y contraseña.');
            }
            if (authError.message.includes('Email not confirmed')) {
                throw new Error('Debe confirmar su correo electrónico antes de iniciar sesión.');
            }
            throw new Error('Error de autenticación. Intente nuevamente.');
        }

        if (!authData.user) {
            throw new Error('No se pudo verificar la identidad. Contacte al administrador.');
        }

        // Obtener perfil del sistema
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();

        if (profileError || !profile) {
            await this.logout();
            throw new Error(
                'Su cuenta no tiene un perfil configurado en el sistema. ' +
                'Contacte al administrador para completar su registro.'
            );
        }

        if (!profile.is_active) {
            await this.logout();
            throw new Error('Esta cuenta ha sido desactivada. Contacte al administrador.');
        }

        if (!profile.organization_id) {
            await this.logout();
            throw new Error(
                'Su cuenta no está asignada a ninguna organización. ' +
                'Contacte al administrador del sistema.'
            );
        }

        const mappedUser: User = {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            role: profile.role,
            avatar: profile.avatar_url,
            isActive: profile.is_active,
            organizationId: profile.organization_id,
        };

        localStorage.setItem(this.userKey, JSON.stringify(mappedUser));
        return mappedUser;
    }

    async register(email: string, password: string, name: string, role: string = 'abogado_junior'): Promise<void> {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name,
                    role
                }
            }
        });

        if (error) throw error;
    }

    async logout(): Promise<void> {
        await supabase.auth.signOut();
        localStorage.removeItem(this.userKey);
    }

    getCurrentUser(): User | null {
        const data = localStorage.getItem(this.userKey);
        if (!data) return null;
        const user = JSON.parse(data) as User;
        // Validación de integridad: si organizationId está vacío la sesión es inválida
        if (!user.organizationId) {
            console.warn('[AuthService] Sesión sin organizationId detectada. Limpiando...');
            localStorage.removeItem(this.userKey);
            return null;
        }
        return user;
    }

    /** Sincroniza la sesión si el token de Supabase sigue activo */
    async syncSession(): Promise<User | null> {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            localStorage.removeItem(this.userKey);
            return null;
        }
        // Re-cargar perfil desde DB para actualizar el cache
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
        if (profile && profile.organization_id) {
            const user: User = {
                id: profile.id,
                email: profile.email,
                name: profile.name,
                role: profile.role,
                avatar: profile.avatar_url,
                isActive: profile.is_active,
                organizationId: profile.organization_id,
            };
            localStorage.setItem(this.userKey, JSON.stringify(user));
            return user;
        }
        localStorage.removeItem(this.userKey);
        return null;
    }

    hasPermission(user: User | null, permission: string): boolean {
        if (!user) return false;
        const permissions = ROLE_PERMISSIONS[user.role] || [];
        return permissions.includes(permission as any);
    }
}

export const authService = new AuthService();
