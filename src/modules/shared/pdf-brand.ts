/**
 * HermesAI Tech — Branding corporativo para reportes PDF
 * Colores extraídos del logo SVG oficial:
 *   Primary:  #0077b5 → rgb(0, 119, 181)
 *   Accent:   #ff6b35 → rgb(255, 107, 53)
 *   Secondary: #5a7184 → rgb(90, 113, 132)
 */
import { jsPDF } from 'jspdf';

export const BRAND = {
    name:     'HermesAI Tech',
    tagline:  '40+ Years Financial Technology Leadership',
    product:  'LegalDoc VE — Plataforma de Compliance Legal',
    colors: {
        primary:   [0, 119, 181] as [number, number, number],   // #0077b5
        accent:    [255, 107, 53] as [number, number, number],  // #ff6b35
        secondary: [90, 113, 132] as [number, number, number],  // #5a7184
        dark:      [15, 23, 42] as [number, number, number],    // slate-900
        seal:      [148, 163, 184] as [number, number, number], // slate-400
    }
};

/**
 * Dibuja el encabezado corporativo HermesAI en un documento jsPDF.
 * Incluye logo textual, línea de acento, referencia y fecha.
 * @returns La coordenada Y después del header (para continuar el contenido).
 */
export function drawPdfBrandHeader(
    doc: jsPDF,
    opts: {
        reportRef: string;
        subtitle?: string;
        date?: string;
    }
): number {
    const pw = doc.internal.pageSize.getWidth();
    const date = opts.date || new Date().toLocaleString('es-VE', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    // ── Logo textual ────────────────────────────────────────────
    // "Hermes" en azul primario
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...BRAND.colors.primary);
    doc.text('Hermes', 20, 18);

    // "AI" en naranja acento
    const hermesWidth = doc.getTextWidth('Hermes');
    doc.setTextColor(...BRAND.colors.accent);
    doc.text('AI', 20 + hermesWidth + 1, 18);

    // "Tech" subtitulo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...BRAND.colors.secondary);
    doc.text('Tech', 20, 24);

    // Línea de acento naranja debajo del logo
    doc.setDrawColor(...BRAND.colors.accent);
    doc.setLineWidth(0.8);
    doc.line(20, 27, 90, 27);

    // ── Referencia y fecha (derecha) ────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.colors.dark);
    doc.text(`REF: ${opts.reportRef}`, pw - 20, 15, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.colors.secondary);
    doc.text(`FECHA: ${date}`, pw - 20, 20, { align: 'right' });

    // ── Subtítulo del reporte (si existe) ────────────────────────
    if (opts.subtitle) {
        doc.setFontSize(7);
        doc.setTextColor(...BRAND.colors.secondary);
        doc.text(opts.subtitle, pw - 20, 25, { align: 'right' });
    }

    // ── Línea separadora ────────────────────────────────────────
    doc.setDrawColor(...BRAND.colors.dark);
    doc.setLineWidth(0.3);
    doc.line(20, 30, pw - 20, 30);

    return 34; // Y de inicio del contenido
}

/**
 * Dibuja el pie de página corporativo con sello legal.
 */
export function drawPdfBrandFooter(
    doc: jsPDF,
    opts?: { generatedBy?: string; pageNum?: number }
): void {
    const pw = doc.internal.pageSize.getWidth();
    const y = 280;

    // Línea delgada
    doc.setDrawColor(...BRAND.colors.seal);
    doc.setLineWidth(0.2);
    doc.line(20, y, pw - 20, y);

    doc.setFontSize(6);
    doc.setTextColor(...BRAND.colors.seal);
    doc.text(`${BRAND.name} — ${BRAND.product}`, pw / 2, y + 4, { align: 'center' });
    doc.text('DOCUMENTO ELECTRONICO — TODA ALTERACION INVALIDA SU VALIDEZ LEGAL', pw / 2, y + 8, { align: 'center' });

    if (opts?.generatedBy) {
        doc.text(`Generado por: ${opts.generatedBy}`, 20, y + 8);
    }
    if (opts?.pageNum) {
        doc.text(`Pág. ${opts.pageNum}`, pw - 20, y + 8, { align: 'right' });
    }
}
