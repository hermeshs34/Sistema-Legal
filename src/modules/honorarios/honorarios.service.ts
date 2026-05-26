// ══════════════════════════════════════════════════════════
// SERVICIO — Módulo de Honorarios Profesionales
// LegalDoc VE
// ══════════════════════════════════════════════════════════

import { supabase } from '../../core/supabase.ts';
import { authService } from '../../core/auth.service.ts';
import type { Client, Matter, TimeEntry, MatterExpense, Invoice, Payment, MatterFinancialSummary, ExchangeRate } from './types.ts';

// ────────────────────────────────────────────────────────
// CLIENTES
// ────────────────────────────────────────────────────────
class ClientService {
    private orgId(): string {
        return authService.getCurrentUser()?.organizationId ?? '';
    }

    async getAll(): Promise<Client[]> {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('organization_id', this.orgId())
            .order('name');
        if (error) throw error;
        return (data ?? []).map(this.map);
    }

    async getById(id: string): Promise<Client | null> {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('id', id)
            .eq('organization_id', this.orgId())
            .single();
        if (error) return null;
        return this.map(data);
    }

    async save(client: Partial<Client>): Promise<Client> {
        const orgId = this.orgId();
        const payload = {
            name: client.name,
            type: client.type ?? 'PERSON',
            id_number: client.idNumber,
            email: client.email,
            phone: client.phone,
            address: client.address,
            credit_risk: client.creditRisk ?? 'LOW',
            notes: client.notes,
            is_active: client.isActive ?? true,
            organization_id: orgId,
        };

        if (client.id) {
            const { data, error } = await supabase
                .from('clients')
                .update({ ...payload, updated_at: new Date().toISOString() })
                .eq('id', client.id)
                .eq('organization_id', orgId)
                .select().single();
            if (error) throw error;
            return this.map(data);
        } else {
            const { data, error } = await supabase
                .from('clients')
                .insert(payload)
                .select().single();
            if (error) throw error;
            return this.map(data);
        }
    }

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('clients')
            .delete()
            .eq('id', id)
            .eq('organization_id', this.orgId());
        if (error) throw error;
    }

    private map(r: any): Client {
        return {
            id: r.id,
            name: r.name,
            type: r.type,
            idNumber: r.id_number,
            email: r.email,
            phone: r.phone,
            address: r.address,
            creditRisk: r.credit_risk,
            notes: r.notes,
            isActive: r.is_active,
            organizationId: r.organization_id,
            createdBy: r.created_by,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        };
    }
}

// ────────────────────────────────────────────────────────
// CASOS / ASUNTOS
// ────────────────────────────────────────────────────────
class MatterService {
    private orgId(): string {
        return authService.getCurrentUser()?.organizationId ?? '';
    }

    async getAll(): Promise<Matter[]> {
        const { data, error } = await supabase
            .from('matters')
            .select(`*, clients(name), lawyers(name)`)
            .eq('organization_id', this.orgId())
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data ?? []).map(this.map);
    }

    async getById(id: string): Promise<Matter | null> {
        const { data, error } = await supabase
            .from('matters')
            .select(`*, clients(name), lawyers(name)`)
            .eq('id', id)
            .eq('organization_id', this.orgId())
            .single();
        if (error) return null;
        return this.map(data);
    }

    async save(matter: Partial<Matter>): Promise<Matter> {
        const orgId = this.orgId();
        const currency = matter.currency ?? 'USD';
        const budget = matter.budget ?? matter.budgetUsd ?? 0;
        const rate = matter.exchangeRate || 1;
        
        const budgetUsd = currency === 'USD' ? budget : (budget / rate);
        const hourlyRate = matter.hourlyRate ?? matter.hourlyRateUsd ?? 0;
        const hourlyRateUsd = currency === 'USD' ? hourlyRate : (hourlyRate / rate);
        const retainer = matter.retainer ?? matter.retainerUsd ?? 0;
        const retainerUsd = currency === 'USD' ? retainer : (retainer / rate);

        const payload = {
            title: matter.title,
            code: matter.code,
            description: matter.description,
            type: matter.type ?? 'LITIGATION',
            status: matter.status ?? 'OPEN',
            client_id: matter.clientId,
            assigned_lawyer_id: matter.assignedLawyerId,
            expediente_id: matter.expedienteId,
            contract_id: matter.contractId,
            fee_type: matter.feeType ?? 'HOURLY',
            
            currency,
            budget,
            budget_usd: budgetUsd,
            retainer,
            retainer_usd: retainerUsd,
            contingency_pct: matter.contingencyPct ?? 0,
            hourly_rate: hourlyRate,
            hourly_rate_usd: hourlyRateUsd,
            
            opened_at: matter.openedAt,
            closed_at: matter.closedAt,
            organization_id: orgId,
        };

        if (matter.id) {
            const { data, error } = await supabase
                .from('matters')
                .update({ ...payload, updated_at: new Date().toISOString() })
                .eq('id', matter.id)
                .eq('organization_id', orgId)
                .select(`*, clients(name), lawyers(name)`).single();
            if (error) throw error;
            return this.map(data);
        } else {
            const { data, error } = await supabase
                .from('matters')
                .insert(payload)
                .select(`*, clients(name), lawyers(name)`).single();
            if (error) throw error;
            return this.map(data);
        }
    }

    async getFinancialSummary(matterId: string): Promise<MatterFinancialSummary> {
        const [matter, entries, expenses, invoices] = await Promise.all([
            this.getById(matterId),
            timeEntryService.getByMatter(matterId),
            expenseService.getByMatter(matterId),
            invoiceService.getByMatter(matterId),
        ]);

        const totalHours = entries.filter(e => e.isBillable).reduce((s, e) => s + e.hours, 0);
        const totalHoursUsd = entries.filter(e => e.isBillable).reduce((s, e) => s + e.amountUsd, 0);
        const totalExpensesUsd = expenses.reduce((s, e) => s + e.amountUsd, 0);
        const totalBilledUsd = invoices.reduce((s, i) => s + i.totalUsd, 0);
        const totalPaidUsd = invoices.reduce((s, i) => s + i.paidUsd, 0);
        const budgetUsd = matter?.budgetUsd ?? 0;

        return {
            matterId,
            matterTitle: matter?.title ?? '',
            budgetUsd,
            totalHours,
            totalHoursUsd,
            totalExpensesUsd,
            totalBilledUsd,
            totalPaidUsd,
            balanceUsd: totalBilledUsd - totalPaidUsd,
            budgetUsedPct: budgetUsd > 0 ? (totalHoursUsd / budgetUsd) * 100 : 0,
        };
    }

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('matters')
            .delete()
            .eq('id', id)
            .eq('organization_id', this.orgId());
        if (error) throw error;
    }

    private map(r: any): Matter {
        return {
            id: r.id,
            code: r.code,
            title: r.title,
            description: r.description,
            type: r.type,
            status: r.status,
            clientId: r.client_id,
            clientName: r.clients?.name,
            assignedLawyerId: r.assigned_lawyer_id,
            assignedLawyerName: r.lawyers?.name,
            expedienteId: r.expediente_id,
            contractId: r.contract_id,
            feeType: r.fee_type,
            currency: r.currency || 'USD',
            budget: Number(r.budget || r.budget_usd || 0),
            budgetUsd: Number(r.budget_usd || 0),
            retainer: Number(r.retainer || r.retainer_usd || 0),
            retainerUsd: Number(r.retainer_usd || 0),
            contingencyPct: Number(r.contingency_pct || 0),
            hourlyRate: Number(r.hourly_rate || r.hourly_rate_usd || 0),
            hourlyRateUsd: Number(r.hourly_rate_usd || 0),
            openedAt: r.opened_at,
            closedAt: r.closed_at,
            organizationId: r.organization_id,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        };
    }
}

// ────────────────────────────────────────────────────────
// TIME TRACKING
// ────────────────────────────────────────────────────────
class TimeEntryService {
    private orgId(): string {
        return authService.getCurrentUser()?.organizationId ?? '';
    }

    async getByMatter(matterId: string): Promise<TimeEntry[]> {
        const { data, error } = await supabase
            .from('time_entries')
            .select(`*, lawyers(name)`)
            .eq('matter_id', matterId)
            .eq('organization_id', this.orgId())
            .order('date', { ascending: false });
        if (error) throw error;
        return (data ?? []).map(this.map);
    }

    async getAll(): Promise<TimeEntry[]> {
        const { data, error } = await supabase
            .from('time_entries')
            .select(`*, lawyers(name), matters(title)`)
            .eq('organization_id', this.orgId())
            .order('date', { ascending: false });
        if (error) throw error;
        return (data ?? []).map(this.map);
    }

    async save(entry: Partial<TimeEntry>): Promise<TimeEntry> {
        const orgId = this.orgId();
        const user = authService.getCurrentUser();
        const hours = entry.hours ?? 0;

        // Calcular rate_usd:
        //   - Si la moneda es USD → rate_usd = rate (la tarifa ingresada)
        //   - Si es otra moneda → convertir usando exchangeRate
        //   - Solo usar entry.rateUsd como fallback si no hay rate definido
        const currency = entry.currency ?? 'USD';
        const inputRate = entry.rate ?? 0;
        const exRate = entry.exchangeRate || 1;
        const rateUsd = inputRate > 0
            ? (currency === 'USD' ? inputRate : inputRate * exRate)
            : (entry.rateUsd ?? 0);

        // Payload estrictamente alineado con las columnas reales de time_entries.
        // NO INCLUIR:
        //   - currency, rate, amount → no existen en el schema (PGRST204)
        //   - amount_usd → es columna GENERATED en PostgreSQL (error 428C9),
        //     se calcula automáticamente como hours * rate_usd
        const payload = {
            matter_id:       entry.matterId,
            lawyer_id:       entry.lawyerId ?? null,
            user_id:         user?.id,
            date:            entry.date ?? new Date().toISOString().split('T')[0],
            description:     entry.description,
            category:        entry.category ?? 'GENERAL',
            hours,
            rate_usd:        rateUsd,
            is_billable:     entry.isBillable ?? true,
            organization_id: orgId,
        };

        if (entry.id) {
            const { data, error } = await supabase
                .from('time_entries')
                .update(payload)
                .eq('id', entry.id)
                .eq('organization_id', orgId)
                .select(`*, lawyers(name)`).single();
            if (error) throw error;
            return this.map(data);
        } else {
            const { data, error } = await supabase
                .from('time_entries')
                .insert(payload)
                .select(`*, lawyers(name)`).single();
            if (error) throw error;
            return this.map(data);
        }
    }

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('time_entries')
            .delete()
            .eq('id', id)
            .eq('organization_id', this.orgId());
        if (error) throw error;
    }

    private map(r: any): TimeEntry {
        return {
            id: r.id,
            matterId: r.matter_id,
            matterTitle: r.matters?.title,
            lawyerId: r.lawyer_id,
            lawyerName: r.lawyers?.name,
            userId: r.user_id,
            date: r.date,
            description: r.description,
            category: r.category,
            hours: Number(r.hours),
            currency: r.currency || 'USD',
            rate: Number(r.rate || r.rate_usd || 0),
            rateUsd: Number(r.rate_usd || 0),
            amount: Number(r.amount || r.amount_usd || 0),
            amountUsd: Number(r.amount_usd || 0),
            isBillable: r.is_billable,
            isInvoiced: r.is_invoiced,
            invoiceId: r.invoice_id,
            organizationId: r.organization_id,
            createdAt: r.created_at,
        };
    }
}

// ────────────────────────────────────────────────────────
// GASTOS
// ────────────────────────────────────────────────────────
class ExpenseService {
    private orgId(): string {
        return authService.getCurrentUser()?.organizationId ?? '';
    }

    async getByMatter(matterId: string): Promise<MatterExpense[]> {
        const { data, error } = await supabase
            .from('matter_expenses')
            .select('*')
            .eq('matter_id', matterId)
            .eq('organization_id', this.orgId())
            .order('date', { ascending: false });
        if (error) throw error;
        return (data ?? []).map(this.map);
    }

    async save(expense: Partial<MatterExpense>): Promise<MatterExpense> {
        const orgId = this.orgId();
        const currency = expense.currency ?? 'USD';
        const amount = expense.amount ?? expense.amountUsd ?? 0;
        const rate = expense.exchangeRate ?? 1;
        // amountUsd = amount / rate (si Bs o EUR, convertir a USD)
        const amountUsd = currency === 'USD' ? amount : (amount / rate);
        const payload = {
            matter_id:     expense.matterId,
            date:          expense.date ?? new Date().toISOString().split('T')[0],
            description:   expense.description,
            category:      expense.category ?? 'OTHER',
            currency,
            amount,
            exchange_rate: rate,
            amount_usd:    amountUsd,
            receipt_url:   expense.receiptUrl,
            paid_by:       expense.paidBy ?? 'FIRM',
            is_reimbursed: expense.isReimbursed ?? false,
            organization_id: orgId,
        };

        if (expense.id) {
            const { data, error } = await supabase.from('matter_expenses').update(payload).eq('id', expense.id).select().single();
            if (error) throw error;
            return this.map(data);
        } else {
            const { data, error } = await supabase.from('matter_expenses').insert(payload).select().single();
            if (error) throw error;
            return this.map(data);
        }
    }

    private map(r: any): MatterExpense {
        return {
            id: r.id, matterId: r.matter_id, date: r.date,
            description: r.description, category: r.category,
            currency: r.currency ?? 'USD',
            amount: Number(r.amount ?? r.amount_usd ?? 0),
            amountUsd: Number(r.amount_usd ?? 0),
            exchangeRate: Number(r.exchange_rate ?? 1),
            receiptUrl: r.receipt_url,
            paidBy: r.paid_by, isReimbursed: r.is_reimbursed,
            organizationId: r.organization_id, createdBy: r.created_by, createdAt: r.created_at,
        };
    }
}

// ────────────────────────────────────────────────────────
// FACTURAS
// ────────────────────────────────────────────────────────
class InvoiceService {
    private orgId(): string {
        return authService.getCurrentUser()?.organizationId ?? '';
    }

    async getAll(): Promise<Invoice[]> {
        const { data, error } = await supabase
            .from('invoices')
            .select(`*, clients(name), matters(title)`)
            .eq('organization_id', this.orgId())
            .order('issued_at', { ascending: false });
        if (error) throw error;
        return (data ?? []).map(this.map);
    }

    async getByMatter(matterId: string): Promise<Invoice[]> {
        const { data, error } = await supabase
            .from('invoices')
            .select(`*, clients(name)`)
            .eq('matter_id', matterId)
            .eq('organization_id', this.orgId());
        if (error) throw error;
        return (data ?? []).map(this.map);
    }

    async save(invoice: Partial<Invoice>): Promise<Invoice> {
        const orgId = this.orgId();
        const user = authService.getCurrentUser();
        const currency = invoice.currency ?? 'USD';
        const rate = (invoice.exchangeRate || 1);
        
        const subtotal = invoice.subtotal ?? invoice.subtotalUsd ?? 0;
        const tax = subtotal * ((invoice.taxPct ?? 0) / 100);
        const islr = subtotal * ((invoice.islrPct ?? 0) / 100);
        const total = subtotal + tax - islr;
        
        const subtotalUsd = currency === 'USD' ? subtotal : (subtotal / rate);
        const taxUsd      = currency === 'USD' ? tax : (tax / rate);
        const islrUsd     = currency === 'USD' ? islr : (islr / rate);
        const totalUsd    = currency === 'USD' ? total : (total / rate);
        const paidUsd     = currency === 'USD' ? (invoice.paid ?? 0) : ((invoice.paid ?? 0) / rate);

        const payload = {
            number: invoice.number ?? `FACT-${Date.now()}`,
            matter_id: invoice.matterId,
            client_id: invoice.clientId,
            type: invoice.type ?? 'PROGRESS',
            status: invoice.status ?? 'DRAFT',
            
            currency,
            exchange_rate: rate,
            
            subtotal,
            tax_pct: invoice.taxPct ?? 0,
            tax,
            islr_pct: invoice.islrPct ?? 0,
            islr,
            total,
            paid: invoice.paid ?? 0,
            balance: total - (invoice.paid ?? 0),

            subtotal_usd: subtotalUsd,
            tax_usd: taxUsd,
            islr_usd: islrUsd,
            total_usd: totalUsd,
            paid_usd: paidUsd,
            balance_usd: totalUsd - paidUsd,

            issued_at: invoice.issuedAt ?? new Date().toISOString().split('T')[0],
            due_at: invoice.dueAt,
            notes: invoice.notes,
            organization_id: orgId,
            created_by: user?.id,
        };

        if (invoice.id) {
            const { data, error } = await supabase.from('invoices').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', invoice.id).select(`*, clients(name), matters(title)`).single();
            if (error) throw error;
            return this.map(data);
        } else {
            const { data, error } = await supabase.from('invoices').insert(payload).select(`*, clients(name), matters(title)`).single();
            if (error) throw error;
            return this.map(data);
        }
    }

    async generateNumber(orgId: string): Promise<string> {
        const year = new Date().getFullYear();
        const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('organization_id', orgId);
        return `FACT-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`;
    }

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('invoices')
            .delete()
            .eq('id', id)
            .eq('organization_id', this.orgId());
        if (error) throw error;
    }

    private map(r: any): Invoice {
        return {
            id: r.id, number: r.number, matterId: r.matter_id, matterTitle: r.matters?.title,
            clientId: r.client_id, clientName: r.clients?.name,
            type: r.type, status: r.status,
            currency: r.currency || 'USD',
            exchangeRate: Number(r.exchange_rate || 1),
            subtotalUsd: Number(r.subtotal_usd || 0),
            taxPct: Number(r.tax_pct || 0),
            taxUsd: Number(r.tax_usd || 0),
            islrPct: Number(r.islr_pct || 0),
            islrUsd: Number(r.islr_usd || 0),
            totalUsd: Number(r.total_usd || 0),
            paidUsd: Number(r.paid_usd || 0),
            balanceUsd: Number(r.balance_usd || 0),
            // Fallback nominal: Si las nuevas columnas son 0 o null, usamos USD
            subtotal: Number(r.subtotal) || Number(r.subtotal_usd) || 0,
            tax: Number(r.tax) || Number(r.tax_usd) || 0,
            islr: Number(r.islr) || Number(r.islr_usd) || 0,
            total: Number(r.total) || Number(r.total_usd) || 0,
            paid: Number(r.paid) || Number(r.paid_usd) || 0,
            balance: Number(r.balance) || Number(r.balance_usd) || 0,
            issuedAt: r.issued_at,
            dueAt: r.due_at,
            paidAt: r.paid_at,
            notes: r.notes,
            organizationId: r.organization_id,
            createdBy: r.created_by,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        };
    }
}

// ────────────────────────────────────────────────────────
// PAGOS
// ────────────────────────────────────────────────────────
class PaymentService {
    private orgId(): string {
        return authService.getCurrentUser()?.organizationId ?? '';
    }

    async save(payment: Partial<Payment>): Promise<Payment> {
        const orgId = this.orgId();
        const user = authService.getCurrentUser();
        
        // Calcular monto USD si viene en otra moneda
        let amountUsd = payment.amountUsd || 0;
        if (payment.currency && payment.currency !== 'USD' && payment.amount) {
            amountUsd = payment.amount / (payment.exchangeRate || 1);
        } else if (payment.currency === 'USD') {
            payment.amount = payment.amountUsd;
        }

        const { data, error } = await supabase
            .from('payments')
            .insert({
                invoice_id: payment.invoiceId,
                client_id: payment.clientId,
                currency: payment.currency || 'USD',
                amount: payment.amount || payment.amountUsd,
                exchange_rate: payment.exchangeRate || 1,
                amount_usd: amountUsd,
                method: payment.method ?? 'TRANSFER',
                reference: payment.reference,
                paid_at: payment.paidAt ?? new Date().toISOString().split('T')[0],
                notes: payment.notes,
                organization_id: orgId,
            })
            .select(`*, clients(name)`).single();
        if (error) throw error;

        // Actualizar saldo de la factura
        const inv = await supabase.from('invoices')
            .select('paid_usd, total_usd, paid, total, currency, exchange_rate')
            .eq('id', payment.invoiceId!)
            .maybeSingle();
            
        if (inv.data) {
            const newPaidUsd = Number(inv.data.paid_usd) + amountUsd;
            const newBalanceUsd = Number(inv.data.total_usd) - newPaidUsd;
            
            // Si la moneda del pago coincide con la de la factura, actualizamos también el monto nominal
            const isSameCurrency = inv.data.currency === (payment.currency || 'USD');
            const newPaidNominal = Number(inv.data.paid) + (isSameCurrency ? (payment.amount || 0) : (amountUsd * Number(inv.data.exchange_rate || 1)));
            const newBalanceNominal = Number(inv.data.total) - newPaidNominal;

            const newStatus = newBalanceUsd <= 0.01 ? 'PAID' : 'PARTIAL';
            await supabase.from('invoices').update({ 
                paid_usd: newPaidUsd, 
                balance_usd: Math.max(0, newBalanceUsd), 
                paid: newPaidNominal,
                balance: Math.max(0, newBalanceNominal),
                status: newStatus, 
                paid_at: (newBalanceUsd <= 0.01) ? data.paid_at : null, 
                updated_at: new Date().toISOString() 
            }).eq('id', payment.invoiceId!);
        }

        return this.map(data);
    }

    private map(data: any): Payment {
        return {
            id: data.id, 
            invoiceId: data.invoice_id, 
            clientId: data.client_id,
            clientName: data.clients?.name, 
            currency: data.currency || 'USD',
            amountUsd: Number(data.amount_usd || 0),
            amount: Number(data.amount) || Number(data.amount_usd) || 0,
            exchangeRate: Number(data.exchange_rate || 1),
            method: data.method, 
            reference: data.reference, 
            paidAt: data.paid_at,
            notes: data.notes, 
            organizationId: data.organization_id,
            createdBy: data.created_by, 
            createdAt: data.created_at,
        };
    }
}

// ────────────────────────────────────────────────────────
// TASAS DE CAMBIO
// ────────────────────────────────────────────────────────
class ExchangeRateService {
    private orgId(): string {
        return authService.getCurrentUser()?.organizationId ?? '';
    }

    /** Obtiene la tasa más reciente para un par de monedas */
    async getLatestRate(from: string, to: string): Promise<number> {
        const { data } = await supabase
            .from('exchange_rates')
            .select('rate')
            .eq('currency_from', from)
            .eq('currency_to', to)
            .eq('organization_id', this.orgId())
            .order('effective_date', { ascending: false })
            .limit(1)
            .maybeSingle();
        return data ? Number(data.rate) : 0;
    }

    /** Obtiene las tasas vigentes para todos los pares (incluye inversos calculados) */
    async getLatestAll(): Promise<Record<string, number>> {
        // Pares directos que existen en la BD
        const directPairs = [
            ['USD','VES'], ['EUR','VES'], ['EUR','USD'], ['USD','CNY'], ['CNY','VES'],
        ];
        const results: Record<string, number> = {};
        
        // Obtener todas las tasas directas
        await Promise.all(directPairs.map(async ([from, to]) => {
            const rate = await this.getLatestRate(from, to);
            if (rate > 0) results[`${from}_${to}`] = rate;
        }));
        
        // Calcular pares inversos automáticamente
        const computeInverse = (from: string, to: string) => {
            const key = `${from}_${to}`;
            const inverseKey = `${to}_${from}`;
            if (!results[key] && results[inverseKey] && results[inverseKey] > 0) {
                results[key] = 1 / results[inverseKey];
            }
        };
        
        // Inversos fundamentales
        computeInverse('VES', 'USD');
        computeInverse('USD', 'EUR');
        computeInverse('VES', 'EUR');
        computeInverse('CNY', 'USD');
        computeInverse('VES', 'CNY');
        
        // Pares cruzados vía USD
        if (!results['EUR_CNY'] && results['EUR_USD'] && results['USD_CNY']) {
            results['EUR_CNY'] = results['EUR_USD'] * results['USD_CNY'];
        }
        if (!results['CNY_EUR'] && results['EUR_CNY'] && results['EUR_CNY'] > 0) {
            results['CNY_EUR'] = 1 / results['EUR_CNY'];
        }
        
        return results;
    }

    /** Historial de tasas (más recientes primero) */
    async getAll(): Promise<ExchangeRate[]> {
        const { data, error } = await supabase
            .from('exchange_rates')
            .select('*')
            .eq('organization_id', this.orgId())
            .order('effective_date', { ascending: false })
            .limit(100);
        if (error) throw error;
        return (data ?? []).map(this.map);
    }

    async save(rate: Partial<ExchangeRate>): Promise<ExchangeRate> {
        const orgId = this.orgId();
        const user = authService.getCurrentUser();
        const payload = {
            currency_from:  rate.currencyFrom,
            currency_to:    rate.currencyTo,
            rate:           rate.rate,
            effective_date: rate.effectiveDate ?? new Date().toISOString().split('T')[0],
            source:         rate.source ?? 'MANUAL',
            notes:          rate.notes,
            organization_id: orgId,
            created_by:     user?.id,
        };
        if (rate.id) {
            const { data, error } = await supabase.from('exchange_rates').update(payload).eq('id', rate.id).select().single();
            if (error) throw error;
            return this.map(data);
        } else {
            // Upsert por fecha + par + org
            const { data, error } = await supabase.from('exchange_rates')
                .upsert(payload, { onConflict: 'currency_from,currency_to,effective_date,organization_id' })
                .select().single();
            if (error) throw error;
            return this.map(data);
        }
    }

    async delete(id: string): Promise<void> {
        const { error } = await supabase.from('exchange_rates').delete().eq('id', id).eq('organization_id', this.orgId());
        if (error) throw error;
    }

    private map(r: any): ExchangeRate {
        return {
            id: r.id,
            currencyFrom: r.currency_from,
            currencyTo: r.currency_to,
            rate: Number(r.rate),
            effectiveDate: r.effective_date,
            source: r.source ?? 'MANUAL',
            notes: r.notes,
            organizationId: r.organization_id,
            createdAt: r.created_at,
        };
    }
}

// ────────────────────────────────────────────────────────
// EXPORTS
// ────────────────────────────────────────────────────────
export const clientService       = new ClientService();
export const matterService       = new MatterService();
export const timeEntryService    = new TimeEntryService();
export const expenseService      = new ExpenseService();
export const invoiceService      = new InvoiceService();
export const paymentService      = new PaymentService();
export const exchangeRateService = new ExchangeRateService();
