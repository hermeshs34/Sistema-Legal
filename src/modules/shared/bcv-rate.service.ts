import { parametersService } from '../parameters/parameters.service.ts';

export interface BcvRate {
    usd_rate: number;
    eur_rate: number;
    rate_date: string;
}

/**
 * BcvRateService.ts
 * Motor de tasas oficiales para LegalDoc VE.
 * Asegura que todos los cálculos de cuantías y multas sigan la tasa oficial del Sistema.
 */
export const bcvRateService = {
    /**
     * Obtiene la tasa oficial de hoy.
     * Si no existe en BD, intenta sincronizar (en un entorno real: scraping o API).
     */
    async getTodayRate(): Promise<BcvRate | null> {
        // Obtenemos de la base paramétrica directamente
        const rate = await parametersService.getTasaBCV();
        
        return {
            usd_rate: rate,
            eur_rate: rate * 1.09,
            rate_date: new Date().toISOString().split('T')[0]
        };
    },

    /**
     * Convierte un monto USD a VES basándose en la tasa oficial.
     */
    async convertUsdToVes(amount: number): Promise<number> {
        const rate = await this.getTodayRate();
        const usdRate = rate?.usd_rate || 36.50; // Fallback razonable
        return amount * usdRate;
    },

    /**
     * Sincronización Manual (Simulación):
     * En producción real, este método podría llamar a una Edge Function 
     * para extraer el dato hoy mismo desde www.bcv.org.ve.
     */
    async syncCurrentRate(): Promise<BcvRate> {
        // En lugar de simular, llamamos a la Edge Function si es posible 
        // o disparamos la recarga del parámetro
        try {
            const { supabase } = await import('../../core/supabase.ts');
            const { error } = await supabase.functions.invoke('update-exchange-rates');
            if (error) throw error;
        } catch (e) {
            console.warn('Sync Edge Function failed, return current state:', e);
        }

        const rate = await this.getTodayRate();
        return rate!;
    }
};
