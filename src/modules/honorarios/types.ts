// ══════════════════════════════════════════════════════════
// TIPOS — Módulo de Honorarios Profesionales
// LegalDoc VE — Gestión integral de honorarios y facturación
// ══════════════════════════════════════════════════════════

export type CreditRisk = 'LOW' | 'MEDIUM' | 'HIGH';
export type ClientType = 'PERSON' | 'COMPANY';

export interface Client {
    id: string;
    name: string;
    type: ClientType;
    idNumber?: string;
    email?: string;
    phone?: string;
    address?: string;
    creditRisk: CreditRisk;
    notes?: string;
    isActive: boolean;
    organizationId: string;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}

// ── Casos / Asuntos ──────────────────────────────────────
export type MatterType = 'LITIGATION' | 'ADVISORY' | 'CONTRACT' | 'ARBITRATION' | 'COMPLIANCE';
export type MatterStatus = 'OPEN' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'ARCHIVED';
export type FeeType = 'HOURLY' | 'FIXED' | 'CONTINGENCY' | 'RETAINER';

export interface Matter {
    id: string;
    code?: string;
    title: string;
    description?: string;
    type: MatterType;
    status: MatterStatus;
    clientId: string;
    clientName?: string;         // JOIN
    assignedLawyerId?: string;
    assignedLawyerName?: string; // JOIN
    expedienteId?: string;
    contractId?: string;
    feeType: FeeType;
    currency: Currency;        // Nueva: Moneda del presupuesto
    budget: number;          // Nueva: Monto nominal
    budgetUsd: number;       // Base USD para consolidación
    retainer: number;        // Nueva
    retainerUsd: number;
    contingencyPct: number;
    hourlyRate: number;      // Nueva
    hourlyRateUsd: number;
    exchangeRate?: number;    // Nueva: Tasa utilizada para el presupuesto inicial
    openedAt: string;
    closedAt?: string;
    organizationId: string;
    createdAt: string;
    updatedAt: string;
    // Calculados (Siempre en USD para motor de consolidación)
    totalHours?: number;
    totalBilledUsd?: number;
    totalPaidUsd?: number;
    balanceUsd?: number;
}

// ── Time Tracking ────────────────────────────────────────
export type TimeCategory = 'HEARING' | 'DRAFTING' | 'RESEARCH' | 'MEETING' | 'CALL' | 'TRAVEL' | 'GENERAL';

export interface TimeEntry {
    id: string;
    matterId: string;
    matterTitle?: string;  // JOIN
    lawyerId?: string;
    lawyerName?: string;   // JOIN
    userId?: string;
    date: string;
    description: string;
    category: TimeCategory;
    hours: number;
    currency: Currency;    // Nueva
    rate: number;          // Nueva: Monto nominal
    rateUsd: number;       // Base USD
    amount: number;        // Nueva: Monto nominal
    amountUsd: number;     // Columna generada
    exchangeRate?: number; // Nueva: Tasa al momento del log de horas
    isBillable: boolean;
    isInvoiced: boolean;
    invoiceId?: string;
    organizationId: string;
    createdAt: string;
}

// ── Gastos ───────────────────────────────────────────────
export type ExpenseCategory = 'COURT_FEE' | 'NOTARY' | 'EXPERT' | 'TRAVEL' | 'PRINTING' | 'APOSTILLE' | 'OTHER';
export type Currency = 'USD' | 'EUR' | 'VES';

export interface MatterExpense {
    id: string;
    matterId: string;
    date: string;
    description: string;
    category: ExpenseCategory;
    currency: Currency;
    amount: number;          // Monto en la moneda seleccionada
    amountUsd: number;       // Equivalente en USD (para cálculos)
    exchangeRate?: number;   // Tasa de cambio al momento del registro
    receiptUrl?: string;
    paidBy: 'FIRM' | 'CLIENT';
    isReimbursed: boolean;
    organizationId: string;
    createdBy?: string;
    createdAt: string;
}

// ── Facturas ─────────────────────────────────────────────
export type InvoiceType = 'RETAINER' | 'PROGRESS' | 'FINAL' | 'EXPENSE';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'PARTIAL' | 'OVERDUE' | 'CANCELLED';

export interface Invoice {
    id: string;
    number: string;
    matterId?: string;
    matterTitle?: string;  // JOIN
    clientId: string;
    clientName?: string;   // JOIN
    type: InvoiceType;
    status: InvoiceStatus;
    
    currency: Currency;
    exchangeRate: number;
    
    subtotal: number;
    taxPct: number;
    tax: number;
    islrPct: number;
    islr: number;
    total: number;
    paid: number;
    balance: number;

    subtotalUsd: number;
    taxUsd: number;
    islrUsd: number;
    totalUsd: number;
    paidUsd: number;
    balanceUsd: number;
    
    issuedAt: string;
    dueAt?: string;
    paidAt?: string;
    notes?: string;
    organizationId: string;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
    USD: '$',
    EUR: '€',
    VES: 'Bs.'
};

// ── Pagos ────────────────────────────────────────────────
export type PaymentMethod = 'TRANSFER' | 'CASH' | 'CHECK' | 'ZELLE' | 'CRYPTO' | 'OTHER';

export interface Payment {
    id: string;
    invoiceId: string;
    clientId: string;
    clientName?: string;  // JOIN
    currency: Currency;
    amount: number;       // Monto en la moneda del pago
    amountUsd: number;    // Equivalente en USD
    exchangeRate?: number;
    method: PaymentMethod;
    reference?: string;
    paidAt: string;
    notes?: string;
    organizationId: string;
    createdBy?: string;
    createdAt: string;
}

// ── Resumen financiero por caso ──────────────────────────
export interface MatterFinancialSummary {
    matterId: string;
    matterTitle: string;
    budgetUsd: number;
    totalHours: number;
    totalHoursUsd: number;
    totalExpensesUsd: number;
    totalBilledUsd: number;
    totalPaidUsd: number;
    balanceUsd: number;
    budgetUsedPct: number;
}

// ── Tasas de Cambio ──────────────────────────────────────
export interface ExchangeRate {
    id: string;
    currencyFrom: 'USD' | 'EUR' | 'VES';
    currencyTo:   'USD' | 'EUR' | 'VES';
    rate: number;
    effectiveDate: string;
    source: string;
    notes?: string;
    organizationId: string;
    createdAt: string;
}
