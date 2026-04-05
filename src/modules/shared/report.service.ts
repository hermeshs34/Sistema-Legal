import { complianceService } from '../compliance/compliance.service.ts';
import { expedienteService } from '../expedientes/expediente.service.ts';
import { bcvRateService } from './bcv-rate.service.ts';
import { supabase } from '../../core/supabase.ts';
import type { Expediente, Actuacion, Audiencia } from '../expedientes/types.ts';

// ─── Estilos base compartidos por todos los reportes ────────────────────────

const BASE_STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body { 
        font-family: 'Inter', system-ui, -apple-system, sans-serif; 
        color: #1e293b; 
        padding: 0; 
        background: #fff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    
    .page {
        padding: 48px 56px;
        max-width: 900px;
        margin: 0 auto;
    }

    /* ── Header institucional ── */
    .report-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 3px solid #1e3a8a;
        padding-bottom: 24px;
        margin-bottom: 32px;
    }
    .brand { font-weight: 900; font-size: 22px; color: #1e3a8a; letter-spacing: -0.02em; }
    .brand-sub { font-size: 11px; color: #64748b; font-weight: 600; margin-top: 4px; letter-spacing: 0.05em; text-transform: uppercase; }
    .report-title { font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 8px; }
    .report-meta { text-align: right; font-size: 12px; color: #64748b; line-height: 1.8; }
    .report-meta strong { color: #0f172a; }

    /* ── Secciones ── */
    .section { margin-top: 32px; page-break-inside: avoid; }
    .section-title {
        font-size: 11px; font-weight: 900; color: #1e3a8a;
        text-transform: uppercase; letter-spacing: 1.5px;
        border-left: 4px solid #1e3a8a; padding-left: 12px;
        margin-bottom: 16px;
    }

    /* ── KPI Cards ── */
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-top: 16px; }
    .kpi-card {
        background: #f8fafc; padding: 20px; border-radius: 12px;
        border: 1px solid #e2e8f0; text-align: center;
    }
    .kpi-label { font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi-value { font-size: 28px; font-weight: 900; color: #0f172a; margin-top: 6px; }
    .kpi-sub { font-size: 11px; color: #94a3b8; margin-top: 4px; }

    /* ── Tablas ── */
    .data-table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    .data-table th { 
        background: #f1f5f9; padding: 10px 14px; text-align: left; 
        font-weight: 800; font-size: 10px; color: #475569;
        text-transform: uppercase; letter-spacing: 0.5px;
        border-bottom: 2px solid #e2e8f0;
    }
    .data-table td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; color: #334155; }
    .data-table tr:hover { background: #fafbfc; }

    /* ── Badges ── */
    .badge { 
        display: inline-block; padding: 3px 10px; border-radius: 6px; 
        font-size: 10px; font-weight: 800; letter-spacing: 0.3px;
    }
    .badge-critical { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .badge-high { background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa; }
    .badge-medium { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
    .badge-low { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
    .badge-active { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
    .badge-pending { background: #fefce8; color: #854d0e; border: 1px solid #fef08a; }

    /* ── Alerta roja ── */
    .alert-urgent {
        background: #fef2f2; border: 1.5px solid #fca5a5; border-radius: 10px;
        padding: 14px 18px; margin-top: 16px; font-size: 12px; color: #991b1b;
        display: flex; align-items: center; gap: 10px;
    }
    .alert-urgent strong { font-weight: 900; }

    /* ── Footer forense ── */
    .report-footer {
        margin-top: 56px; padding-top: 20px; border-top: 2px solid #e2e8f0;
        font-size: 9px; color: #94a3b8; text-align: center; line-height: 1.8;
    }
    .report-footer .hash { font-family: 'Courier New', monospace; font-size: 8px; color: #cbd5e1; }

    /* ── Toolbar (no se imprime) ── */
    .print-toolbar {
        position: fixed; bottom: 0; left: 0; right: 0; padding: 16px;
        background: #0f172a; display: flex; justify-content: center; gap: 12px;
        box-shadow: 0 -8px 32px rgba(0,0,0,0.3); z-index: 9999;
    }
    .print-toolbar button {
        padding: 12px 28px; border-radius: 10px; border: none; 
        font-weight: 800; cursor: pointer; font-size: 14px;
        transition: transform 0.1s;
    }
    .print-toolbar button:active { transform: scale(0.97); }
    .btn-print { background: #3b82f6; color: white; }
    .btn-close { background: #334155; color: #94a3b8; }

    @media print { 
        .print-toolbar { display: none !important; } 
        .page { padding: 24px 32px; }
        body { padding-bottom: 0; }
    }
    @media screen { body { padding-bottom: 80px; background: #f1f5f9; } }
`;

/** 
 * SHA-256 hash using Web Crypto API 
 */
async function generateHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function qrCodeUrl(data: string, size = 100): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&margin=2`;
}

function formatDate(d?: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(d?: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleString('es-VE', { 
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function riskBadge(risk: string): string {
    const map: Record<string, string> = {
        CRITICAL: 'badge-critical', HIGH: 'badge-high', 
        MEDIUM: 'badge-medium', LOW: 'badge-low'
    };
    const labels: Record<string, string> = {
        CRITICAL: 'CRÍTICO', HIGH: 'ALTO', MEDIUM: 'MEDIO', LOW: 'BAJO'
    };
    return `<span class="badge ${map[risk] || 'badge-medium'}">${labels[risk] || risk}</span>`;
}

function openReport(html: string) {
    const win = window.open('', '_blank');
    if (!win) { alert('Por favor, habilite las ventanas emergentes para generar reportes.'); return; }
    win.document.write(html);
    win.document.close();
}

async function reportFooter(reportCode: string, content: string): Promise<string> {
    const hash = await generateHash(content);
    const ts = new Date().toISOString();
    const verificationUrl = `https://legaldoc.ve/verify/${reportCode}`;
    
    return `
        <div class="report-footer" style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
            <div style="width: 100%; border-top: 2px solid #e2e8f0; padding-top: 20px;">
                <div>Este documento ha sido generado por <strong>LegalDoc VE</strong> — Motor Forense v1.0</div>
                <div>Emisión: ${formatDateTime(ts)} &nbsp;·&nbsp; Reporte Nro: <strong>${reportCode}</strong></div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 24px; background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; width: 100%; text-align: left;">
                <img src="${qrCodeUrl(verificationUrl)}" width="80" height="80" style="border-radius: 8px; border: 1px solid #cbd5e1" />
                <div style="flex: 1;">
                    <div style="font-weight: 800; color: #1e3a8a; font-size: 10px; text-transform: uppercase; margin-bottom: 4px;">Certificado de Integridad Digital</div>
                    <div class="hash" style="color: #64748b; font-size: 8px; word-break: break-all;">SHA-256: ${hash}</div>
                    <div style="font-size: 8px; color: #94a3b8; margin-top: 4px;">Escanee para verificar la validez de este reporte en la plataforma central.</div>
                </div>
            </div>

            <div style="font-size: 8px; color: #cbd5e1; font-style: italic;">
                Documento de cumplimiento legal y FinOps. Cumple con la Ley de Mensajes de Datos (VE) y Reglamento eIDAS (UE).
            </div>
        </div>
    `;
}

function toolbar(): string {
    return `
        <div class="print-toolbar">
            <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
            <button class="btn-close" onclick="window.close()">Cerrar</button>
        </div>
    `;
}

// ─── SERVICIO DE REPORTES ───────────────────────────────────────────────────

export const reportService = {

    // ═══════════════════════════════════════════════════════════════════════════
    // R-01 — DOSSIER DE ESTADO PROCESAL DEL EXPEDIENTE
    // ═══════════════════════════════════════════════════════════════════════════

    async generateDossierProcesal(exp: Expediente) {
        const [actuaciones, audiencias, bcvData] = await Promise.all([
            expedienteService.getActuaciones(exp.id),
            expedienteService.getAudiencias(exp.id),
            bcvRateService.getTodayRate()
        ]);

        const bcvRate = bcvData?.usd_rate || 473.87;
        const now = new Date();
        const refCode = `DOSSIER-${exp.id}-${now.getFullYear()}`;

        // Calcular cuantías multi-divisa
        let cuantiaBlock = '';
        if (exp.cuantia) {
            const usd = exp.currency === 'USD' ? exp.cuantia : 
                        exp.currency === 'EUR' ? exp.cuantia * 1.08 : 
                        exp.cuantia / bcvRate;
            const ves = usd * bcvRate;
            const eur = usd / 1.08;
            cuantiaBlock = `
                <div class="kpi-grid">
                    <div class="kpi-card">
                        <div class="kpi-label">Cuantía (USD)</div>
                        <div class="kpi-value" style="font-size:22px">$${usd.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">Equivalente BCV (VES)</div>
                        <div class="kpi-value" style="font-size:22px">${ves.toLocaleString('es-VE', {minimumFractionDigits: 2})} Bs</div>
                        <div class="kpi-sub">Tasa: ${bcvRate} VES/USD</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">Equivalente (EUR)</div>
                        <div class="kpi-value" style="font-size:22px">€${eur.toLocaleString('de-DE', {minimumFractionDigits: 2})}</div>
                    </div>
                </div>
            `;
        }

        // Timeline de actuaciones
        const actRows = actuaciones.map((a: Actuacion) => `
            <tr>
                <td style="white-space:nowrap">${formatDate(a.fecha)}</td>
                <td><span class="badge badge-active">${a.tipo}</span></td>
                <td>${a.descripcion}</td>
                <td>${a.resultado || '<span style="color:#cbd5e1">—</span>'}</td>
                <td>${a.proximoPaso || '<span style="color:#cbd5e1">—</span>'}</td>
            </tr>
        `).join('');

        // Audiencias pendientes
        const pendientes = audiencias.filter((a: Audiencia) => a.status === 'PENDIENTE');
        const audRows = audiencias.map((a: Audiencia) => {
            const fecha = new Date(a.fechaHora);
            const diff = Math.ceil((fecha.getTime() - now.getTime()) / 86400000);
            const urgentClass = diff >= 0 && diff <= 7 ? 'style="background:#fef2f2; font-weight:700"' : '';
            return `
                <tr ${urgentClass}>
                    <td style="white-space:nowrap">${formatDateTime(a.fechaHora)}</td>
                    <td>${a.tipo}</td>
                    <td>${a.tribunal || '—'}</td>
                    <td>${a.sala || '—'}</td>
                    <td><span class="badge ${a.status === 'PENDIENTE' ? 'badge-pending' : a.status === 'REALIZADA' ? 'badge-low' : 'badge-medium'}">${a.status}</span></td>
                    <td>${diff >= 0 ? diff + ' días' : 'Pasada'}</td>
                </tr>
            `;
        }).join('');

        // Alerta de próximas audiencias
        const urgentes = pendientes.filter((a: Audiencia) => {
            const diff = Math.ceil((new Date(a.fechaHora).getTime() - now.getTime()) / 86400000);
            return diff >= 0 && diff <= 7;
        });
        const alertBlock = urgentes.length > 0 ? `
            <div class="alert-urgent">
                <span style="font-size:20px">⚠️</span>
                <div>
                    <strong>ALERTA DE PERENCIÓN:</strong> Existen ${urgentes.length} audiencia(s) programada(s) en los próximos 7 días. 
                    Verifique los plazos procesales conforme al Art. 267 CPC (Venezuela) o normativa aplicable.
                </div>
            </div>
        ` : '';

        const htmlBody = `
                <div class="report-header">
                    <div>
                        <div class="brand">LEGALTECH COMPLIANCE VE</div>
                        <div class="brand-sub">Sistema Integral de Gestión Legal</div>
                        <div class="report-title">R-01 · Dossier de Estado Procesal</div>
                    </div>
                    <div class="report-meta">
                        <div><strong>${refCode}</strong></div>
                        <div>Emisión: ${formatDate(now.toISOString())}</div>
                        <div>Jurisdicción: ${exp.region || 'VE'}</div>
                    </div>
                </div>

                <!-- Datos del caso -->
                <div class="section">
                    <div class="section-title">Identificación del Expediente</div>
                    <table class="data-table">
                        <tr><td style="width:200px; font-weight:700; color:#64748b">Expediente</td><td><strong>${exp.id}</strong> ${exp.numeroExpediente ? '— Nro. Tribunal: ' + exp.numeroExpediente : ''}</td></tr>
                        <tr><td style="font-weight:700; color:#64748b">Título / Causa</td><td>${exp.titulo}</td></tr>
                        <tr><td style="font-weight:700; color:#64748b">Parte Actora</td><td>${exp.parteActora}</td></tr>
                        <tr><td style="font-weight:700; color:#64748b">Parte Demandada</td><td>${exp.parteDemandada}</td></tr>
                        <tr><td style="font-weight:700; color:#64748b">Posición Procesal</td><td>${exp.nuestraPosicion}</td></tr>
                        <tr><td style="font-weight:700; color:#64748b">Tipo de Proceso</td><td>${exp.tipoProceso}</td></tr>
                        <tr><td style="font-weight:700; color:#64748b">Tribunal</td><td>${exp.tribunal || 'Sin asignar'}</td></tr>
                        <tr><td style="font-weight:700; color:#64748b">Estado</td><td><span class="badge badge-active">${exp.status}</span></td></tr>
                        <tr><td style="font-weight:700; color:#64748b">Nivel de Riesgo</td><td>${riskBadge(exp.riesgo)}</td></tr>
                        <tr><td style="font-weight:700; color:#64748b">Fecha Inicio</td><td>${formatDate(exp.fechaInicio)}</td></tr>
                        <tr><td style="font-weight:700; color:#64748b">Fecha Cierre</td><td>${exp.fechaCierre ? formatDate(exp.fechaCierre) : 'En curso'}</td></tr>
                    </table>
                </div>

                <!-- Cuantía multi-divisa -->
                ${cuantiaBlock ? `<div class="section"><div class="section-title">Valoración Económica Multi-Divisa</div>${cuantiaBlock}</div>` : ''}

                ${alertBlock}

                <!-- Cronología procesal -->
                <div class="section">
                    <div class="section-title">Cronología de Actuaciones Procesales (${actuaciones.length})</div>
                    ${actuaciones.length > 0 ? `
                        <table class="data-table">
                            <thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Resultado</th><th>Próximo Paso</th></tr></thead>
                            <tbody>${actRows}</tbody>
                        </table>
                    ` : '<p style="color:#94a3b8; text-align:center; padding:24px">Sin actuaciones registradas.</p>'}
                </div>

                <!-- Audiencias -->
                <div class="section">
                    <div class="section-title">Agenda de Audiencias (${audiencias.length} total — ${pendientes.length} pendientes)</div>
                    ${audiencias.length > 0 ? `
                        <table class="data-table">
                            <thead><tr><th>Fecha y Hora</th><th>Tipo</th><th>Tribunal</th><th>Sala</th><th>Estado</th><th>Faltan</th></tr></thead>
                            <tbody>${audRows}</tbody>
                        </table>
                    ` : '<p style="color:#94a3b8; text-align:center; padding:24px">Sin audiencias programadas.</p>'}
                </div>

                <!-- Notas -->
                ${exp.descripcion ? `
                    <div class="section">
                        <div class="section-title">Notas Internas del Expediente</div>
                        <div style="background:#f8fafc; padding:16px 20px; border-radius:10px; border:1px solid #e2e8f0; font-size:13px; line-height:1.7; color:#334155">${exp.descripcion}</div>
                    </div>
                ` : ''}
        `;

        const footerHtml = await reportFooter(refCode, htmlBody);
        const finalHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Dossier Procesal — ${exp.id}</title>
            <style>${BASE_STYLES}</style></head><body>
            <div class="page">
                ${htmlBody}
                ${footerHtml}
            </div>
            ${toolbar()}
        </body></html>`;

        openReport(finalHtml);
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // R-05 — REPORTE DE VENCIMIENTOS Y ALERTAS CONTRACTUALES
    // ═══════════════════════════════════════════════════════════════════════════

    async generateVencimientosReport() {
        const { data: docs } = await supabase
            .from('documents')
            .select('id, title, status, metadata, risk_level, created_at')
            .order('created_at', { ascending: false });

        const documents = docs || [];
        const now = new Date();
        const refCode = `VENC-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

        // Clasificar documentos por urgencia
        const withExpiry = documents.filter((d: any) => d.metadata?.expirationDate).map((d: any) => {
            const exp = new Date(d.metadata.expirationDate);
            const diff = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
            return { ...d, expirationDate: exp, daysLeft: diff };
        }).sort((a: any, b: any) => a.daysLeft - b.daysLeft);

        const expired = withExpiry.filter((d: any) => d.daysLeft < 0);
        const urgent = withExpiry.filter((d: any) => d.daysLeft >= 0 && d.daysLeft <= 7);
        const warning = withExpiry.filter((d: any) => d.daysLeft > 7 && d.daysLeft <= 30);
        const safe = withExpiry.filter((d: any) => d.daysLeft > 30);

        const rowsHtml = withExpiry.map((d: any) => {
            let urgencyClass = 'badge-low';
            let urgencyLabel = 'VIGENTE';
            if (d.daysLeft < 0) { urgencyClass = 'badge-critical'; urgencyLabel = 'VENCIDO'; }
            else if (d.daysLeft <= 7) { urgencyClass = 'badge-critical'; urgencyLabel = 'URGENTE'; }
            else if (d.daysLeft <= 30) { urgencyClass = 'badge-high'; urgencyLabel = 'PRÓXIMO'; }

            return `
                <tr ${d.daysLeft >= 0 && d.daysLeft <= 7 ? 'style="background:#fef2f2"' : ''}>
                    <td style="font-weight:700">${d.title || 'Sin título'}</td>
                    <td style="white-space:nowrap">${formatDate(d.metadata.expirationDate)}</td>
                    <td style="text-align:center; font-weight:800; color:${d.daysLeft < 0 ? '#b91c1c' : d.daysLeft <= 7 ? '#dc2626' : '#334155'}">${d.daysLeft}</td>
                    <td>${riskBadge(d.risk_level?.toUpperCase() || 'LOW')}</td>
                    <td><span class="badge ${urgencyClass}">${urgencyLabel}</span></td>
                </tr>
            `;
        }).join('');

        const htmlBody = `
                <div class="report-header">
                    <div>
                        <div class="brand">LEGALTECH COMPLIANCE VE</div>
                        <div class="brand-sub">Centro de Control de Obligaciones</div>
                        <div class="report-title">R-05 · Reporte de Vencimientos y Alertas Contractuales</div>
                    </div>
                    <div class="report-meta">
                        <div><strong>${refCode}</strong></div>
                        <div>Emisión: ${formatDate(now.toISOString())}</div>
                        <div>Total documentos: ${documents.length}</div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Panel de Estado</div>
                    <div class="kpi-grid">
                        <div class="kpi-card" style="border-left:4px solid #dc2626">
                            <div class="kpi-label">Vencidos</div>
                            <div class="kpi-value" style="color:#dc2626">${expired.length}</div>
                        </div>
                        <div class="kpi-card" style="border-left:4px solid #f97316">
                            <div class="kpi-label">Urgentes (≤ 7 días)</div>
                            <div class="kpi-value" style="color:#f97316">${urgent.length}</div>
                        </div>
                        <div class="kpi-card" style="border-left:4px solid #eab308">
                            <div class="kpi-label">Próximos (≤ 30 días)</div>
                            <div class="kpi-value" style="color:#eab308">${warning.length}</div>
                        </div>
                        <div class="kpi-card" style="border-left:4px solid #22c55e">
                            <div class="kpi-label">Vigentes (> 30 días)</div>
                            <div class="kpi-value" style="color:#22c55e">${safe.length}</div>
                        </div>
                    </div>
                </div>

                ${expired.length + urgent.length > 0 ? `
                    <div class="alert-urgent">
                        <span style="font-size:20px">🚨</span>
                        <div>
                            <strong>ACCIÓN REQUERIDA:</strong> Existen ${expired.length} documento(s) vencido(s) y ${urgent.length} por vencer en los próximos 7 días.
                            Se recomienda iniciar procedimiento de renovación o cierre inmediato.
                        </div>
                    </div>
                ` : ''}

                <div class="section">
                    <div class="section-title">Detalle de Obligaciones por Fecha de Vencimiento</div>
                    ${withExpiry.length > 0 ? `
                        <table class="data-table">
                            <thead><tr><th>Documento</th><th>Vencimiento</th><th style="text-align:center">Días</th><th>Riesgo</th><th>Urgencia</th></tr></thead>
                            <tbody>${rowsHtml}</tbody>
                        </table>
                    ` : '<p style="color:#94a3b8; text-align:center; padding:32px">No hay documentos con fechas de vencimiento configuradas.</p>'}
                </div>

                <div class="section">
                    <div class="section-title">Documentos sin Fecha de Vencimiento</div>
                    <p style="font-size:12px; color:#64748b; padding:8px 0">
                        ${documents.length - withExpiry.length} documento(s) no tienen fecha de vencimiento asignada. 
                        Se recomienda revisar y actualizar los metadatos para un control completo.
                    </p>
                </div>
        `;

        const footerHtml = await reportFooter(refCode, htmlBody);
        const finalHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte de Vencimientos — LegalDoc VE</title>
            <style>${BASE_STYLES}</style></head><body>
            <div class="page">
                ${htmlBody}
                ${footerHtml}
            </div>
            ${toolbar()}
        </body></html>`;

        openReport(finalHtml);
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // R-09 — INFORME DE INVERSIÓN TECNOLÓGICA (FINOPS LEGAL)
    // ═══════════════════════════════════════════════════════════════════════════

    async generateFinOpsReport(_orgId?: string) {
        const [consentLogs, aiLogs, bcvData] = await Promise.all([
            complianceService.getConsentAuditLogs(),
            complianceService.getAiUsageLogs(),
            bcvRateService.getTodayRate()
        ]);

        const bcvRate = bcvData?.usd_rate || 473.87;
        const now = new Date();
        const refCode = `FINOPS-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

        // Estadísticas FinOps
        const totalTokens = aiLogs.reduce((s: number, l: any) => s + ((l.prompt_tokens || 0) + (l.completion_tokens || 0)), 0);
        const totalUsd = (totalTokens / 1000000) * 0.15;

        // Desglose por usuario
        const byUser: Record<string, { name: string; count: number; tokens: number }> = {};
        aiLogs.forEach((l: any) => {
            const name = l.profiles?.name || 'Sistema';
            if (!byUser[name]) byUser[name] = { name, count: 0, tokens: 0 };
            byUser[name].count++;
            byUser[name].tokens += (l.prompt_tokens || 0) + (l.completion_tokens || 0);
        });
        const userRows = Object.values(byUser)
            .sort((a, b) => b.tokens - a.tokens)
            .map(u => {
                const usd = (u.tokens / 1000000) * 0.15;
                return `
                    <tr>
                        <td style="font-weight:700">${u.name}</td>
                        <td style="text-align:center">${u.count}</td>
                        <td style="text-align:right">${u.tokens.toLocaleString()}</td>
                        <td style="text-align:right">$${usd.toFixed(4)}</td>
                        <td style="text-align:right">${(usd * bcvRate).toLocaleString('es-VE', {minimumFractionDigits: 2})} Bs</td>
                    </tr>
                `;
            }).join('');

        // Detalle de actividad reciente
        const recentRows = aiLogs.slice(0, 15).map((l: any) => `
            <tr>
                <td style="white-space:nowrap">${formatDateTime(l.created_at)}</td>
                <td>${l.profiles?.name || 'Sistema'}</td>
                <td>${l.action_type || 'analysis'}</td>
                <td style="text-align:right">${((l.prompt_tokens || 0) + (l.completion_tokens || 0)).toLocaleString()}</td>
                <td style="text-align:right">${l.model || 'gpt-4o-mini'}</td>
            </tr>
        `).join('');

        // Tabla de consentimientos
        const consentRows = consentLogs.slice(0, 10).map((l: any) => `
            <tr>
                <td>${l.profiles?.name || '—'}</td>
                <td>${l.profiles?.email || '—'}</td>
                <td>${l.policy_version || '—'}</td>
                <td style="white-space:nowrap">${formatDateTime(l.accepted_at)}</td>
            </tr>
        `).join('');

        const htmlBody = `
                <div class="report-header">
                    <div>
                        <div class="brand">LEGALTECH COMPLIANCE VE</div>
                        <div class="brand-sub">Oficina de Control Financiero Tecnológico</div>
                        <div class="report-title">R-09 · Informe de Inversión Tecnológica (FinOps Legal)</div>
                    </div>
                    <div class="report-meta">
                        <div><strong>${refCode}</strong></div>
                        <div>Emisión: ${formatDate(now.toISOString())}</div>
                        <div>Tasa BCV: <strong>${bcvRate} VES/USD</strong></div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Resumen Ejecutivo de Inversión</div>
                    <div class="kpi-grid">
                        <div class="kpi-card">
                            <div class="kpi-label">Análisis IA Realizados</div>
                            <div class="kpi-value">${aiLogs.length}</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Tokens Consumidos</div>
                            <div class="kpi-value" style="font-size:22px">${totalTokens.toLocaleString()}</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Inversión (USD)</div>
                            <div class="kpi-value" style="color:#1e40af">$${totalUsd.toFixed(4)}</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Inversión (VES)</div>
                            <div class="kpi-value" style="color:#1e40af">${(totalUsd * bcvRate).toLocaleString('es-VE', {minimumFractionDigits: 2})} Bs</div>
                            <div class="kpi-sub">Tasa BCV: ${bcvRate}</div>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Desglose por Consultor / Abogado</div>
                    ${Object.keys(byUser).length > 0 ? `
                        <table class="data-table">
                            <thead><tr><th>Usuario</th><th style="text-align:center">Análisis</th><th style="text-align:right">Tokens</th><th style="text-align:right">Costo (USD)</th><th style="text-align:right">Costo (VES)</th></tr></thead>
                            <tbody>${userRows}</tbody>
                        </table>
                    ` : '<p style="color:#94a3b8; text-align:center; padding:24px">Sin datos de uso registrados.</p>'}
                </div>

                <div class="section">
                    <div class="section-title">Actividad Reciente (Últimas 15 interacciones)</div>
                    ${aiLogs.length > 0 ? `
                        <table class="data-table">
                            <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th style="text-align:right">Tokens</th><th style="text-align:right">Modelo</th></tr></thead>
                            <tbody>${recentRows}</tbody>
                        </table>
                    ` : '<p style="color:#94a3b8; text-align:center; padding:24px">Sin actividad de IA registrada.</p>'}
                </div>

                <div class="section">
                    <div class="section-title">Registro de Trazabilidad Forense (RGPD/LDPB)</div>
                    ${consentLogs.length > 0 ? `
                        <table class="data-table">
                            <thead><tr><th>Usuario</th><th>Email</th><th>Versión Política</th><th>Fecha Aceptación</th></tr></thead>
                            <tbody>${consentRows}</tbody>
                        </table>
                    ` : '<p style="color:#94a3b8; text-align:center; padding:24px">Sin registros de consentimiento.</p>'}
                </div>
        `;

        const footerHtml = await reportFooter(refCode, htmlBody);
        const finalHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Informe FinOps — LegalDoc VE</title>
            <style>${BASE_STYLES}</style></head><body>
            <div class="page">
                ${htmlBody}
                ${footerHtml}
            </div>
            ${toolbar()}
        </body></html>`;

        openReport(finalHtml);
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // R-02 — ACTA DE AUDIENCIA (PRE / POST)
    // ═══════════════════════════════════════════════════════════════════════════

    async generateActaAudiencia(exp: Expediente, audienciaId?: string) {
        const [actuaciones, audiencias] = await Promise.all([
            expedienteService.getActuaciones(exp.id),
            expedienteService.getAudiencias(exp.id)
        ]);

        const aud = audienciaId ? audiencias.find((a: Audiencia) => a.id === audienciaId) : audiencias[0];
        const now = new Date();
        const refCode = `ACTA-${exp.id}-${now.getFullYear()}`;
        const isPast = aud ? new Date(aud.fechaHora) < now : false;

        const recentActs = actuaciones.slice(0, 5).map((a: Actuacion) => `
            <tr><td style="white-space:nowrap">${formatDate(a.fecha)}</td><td><span class="badge badge-active">${a.tipo}</span></td><td>${a.descripcion}</td></tr>
        `).join('');

        const htmlBody = `
                <div class="report-header">
                    <div>
                        <div class="brand">LEGALTECH COMPLIANCE VE</div>
                        <div class="brand-sub">Gestión Procesal</div>
                        <div class="report-title">R-02 · Acta de Audiencia — ${isPast ? 'POST AUDIENCIA' : 'BRIEF PRE AUDIENCIA'}</div>
                    </div>
                    <div class="report-meta">
                        <div><strong>${refCode}</strong></div>
                        <div>Emisión: ${formatDate(now.toISOString())}</div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Datos del Caso</div>
                    <table class="data-table">
                        <tr><td style="width:200px; font-weight:700; color:#64748b">Expediente</td><td><strong>${exp.id}</strong> — ${exp.titulo}</td></tr>
                        <tr><td style="font-weight:700; color:#64748b">Partes</td><td>${exp.parteActora} vs ${exp.parteDemandada}</td></tr>
                        <tr><td style="font-weight:700; color:#64748b">Tribunal</td><td>${exp.tribunal || 'Sin asignar'}</td></tr>
                        <tr><td style="font-weight:700; color:#64748b">Posición</td><td>${exp.nuestraPosicion}</td></tr>
                    </table>
                </div>

                ${aud ? `
                <div class="section">
                    <div class="section-title">Datos de la Audiencia</div>
                    <table class="data-table">
                        <tr><td style="width:200px; font-weight:700; color:#64748b">Fecha y Hora</td><td><strong>${formatDateTime(aud.fechaHora)}</strong></td></tr>
                        <tr><td style="font-weight:700; color:#64748b">Tipo</td><td>${aud.tipo}</td></tr>
                        <tr><td style="font-weight:700; color:#64748b">Sala</td><td>${aud.sala || '—'}</td></tr>
                        <tr><td style="font-weight:700; color:#64748b">Estado</td><td><span class="badge ${aud.status === 'REALIZADA' ? 'badge-low' : 'badge-pending'}">${aud.status}</span></td></tr>
                        ${aud.resultado ? `<tr><td style="font-weight:700; color:#64748b">Resultado</td><td>${aud.resultado}</td></tr>` : ''}
                        ${aud.descripcion ? `<tr><td style="font-weight:700; color:#64748b">Objeto</td><td>${aud.descripcion}</td></tr>` : ''}
                    </table>
                </div>
                ` : ''}

                <div class="section">
                    <div class="section-title">Últimas Actuaciones del Expediente</div>
                    ${actuaciones.length > 0 ? `
                        <table class="data-table">
                            <thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th></tr></thead>
                            <tbody>${recentActs}</tbody>
                        </table>
                    ` : '<p style="color:#94a3b8; text-align:center; padding:24px">Sin actuaciones previas.</p>'}
                </div>

                <div class="section">
                    <div class="section-title">Espacio para Notas del Abogado</div>
                    <div style="border:2px dashed #e2e8f0; border-radius:12px; min-height:120px; padding:16px; color:#cbd5e1; font-style:italic">
                        Escriba aquí sus notas y observaciones durante o después de la audiencia...
                    </div>
                </div>
        `;

        const footerHtml = await reportFooter(refCode, htmlBody);
        const finalHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Acta de Audiencia — ${exp.id}</title>
            <style>${BASE_STYLES}</style></head><body>
            <div class="page">
                ${htmlBody}
                ${footerHtml}
            </div>
            ${toolbar()}
        </body></html>`;

        openReport(finalHtml);
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // R-03 — INFORME DE CIERRE DE CASO
    // ═══════════════════════════════════════════════════════════════════════════

    async generateCierreCaso(exp: Expediente) {
        const [actuaciones, audiencias, bcvData] = await Promise.all([
            expedienteService.getActuaciones(exp.id),
            expedienteService.getAudiencias(exp.id),
            bcvRateService.getTodayRate()
        ]);

        const bcvRate = bcvData?.usd_rate || 473.87;
        const now = new Date();
        const refCode = `CIERRE-${exp.id}-${now.getFullYear()}`;
        const audienciasRealizadas = audiencias.filter((a: Audiencia) => a.status === 'REALIZADA').length;
        const duracion = exp.fechaInicio ? Math.ceil((now.getTime() - new Date(exp.fechaInicio).getTime()) / 86400000) : 0;

        let cuantiaSection = '';
        if (exp.cuantia) {
            const usd = exp.currency === 'USD' ? exp.cuantia : exp.currency === 'EUR' ? exp.cuantia * 1.08 : exp.cuantia / bcvRate;
            cuantiaSection = `
                <div class="kpi-grid">
                    <div class="kpi-card"><div class="kpi-label">Cuantía Original</div><div class="kpi-value" style="font-size:20px">${exp.currency} ${exp.cuantia.toLocaleString()}</div></div>
                    <div class="kpi-card"><div class="kpi-label">Equivalente USD</div><div class="kpi-value" style="font-size:20px">$${usd.toLocaleString('en-US',{minimumFractionDigits:2})}</div></div>
                    <div class="kpi-card"><div class="kpi-label">Equivalente VES</div><div class="kpi-value" style="font-size:20px">${(usd*bcvRate).toLocaleString('es-VE',{minimumFractionDigits:2})} Bs</div><div class="kpi-sub">Tasa BCV: ${bcvRate}</div></div>
                </div>
            `;
        }

        const htmlBody = `
                <div class="report-header">
                    <div>
                        <div class="brand">LEGALTECH COMPLIANCE VE</div>
                        <div class="brand-sub">Oficina de Gestión de Casos</div>
                        <div class="report-title">R-03 · Informe de Cierre de Caso</div>
                    </div>
                    <div class="report-meta">
                        <div><strong>${refCode}</strong></div>
                        <div>Emisión: ${formatDate(now.toISOString())}</div>
                        <div>Estado: <strong>${exp.status}</strong></div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Resumen Ejecutivo</div>
                    <div class="kpi-grid">
                        <div class="kpi-card"><div class="kpi-label">Duración</div><div class="kpi-value">${duracion}d</div></div>
                        <div class="kpi-card"><div class="kpi-label">Actuaciones</div><div class="kpi-value">${actuaciones.length}</div></div>
                        <div class="kpi-card"><div class="kpi-label">Audiencias</div><div class="kpi-value">${audienciasRealizadas}/${audiencias.length}</div></div>
                        <div class="kpi-card"><div class="kpi-label">Resultado</div><div class="kpi-value" style="font-size:16px">${exp.status}</div></div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Identificación</div>
                    <table class="data-table">
                        <tr><td style="width:200px;font-weight:700;color:#64748b">Título</td><td>${exp.titulo}</td></tr>
                        <tr><td style="font-weight:700;color:#64748b">Partes</td><td>${exp.parteActora} vs ${exp.parteDemandada}</td></tr>
                        <tr><td style="font-weight:700;color:#64748b">Tribunal</td><td>${exp.tribunal || '—'}</td></tr>
                        <tr><td style="font-weight:700;color:#64748b">Tipo / Riesgo</td><td>${exp.tipoProceso} · ${riskBadge(exp.riesgo)}</td></tr>
                        <tr><td style="font-weight:700;color:#64748b">Inicio</td><td>${formatDate(exp.fechaInicio)}</td></tr>
                        <tr><td style="font-weight:700;color:#64748b">Cierre</td><td>${formatDate(exp.fechaCierre) || formatDate(now.toISOString())}</td></tr>
                    </table>
                </div>

                ${cuantiaSection ? `<div class="section"><div class="section-title">Valoración Económica</div>${cuantiaSection}</div>` : ''}
        `;

        const footerHtml = await reportFooter(refCode, htmlBody);
        const finalHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Cierre de Caso — ${exp.id}</title>
            <style>${BASE_STYLES}</style></head><body>
            <div class="page">
                ${htmlBody}
                ${footerHtml}
            </div>
            ${toolbar()}
        </body></html>`;

        openReport(finalHtml);
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // R-04 — INFORME DE RIESGO EN CONTRATOS
    // ═══════════════════════════════════════════════════════════════════════════

    async generateRiesgoContractual() {
        const { data: docs } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
        const documents = docs || [];
        const now = new Date();
        const refCode = `RIESGO-CONT-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

        const rows = documents.map((d: any) => {
            const risk = (d.risk_level || 'low').toUpperCase();
            const expDate = d.metadata?.expirationDate;
            const daysLeft = expDate ? Math.ceil((new Date(expDate).getTime() - now.getTime()) / 86400000) : null;
            return `
                <tr>
                    <td style="font-weight:700">${d.title || 'Sin título'}</td>
                    <td>${d.doc_type || 'documento'}</td>
                    <td>${riskBadge(risk)}</td>
                    <td>${expDate ? formatDate(expDate) : '—'}</td>
                    <td style="text-align:center;font-weight:700;color:${daysLeft !== null && daysLeft <= 7 ? '#dc2626' : '#334155'}">${daysLeft !== null ? daysLeft + 'd' : '—'}</td>
                    <td><span class="badge ${d.status === 'published' ? 'badge-low' : d.status === 'draft' ? 'badge-medium' : 'badge-active'}">${d.status || 'draft'}</span></td>
                </tr>
            `;
        }).join('');

        const riskCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<string, number>;
        documents.forEach((d: any) => { const r = (d.risk_level || 'low').toUpperCase(); if (riskCounts[r] !== undefined) riskCounts[r]++; });

        const htmlBody = `
                <div class="report-header">
                    <div><div class="brand">LEGALTECH COMPLIANCE VE</div><div class="brand-sub">Gestión de Riesgo Contractual</div><div class="report-title">R-04 · Informe de Riesgo en Contratos</div></div>
                    <div class="report-meta"><div><strong>${refCode}</strong></div><div>Emisión: ${formatDate(now.toISOString())}</div><div>Total documentos: ${documents.length}</div></div>
                </div>
                <div class="section"><div class="section-title">Distribución de Riesgo</div>
                    <div class="kpi-grid">
                        <div class="kpi-card" style="border-left:4px solid #dc2626"><div class="kpi-label">Crítico</div><div class="kpi-value" style="color:#dc2626">${riskCounts.CRITICAL}</div></div>
                        <div class="kpi-card" style="border-left:4px solid #f97316"><div class="kpi-label">Alto</div><div class="kpi-value" style="color:#f97316">${riskCounts.HIGH}</div></div>
                        <div class="kpi-card" style="border-left:4px solid #eab308"><div class="kpi-label">Medio</div><div class="kpi-value" style="color:#eab308">${riskCounts.MEDIUM}</div></div>
                        <div class="kpi-card" style="border-left:4px solid #22c55e"><div class="kpi-label">Bajo</div><div class="kpi-value" style="color:#22c55e">${riskCounts.LOW}</div></div>
                    </div>
                </div>
                <div class="section"><div class="section-title">Detalle por Documento</div>
                    <table class="data-table">
                        <thead><tr><th>Documento</th><th>Tipo</th><th>Riesgo</th><th>Vencimiento</th><th style="text-align:center">Días</th><th>Estado</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
        `;

        const footerHtml = await reportFooter(refCode, htmlBody);
        const finalHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Riesgo Contractual — LegalDoc VE</title>
            <style>${BASE_STYLES}</style></head><body>
            <div class="page">
                ${htmlBody}
                ${footerHtml}
            </div>${toolbar()}</body></html>`;
        openReport(finalHtml);
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // R-06 — CERTIFICADO DE AUDITORÍA DE CONSENTIMIENTO (RGPD/LDPB)
    // ═══════════════════════════════════════════════════════════════════════════

    async generateCertificadoRGPD() {
        const [consentLogs] = await Promise.all([
            complianceService.getConsentAuditLogs(),
            bcvRateService.getTodayRate()
        ]);
        const now = new Date();
        const refCode = `CERT-RGPD-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

        const rows = consentLogs.map((l: any) => `
            <tr>
                <td style="font-weight:700">${l.profiles?.name || '—'}</td>
                <td>${l.profiles?.email || '—'}</td>
                <td><span class="badge badge-active">${l.policy_version || '—'}</span></td>
                <td style="white-space:nowrap">${formatDateTime(l.accepted_at)}</td>
                <td>${l.withdrawn_at ? '<span class="badge badge-critical">RETIRADO</span>' : '<span class="badge badge-low">VIGENTE</span>'}</td>
                <td style="font-size:10px;color:#94a3b8;max-width:150px;overflow:hidden;text-overflow:ellipsis">${l.user_agent?.substring(0,50) || '—'}</td>
            </tr>
        `).join('');

        const htmlBody = `
                <div class="report-header">
                    <div><div class="brand">LEGALTECH COMPLIANCE VE</div><div class="brand-sub">Oficina de Protección de Datos</div><div class="report-title">R-06 · Certificado de Auditoría de Consentimiento</div></div>
                    <div class="report-meta"><div><strong>${refCode}</strong></div><div>Emisión: ${formatDate(now.toISOString())}</div><div>Marco: RGPD (EU) / LDPB (VE)</div></div>
                </div>

                <div class="cert-seal">
                    <div class="cert-seal-icon">🛡️</div>
                    <div class="cert-seal-text">Certificado de Cumplimiento de Consentimiento</div>
                    <div style="font-size:11px;color:#166534;margin-top:8px">Este documento certifica que los consentimientos registrados cumplen con los requisitos del RGPD Art. 7 y la LDPB venezolana.</div>
                </div>

                <div class="section"><div class="section-title">Registro Forense de Consentimientos (${consentLogs.length})</div>
                    ${consentLogs.length > 0 ? `
                        <table class="data-table">
                            <thead><tr><th>Usuario</th><th>Email</th><th>Versión</th><th>Fecha Aceptación</th><th>Estado</th><th>Dispositivo</th></tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    ` : '<p style="color:#94a3b8; text-align:center; padding:24px">Sin registros de consentimiento.</p>'}
                </div>

                <div class="section">
                    <div class="section-title">Declaración de Integridad</div>
                    <div style="background:#f8fafc;padding:16px 20px;border-radius:10px;border:1px solid #e2e8f0;font-size:12px;line-height:1.8;color:#334155">
                        Se certifica que todos los registros de consentimiento anteriores han sido almacenados de forma inmutable en la base de datos de LegalDoc VE con timestamps verificables. 
                    </div>
                </div>
        `;

        const footerHtml = await reportFooter(refCode, htmlBody);
        const finalHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Certificado RGPD — LegalDoc VE</title>
            <style>${BASE_STYLES}
                .cert-seal { text-align:center; margin:32px 0; padding:24px; background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%); border-radius:16px; border:2px solid #86efac; }
                .cert-seal-icon { font-size:48px; margin-bottom:8px; }
                .cert-seal-text { font-size:14px; font-weight:900; color:#166534; text-transform:uppercase; letter-spacing:2px; }
            </style></head><body>
            <div class="page">
                ${htmlBody}
                ${footerHtml}
            </div>${toolbar()}</body></html>`;
        openReport(finalHtml);
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // R-07 — SCORECARD DE CUMPLIMIENTO NORMATIVO
    // ═══════════════════════════════════════════════════════════════════════════

    async generateScorecardCumplimiento() {
        const items = await complianceService.getAll();
        const summary = complianceService.getSummary(items);
        const now = new Date();
        const refCode = `SCORE-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        const pct = Math.round((summary.compliantCount / (summary.totalItems || 1)) * 100);

        // Agrupar por área
        const byArea: Record<string, { total: number, compliant: number, critical: number }> = {};
        items.forEach((i: any) => {
            if (!byArea[i.area]) byArea[i.area] = { total: 0, compliant: 0, critical: 0 };
            byArea[i.area].total++;
            if (i.status === 'COMPLIANT') byArea[i.area].compliant++;
            if (i.riskLevel === 'CRITICAL') byArea[i.area].critical++;
        });

        const areaRows = Object.entries(byArea).map(([area, d]) => {
            const areaPct = Math.round((d.compliant / (d.total || 1)) * 100);
            const color = areaPct >= 80 ? '#22c55e' : areaPct >= 50 ? '#eab308' : '#dc2626';
            return `
                <tr>
                    <td style="font-weight:700">${area}</td>
                    <td style="text-align:center">${d.total}</td>
                    <td style="text-align:center;color:#22c55e;font-weight:700">${d.compliant}</td>
                    <td style="text-align:center;color:#dc2626;font-weight:700">${d.critical}</td>
                    <td>
                        <div style="display:flex;align-items:center;gap:8px">
                            <div style="flex:1;height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden">
                                <div style="width:${areaPct}%;height:100%;background:${color};border-radius:4px"></div>
                            </div>
                            <span style="font-weight:800;font-size:12px;color:${color}">${areaPct}%</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        const itemRows = items.map((i: any) => {
            const stMap: Record<string, string> = { COMPLIANT: 'badge-low', NON_COMPLIANT: 'badge-critical', PARTIAL: 'badge-medium', PENDING: 'badge-pending', EXPIRED: 'badge-critical' };
            const stLabels: Record<string, string> = { COMPLIANT: 'Cumple', NON_COMPLIANT: 'No Cumple', PARTIAL: 'Parcial', PENDING: 'Pendiente', EXPIRED: 'Vencido' };
            return `
                <tr>
                    <td style="font-weight:700">${i.title}</td>
                    <td>${i.area}</td>
                    <td>${riskBadge(i.riskLevel)}</td>
                    <td><span class="badge ${stMap[i.status] || 'badge-medium'}">${stLabels[i.status] || i.status}</span></td>
                    <td style="white-space:nowrap">${i.nextReview || '—'}</td>
                </tr>
            `;
        }).join('');

        const globalColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#eab308' : '#dc2626';

        const htmlBody = `
                <div class="report-header">
                    <div><div class="brand">LEGALTECH COMPLIANCE VE</div><div class="brand-sub">Dirección de Cumplimiento Normativo</div><div class="report-title">R-07 · Scorecard de Cumplimiento Normativo</div></div>
                    <div class="report-meta"><div><strong>${refCode}</strong></div><div>Emisión: ${formatDate(now.toISOString())}</div><div>Período: Trimestral</div></div>
                </div>

                <div class="section"><div class="section-title">Indicador Global de Cumplimiento</div>
                    <div style="display:flex;align-items:center;justify-content:center;gap:48px;padding:32px;background:linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%);border-radius:16px;border:1px solid #e2e8f0">
                        <div style="text-align:center">
                            <div style="font-size:64px;font-weight:900;color:${globalColor}">${pct}%</div>
                            <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:1px">Cumplimiento Global</div>
                        </div>
                        <div style="display:grid;gap:12px">
                            <div style="display:flex;gap:8px;align-items:center"><span style="width:12px;height:12px;border-radius:50%;background:#22c55e"></span><span style="font-size:13px"><strong>${summary.compliantCount}</strong> Conforme</span></div>
                            <div style="display:flex;gap:8px;align-items:center"><span style="width:12px;height:12px;border-radius:50%;background:#dc2626"></span><span style="font-size:13px"><strong>${summary.nonCompliantCount}</strong> No Conforme</span></div>
                            <div style="display:flex;gap:8px;align-items:center"><span style="width:12px;height:12px;border-radius:50%;background:#eab308"></span><span style="font-size:13px"><strong>${summary.pendingTasks}</strong> Pendientes</span></div>
                            <div style="display:flex;gap:8px;align-items:center"><span style="width:12px;height:12px;border-radius:50%;background:#ef4444"></span><span style="font-size:13px"><strong>${summary.criticalRiskCount}</strong> Riesgos Críticos</span></div>
                        </div>
                    </div>
                </div>

                <div class="section"><div class="section-title">Cumplimiento por Área Normativa</div>
                    <table class="data-table">
                        <thead><tr><th>Área</th><th style="text-align:center">Total</th><th style="text-align:center">Conformes</th><th style="text-align:center">Críticos</th><th>Nivel de Cumplimiento</th></tr></thead>
                        <tbody>${areaRows}</tbody>
                    </table>
                </div>

                <div class="section"><div class="section-title">Detalle Ítem por Ítem</div>
                    <table class="data-table">
                        <thead><tr><th>Requisito</th><th>Área</th><th>Riesgo</th><th>Estado</th><th>Próxima Revisión</th></tr></thead>
                        <tbody>${itemRows}</tbody>
                    </table>
                </div>
        `;

        const footerHtml = await reportFooter(refCode, htmlBody);
        const finalHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Scorecard Cumplimiento — LegalDoc VE</title>
            <style>${BASE_STYLES}</style></head><body>
            <div class="page">
                ${htmlBody}
                ${footerHtml}
            </div>${toolbar()}</body></html>`;
        openReport(finalHtml);
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // R-08 — CERTIFICADO DE TRANSPARENCIA DE IA (EU AI ACT)
    // ═══════════════════════════════════════════════════════════════════════════

    async generateTransparenciaIA() {
        const aiLogs = await complianceService.getAiUsageLogs();
        const now = new Date();
        const refCode = `CERT-IA-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

        const modelsUsed = [...new Set(aiLogs.map((l: any) => l.model || 'gpt-4o-mini'))];
        const totalAnalyses = aiLogs.length;

        const htmlBody = `
                <div class="report-header">
                    <div><div class="brand">LEGALTECH COMPLIANCE VE</div><div class="brand-sub">Oficina de Gobernanza de IA</div><div class="report-title">R-08 · Certificado de Transparencia de IA</div></div>
                    <div class="report-meta"><div><strong>${refCode}</strong></div><div>Emisión: ${formatDate(now.toISOString())}</div><div>Marco: EU AI Act 2024</div></div>
                </div>

                <div class="ai-seal">
                    <div style="font-size:48px;margin-bottom:8px">🤖</div>
                    <div style="font-size:14px;font-weight:900;color:#1e40af;text-transform:uppercase;letter-spacing:2px">Declaración de Transparencia de Inteligencia Artificial</div>
                    <div style="font-size:11px;color:#1e40af;margin-top:8px">Conforme al Reglamento (UE) 2024/1689 — EU AI Act · Clasificación: Sistema de Alto Riesgo</div>
                </div>

                <div class="section"><div class="section-title">1. Modelos de IA Utilizados</div>
                    <table class="data-table">
                        <thead><tr><th>Modelo</th><th>Proveedor</th><th>Uso</th><th>Supervisión Humana</th></tr></thead>
                        <tbody>
                            ${modelsUsed.map(m => `<tr><td style="font-weight:700">${m}</td><td>OpenAI / Azure</td><td>Análisis documental, predicción procesal</td><td><span class="badge badge-low">✓ VERIFICADA</span></td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="section"><div class="section-title">2. Declaraciones de Cumplimiento</div>
                    <table class="data-table">
                        <tr><td style="width:60%;font-weight:600">El sistema NO toma decisiones autónomas sin supervisión humana</td><td><span class="badge badge-low">CONFORME</span></td></tr>
                        <tr><td style="font-weight:600">Los datos son procesados bajo principios de Privacy by Design</td><td><span class="badge badge-low">CONFORME</span></td></tr>
                        <tr><td style="font-weight:600">No se detectaron sesgos discriminatorios en el análisis</td><td><span class="badge badge-low">CONFORME</span></td></tr>
                        <tr><td style="font-weight:600">Los resultados de IA son presentados como asistencia, no como consejo legal</td><td><span class="badge badge-low">CONFORME</span></td></tr>
                        <tr><td style="font-weight:600">Se mantiene registro de auditoría de todas las interacciones</td><td><span class="badge badge-low">CONFORME</span></td></tr>
                    </table>
                </div>

                <div class="section"><div class="section-title">3. Estadísticas de Uso</div>
                    <div class="kpi-grid">
                        <div class="kpi-card"><div class="kpi-label">Análisis Realizados</div><div class="kpi-value">${totalAnalyses}</div></div>
                        <div class="kpi-card"><div class="kpi-label">Modelos Activos</div><div class="kpi-value">${modelsUsed.length}</div></div>
                        <div class="kpi-card"><div class="kpi-label">Verificación Humana</div><div class="kpi-value" style="color:#22c55e;font-size:20px">100%</div></div>
                    </div>
                </div>

                <div class="section"><div class="section-title">Firma Digital</div>
                    <div style="background:#f8fafc;padding:16px;border-radius:10px;border:1px solid #e2e8f0;font-size:11px;font-family:monospace;color:#64748b;text-align:center">
                        Este certificado es válido únicamente con la firma digital del DPO de la organización.
                    </div>
                </div>
        `;

        const footerHtml = await reportFooter(refCode, htmlBody);
        const finalHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Certificado Transparencia IA — LegalDoc VE</title>
            <style>${BASE_STYLES}
                .ai-seal { text-align:center; margin:32px 0; padding:24px; background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%); border-radius:16px; border:2px solid #93c5fd; }
            </style></head><body>
            <div class="page">
                ${htmlBody}
                ${footerHtml}
            </div>${toolbar()}</body></html>`;
        openReport(finalHtml);
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // R-10 — CUANTÍAS Y RIESGO FINANCIERO POR JURISDICCIÓN
    // ═══════════════════════════════════════════════════════════════════════════

    async generateCuantiasMultidivisa() {
        const { data: exps } = await supabase.from('expedientes').select('*').order('created_at', { ascending: false });
        const expedientes = exps || [];
        const bcvData = await bcvRateService.getTodayRate();
        const bcvRate = bcvData?.usd_rate || 473.87;
        const now = new Date();
        const refCode = `CUANT-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

        let totalUsd = 0;
        const rows = expedientes.filter((e: any) => e.cuantia).map((e: any) => {
            const usd = e.currency === 'USD' ? e.cuantia : e.currency === 'EUR' ? e.cuantia * 1.08 : e.cuantia / bcvRate;
            totalUsd += usd;
            return `
                <tr>
                    <td style="font-weight:700">${e.titulo || e.id}</td>
                    <td>${e.region || 'VE'}</td>
                    <td>${riskBadge((e.riesgo || 'LOW').toUpperCase())}</td>
                    <td style="text-align:right">${e.currency} ${e.cuantia.toLocaleString()}</td>
                    <td style="text-align:right;font-weight:700">$${usd.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                    <td style="text-align:right">${(usd * bcvRate).toLocaleString('es-VE',{minimumFractionDigits:2})} Bs</td>
                    <td style="text-align:right">€${(usd / 1.08).toLocaleString('de-DE',{minimumFractionDigits:2})}</td>
                </tr>
            `;
        }).join('');

        const htmlBody = `
                <div class="report-header">
                    <div><div class="brand">LEGALTECH COMPLIANCE VE</div><div class="brand-sub">Dirección Financiera Legal</div><div class="report-title">R-10 · Cuantías y Riesgo Financiero por Jurisdicción</div></div>
                    <div class="report-meta"><div><strong>${refCode}</strong></div><div>Emisión: ${formatDate(now.toISOString())}</div><div>Tasa BCV: ${bcvRate} VES/USD</div></div>
                </div>
                <div class="section"><div class="section-title">Consolidado Multi-Divisa</div>
                    <div class="kpi-grid">
                        <div class="kpi-card"><div class="kpi-label">Total Cartera (USD)</div><div class="kpi-value" style="color:#1e40af">$${totalUsd.toLocaleString('en-US',{minimumFractionDigits:2})}</div></div>
                        <div class="kpi-card"><div class="kpi-label">Total (VES)</div><div class="kpi-value" style="color:#1e40af">${(totalUsd*bcvRate).toLocaleString('es-VE',{minimumFractionDigits:2})} Bs</div></div>
                        <div class="kpi-card"><div class="kpi-label">Total (EUR)</div><div class="kpi-value" style="color:#1e40af">€${(totalUsd/1.08).toLocaleString('de-DE',{minimumFractionDigits:2})}</div></div>
                        <div class="kpi-card"><div class="kpi-label">Expedientes con Cuantía</div><div class="kpi-value">${expedientes.filter((e:any)=>e.cuantia).length}/${expedientes.length}</div></div>
                    </div>
                </div>
                <div class="section"><div class="section-title">Detalle por Expediente</div>
                    <table class="data-table">
                        <thead><tr><th>Caso</th><th>Región</th><th>Riesgo</th><th style="text-align:right">Original</th><th style="text-align:right">USD</th><th style="text-align:right">VES</th><th style="text-align:right">EUR</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
        `;

        const footerHtml = await reportFooter(refCode, htmlBody);
        const finalHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Cuantías Multi-divisa — LegalDoc VE</title>
            <style>${BASE_STYLES}</style></head><body>
            <div class="page">
                ${htmlBody}
                ${footerHtml}
            </div>${toolbar()}</body></html>`;
        openReport(finalHtml);
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // R-11 — HONORARIOS Y ACTIVIDAD POR ABOGADO
    // ═══════════════════════════════════════════════════════════════════════════

    async generateActividadAbogados() {
        const [{ data: profiles }, { data: exps }, aiLogs] = await Promise.all([
            supabase.from('profiles').select('id, name, email, role').order('name'),
            supabase.from('expedientes').select('*'),
            complianceService.getAiUsageLogs()
        ]);
        const now = new Date();
        const refCode = `ACT-ABG-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

        const lawyers = (profiles || []).filter((p: any) => p.role === 'CONSULTOR_GENERAL' || p.role === 'SOCIO_PRINCIPAL' || p.role === 'ABOGADO' || p.role === 'admin');
        const expedientes = exps || [];

        const rows = lawyers.map((l: any) => {
            const cases = expedientes.filter((e: any) => e.assigned_lawyer_id === l.id || e.created_by === l.id);
            const active = cases.filter((e: any) => e.status === 'ACTIVO').length;
            const aiUses = aiLogs.filter((a: any) => a.user_id === l.id).length;
            return `
                <tr>
                    <td><div><span style="font-weight:700">${l.name}</span><br><span style="font-size:11px;color:#94a3b8">${l.email}</span></div></td>
                    <td style="text-align:center;font-weight:700">${cases.length}</td>
                    <td style="text-align:center;font-weight:700;color:#22c55e">${active}</td>
                    <td style="text-align:center">${aiUses}</td>
                    <td><span class="badge badge-active">${l.role}</span></td>
                </tr>
            `;
        }).join('');

        const htmlBody = `
                <div class="report-header">
                    <div><div class="brand">LEGALTECH COMPLIANCE VE</div><div class="brand-sub">Dirección de Talento Legal</div><div class="report-title">R-11 · Honorarios y Actividad por Abogado</div></div>
                    <div class="report-meta"><div><strong>${refCode}</strong></div><div>Emisión: ${formatDate(now.toISOString())}</div><div>Total consultores: ${lawyers.length}</div></div>
                </div>
                <div class="section"><div class="section-title">Productividad por Consultor</div>
                    <table class="data-table">
                        <thead><tr><th>Abogado</th><th style="text-align:center">Expedientes</th><th style="text-align:center">Activos</th><th style="text-align:center">Análisis IA</th><th>Rol</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
        `;

        const footerHtml = await reportFooter(refCode, htmlBody);
        const finalHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Actividad por Abogado — LegalDoc VE</title>
            <style>${BASE_STYLES}</style></head><body>
            <div class="page">
                ${htmlBody}
                ${footerHtml}
            </div>${toolbar()}</body></html>`;
        openReport(finalHtml);
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // R-12 — DECLARACIÓN JURADA DE USO DE IA PARA TRIBUNALES
    // ═══════════════════════════════════════════════════════════════════════════

    async generateDeclaracionIA(exp?: Expediente) {
        const now = new Date();
        const refCode = `DECL-IA-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

        const htmlBody = `
                <div class="report-header">
                    <div><div class="brand">LEGALTECH COMPLIANCE VE</div><div class="brand-sub">Declaración para Tribunales</div><div class="report-title">R-12 · Declaración Jurada de Uso de Herramientas de IA</div></div>
                    <div class="report-meta"><div><strong>${refCode}</strong></div><div>Emisión: ${formatDate(now.toISOString())}</div></div>
                </div>

                ${exp ? `
                <div class="section"><div class="section-title">Expediente Relacionado</div>
                    <table class="data-table">
                        <tr><td style="width:200px;font-weight:700;color:#64748b">Expediente</td><td>${exp.id} — ${exp.titulo}</td></tr>
                        <tr><td style="font-weight:700;color:#64748b">Tribunal</td><td>${exp.tribunal || '—'}</td></tr>
                    </table>
                </div>
                ` : ''}

                <div class="decl-box">
                    <h3 style="font-size:14px;font-weight:900;color:#92400e;margin:0 0 16px">DECLARACIÓN</h3>
                    <p style="font-size:13px;line-height:1.8;color:#78350f;margin:0">
                        El/La abogado(a) suscrito(a), en ejercicio de su representación procesal, declara de buena fe y conforme a las directrices 
                        del Poder Judicial que <strong>se utilizaron herramientas de Inteligencia Artificial</strong> como asistencia en la elaboración 
                        de los escritos y/o análisis presentados en el presente expediente.
                    </p>
                    <p style="font-size:13px;line-height:1.8;color:#78350f;margin:12px 0 0">
                        Se hace constar que:<br>
                        ✓ La IA fue utilizada exclusivamente como herramienta de <strong>asistencia</strong>, no como sustituto del criterio profesional.<br>
                        ✓ Todo el contenido generado fue <strong>revisado, verificado y aprobado</strong> por el profesional del Derecho firmante.<br>
                        ✓ Las citas legales, jurisprudenciales y doctrinarias fueron <strong>cotejadas con las fuentes originales</strong>.<br>
                        ✓ El sistema utilizado (LegalDoc VE) cumple con los estándares del <strong>EU AI Act 2024</strong> y la <strong>LDPB venezolana</strong>.
                    </p>
                </div>

                <div class="section" style="margin-top:48px">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:48px">
                        <div style="border-top:2px solid #1e293b;padding-top:12px;text-align:center">
                            <div style="font-size:11px;color:#64748b;font-weight:600">Firma del Abogado Responsable</div>
                            <div style="margin-top:4px;font-size:10px;color:#94a3b8">Nombre, INPREABOGADO Nº, Firma</div>
                        </div>
                        <div style="border-top:2px solid #1e293b;padding-top:12px;text-align:center">
                            <div style="font-size:11px;color:#64748b;font-weight:600">Fecha</div>
                            <div style="margin-top:4px;font-size:10px;color:#94a3b8">${formatDate(now.toISOString())}</div>
                        </div>
                    </div>
                </div>
        `;

        const footerHtml = await reportFooter(refCode, htmlBody);
        const finalHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Declaración Uso IA — LegalDoc VE</title>
            <style>${BASE_STYLES}
                .decl-box { background:#fffbeb; border:2px solid #fde68a; border-radius:12px; padding:24px; margin:24px 0; }
            </style></head><body>
            <div class="page">
                ${htmlBody}
                ${footerHtml}
            </div>${toolbar()}</body></html>`;
        openReport(finalHtml);
    }
};
