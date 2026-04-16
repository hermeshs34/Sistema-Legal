import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Contract } from '../contracts/types.ts';
import type { AuditLog } from './audit.service.ts';
import { drawPdfBrandHeader, drawPdfBrandFooter } from './pdf-brand.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CertifiedPdfOptions {
    contract: Contract & Record<string, unknown>;
    auditLogs: AuditLog[];
    generatedBy: { name: string; role: string; email?: string };
    organizationName?: string;
    organizationRif?: string;
}

interface AuditTrailPdfOptions {
    contract: Contract & Record<string, unknown>;
    auditLogs: AuditLog[];
    generatedBy: { name: string; role: string; email?: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateReportNumber(code: string): string {
    const now = new Date();
    return `${code}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
}

function fmtDate(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-VE', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

const ACTION_LABELS: Record<string, string> = {
    create: 'Creación',
    update: 'Modificación',
    delete: 'Eliminación',
    login: 'Acceso',
    logout: 'Cierre de sesión',
    status_change: 'Estado',
    comment: 'Comentario',
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const pdfReportService = {

    /** 
     * B-01 · Generar Contrato Certificado (RPT-CONT-001)
     */
    async generateCertifiedContract(opts: CertifiedPdfOptions): Promise<void> {
        const { contract, auditLogs } = opts;
        const doc = new jsPDF('p', 'mm', 'a4');
        const reportNumber = generateReportNumber('RPT-CONT-001');
        const generatedAt = fmtDate(new Date().toISOString());

        // Header corporativo HermesAI
        const contentY = drawPdfBrandHeader(doc, {
            reportRef: reportNumber,
            subtitle: 'CERTIFICACION FORENSE DE INSTRUMENTO LEGAL',
            date: generatedAt
        });

        // Title
        doc.setFillColor(30, 41, 59); // slate-800
        doc.roundedRect(20, contentY, 170, 25, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text('CERTIFICADO DE INSTRUMENTO LEGAL', 25, contentY + 7);
        doc.setFontSize(14);
        const safeTitle = (contract.title || 'SIN TITULO').replace(/[\u0080-\uFFFF]/g, c => c.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
        doc.text(safeTitle.toUpperCase().substring(0, 60), 25, contentY + 17);

        // General Info Table
        const typeLabels: Record<string, string> = {
            SERVICE: 'Servicios', NDA: 'Confidencialidad', EMPLOYMENT: 'Laboral', OTHER: 'Varios'
        };

        autoTable(doc, {
            startY: contentY + 32,
            head: [['CAMPO', 'DETALLE REGISTRADO']],
            body: [
                ['ID CONTRATO', contract.id],
                ['TIPO', typeLabels[contract.type] || contract.type],
                ['ESTADO', contract.status],
                ['PARTES', contract.parties?.join(' e ') || '-'],
                ['VIGENCIA', `${contract.startDate || '-'} hasta ${contract.endDate || 'Indeterminado'}`],
                ['VALOR', `${contract.currency || 'USD'} ${contract.value || '0.00'}`],
                ['RESPONSABLE', contract.assignedLawyerName || 'SISTEMA'],
            ],
            theme: 'striped',
            headStyles: { fillColor: [15, 23, 42] },
            columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' } }
        });

        // Signature Status — finalY se lee DESPUÉS de llamar autoTable
        let currentY = ((doc as any).lastAutoTable?.finalY ?? 130) + 15;
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text('ESTADO DE FIRMA ELECTRONICA', 20, currentY);
        doc.line(20, currentY + 2, 190, currentY + 2);

        if (contract.signature_hash) {
            doc.setFillColor(240, 253, 244); // green-50
            doc.roundedRect(20, currentY + 6, 170, 40, 3, 3, 'F');
            doc.setTextColor(22, 163, 74); // green-600
            doc.setFontSize(9);
            doc.text('FIRMA VALIDA Y VERIFICADA (LDFE VENEZUELA)', 25, currentY + 15);
            
            doc.setTextColor(71, 85, 105); // slate-600
            doc.setFontSize(8);
            doc.text(`FIRMADO POR: ${contract.signed_by_name?.toUpperCase()}`, 25, currentY + 23);
            doc.text(`EMAIL: ${contract.signed_by_email}`, 25, currentY + 28);
            doc.text(`FECHA DE FIRMA: ${fmtDate(contract.signed_at as string)}`, 25, currentY + 33);
            
            doc.setFont('courier', 'normal');
            doc.setFontSize(7);
            doc.text(`HASH: ${contract.signature_hash}`, 25, currentY + 40);
            doc.setFont('helvetica', 'normal');
        } else {
            doc.setFillColor(254, 243, 199); // amber-100
            doc.roundedRect(20, currentY + 6, 170, 15, 3, 3, 'F');
            doc.setTextColor(180, 83, 9); // amber-700
            doc.setFontSize(9);
            doc.text('DOCUMENTO EN TRAMITE / SIN FIRMA REGISTRADA', 25, currentY + 15);
        }

        // Audit Summary
        currentY = currentY + 65;
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text('AUDITORIA DE CUSTODIA (TOP 5)', 20, currentY);

        autoTable(doc, {
            startY: currentY + 4,
            head: [['FECHA', 'ACCION', 'AUTOR', 'TRAZA']],
            body: auditLogs.slice(0, 5).map(l => [
                fmtDate(l.createdAt),
                ACTION_LABELS[l.action] || l.action,
                (l.details as any)?.author || l.userId || 'Sistema',
                doc.splitTextToSize(
                    (l.details as any)?.message || (l.details as any)?.action || 'OK',
                    50
                )
            ]),
            theme: 'grid',
            headStyles: { fillColor: [100, 116, 139] },
            bodyStyles: { fontSize: 7 }
        });

        // Sello corporativo HermesAI
        drawPdfBrandFooter(doc, { generatedBy: opts.generatedBy?.name });

        const safeFilename = (contract.title || 'contrato').replace(/[^a-zA-Z0-9_\-]/g, '_');
        doc.save(`${safeFilename}_CERTIFICADO.pdf`);
    },

    /** 
     * B-03 · Generar Bitácora de Auditoría (RPT-CONT-003)
     */
    async generateAuditTrail(opts: AuditTrailPdfOptions): Promise<void> {
        const { contract, auditLogs, generatedBy } = opts;
        const doc = new jsPDF('p', 'mm', 'a4');
        const reportNumber = generateReportNumber('RPT-CONT-003');

        // Header corporativo HermesAI
        const contentY = drawPdfBrandHeader(doc, {
            reportRef: reportNumber,
            subtitle: 'BITACORA DE AUDITORIA FORENSE'
        });

        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        const safeContractTitle = (contract.title || 'Sin titulo').replace(/[\u0080-\uFFFF]/g, c => c.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
        doc.text(`CONTRATO: ${safeContractTitle}`, 20, contentY + 4);


        autoTable(doc, {
            startY: contentY + 10,
            head: [['FECHA/HORA', 'ACCION', 'USUARIO', 'MENSAJE / EVIDENCIA']],
            body: auditLogs.length > 0 ? auditLogs.map(l => {
                const details = l.details as any;
                const msg = details?.message || details?.action || details?.text || '-';
                const bio = details?._biometric ? '[BIO-OK]' : '';
                const traza = `${msg}${bio ? ' ' + bio : ''}`.trim();
                return [
                    fmtDate(l.createdAt),
                    ACTION_LABELS[l.action] || l.action,
                    details?.author || l.userId || 'Sistema',
                    traza
                ];
            }) : [['Sin registros', '-', '-', '-']],
            theme: 'striped',
            headStyles: { fillColor: [30, 41, 59] },
            bodyStyles: { fontSize: 8 }
        });

        // Pie corporativo HermesAI
        drawPdfBrandFooter(doc, { generatedBy: `${generatedBy.name} (${generatedBy.role})` });

        doc.save(`BITACORA_${contract.id.substring(0, 8)}.pdf`);
    }
};
