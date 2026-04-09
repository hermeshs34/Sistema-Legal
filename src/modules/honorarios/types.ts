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
    budgetUsd: number;
    retainerUsd: number;
    contingencyPct: number;
    hourlyRateUsd: number;
    openedAt: string;
    closedAt?: string;
    organizationId: string;
    createdAt: string;
    updatedAt: string;
    // Calculados
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
    rateUsd: number;
    amountUsd: number;     // Columna generada
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
    subtotalUsd: number;
    taxPct: number;
    taxUsd: number;
    islrPct: number;
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

// ── Pagos ────────────────────────────────────────────────
export type PaymentMethod = 'TRANSFER' | 'CASH' | 'CHECK' | 'ZELLE' | 'CRYPTO' | 'OTHER';

export interface Payment {
    id: string;
    invoiceId: string;
    clientId: string;
    clientName?: string;  // JOIN
    amountUsd: number;
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
