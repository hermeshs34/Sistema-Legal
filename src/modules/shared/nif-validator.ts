/**
 * nif-validator.ts
 * Validación de identificadores fiscales españoles.
 *
 * Soporta:
 *   NIF — Número de Identificación Fiscal (persona física residente)
 *         Formato: 8 dígitos + 1 letra de control
 *         Algoritmo: tabla mod23 → 'TRWAGMYFPDXBNJZSQVHLCKE'
 *
 *   NIE — Número de Identidad de Extranjero
 *         Formato: X|Y|Z + 7 dígitos + 1 letra de control
 *         X→0, Y→1, Z→2 antes de aplicar el algoritmo NIF
 *
 *   CIF — Código de Identificación Fiscal (persona jurídica)
 *         Formato: letra + 7 dígitos + dígito/letra de control
 *         Letras ABCDEFGHJNPQRSUVW — algoritmo de control diferenciado
 *
 * Referencia: Real Decreto 1065/2007, Arts. 11-17
 *             Resolución AEAT — validación NIF/NIE/CIF
 *
 * También incluye validación de RIF venezolano (J|G|V|E|P + 9 dígitos)
 */

// ── Constantes NIF ─────────────────────────────────────────────────────────

const NIF_CONTROL_TABLE = 'TRWAGMYFPDXBNJZSQVHLCKE';

// Letras iniciales de CIF que usan letra de control (no dígito)
const CIF_LETTER_CONTROL = 'PQRSW';

// Letras de control alternativas del CIF
const CIF_CONTROL_TABLE = 'JABCDEFGHI';

// ── Tipos de resultado ─────────────────────────────────────────────────────

export type TipoDocumento = 'NIF' | 'NIE' | 'CIF' | 'RIF' | 'PASSPORT' | 'DESCONOCIDO';

export interface ValidationResult {
    valid: boolean;
    tipo: TipoDocumento;
    normalizado: string;    // Formato canónico en mayúsculas sin espacios/guiones
    error?: string;
}

// ── Validador NIF ──────────────────────────────────────────────────────────

function validateNIF(raw: string): ValidationResult {
    const clean = raw.toUpperCase().replace(/[\s-]/g, '');

    if (!/^\d{8}[A-Z]$/.test(clean)) {
        return { valid: false, tipo: 'NIF', normalizado: clean, error: 'Formato NIF inválido (esperado: 8 dígitos + letra)' };
    }

    const digits = parseInt(clean.slice(0, 8), 10);
    const expected = NIF_CONTROL_TABLE[digits % 23];
    const actual   = clean[8];

    if (actual !== expected) {
        return { valid: false, tipo: 'NIF', normalizado: clean, error: `Letra de control incorrecta. Esperada: ${expected}, recibida: ${actual}` };
    }

    return { valid: true, tipo: 'NIF', normalizado: clean };
}

// ── Validador NIE ──────────────────────────────────────────────────────────

function validateNIE(raw: string): ValidationResult {
    const clean = raw.toUpperCase().replace(/[\s-]/g, '');

    if (!/^[XYZ]\d{7}[A-Z]$/.test(clean)) {
        return { valid: false, tipo: 'NIE', normalizado: clean, error: 'Formato NIE inválido (esperado: X/Y/Z + 7 dígitos + letra)' };
    }

    // Sustituir letra inicial por su equivalente numérico
    const prefix = clean[0] === 'X' ? '0' : clean[0] === 'Y' ? '1' : '2';
    const nifEquivalent = prefix + clean.slice(1, 8);
    const digits  = parseInt(nifEquivalent, 10);
    const expected = NIF_CONTROL_TABLE[digits % 23];
    const actual   = clean[8];

    if (actual !== expected) {
        return { valid: false, tipo: 'NIE', normalizado: clean, error: `Letra de control incorrecta. Esperada: ${expected}, recibida: ${actual}` };
    }

    return { valid: true, tipo: 'NIE', normalizado: clean };
}

// ── Validador CIF ──────────────────────────────────────────────────────────

function validateCIF(raw: string): ValidationResult {
    const clean = raw.toUpperCase().replace(/[\s-]/g, '');

    if (!/^[ABCDEFGHJNPQRSUVW]\d{7}[A-Z0-9]$/.test(clean)) {
        return { valid: false, tipo: 'CIF', normalizado: clean, error: 'Formato CIF inválido' };
    }

    const letra  = clean[0];
    const digits = clean.slice(1, 8);
    const control = clean[8];

    // Suma par: dígitos en posiciones pares (1-indexado → 2,4,6)
    let sumPar = 0;
    for (let i = 1; i < 7; i += 2) {
        sumPar += parseInt(digits[i], 10);
    }

    // Suma impar: dígitos en posiciones impares (1,3,5,7), doblados y cross-summed
    let sumImpar = 0;
    for (let i = 0; i < 7; i += 2) {
        const double = parseInt(digits[i], 10) * 2;
        sumImpar += double >= 10 ? double - 9 : double;
    }

    const total      = sumPar + sumImpar;
    const unitDigit  = (10 - (total % 10)) % 10;

    const expectedDigit  = unitDigit.toString();
    const expectedLetter = CIF_CONTROL_TABLE[unitDigit];

    // Algunas letras de inicio obligan a control por letra
    const needsLetter = CIF_LETTER_CONTROL.includes(letra);
    const needsDigit  = 'ABEH'.includes(letra);

    const isValidLetter = control === expectedLetter;
    const isValidDigit  = control === expectedDigit;

    if (needsLetter && !isValidLetter) {
        return { valid: false, tipo: 'CIF', normalizado: clean, error: `Dígito de control incorrecto. Esperada letra: ${expectedLetter}` };
    }
    if (needsDigit && !isValidDigit) {
        return { valid: false, tipo: 'CIF', normalizado: clean, error: `Dígito de control incorrecto. Esperado: ${expectedDigit}` };
    }
    if (!needsLetter && !needsDigit && !isValidLetter && !isValidDigit) {
        return { valid: false, tipo: 'CIF', normalizado: clean, error: `Dígito de control incorrecto. Esperado: ${expectedDigit} o ${expectedLetter}` };
    }

    return { valid: true, tipo: 'CIF', normalizado: clean };
}

// ── Validador RIF venezolano ───────────────────────────────────────────────

function validateRIF(raw: string): ValidationResult {
    // Formato: J-12345678-9 o V123456789 (con o sin guiones)
    const clean = raw.toUpperCase().replace(/[\s-]/g, '');

    if (!/^[JGVEP]\d{9}$/.test(clean)) {
        return {
            valid: false, tipo: 'RIF', normalizado: clean,
            error: 'Formato RIF inválido (esperado: J/G/V/E/P + 9 dígitos)',
        };
    }

    // Formato canónico con guión: J-12345678-9
    const tipo    = clean[0];
    const cuerpo  = clean.slice(1, 9);
    const control = clean[9];
    const normalizado = `${tipo}-${cuerpo}-${control}`;

    return { valid: true, tipo: 'RIF', normalizado };
}

// ── Función principal — detecta y valida automáticamente ──────────────────

/**
 * Valida cualquier identificador fiscal: NIF, NIE, CIF (ES) o RIF (VE).
 * Detección automática por el patrón del input.
 *
 * @example
 * validateFiscalId('12345678Z')     // NIF español
 * validateFiscalId('X1234567L')     // NIE español
 * validateFiscalId('B12345674')     // CIF español
 * validateFiscalId('J-12345678-9') // RIF venezolano
 */
export function validateFiscalId(raw: string): ValidationResult {
    if (!raw || !raw.trim()) {
        return { valid: false, tipo: 'DESCONOCIDO', normalizado: '', error: 'El identificador no puede estar vacío' };
    }

    const clean = raw.toUpperCase().replace(/[\s-]/g, '');

    // RIF venezolano: empieza con J|G|V|E|P y tiene 10 caracteres
    if (/^[JGVEP]/.test(clean) && clean.length === 10) return validateRIF(raw);

    // NIE: empieza con X, Y, Z
    if (/^[XYZ]/.test(clean)) return validateNIE(raw);

    // CIF: empieza con letra de empresa
    if (/^[ABCDEFGHJNPQRSUVW]/.test(clean)) return validateCIF(raw);

    // NIF: solo dígitos + letra final
    if (/^\d{7,8}[A-Z]?$/.test(clean)) return validateNIF(raw);

    // Pasaporte u otro documento (no se valida algorítmicamente)
    return { valid: true, tipo: 'PASSPORT', normalizado: clean };
}

/**
 * Formatea un NIF/NIE/CIF/RIF ya validado en su formato canónico de display.
 * Requiere que validateFiscalId haya retornado valid: true.
 */
export function formatFiscalId(id: string, tipo: TipoDocumento): string {
    const clean = id.toUpperCase().replace(/[\s-]/g, '');
    if (tipo === 'RIF' && clean.length === 10) {
        return `${clean[0]}-${clean.slice(1, 9)}-${clean[9]}`;
    }
    // NIF/NIE/CIF: sin separadores
    return clean;
}

/**
 * Helper para formularios: devuelve el mensaje de error inline o cadena vacía.
 */
export function getFiscalIdError(raw: string): string {
    if (!raw.trim()) return '';
    const result = validateFiscalId(raw);
    return result.valid ? '' : (result.error ?? 'Identificador fiscal inválido');
}

/**
 * Etiqueta del tipo de documento según la jurisdicción del sistema.
 */
export const FISCAL_ID_LABELS: Record<TipoDocumento, string> = {
    NIF:          'NIF — Núm. Identificación Fiscal (ES)',
    NIE:          'NIE — Núm. Identidad Extranjero (ES)',
    CIF:          'CIF — Cód. Identificación Fiscal (ES empresa)',
    RIF:          'RIF — Registro de Información Fiscal (VE)',
    PASSPORT:     'Pasaporte / Documento extranjero',
    DESCONOCIDO:  'Documento no reconocido',
};
