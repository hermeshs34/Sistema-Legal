/**
 * face-invoice.service.ts
 * Facturación electrónica para España — FACe / FacturaE
 *
 * FACe: Punto General de Entrada de Facturas Electrónicas (AAPP)
 * FacturaE: Formato XML estándar para e-facturas en España (UBL 2.1 / FacturaE 3.2.2)
 *
 * Marco legal:
 *   → Ley 25/2013 — Impulso de la factura electrónica y creación del registro contable
 *   → RD 1619/2012 — Obligaciones de facturación
 *   → Ley Crea y Crece (Ley 18/2022) — Obligatoriedad factura electrónica B2B (2025-2026)
 *   → Reglamento eIDAS para firma XAdES-BES (obligatorio en facturas AAPP)
 *
 * Flujo para bufetes que facturan a AAPP:
 *   1. Generar XML FacturaE con datos del expediente/contrato
 *   2. Firmar XML con certificado (XAdES-BES) → via Edge Function
 *   3. Enviar a FACe (endpoint REST del MINHAP)
 *   4. Obtener número de registro contable asignado
 *
 * Para facturación B2B (clientes privados):
 *   A partir de 2025: Verifactu o sistema equivalente homologado AEAT
 *   Esta implementación genera el XML y lo registra en BD.
 */

import { supabase } from '../../core/supabase.ts';
import { authService } from '../../core/auth.service.ts';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type FaceInvoiceStatus =
    | 'draft'         // Borrador
    | 'generated'     // XML generado, pendiente de firma
    | 'signed'        // XML firmado (XAdES-BES)
    | 'submitted'     // Enviada a FACe
    | 'registered'    // Registrada con número contable asignado
    | 'paid'          // Cobrada
    | 'rejected'      // Rechazada por la AAPP
    | 'cancelled';    // Anulada

export interface FaceInvoiceParty {
    nombre:       string;
    nif:          string;       // NIF/CIF del emisor/receptor
    direccion:    string;
    codigoPostal: string;
    ciudad:       string;
    provincia:    string;
    pais:         string;       // 'ES' por defecto
}

export interface FaceInvoiceLine {
    descripcion:          string;
    cantidad:             number;
    precioUnitario:       number;    // Sin IVA
    tipoImpositivo:       number;    // % IVA (21, 10, 4, 0)
    descuento?:           number;    // % de descuento
    codigoExpediente?:    string;    // Referencia interna (ej: EXP-202605-0001)
}

export interface FaceInvoiceData {
    // Identificación
    numeroFactura:    string;        // Generado automáticamente: FXXX-YYYY-NNNN
    serieFactura:     string;        // Serie (ej: 'A', 'B', 'LEG')
    fechaEmision:     string;        // ISO date YYYY-MM-DD
    fechaVencimiento: string;
    // Partes
    emisor:           FaceInvoiceParty;
    receptor:         FaceInvoiceParty;
    // Código DIR3 (obligatorio para AAPP)
    codigoOrgano?:    string;        // Código DIR3 del órgano gestor
    codigoUnidad?:    string;        // Código DIR3 unidad tramitadora
    codigoOficina?:   string;        // Código DIR3 oficina contable
    // Líneas y totales
    lineas:           FaceInvoiceLine[];
    // Metadatos
    conceptoGeneral?: string;        // Descripción global
    observaciones?:   string;
    metodoPago?:      'transferencia' | 'domiciliacion' | 'cheque' | 'otro';
    ibanEmisor?:      string;        // IBAN para transferencia
    // Referencia interna
    contractId?:      string;
    expedienteId?:    string;
}

export interface FaceInvoiceRecord {
    id:             string;
    organizationId: string;
    numeroFactura:  string;
    status:         FaceInvoiceStatus;
    totalBruto:     number;
    totalIva:       number;
    totalNeto:      number;
    xmlContent?:    string;
    xmlUrl?:        string;
    faceRegistro?:  string;         // Número de registro contable FACe
    contractId?:    string;
    expedienteId?:  string;
    createdAt:      string;
}

// ── Utilidades de cálculo ──────────────────────────────────────────────────────

function calcularTotales(lineas: FaceInvoiceLine[]): {
    baseImponible: number; cuotaIva: number; total: number; desglose: { tipo: number; base: number; cuota: number }[];
} {
    const desglose: Record<number, { base: number; cuota: number }> = {};

    for (const l of lineas) {
        const descuento   = l.descuento ? (l.precioUnitario * l.cantidad * l.descuento / 100) : 0;
        const base        = (l.precioUnitario * l.cantidad) - descuento;
        const cuota       = base * (l.tipoImpositivo / 100);

        if (!desglose[l.tipoImpositivo]) desglose[l.tipoImpositivo] = { base: 0, cuota: 0 };
        desglose[l.tipoImpositivo].base  += base;
        desglose[l.tipoImpositivo].cuota += cuota;
    }

    const desgloseArr  = Object.entries(desglose).map(([tipo, v]) => ({
        tipo: Number(tipo), base: round2(v.base), cuota: round2(v.cuota),
    }));
    const baseImponible = round2(desgloseArr.reduce((s, d) => s + d.base, 0));
    const cuotaIva      = round2(desgloseArr.reduce((s, d) => s + d.cuota, 0));

    return { baseImponible, cuotaIva, total: round2(baseImponible + cuotaIva), desglose: desgloseArr };
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

// ── Generador XML FacturaE 3.2.2 ───────────────────────────────────────────────

function generateFacturaeXML(data: FaceInvoiceData): string {
    const { baseImponible, cuotaIva, total, desglose } = calcularTotales(data.lineas);

    const linesXML = data.lineas.map((l, i) => {
        const desc   = l.descuento ? (l.precioUnitario * l.cantidad * l.descuento / 100) : 0;
        const base   = round2((l.precioUnitario * l.cantidad) - desc);
        const cuota  = round2(base * (l.tipoImpositivo / 100));
        return `
        <InvoiceLine>
            <ItemDescription>${escXml(l.descripcion)}</ItemDescription>
            <Quantity>${l.cantidad.toFixed(2)}</Quantity>
            <UnitPriceWithoutTax>${l.precioUnitario.toFixed(4)}</UnitPriceWithoutTax>
            <TotalCost>${base.toFixed(2)}</TotalCost>
            <GrossAmount>${base.toFixed(2)}</GrossAmount>
            <TaxesWithheld/>
            <TaxesOutputs>
                <Tax>
                    <TaxTypeCode>01</TaxTypeCode>
                    <TaxRate>${l.tipoImpositivo.toFixed(2)}</TaxRate>
                    <TaxableBase><TotalAmount>${base.toFixed(2)}</TotalAmount></TaxableBase>
                    <TaxAmount><TotalAmount>${cuota.toFixed(2)}</TotalAmount></TaxAmount>
                </Tax>
            </TaxesOutputs>
            <LineItemPeriod>
                <StartDate>${data.fechaEmision}</StartDate>
                <EndDate>${data.fechaEmision}</EndDate>
            </LineItemPeriod>
            <AdditionalLineItemInformation>${escXml(l.codigoExpediente ?? `Línea ${i + 1}`)}</AdditionalLineItemInformation>
        </InvoiceLine>`;
    }).join('');

    const taxesXML = desglose.map(d => `
            <Tax>
                <TaxTypeCode>01</TaxTypeCode>
                <TaxRate>${d.tipo.toFixed(2)}</TaxRate>
                <TaxableBase><TotalAmount>${d.base.toFixed(2)}</TotalAmount></TaxableBase>
                <TaxAmount><TotalAmount>${d.cuota.toFixed(2)}</TotalAmount></TaxAmount>
            </Tax>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<fe:Facturae xmlns:fe="http://www.facturae.es/Facturae/2009/v3.2.2/Facturae"
             xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
    <FileHeader>
        <SchemaVersion>3.2.2</SchemaVersion>
        <Modality>I</Modality>
        <InvoiceIssuerType>EM</InvoiceIssuerType>
        <Batch>
            <BatchIdentifier>${escXml(data.emisor.nif)}${escXml(data.numeroFactura)}</BatchIdentifier>
            <InvoicesCount>1</InvoicesCount>
            <TotalInvoicesAmount><TotalAmount>${total.toFixed(2)}</TotalAmount></TotalInvoicesAmount>
            <TotalOutstandingAmount><TotalAmount>${total.toFixed(2)}</TotalAmount></TotalOutstandingAmount>
            <TotalExecutableAmount><TotalAmount>${total.toFixed(2)}</TotalAmount></TotalExecutableAmount>
            <InvoiceCurrencyCode>EUR</InvoiceCurrencyCode>
        </Batch>
    </FileHeader>
    <Parties>
        <SellerParty>
            <TaxIdentification>
                <PersonTypeCode>J</PersonTypeCode>
                <ResidenceTypeCode>R</ResidenceTypeCode>
                <TaxIdentificationNumber>${escXml(data.emisor.nif)}</TaxIdentificationNumber>
            </TaxIdentification>
            <LegalEntity>
                <CorporateName>${escXml(data.emisor.nombre)}</CorporateName>
                <AddressInSpain>
                    <Address>${escXml(data.emisor.direccion)}</Address>
                    <PostCode>${escXml(data.emisor.codigoPostal)}</PostCode>
                    <Town>${escXml(data.emisor.ciudad)}</Town>
                    <Province>${escXml(data.emisor.provincia)}</Province>
                    <CountryCode>ESP</CountryCode>
                </AddressInSpain>
            </LegalEntity>
        </SellerParty>
        <BuyerParty>
            <TaxIdentification>
                <PersonTypeCode>J</PersonTypeCode>
                <ResidenceTypeCode>R</ResidenceTypeCode>
                <TaxIdentificationNumber>${escXml(data.receptor.nif)}</TaxIdentificationNumber>
            </TaxIdentification>
            <LegalEntity>
                <CorporateName>${escXml(data.receptor.nombre)}</CorporateName>
                ${data.codigoOrgano ? `<AdministrativeCentres>
                    <AdministrativeCentre>
                        <CentreCode>${escXml(data.codigoOrgano)}</CentreCode>
                        <RoleTypeCode>01</RoleTypeCode>
                        <Name>Órgano Gestor</Name>
                    </AdministrativeCentre>
                    <AdministrativeCentre>
                        <CentreCode>${escXml(data.codigoUnidad ?? data.codigoOrgano)}</CentreCode>
                        <RoleTypeCode>02</RoleTypeCode>
                        <Name>Unidad Tramitadora</Name>
                    </AdministrativeCentre>
                    <AdministrativeCentre>
                        <CentreCode>${escXml(data.codigoOficina ?? data.codigoOrgano)}</CentreCode>
                        <RoleTypeCode>03</RoleTypeCode>
                        <Name>Oficina Contable</Name>
                    </AdministrativeCentre>
                </AdministrativeCentres>` : ''}
                <AddressInSpain>
                    <Address>${escXml(data.receptor.direccion)}</Address>
                    <PostCode>${escXml(data.receptor.codigoPostal)}</PostCode>
                    <Town>${escXml(data.receptor.ciudad)}</Town>
                    <Province>${escXml(data.receptor.provincia)}</Province>
                    <CountryCode>ESP</CountryCode>
                </AddressInSpain>
            </LegalEntity>
        </BuyerParty>
    </Parties>
    <Invoices>
        <Invoice>
            <InvoiceHeader>
                <InvoiceNumber>${escXml(data.numeroFactura)}</InvoiceNumber>
                <InvoiceSeriesCode>${escXml(data.serieFactura)}</InvoiceSeriesCode>
                <InvoiceDocumentType>FC</InvoiceDocumentType>
                <InvoiceClass>OO</InvoiceClass>
            </InvoiceHeader>
            <InvoiceIssueData>
                <IssueDate>${data.fechaEmision}</IssueDate>
                <InvoiceCurrencyCode>EUR</InvoiceCurrencyCode>
                <TaxCurrencyCode>EUR</TaxCurrencyCode>
                <LanguageName>es</LanguageName>
            </InvoiceIssueData>
            <TaxesOutputs>${taxesXML}
            </TaxesOutputs>
            <TaxesWithheld/>
            <InvoiceTotals>
                <TotalGrossAmount>${baseImponible.toFixed(2)}</TotalGrossAmount>
                <TotalGrossAmountBeforeTaxes>${baseImponible.toFixed(2)}</TotalGrossAmountBeforeTaxes>
                <TotalTaxOutputs>${cuotaIva.toFixed(2)}</TotalTaxOutputs>
                <TotalTaxesWithheld>0.00</TotalTaxesWithheld>
                <InvoiceTotal>${total.toFixed(2)}</InvoiceTotal>
                <TotalOutstandingAmount>${total.toFixed(2)}</TotalOutstandingAmount>
                <TotalExecutableAmount>${total.toFixed(2)}</TotalExecutableAmount>
            </InvoiceTotals>
            <Items>${linesXML}
            </Items>
            <PaymentDetails>
                <Installment>
                    <InstallmentDueDate>${data.fechaVencimiento}</InstallmentDueDate>
                    <InstallmentAmount>${total.toFixed(2)}</InstallmentAmount>
                    <PaymentMeans>${data.metodoPago === 'transferencia' ? '04' : '01'}</PaymentMeans>
                    ${data.ibanEmisor ? `<AccountToBeCredited><IBAN>${escXml(data.ibanEmisor)}</IBAN></AccountToBeCredited>` : ''}
                </Installment>
            </PaymentDetails>
            ${data.observaciones ? `<AdditionalData><InvoiceAdditionalInformation>${escXml(data.observaciones)}</InvoiceAdditionalInformation></AdditionalData>` : ''}
        </Invoice>
    </Invoices>
</fe:Facturae>`;
}

function escXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ── Servicio ───────────────────────────────────────────────────────────────────

class FaceInvoiceService {

    /**
     * Genera el XML FacturaE y registra la factura en BD como 'generated'.
     * El XML puede descargarse o enviarse a la Edge Function para firmado XAdES.
     */
    async generate(data: FaceInvoiceData): Promise<{ record: FaceInvoiceRecord; xml: string }> {
        const user = authService.getCurrentUser();
        if (!user) throw new Error('No autenticado');

        const { baseImponible, cuotaIva, total } = calcularTotales(data.lineas);
        const xml = generateFacturaeXML(data);

        const { data: row, error } = await supabase
            .from('face_invoices')
            .insert({
                organization_id: user.organizationId,
                numero_factura:  data.numeroFactura,
                serie_factura:   data.serieFactura,
                fecha_emision:   data.fechaEmision,
                fecha_vencimiento: data.fechaVencimiento,
                nif_emisor:      data.emisor.nif,
                nombre_emisor:   data.emisor.nombre,
                nif_receptor:    data.receptor.nif,
                nombre_receptor: data.receptor.nombre,
                codigo_organ:    data.codigoOrgano ?? null,
                total_bruto:     baseImponible,
                total_iva:       cuotaIva,
                total_neto:      total,
                xml_content:     xml,
                status:          'generated',
                contract_id:     data.contractId ?? null,
                expediente_id:   data.expedienteId ?? null,
                created_by:      user.id,
                payload_json:    data as any,
            })
            .select()
            .single();

        if (error || !row) throw new Error('Error al guardar factura: ' + error?.message);

        return { record: this._map(row), xml };
    }

    /**
     * Descarga el XML como fichero .xsig / .xml en el navegador.
     */
    downloadXML(xml: string, numeroFactura: string): void {
        const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `factura-${numeroFactura}.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Genera el siguiente número de factura en formato: LEG-YYYYMM-NNNN.
     */
    async nextInvoiceNumber(serie = 'LEG'): Promise<string> {
        const user = authService.getCurrentUser();
        if (!user) return `${serie}-${new Date().toISOString().slice(0, 7).replace('-', '')}-0001`;

        const prefix = `${serie}-${new Date().toISOString().slice(0, 7).replace('-', '')}-`;
        const { data } = await supabase
            .from('face_invoices')
            .select('numero_factura')
            .eq('organization_id', user.organizationId)
            .like('numero_factura', `${prefix}%`)
            .order('numero_factura', { ascending: false })
            .limit(1)
            .maybeSingle();

        const last = data?.numero_factura;
        const seq  = last ? parseInt(last.slice(-4), 10) + 1 : 1;
        return `${prefix}${seq.toString().padStart(4, '0')}`;
    }

    /**
     * Lista todas las facturas de la organización.
     */
    async getAll(): Promise<FaceInvoiceRecord[]> {
        const user = authService.getCurrentUser();
        if (!user) return [];

        const { data } = await supabase
            .from('face_invoices')
            .select('*')
            .eq('organization_id', user.organizationId)
            .order('fecha_emision', { ascending: false });

        return (data ?? []).map(r => this._map(r));
    }

    private _map(row: any): FaceInvoiceRecord {
        return {
            id:             row.id,
            organizationId: row.organization_id,
            numeroFactura:  row.numero_factura,
            status:         row.status as FaceInvoiceStatus,
            totalBruto:     Number(row.total_bruto),
            totalIva:       Number(row.total_iva),
            totalNeto:      Number(row.total_neto),
            xmlContent:     row.xml_content ?? undefined,
            xmlUrl:         row.xml_url ?? undefined,
            faceRegistro:   row.face_registro ?? undefined,
            contractId:     row.contract_id ?? undefined,
            expedienteId:   row.expediente_id ?? undefined,
            createdAt:      row.created_at,
        };
    }
}

export const faceInvoiceService = new FaceInvoiceService();

export const FACE_STATUS_CONFIG: Record<FaceInvoiceStatus, { label: string; color: string; bg: string; emoji: string }> = {
    draft:      { label: 'Borrador',            color: '#64748b', bg: '#f8fafc', emoji: '📝' },
    generated:  { label: 'XML generado',        color: '#1d4ed8', bg: '#eff6ff', emoji: '📄' },
    signed:     { label: 'Firmada (XAdES)',     color: '#7c3aed', bg: '#f5f3ff', emoji: '🔏' },
    submitted:  { label: 'Enviada a FACe',      color: '#d97706', bg: '#fffbeb', emoji: '📤' },
    registered: { label: 'Registrada en AAPP',  color: '#166534', bg: '#f0fdf4', emoji: '✅' },
    paid:       { label: 'Cobrada',             color: '#059669', bg: '#ecfdf5', emoji: '💶' },
    rejected:   { label: 'Rechazada',           color: '#991b1b', bg: '#fef2f2', emoji: '❌' },
    cancelled:  { label: 'Anulada',             color: '#374151', bg: '#f9fafb', emoji: '🚫' },
};
