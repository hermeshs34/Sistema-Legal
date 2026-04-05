import { aiService } from '../documents/ai.service.ts';

/**
 * Servicio encargado de gestionar la base de conocimientos legales públicos (Leyes, Gacetas, Providencias).
 * Estos datos se indexan con una organization_id especial (ej. ceros) para ser accesibles por todos.
 */
export const legalKnowledgeService = {
    // UUID especial para conocimiento público universal en la plataforma
    PUBLIC_ORG_ID: '00000000-0000-0000-0000-000000000000',

    /**
     * Semilla de leyes fundamentales venezolanas para el motor RAG.
     */
    async seedBaseKnowledge(): Promise<void> {
        const laws = [
            {
                title: 'Ley sobre Mensajes de Datos y Firmas Electrónicas (LDFE)',
                fragments: [
                    'Art. 1: La presente Ley tiene por objeto otorgar y reconocer eficacia y valor jurídico a la Firma Electrónica, al Mensaje de Datos y a toda información escrita en formato electrónico...',
                    'Art. 16: La Firma Electrónica que permita vincular al Firmante con el Mensaje de Datos y atribuir la autoría de éste, tendrá la misma validez y eficacia probatoria que la firma autógrafa.',
                    'Art. 2: Mensaje de Datos: Toda información inteligible en formato electrónico o similar que pueda ser almacenada o intercambiada por cualquier medio.',
                    'Art. 31: Terceros de Confianza. Las partes podrán convenir la intervención de un tercero para la conservación de los mensajes de datos y las firmas electrónicas.'
                ]
            },
            {
                title: 'LOPCYMAT (Salud y Seguridad Laboral)',
                fragments: [
                    'Art. 1: El objeto de esta Ley es establecer las instituciones, normas y lineamientos de las políticas, y los órganos y entes que permitan garantizar a los trabajadores condiciones de seguridad, salud y bienestar.',
                    'Art. 53: Los trabajadores y las trabajadoras tienen derecho a desarrollar sus labores en un ambiente de trabajo adecuado y propicio para el pleno ejercicio de sus facultades físicas y mentales.',
                    'Art. 56: Son deberes de los empleadores y empleadoras adoptar las medidas necesarias para garantizar a los trabajadores y trabajadoras condiciones de salud, higiene, seguridad y bienestar en el trabajo.',
                    'Art. 119: Infracciones graves. Se considera infracción grave el incumplimiento de las normas de seguridad y salud que pongan en peligro la integridad del trabajador.'
                ]
            },
            {
                title: 'Código Civil de Venezuela (Principios de Contratos)',
                fragments: [
                    'Art. 1.133: El contrato es una convención entre dos o más personas para constituir, reglar, transmitir, modificar o extinguir entre ellas un vínculo jurídico.',
                    'Art. 1.141: Las condiciones requeridas para la existencia del contrato son: 1. Consentimiento de las partes; 2. Objeto que pueda ser materia de contrato; y 3. Causa lícita.',
                    'Art. 1.159: Los contratos tienen fuerza de Ley entre las partes. No pueden revocarse sino por mutuo consentimiento o por las causas autorizadas por la Ley.'
                ]
            },
            {
                title: 'Jurisprudencia TSJ (Criterios Vinculantes)',
                fragments: [
                    'Sentencia N° 0001 (Sala de Casación Civil): Reconocimiento de la validez probatoria de los mensajes de datos y firmas electrónicas siempre que se cumpla con la integridad de la cadena de custodia.',
                    'Caso Pfizer (Sala de Casación Social): La responsabilidad objetiva del patrono en accidentes laborales (Art. 56 LOPCYMAT) exige la demostración del daño y la relación de causalidad, independientemente de la culpa.',
                    'Sentencia sobre Habeas Data (Sala Constitucional): El derecho a la autodeterminación informativa permite al ciudadano conocer qué datos personales constan en archivos públicos o privados y exigir su rectificación.'
                ]
            }
        ];

        console.log('🌱 Iniciando indexación de conocimiento legal base...');
        
        for (const law of laws) {
            for (const fragment of law.fragments) {
                // Indexamos directamente en la tabla de vectores
                // Nota: entityId es el nombre de la ley para referencia técnica
                await aiService.indexLegalKnowledge(
                    law.title.substring(0, 20), 
                    'document', 
                    fragment, 
                    this.PUBLIC_ORG_ID, 
                    { source: law.title, category: 'public_law' }
                );
            }
        }
        
        console.log('✅ Conocimiento base indexado correctamente.');
    }
};
