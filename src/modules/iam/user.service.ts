import { supabase } from '../../core/supabase.ts';
import { type User } from '../../core/user.types.ts';
import { authService } from '../../core/auth.service.ts';

class UserService {
    async getAll(): Promise<User[]> {
        const user = authService.getCurrentUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('organization_id', user.organizationId)
            .order('name');

        if (error) {
            console.error('Error fetching users:', error);
            return [];
        }

        return (data || []).map(u => ({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            avatar: u.avatar_url,
            isActive: u.is_active,
            organizationId: u.organization_id
        }));
    }

    async getById(id: string): Promise<User | null> {
        const user = authService.getCurrentUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', id)
            .eq('organization_id', user.organizationId)
            .single();

        if (error || !data) return null;

        return {
            id: data.id,
            email: data.email,
            name: data.name,
            role: data.role,
            avatar: data.avatar_url,
            isActive: data.is_active,
            organizationId: data.organization_id
        };
    }

    // Nota: El 'save' de perfil usualmente se maneja vía Admin Auth o el propio usuario
    // Para simplificar el panel de admin, usaremos un update directo a profiles.
    // La creación de usuarios nuevos debería ser vía Auth.signUp
    async save(user: User, password?: string): Promise<void> {
        const currentUser = authService.getCurrentUser();
        
        // 1. Si hay un password, es un usuario nuevo o cambio de clave. 
        // Registramos en el motor de Autenticación de Supabase primero.
        if (password) {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: user.email,
                password: password,
                options: {
                    data: {
                        name: user.name,
                        role: user.role
                    }
                }
            });

            if (authError) throw authError;

            // Usamos el ID generado por Supabase Auth para nuestro perfil
            if (authData.user) {
                user.id = authData.user.id;
            }
        }

        // 2. Guardamos los datos extendidos en nuestra tabla de perfiles
        // Como 'profiles' se autogenera por un Trigger al hacer signUp,
        // usar .upsert() desde el frontend causa un error RLS (no hay permisos de INSERT).
        // Siempre usamos .update() para afectar la fila que ya existe o que el Trigger acaba de crear.
        const { error: profileError } = await supabase
            .from('profiles')
            .update({
                email: user.email,
                name: user.name,
                role: user.role,
                avatar_url: user.avatar,
                is_active: user.isActive,
                organization_id: user.organizationId || currentUser?.organizationId,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

        if (profileError) throw profileError;
    }

    async delete(id: string): Promise<void> {
        const user = authService.getCurrentUser();
        if (!user) return;

        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', id)
            .eq('organization_id', user.organizationId);

        if (error) throw error;
    }

    /**
     * Cambia la contraseña de un usuario existente.
     * Usa Admin API (requiere service_role) si está disponible.
     * Si no, envía un email de restablecimiento como fallback seguro.
     */
    async changePassword(userId: string, userEmail: string, newPassword: string): Promise<{ method: 'direct' | 'email' }> {
        // Intento 1: Admin API (funciona si el cliente tiene service_role key)
        try {
            const { error } = await supabase.auth.admin.updateUserById(userId, {
                password: newPassword
            });
            if (!error) return { method: 'direct' };
        } catch (_) {
            // Admin API no disponible con anon key — usar fallback
        }

        // Intento 2: Si es el usuario actual autenticado, puede cambiarse a sí mismo
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser?.id === userId) {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            return { method: 'direct' };
        }

        // Fallback: Enviar email de restablecimiento
        const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
            redirectTo: window.location.origin + '/reset-password'
        });
        if (error) throw error;
        return { method: 'email' };
    }

    async uploadAvatar(file: File, userId: string): Promise<string> {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}-${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Retornamos el path interno. Para mostrar el avatar, 
        // usar createSignedUrl (bucket privado) o getPublicUrl si el bucket es público.
        return filePath;
    }

    generateId(): string {
        // Supabase usa UUIDs, pero mantendremos este helper si el form lo requiere antes de persistir
        return crypto.randomUUID();
    }
}

export const userService = new UserService();
