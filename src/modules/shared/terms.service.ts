import { supabase } from '../../core/supabase.ts';
import { addDays, isSaturday, isSunday, format, parseISO, addBusinessDays, isAfter } from 'date-fns';

export type TermMode = 'working' | 'calendar';

export interface Holiday {
    id: string;
    holiday_date: string;
    name: string;
    jurisdiction: string;
}

/**
 * TermsService.ts
 * Motor de cómputo de términos procesales para LegalDoc VE.
 * Gestiona el cálculo de lapsos judiciales considerando feriados nacionales y tribunalicios.
 */
export const termsService = {
    /**
     * Obtiene los días feriados configurados para una jurisdicción.
     */
    async getHolidays(jurisdiction: string = 'VE'): Promise<Holiday[]> {
        const { data, error } = await supabase
            .from('judicial_holidays')
            .select('*')
            .eq('jurisdiction', jurisdiction)
            .eq('is_active', true);

        if (error) {
            console.error('Error fetching holidays:', error);
            return [];
        }
        return data || [];
    },

    /**
     * Determina si un día particular es feriado o no hábil.
     */
    async isNonWorkingDay(date: Date, jurisdiction: string = 'VE', holidays?: Holiday[]): Promise<boolean> {
        // 1. Fines de semana
        if (isSaturday(date) || isSunday(date)) return true;

        // 2. Feriados cargados
        const activeHolidays = holidays || await this.getHolidays(jurisdiction);
        const dateStr = format(date, 'yyyy-MM-dd');
        
        return activeHolidays.some(h => h.holiday_date === dateStr);
    },

    /**
     * Cómputo Principal: Calcula la fecha de vencimiento.
     * @param startDate Fecha de inicio (ej: fecha de notificación)
     * @param days Cantidad de días del lapso
     * @param jurisdiction Jurisdicción aplicable (VE, ES, etc)
     * @param mode 'working' (hábiles) o 'calendar' (continuos)
     */
    async calculateDeadline(
        startDate: string | Date, 
        days: number, 
        jurisdiction: string = 'VE', 
        mode: TermMode = 'working'
    ): Promise<Date> {
        let current = typeof startDate === 'string' ? parseISO(startDate) : startDate;
        const holidays = await this.getHolidays(jurisdiction);

        if (mode === 'calendar') {
            // Días continuos (calendario): simplemente se suman
            let result = addDays(current, days);
            
            // Si el último día es inhábil, el vencimiento suele prorrogarse al siguiente hábil
            // (Regla estándar en CPC VE y muchas jurisdicciones)
            while (await this.isNonWorkingDay(result, jurisdiction, holidays)) {
                result = addDays(result, 1);
            }
            return result;
        } else {
            // Días hábiles: solo cuentan los que no son feriados ni fines de semana
            let remaining = days;
            let result = current;
            
            while (remaining > 0) {
                result = addDays(result, 1);
                if (!(await this.isNonWorkingDay(result, jurisdiction, holidays))) {
                    remaining--;
                }
            }
            return result;
        }
    }
};
