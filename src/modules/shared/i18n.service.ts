import { supabase } from '../../core/supabase.ts';

export type Currency = 'USD' | 'VES' | 'EUR' | 'COP';

interface CurrencyRate {
    targetCurrency: string;
    rate: number;
    updatedAt: string;
}

export const i18nService = {
    // Current locale settings
    getLocale(): string {
        return navigator.language || 'es-VE';
    },

    // Currency Formatting
    formatCurrency(amount: number, currency: Currency = 'USD'): string {
        const locale = this.getLocale();
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2
        }).format(amount);
    },

    // Fetch rates from DB
    async getExchangeRates(): Promise<CurrencyRate[]> {
        const { data, error } = await supabase
            .from('currency_rates')
            .select('*');

        if (error) {
            console.error('Error fetching rates:', error);
            return [];
        }

        return data.map(r => ({
            targetCurrency: r.target_currency,
            rate: Number(r.rate),
            updatedAt: r.updated_at
        }));
    },

    // Convert amount
    async convert(amount: number, from: Currency, to: Currency): Promise<number> {
        if (from === to) return amount;

        const rates = await this.getExchangeRates();

        // Simplified conversion logic (assuming USD as base for now)
        if (from === 'USD') {
            const rateObj = rates.find(r => r.targetCurrency === to);
            return rateObj ? amount * rateObj.rate : amount;
        } else if (to === 'USD') {
            const rateObj = rates.find(r => r.targetCurrency === from);
            return rateObj ? amount / rateObj.rate : amount;
        } else {
            // Cross-conversion via USD
            const fromRate = rates.find(r => r.targetCurrency === from);
            const toRate = rates.find(r => r.targetCurrency === to);
            if (fromRate && toRate) {
                const amountInUsd = amount / fromRate.rate;
                return amountInUsd * toRate.rate;
            }
        }

        return amount;
    },

    // Date formatting based on region
    formatDate(date: string | Date): string {
        const d = typeof date === 'string' ? new Date(date) : date;
        return new Intl.DateTimeFormat(this.getLocale(), {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        }).format(d);
    },

    formatDateTime(date: string | Date): string {
        const d = typeof date === 'string' ? new Date(date) : date;
        return new Intl.DateTimeFormat(this.getLocale(), {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(d);
    }
};
