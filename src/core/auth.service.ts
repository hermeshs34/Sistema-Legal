import { supabase } from './supabase.ts';
import { ROLE_PERMISSIONS, type User } from './user.types.ts';

// ─── Constantes de seguridad ────────────────────────────────────────────────
/** sessionStorage: se borra al cerrar el tab. Nunca localStorage para datos de rol. */
const SESSION_KEY     = 'legal_session';
const RATE_KEY_PREFIX = 'legal_rate_';
const MAX_ATTEMPTS    = 5;
/** Lockout progresivo: 30s → 2min → 5min → 15min */
const LOCKOUT_STEPS   = [30, 120, 300, 900];

/** Roles que requieren MFA/TOTP obligatorio */
const MFA_REQUIRED_ROLES: string[] = [
    'consultor_general',
    'abogado_senior',
    'compliance_officer',
    'gerente_firma',
    'auditor_externo',
];

// ─── Helpers internos ────────────────────────────────────────────────────────

interface RateData { attempts: number; lockedUntil: number; step: number; }

function getRateData(email: string): RateData {
    const raw = sessionStorage.getItem(`${RATE_KEY_PREFIX}${email}`);
    if (!raw) return { attempts: 0, lockedUntil: 0, step: 0 };
    try { return JSON.parse(raw) as RateData; }
    catch { return { attempts: 0, lockedUntil: 0, step: 0 }; }
}

function setRateData(email: string, data: RateData): void {
    sessionStorage.setItem(`${RATE_KEY_PREFIX}${email}`, JSON.stringify(data));
}

function mapProfile(profile: Record<string, unknown>): User {
    return {
        id:             profile.id as string,
        email:          profile.email as string,
        name:           profile.name as string,
        role:           profile.role as User['role'],
        avatar:         profile.avatar_url as string | undefined,
        isActive:       profile.is_active as boolean,
        organizationId: profile.organization_id as string,
    };
}

// ─── AuthService ─────────────────────────────────────────────────────────────

class AuthService {

    // ── Rate Limiting ─────────────────────────────────────────────────────────

    /**
     * Verifica si el email está en lockout.
     * Lanza error con formato "LOCKOUT:<segundos>" para que LoginView muestre el contador.
     */
    checkRateLimit(email: string): void {
        const rate = getRateData(email);
        const now  = Date.now();
        if (rate.lockedUntil > now) {
            const secsLeft = Math.ceil((rate.lockedUntil - now) / 1000);
            throw new Error(`LOCKOUT:${secsLeft}`);
        }
    }

    /**
     * Registra un intento fallido y aplica lockout progresivo si se superó el máximo.
     * Retorna los segundos de bloqueo aplicado (0 si aún no hay lockout).
     */
    recordFailedAttempt(email: string): number {
        const rate     = getRateData(email);
        const attempts = rate.attempts + 1;

        if (attempts >= MAX_ATTEMPTS) {
            const step       = Math.min(rate.step, LOCKOUT_STEPS.length - 1);
            const lockoutSec = LOCKOUT_STEPS[step];
            setRateData(email, { attempts, lockedUntil: Date.now() + lockoutSec * 1000, step: step + 1 });
            return lockoutSec;
        }

        setRateData(email, { ...rate, attempts });
        return 0;
    }

    clearRateLimit(email: string): void {
        sessionStorage.removeItem(`${RATE_KEY_PREFIX}${email}`);
    }

    getAttempts(email: string): number {
        return getRateData(email).attempts;
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    /**
     * Autenticación en dos fases:
     *   1. Credenciales (Supabase Auth)
     *   2. MFA TOTP si el rol lo requiere y el factor está configurado
     *
     * Retorna { user, mfaRequired, factorId? }.
     * Si mfaRequired=true → llamar a verifyMFA() antes de guardar la sesión.
     */
    async login(
        email: string,
        password: string
    ): Promise<{ user: User; mfaRequired: boolean; factorId?: string; enrollmentRequired?: boolean }> {
        const cleanEmail = email.trim().toLowerCase();

        // 1. Rate limit — bloquea antes de intentar contra Supabase
        this.checkRateLimit(cleanEmail);

        // 2. Autenticación vía Supabase Auth (exclusiva — sin bypasses)
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
        });

        if (authError) {
            this.recordFailedAttempt(cleanEmail);
            const remaining = Math.max(0, MAX_ATTEMPTS - this.getAttempts(cleanEmail));
            if (authError.message.includes('Invalid login credentials')) {
                throw new Error(
                    remaining > 0
                        ? `Credenciales incorrectas. Intentos restantes: ${remaining}.`
                        : 'Cuenta bloqueada temporalmente. Intente en unos minutos.'
                );
            }
            if (authError.message.includes('Email not confirmed')) {
                throw new Error('Debe confirmar su correo electrónico antes de iniciar sesión.');
            }
            throw new Error('Error de autenticación. Intente nuevamente.');
        }

        if (!authData.user) {
            this.recordFailedAttempt(cleanEmail);
            throw new Error('No se pudo verificar la identidad. Contacte al administrador.');
        }

        // 3. Cargar perfil desde DB (fuente de verdad de rol y organización)
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

        if (!(profile.is_active as boolean)) {
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

        const mappedUser = mapProfile(profile);

        // 4. Verificar MFA si el rol lo requiere
        if (MFA_REQUIRED_ROLES.includes(mappedUser.role)) {
            const { data: factors } = await supabase.auth.mfa.listFactors();
            const verifiedTOTP = factors?.totp?.find(f => f.status === 'verified');
            if (verifiedTOTP) {
                // Factor activo → NO guardar sesión, esperar verificación TOTP
                return { user: mappedUser, mfaRequired: true, factorId: verifiedTOTP.id };
            }
            // Factor no configurado → enrollment obligatorio.
            // NO guardar sesión: si el usuario refresca antes de completar el enrollment
            // syncSession() encontrará AAL1 y forzará cierre de sesión.
            this.clearRateLimit(cleanEmail);
            return { user: mappedUser, mfaRequired: false, enrollmentRequired: true };
        }

        // 5. Sesión directa (rol de bajo riesgo, sin MFA requerido)
        this._saveSession(mappedUser);
        this.clearRateLimit(cleanEmail);
        return { user: mappedUser, mfaRequired: false };
    }

    // ── MFA ───────────────────────────────────────────────────────────────────

    /**
     * Paso 2 del flujo MFA: verifica el código TOTP y finaliza la sesión.
     */
    async verifyMFA(factorId: string, code: string, user: User): Promise<User> {
        const { data: challengeData, error: challengeErr } =
            await supabase.auth.mfa.challenge({ factorId });

        if (challengeErr || !challengeData) {
            throw new Error('No se pudo iniciar el desafío MFA. Intente nuevamente.');
        }

        const { error: verifyErr } = await supabase.auth.mfa.verify({
            factorId,
            challengeId: challengeData.id,
            code:        code.replace(/\s/g, ''),
        });

        if (verifyErr) {
            throw new Error('Código MFA incorrecto. Verifique su aplicación autenticadora.');
        }

        this._saveSession(user);
        this.clearRateLimit(user.email);
        return user;
    }

    /**
     * Genera QR para enrolamiento TOTP inicial.
     * Retorna { qrCode (data URI), secret, factorId }.
     */
    async enrollMFA(): Promise<{ qrCode: string; secret: string; factorId: string }> {
        const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
        if (error || !data) throw new Error('Error iniciando enrolamiento MFA. Intente nuevamente.');
        return {
            qrCode:   data.totp.qr_code,
            secret:   data.totp.secret,
            factorId: data.id,
        };
    }

    /**
     * Confirma el enrolamiento verificando el primer código generado por la app.
     */
    async confirmMFAEnrollment(factorId: string, code: string): Promise<void> {
        const { data: challengeData, error: challengeErr } =
            await supabase.auth.mfa.challenge({ factorId });

        if (challengeErr || !challengeData) {
            throw new Error('Error en desafío de confirmación MFA.');
        }

        const { error: verifyErr } = await supabase.auth.mfa.verify({
            factorId,
            challengeId: challengeData.id,
            code:        code.replace(/\s/g, ''),
        });

        if (verifyErr) {
            throw new Error('Código incorrecto. Escanee de nuevo el QR e intente.');
        }
    }

    // ── Sesión ────────────────────────────────────────────────────────────────

    /**
     * Persiste el perfil de usuario en sessionStorage (se borra al cerrar el tab).
     * NUNCA almacena tokens JWT — esos los gestiona el cliente Supabase internamente.
     */
    /** Guarda la sesión tras enrollment MFA exitoso (llamar desde LoginView). */
    saveSession(user: User): void {
        this._saveSession(user);
    }

    private _saveSession(user: User): void {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    }

    async logout(): Promise<void> {
        await supabase.auth.signOut();
        sessionStorage.removeItem(SESSION_KEY);
    }

    /**
     * Retorna el perfil cacheado.
     * Valida estructura mínima para detectar sessionStorage corrompido o manipulado.
     * La validación de integridad profunda (userId vs JWT) se hace en syncSession().
     */
    getCurrentUser(): User | null {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;

        let user: User;
        try { user = JSON.parse(raw) as User; }
        catch { sessionStorage.removeItem(SESSION_KEY); return null; }

        if (!user.id || !user.organizationId || !user.role) {
            sessionStorage.removeItem(SESSION_KEY);
            return null;
        }
        return user;
    }

    /**
     * Sincroniza el perfil contra Supabase Auth.
     * - Siempre recarga el perfil desde la DB (no confía solo en sessionStorage)
     * - Valida que el ID en cache coincida con el JWT activo (anti-tampering de rol)
     * - Llamar al arrancar la app y periódicamente en background
     */
    async syncSession(): Promise<User | null> {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            sessionStorage.removeItem(SESSION_KEY);
            return null;
        }

        // Validación de integridad: el ID del cache debe coincidir con el JWT
        const cached = this.getCurrentUser();
        if (cached && cached.id !== session.user.id) {
            console.warn(
                '[AuthService] Integridad violada: ID en sessionStorage no coincide con JWT. ' +
                'Posible manipulación. Cerrando sesión.'
            );
            sessionStorage.removeItem(SESSION_KEY);
            await supabase.auth.signOut();
            return null;
        }

        // Recargar perfil desde DB para obtener rol y estado actualizados
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (!profile?.organization_id) {
            sessionStorage.removeItem(SESSION_KEY);
            return null;
        }

        const freshUser = mapProfile(profile);

        // ── Validación AAL (Assurance Level) — anti-bypass MFA por refresh ──────
        // Para roles que requieren MFA, SOLO se permite sesión AAL2 (TOTP completado).
        // Cualquier sesión AAL1 —ya sea porque el factor no fue verificado o porque
        // el usuario aún no ha completado el enrollment— se fuerza a cerrar.
        if (MFA_REQUIRED_ROLES.includes(freshUser.role)) {
            const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            if (aalData?.currentLevel !== 'aal2') {
                console.warn(
                    `[AuthService] Rol "${freshUser.role}" requiere AAL2 pero sesión es ` +
                    `${aalData?.currentLevel ?? 'desconocido'}. Forzando cierre de sesión.`
                );
                sessionStorage.removeItem(SESSION_KEY);
                await supabase.auth.signOut();
                return null;
            }
        }

        this._saveSession(freshUser);
        return freshUser;
    }

    // ── Utilidades ────────────────────────────────────────────────────────────

    async register(email: string, password: string, name: string, role: string = 'abogado_junior'): Promise<void> {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name, role } },
        });
        if (error) throw error;
    }

    hasPermission(user: User | null, permission: string): boolean {
        if (!user) return false;
        const permissions = ROLE_PERMISSIONS[user.role] || [];
        return permissions.includes(permission as never);
    }

    /** Indica si el rol debe configurar MFA obligatoriamente. */
    requiresMFA(role: string): boolean {
        return MFA_REQUIRED_ROLES.includes(role);
    }
}

export const authService = new AuthService();
