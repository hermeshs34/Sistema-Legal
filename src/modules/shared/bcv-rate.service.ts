import { supabase } from '../../core/supabase.ts';
import { parametersService } from '../parameters/parameters.service.ts';

// ══════════════════════════════════════════════════════════════
// currency.service.ts — Motor Multimoneda LegalDoc VE
// Soporta: USD, VES, EUR, COP
// Fuentes: BCV, BCE, API internacional
// ══════════════════════════════════════════════════════════════

export type SupportedCurrency = 'USD' | 'EUR' | 'VES' | 'COP';

export interface CurrencyRate {
    from: SupportedCurrency;
    to: SupportedCurrency;
    rate: number;
    effectiveDate: string;
    source: string;
}

export interface ReexpresionResult {
    originalAmount: number;
    originalCurrency: SupportedCurrency;
    originalDate: string;
    originalRate: number;
    currentRate: number;
    reexpressedAmount: number;
    difference: number;
    variationPct: number;
}

export const CURRENCY_CONFIG: Record<SupportedCurrency, { symbol: string; name: string; flag: string; decimals: number }> = {
    USD: { symbol: '$',   name: 'Dólar USA',          flag: '🇺🇸', decimals: 2 },
    EUR: { symbol: '€',   name: 'Euro',               flag: '🇪🇺', decimals: 2 },
    VES: { symbol: 'Bs.', name: 'Bolívar Soberano',   flag: '🇻🇪', decimals: 2 },
    COP: { symbol: '$',   name: 'Peso Colombiano',    flag: '🇨🇴', decimals: 0 },
};

class CurrencyService {
    private rateCache: Map<string, { rate: number; timestamp: number }> = new Map();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

    /**
     * Obtiene todas las tasas vigentes (última por par)
     */
    async getCurrentRates(): Promise<CurrencyRate[]> {
        const { data, error } = await supabase
            .from('current_rates')
            .select('*');
        
        if (error) {
            console.error('Error fetching current rates:', error);
            return [];
        }

        return (data || []).map(r => ({
            from: r.currency_from as SupportedCurrency,
            to: r.currency_to as SupportedCurrency,
            rate: Number(r.rate),
            effectiveDate: r.effective_date,
            source: r.source || ''
        }));
    }

    /**
     * Obtiene la tasa vigente para un par específico (con cache)
     */
    async getRate(from: SupportedCurrency, to: SupportedCurrency): Promise<number> {
        if (from === to) return 1;
        
        const cacheKey = `${from}/${to}`;
        const cached = this.rateCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.rate;
        }

        // Buscar tasa directa
        const { data: direct } = await supabase
            .from('current_rates')
            .select('rate')
            .eq('currency_from', from)
            .eq('currency_to', to)
            .maybeSingle();
        
        if (direct?.rate) {
            const rate = Number(direct.rate);
            this.rateCache.set(cacheKey, { rate, timestamp: Date.now() });
            return rate;
        }

        // Buscar tasa inversa
        const { data: inverse } = await supabase
            .from('current_rates')
            .select('rate')
            .eq('currency_from', to)
            .eq('currency_to', from)
            .maybeSingle();
        
        if (inverse?.rate && Number(inverse.rate) > 0) {
            const rate = 1 / Number(inverse.rate);
            this.rateCache.set(cacheKey, { rate, timestamp: Date.now() });
            return rate;
        }

        // Conversión triangular vía USD
        if (from !== 'USD' && to !== 'USD') {
            const fromUsd = await this.getRate(from, 'USD');
            const usdTo = await this.getRate('USD', to);
            if (fromUsd > 0 && usdTo > 0) {
                const rate = fromUsd * usdTo;
                this.rateCache.set(cacheKey, { rate, timestamp: Date.now() });
                return rate;
            }
        }

        return 0;
    }

    /**
     * Convierte un monto entre monedas usando la tasa vigente
     */
    async convert(amount: number, from: SupportedCurrency, to: SupportedCurrency): Promise<number> {
        if (from === to) return amount;
        const rate = await this.getRate(from, to);
        return rate > 0 ? Number((amount * rate).toFixed(CURRENCY_CONFIG[to].decimals)) : 0;
    }

    /**
     * Obtiene la tasa en una fecha específica (para reexpresión)
     */
    async getRateOnDate(from: SupportedCurrency, to: SupportedCurrency, date: string): Promise<number> {
        if (from === to) return 1;
        
        const { data } = await supabase
            .from('exchange_rates')
            .select('rate')
            .eq('currency_from', from)
            .eq('currency_to', to)
            .lte('effective_date', date)
            .order('effective_date', { ascending: false })
            .limit(1)
            .maybeSingle();
        
        if (data?.rate) return Number(data.rate);

        // Inversa
        const { data: inv } = await supabase
            .from('exchange_rates')
            .select('rate')
            .eq('currency_from', to)
            .eq('currency_to', from)
            .lte('effective_date', date)
            .order('effective_date', { ascending: false })
            .limit(1)
            .maybeSingle();
        
        if (inv?.rate && Number(inv.rate) > 0) return 1 / Number(inv.rate);
        
        return 0;
    }

    /**
     * Reexpresa un monto a la tasa actual (para facturas pendientes)
     */
    async reexpress(
        amount: number,
        currency: SupportedCurrency,
        targetCurrency: SupportedCurrency,
        originalDate: string
    ): Promise<ReexpresionResult> {
        const originalRate = await this.getRateOnDate(currency, targetCurrency, originalDate);
        const currentRate = await this.getRate(currency, targetCurrency);
        
        const originalAmount = amount;
        const reexpressedAmount = Number((amount * currentRate).toFixed(2));
        const originalConverted = Number((amount * originalRate).toFixed(2));
        const difference = Number((reexpressedAmount - originalConverted).toFixed(2));
        const variationPct = originalRate > 0 
            ? Number((((currentRate - originalRate) / originalRate) * 100).toFixed(2))
            : 0;

        return {
            originalAmount,
            originalCurrency: currency,
            originalDate,
            originalRate,
            currentRate,
            reexpressedAmount,
            difference,
            variationPct
        };
    }

    /**
     * Obtiene el historial de tasas para un par
     */
    async getRateHistory(from: SupportedCurrency, to: SupportedCurrency, days: number = 30): Promise<CurrencyRate[]> {
        const since = new Date();
        since.setDate(since.getDate() - days);
        
        const { data, error } = await supabase
            .from('exchange_rates')
            .select('*')
            .eq('currency_from', from)
            .eq('currency_to', to)
            .gte('effective_date', since.toISOString().split('T')[0])
            .order('effective_date', { ascending: true });

        if (error) {
            console.error('Error fetching rate history:', error);
            return [];
        }

        return (data || []).map(r => ({
            from: r.currency_from as SupportedCurrency,
            to: r.currency_to as SupportedCurrency,
            rate: Number(r.rate),
            effectiveDate: r.effective_date,
            source: r.source || ''
        }));
    }

    /**
     * Sincroniza todas las tasas (invoca Edge Function)
     */
    async syncAllRates(): Promise<{ success: boolean; rates?: CurrencyRate[]; error?: string }> {
        try {
            const { data, error } = await supabase.functions.invoke('update-exchange-rates');
            if (error) throw error;
            
            // Limpiar cache
            this.rateCache.clear();
            
            return { 
                success: data?.success || false, 
                rates: data?.rates?.map((r: any) => ({
                    from: r.from,
                    to: r.to,
                    rate: r.rate,
                    effectiveDate: data.date,
                    source: r.source
                })),
                error: data?.errors?.join(', ')
            };
        } catch (e: any) {
            console.error('Error syncing rates:', e);
            return { success: false, error: e.message };
        }
    }

    /**
     * Registra una tasa manual (admin)
     */
    async saveManualRate(from: SupportedCurrency, to: SupportedCurrency, rate: number, date?: string): Promise<void> {
        const effectiveDate = date || new Date().toISOString().split('T')[0];
        const { data: user } = await supabase.auth.getUser();

        // Verificar si ya existe para esa fecha
        const { data: existing } = await supabase
            .from('exchange_rates')
            .select('id')
            .eq('currency_from', from)
            .eq('currency_to', to)
            .eq('effective_date', effectiveDate)
            .maybeSingle();

        if (existing) {
            await supabase
                .from('exchange_rates')
                .update({ rate, source: 'Manual', notes: `Ingresado por ${user?.user?.email || 'admin'}` })
                .eq('id', existing.id);
        } else {
            await supabase
                .from('exchange_rates')
                .insert({
                    currency_from: from,
                    currency_to: to,
                    rate,
                    effective_date: effectiveDate,
                    source: 'Manual',
                    notes: `Ingresado por ${user?.user?.email || 'admin'}`,
                    organization_id: '351e2bde-0623-4903-95e0-94b39ab265d6',
                    created_by: user?.user?.id
                });
        }

        // Limpiar cache
        this.rateCache.clear();

        // Si es USD/VES, actualizar también system_parameters
        if (from === 'USD' && to === 'VES') {
            await parametersService.updateTasaBCV(rate);
        }
    }

    /**
     * Formatea un monto con el símbolo de la moneda
     */
    format(amount: number, currency: SupportedCurrency): string {
        const config = CURRENCY_CONFIG[currency];
        const formatted = amount.toLocaleString('es-VE', { 
            minimumFractionDigits: config.decimals, 
            maximumFractionDigits: config.decimals 
        });
        return `${config.symbol}${formatted}`;
    }
}

// ── Compatibilidad con bcvRateService existente ──────────────
export interface BcvRate {
    usd_rate: number;
    eur_rate: number;
    rate_date: string;
}

export const currencyService = new CurrencyService();

export const bcvRateService = {
    async getTodayRate() {
        const rates = await currencyService.getCurrentRates();
        const usdVes = rates.find(r => r.from === 'USD' && r.to === 'VES');
        const eurVes = rates.find(r => r.from === 'EUR' && r.to === 'VES');
        return {
            usd_rate: usdVes?.rate || 0,
            eur_rate: eurVes?.rate || 0,
            rate_date: usdVes?.effectiveDate || new Date().toISOString().split('T')[0]
        };
    },
    async convertUsdToVes(amount: number) {
        return currencyService.convert(amount, 'USD', 'VES');
    },
    async syncCurrentRate() {
        const result = await currencyService.syncAllRates();
        return this.getTodayRate();
    }
};
