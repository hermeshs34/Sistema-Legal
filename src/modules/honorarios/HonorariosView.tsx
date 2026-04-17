import React, { useState, useEffect } from 'react';
import { 
    Users, 
    Briefcase, 
    Clock, 
    FileText, 
    TrendingUp, 
    CheckCircle2,
    Search as SearchIcon,
    Download as DownloadIcon,
    Mail,
    Phone,
    Plus,
    RefreshCw,
    Eye,
    Trash2,
    Edit2,
    AlertTriangle,
    Gavel,
    FileSignature,
    Receipt,
    X,
    Filter,
    Paperclip,
    ExternalLink,
    FileDown,
    DollarSign,
    ArrowLeftRight,
    TrendingDown,
    Info,
    Calendar,
    Globe
} from 'lucide-react';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend, 
    ResponsiveContainer, 
    PieChart, 
    Pie, 
    Cell,
    LineChart,
    Line
} from 'recharts';
import { clientService, matterService, invoiceService, timeEntryService, paymentService, expenseService, exchangeRateService } from './honorarios.service.ts';
import { contractService } from '../contracts/contract.service.ts';
import { expedienteService } from '../expedientes/expediente.service.ts';
import type { Client, Matter, Invoice, TimeEntry, PaymentMethod, MatterExpense, ExpenseCategory, ExchangeRate, Currency } from './types.ts';
import { CURRENCY_SYMBOLS } from './types.ts';
import type { Contract } from '../contracts/types.ts';
import type { Expediente } from '../expedientes/types.ts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'jspdf-autotable';
import { supabase } from '../../core/supabase.ts';
import { drawPdfBrandHeader, drawPdfBrandFooter } from '../shared/pdf-brand.ts';

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem', borderRadius: '12px',
    border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#1e293b',
    background: '#f8fafc', outline: 'none', boxSizing: 'border-box',
    transition: 'all 0.2s',
};

type Tab = 'DASHBOARD' | 'CLIENTES' | 'CASOS' | 'TIME' | 'FACTURAS' | 'GASTOS';

export const HonorariosView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('DASHBOARD');
    const [loading, setLoading] = useState(true);
    
    // Data states
    const [clients, setClients] = useState<Client[]>([]);
    const [matters, setMatters] = useState<Matter[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
    const [expenses, setExpenses] = useState<MatterExpense[]>([]);
    const [lawyers, setLawyers] = useState<{id: string, name: string}[]>([]);

    // Expense UI states
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [expenseFilterMatter, setExpenseFilterMatter] = useState('');
    const [expenseForm, setExpenseForm] = useState<Partial<MatterExpense>>({
        matterId: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        category: 'OTHER',
        amountUsd: 0,
        paidBy: 'FIRM',
        isReimbursed: false
    });
    const [savingExpense, setSavingExpense] = useState(false);
    const [uploadingReceipt, setUploadingReceipt] = useState(false);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);
    const [showInvoiceFromExpenses, setShowInvoiceFromExpenses] = useState(false);
    const [creatingExpenseInvoice, setCreatingExpenseInvoice] = useState(false);
    const [expenseCurrency, setExpenseCurrency] = useState<'USD'|'EUR'|'VES'>('USD');
    // Exchange Rates
    const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
    const [presentationCurrency, setPresentationCurrency] = useState<Currency>('USD');
    const [latestRates, setLatestRates] = useState<Record<string, number>>({});
    const [showRatesModal, setShowRatesModal] = useState(false);
    const [rateForm, setRateForm] = useState<Partial<ExchangeRate>>({ currencyFrom:'USD', currencyTo:'VES', rate:0, source:'MANUAL' });
    const [savingRate, setSavingRate] = useState(false);
    const [convertAmount, setConvertAmount] = useState(1);
    const [convertFrom, setConvertFrom] = useState<'USD'|'EUR'|'VES'>('USD');
    const [convertTo, setConvertTo] = useState<'USD'|'EUR'|'VES'>('VES');
    
    // Sync UI states
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [syncSource, setSyncSource] = useState<'EXPEDIENTE' | 'CONTRATO' | null>(null);
    const [availableExpedientes, setAvailableExpedientes] = useState<Expediente[]>([]);
    const [availableContracts, setAvailableContracts] = useState<Contract[]>([]);
    const [syncSelection, setSyncSelection] = useState<string>('');
    const [syncFeeType, setSyncFeeType] = useState<'HOURLY' | 'FIXED' | 'CONTINGENCY'>('FIXED');
    const [syncBudget, setSyncBudget] = useState(0);
    const [syncClientId, setSyncClientId] = useState('');
    const [syncing, setSyncing] = useState(false);
    
    // Client Creation UI
    const [showClientModal, setShowClientModal] = useState(false);
    const [clientForm, setClientForm] = useState<{
        id?: string;
        name: string;
        idNumber: string;
        email: string;
        phone: string;
        address: string;
        creditRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    }>({
        name: '',
        idNumber: '',
        email: '',
        phone: '',
        address: '',
        creditRisk: 'LOW'
    });
    const [savingClient, setSavingClient] = useState(false);

    // Invoice UI
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [selectedMatterId, setSelectedMatterId] = useState('');
    const [invoiceData, setInvoiceData] = useState({
        id: undefined as string | undefined,
        number: '',
        description: '',
        amount: 0,
        currency: 'USD' as Currency,
        exchangeRate: 1,
        dueDays: 15,
        status: 'SENT' as any
    });
    const [creatingInvoice, setCreatingInvoice] = useState(false);

    // Forensic UI
    const [showForensicModal, setShowForensicModal] = useState(false);

    // Payment UI
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [paymentForm, setPaymentForm] = useState({
        amount: 0,
        method: 'TRANSFER' as PaymentMethod,
        reference: '',
        date: new Date().toISOString().split('T')[0]
    });
    const [savingPayment, setSavingPayment] = useState(false);
    const [showTimeModal, setShowTimeModal] = useState(false);
    const [timeForm, setTimeForm] = useState({
        id: undefined as string | undefined,
        matterId: '',
        lawyerId: '',
        hours: 1,
        currency: 'USD' as Currency,
        rate: 150,
        rateUsd: 150,
        description: '',
        date: new Date().toISOString().split('T')[0]
    });
    const [savingTime, setSavingTime] = useState(false);

    // Matter Form UI
    const [showMatterModal, setShowMatterModal] = useState(false);
    const [matterForm, setMatterForm] = useState<Partial<Matter>>({
        title: '',
        code: '',
        type: 'LITIGATION',
        status: 'ACTIVE',
        feeType: 'FIXED',
        currency: 'USD',
        budget: 0,
        budgetUsd: 0,
        clientId: ''
    });
    const [savingMatter, setSavingMatter] = useState(false);
    
    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            try {
                // Fetch lawyers first
                const { data: laws } = await supabase.from('lawyers').select('id, name');
                setLawyers(laws || []);

                const [c, m, i, t] = await Promise.all([
                    clientService.getAll(),
                    matterService.getAll(),
                    invoiceService.getAll(),
                    timeEntryService.getAll()
                ]);

                // Normalizador PRO: Garantiza que datos viejos tengan los campos de moneda
                const normalizedMatters = m.map(item => ({
                    ...item,
                    currency: item.currency || 'USD',
                    budget: item.budget || item.budgetUsd || 0,
                    hourlyRate: item.hourlyRate || item.hourlyRateUsd || 0
                }));

                const normalizedTimes = t.map(item => ({
                    ...item,
                    currency: item.currency || 'USD',
                    rate: item.rate || item.rateUsd || 0,
                    amount: item.amount || item.amountUsd || 0
                }));

                setClients(c);
                setMatters(normalizedMatters);
                setInvoices(i);
                setTimeEntries(normalizedTimes);

                // Cargar gastos de todos los asuntos activos
                if (normalizedMatters.length > 0) {
                    const expPromises = normalizedMatters.map(matter => expenseService.getByMatter(matter.id));
                    const expArrays = await Promise.all(expPromises);
                    setExpenses(expArrays.flat());
                }
                // Cargar tasas de cambio
                try {
                    const [rateHistory, latest] = await Promise.all([
                        exchangeRateService.getAll(),
                        exchangeRateService.getLatestAll()
                    ]);
                    setExchangeRates(rateHistory);
                    setLatestRates(latest);
                } catch { /* sin tasas registradas aún */ }
            } catch (error) {
                console.error("Error loading honorarios data:", error);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, []);

    // Helper: Obtener tasa actual para guardado
    const getRateForSave = (from: Currency, to: Currency) => {
        if (from === to) return 1;
        return latestRates[`${from}_${to}`] || 1;
    };

    const handleStartSync = async () => {
        const [exps, ctrs] = await Promise.all([
            expedienteService.getAll(),
            contractService.getAll()
        ]);
        const existingExpIds = matters.map(m => m.expedienteId);
        const existingCtrIds = matters.map(m => m.contractId);
        
        setAvailableExpedientes(exps.filter(e => !existingExpIds.includes(e.id)));
        setAvailableContracts(ctrs.filter(c => !existingCtrIds.includes(c.id)));
        setShowSyncModal(true);
    };

    const handleSync = async () => {
        if (!syncSelection || !syncClientId) return;
        setSyncing(true);
        try {
            let label = '';
            let expId = undefined;
            let ctrId = undefined;

            if (syncSource === 'EXPEDIENTE') {
                const e = availableExpedientes.find(x => x.id === syncSelection);
                if (e) {
                    label = `EXP: ${e.numeroExpediente || 'S/N'} - ${e.parteActora} vs ${e.parteDemandada}`;
                    expId = e.id;
                }
            } else {
                const c = availableContracts.find(x => x.id === syncSelection);
                if (c) {
                    label = `CTR: ${c.title}`;
                    ctrId = c.id;
                }
            }

            await matterService.save({
                title: label,
                type: syncSource === 'EXPEDIENTE' ? 'LITIGATION' : 'ADVISORY',
                status: 'ACTIVE',
                clientId: syncClientId,
                expedienteId: expId,
                contractId: ctrId,
                feeType: syncFeeType as any,
                budgetUsd: syncBudget
            });
            
            const m = await matterService.getAll();
            setMatters(m);
            setShowSyncModal(false);
            setSyncSelection('');
            setSyncSource(null);
            setSyncClientId('');
        } catch (err) {
            console.error("Sync error:", err);
            alert("Error al sincronizar el asunto.");
        } finally {
            setSyncing(false);
        }
    };

    const handleSaveMatter = async () => {
        if (!matterForm.title || !matterForm.clientId) return;
        setSavingMatter(true);
        try {
            const currency = matterForm.currency || 'USD';
            const exRate = getRateForSave(currency, 'USD');
            
            await matterService.save({
                ...matterForm,
                exchangeRate: (currency === 'USD') ? 1 : (1 / exRate) // Tasa para volver a USD
            });
            
            const m = await matterService.getAll();
            const normalized = m.map(item => ({
                ...item,
                currency: item.currency || 'USD',
                budget: item.budget || item.budgetUsd || 0,
                hourlyRate: item.hourlyRate || item.hourlyRateUsd || 0
            }));
            setMatters(normalized);
            setShowMatterModal(false);
            setMatterForm({ title: '', code: '', type: 'LITIGATION', status: 'ACTIVE', feeType: 'FIXED', currency: 'USD', budget: 0, clientId: '' });
        } catch (err) {
            console.error("Error saving matter:", err);
            alert("No se pudo guardar el asunto.");
        } finally {
            setSavingMatter(false);
        }
    };

    const handleEditMatter = (m: Matter) => {
        setMatterForm(m);
        setShowMatterModal(true);
    };

    const handleDeleteMatter = async (id: string) => {
        if (!confirm("¿Está seguro de eliminar este asunto? Esto podría afectar facturas asociadas.")) return;
        try {
            await matterService.delete(id);
            setMatters(matters.filter(m => m.id !== id));
        } catch (err) {
            alert("No se pudo eliminar el asunto. Verifique si tiene facturas vinculadas.");
        }
    };

    const handleCreateClient = async () => {
        if (!clientForm.name) return;
        setSavingClient(true);
        try {
            await clientService.save(clientForm);
            const updatedClients = await clientService.getAll();
            setClients(updatedClients);
            setShowClientModal(false);
            setClientForm({ name: '', idNumber: '', email: '', phone: '', address: '', creditRisk: 'LOW' });
        } catch (err) {
            console.error("Error saving client:", err);
            alert("No se pudo guardar el cliente.");
        } finally {
            setSavingClient(false);
        }
    };

    const handleEditClient = (c: Client) => {
        setClientForm({
            id: c.id,
            name: c.name,
            idNumber: c.idNumber || '',
            email: c.email || '',
            phone: c.phone || '',
            address: c.address || '',
            creditRisk: (c.creditRisk as any) || 'LOW'
        });
        setShowClientModal(true);
    };

    const handleCreateInvoice = async () => {
        if (!selectedMatterId || invoiceData.amount <= 0) return;
        setCreatingInvoice(true);
        try {
            const matter = matters.find(m => m.id === selectedMatterId);
            if (!matter) return;

            const now = new Date();
            const due = new Date();
            due.setDate(now.getDate() + invoiceData.dueDays);

            await invoiceService.save({
                id: invoiceData.id,
                matterId: selectedMatterId,
                clientId: matter.clientId,
                number: invoiceData.number || `INV-${Date.now().toString().slice(-6)}`,
                status: invoiceData.status || 'SENT',
                issuedAt: now.toISOString(),
                dueAt: due.toISOString(),
                taxPct: 0,
                islrPct: 0,
                currency: invoiceData.currency,
                exchangeRate: invoiceData.exchangeRate,
                subtotal: invoiceData.amount, // Monto en la moneda seleccionada
                paid: 0,
            });

            const updatedInvoices = await invoiceService.getAll();
            setInvoices(updatedInvoices);
            setShowInvoiceModal(false);
            setInvoiceData({ id: undefined, number: '', description: '', amount: 0, currency: 'USD', exchangeRate: 1, dueDays: 15, status: 'SENT' });
        } catch (err) {
            console.error("Error saving invoice:", err);
            alert("No se pudo guardar la factura.");
        } finally {
            setCreatingInvoice(false);
        }
    };

    const handleEditInvoice = (inv: Invoice) => {
        setInvoiceData({
            id: inv.id,
            number: inv.number,
            description: inv.notes || '',
            amount: inv.total,
            currency: inv.currency,
            exchangeRate: inv.exchangeRate,
            dueDays: 15,
            status: inv.status
        });
        setSelectedMatterId(inv.matterId || '');
        setShowInvoiceModal(true);
    };

    // ── Motor de Presentación Profesional ────────────────────
    /**
     * @description Convierte y formatea un valor base (USD) a la moneda de presentación activa
     * @param valUsd Valor en USD
     * @param forceCurrency Si se pasa, fuerza el formateo en esa moneda sin convertir (Uso en tablas nominales)
     */
    const renderFmt = (valUsd: number, forceCurrency?: Currency) => {
        if (forceCurrency) {
            const sym = CURRENCY_SYMBOLS[forceCurrency] || '$';
            return `${sym}${valUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        
        const rate = (presentationCurrency === 'USD') ? 1 : latestRates[`USD_${presentationCurrency}`] || 1;
        const finalValue = valUsd * rate;
        const sym = CURRENCY_SYMBOLS[presentationCurrency] || '$';
        return `${sym}${finalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const handleDeleteInvoice = async (id: string) => {
        if (!confirm("¿Está seguro de eliminar esta factura?")) return;
        try {
            await invoiceService.delete(id);
            setInvoices(invoices.filter(i => i.id !== id));
        } catch (err) {
            alert("No se pudo eliminar la factura.");
        }
    };

    const handleSaveTime = async () => {
        if (!timeForm.matterId || timeForm.hours <= 0) return;
        setSavingTime(true);
        try {
            const currency = timeForm.currency || 'USD';
            const exRate = getRateForSave(currency, 'USD');
            
            await timeEntryService.save({
                ...timeForm,
                exchangeRate: (currency === 'USD') ? 1 : (1 / exRate)
            });
            
            const t = await timeEntryService.getAll();
            const normalized = t.map(item => ({
                ...item,
                currency: item.currency || 'USD',
                rate: item.rate || item.rateUsd || 0,
                amount: item.amount || item.amountUsd || 0
            }));
            setTimeEntries(normalized);
            setShowTimeModal(false);
            setTimeForm({ id: undefined, matterId: '', lawyerId: '', hours: 1, currency: 'USD', rate: 150, rateUsd: 150, description: '', date: new Date().toISOString().split('T')[0] });
        } catch (err) {
            console.error("Error saving time entry:", err);
            alert("No se pudo guardar el registro de tiempo.");
        } finally {
            setSavingTime(false);
        }
    };

    const handleRegisterPayment = async () => {
        if (!selectedInvoice || paymentForm.amount <= 0) return;
        setSavingPayment(true);
        try {
            await paymentService.save({
                invoiceId: selectedInvoice.id,
                clientId: selectedInvoice.clientId,
                currency: selectedInvoice.currency,
                amount: paymentForm.amount,
                exchangeRate: selectedInvoice.exchangeRate,
                amountUsd: selectedInvoice.currency === 'USD' ? paymentForm.amount : paymentForm.amount / selectedInvoice.exchangeRate,
                method: paymentForm.method,
                reference: paymentForm.reference,
                paidAt: paymentForm.date
            });
            
            const [inv, mat] = await Promise.all([
                invoiceService.getAll(),
                matterService.getAll()
            ]);
            setInvoices(inv);
            setMatters(mat);
            setShowPaymentModal(false);
            setSelectedInvoice(null);
            setPaymentForm({ amount: 0, method: 'TRANSFER', reference: '', date: new Date().toISOString().split('T')[0] });
        } catch (err) {
            console.error("Error saving payment:", err);
            alert("No se pudo registrar el pago.");
        } finally {
            setSavingPayment(false);
        }
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        
        // Header corporativo HermesAI
        const contentY = drawPdfBrandHeader(doc, {
            reportRef: `RPT-FIN-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`,
            subtitle: `REPORTE FINANCIERO CONSOLIDADO (${presentationCurrency})`
        });
        
        // KPIs en PDF
        const totalBudgeted = matters.reduce((sum, m) => sum + m.budgetUsd, 0);
        const totalPaidValue = invoices.reduce((sum, inv) => sum + inv.paidUsd, 0);
        
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`TOTAL PRESUPUESTADO: ${renderFmt(totalBudgeted)}`, 14, contentY + 4);
        doc.text(`TOTAL COBRADO: ${renderFmt(totalPaidValue)}`, 14, contentY + 11);
        
        // Tabla de Facturación
        const tableData = invoices.map(i => {
            return [
                i.number,
                new Date(i.issuedAt).toLocaleDateString(),
                i.clientName || '---',
                i.currency,
                renderFmt(i.total, i.currency), 
                renderFmt(i.totalUsd), 
                renderFmt(i.balanceUsd),
                String(i.status || '')
            ];
        });

        autoTable(doc, {
            startY: contentY + 22,
            head: [['Factura', 'Fecha', 'Cliente', 'Divisa', 'Monto Nom.', `Total (${presentationCurrency})`, 'Saldo Pnd.', 'Estado']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [99, 102, 241], fontSize: 8 },
            styles: { fontSize: 8 }
        });
        
        // Pie corporativo HermesAI
        drawPdfBrandFooter(doc, { generatedBy: 'Sistema LegalDoc VE' });
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        const tblFinalY = (doc as any).lastAutoTable.finalY + 10;
        doc.text(`Consolidado en ${presentationCurrency} según tasas vigentes.`, 14, tblFinalY);

        doc.save(`reporte_financiero_${presentationCurrency}_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handleExportCSV = () => {
        const headers = ["Numero", "Fecha", "Cliente", "Asunto", "Moneda", "Monto Original", "Total USD", "Saldo Original", "Saldo USD", "Estado"];
        const rows = invoices.map(i => [
            i.number,
            new Date(i.issuedAt).toLocaleDateString(),
            i.clientName,
            i.matterTitle,
            i.currency,
            i.total,
            i.totalUsd,
            i.balance,
            i.balanceUsd,
            i.status
        ]);
        
        const content = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([content], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_facturacion_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const handleExportExpensesPDF = (filtered: MatterExpense[]) => {
        const doc = new jsPDF();
        
        // Header corporativo HermesAI
        const contentY = drawPdfBrandHeader(doc, {
            reportRef: `RPT-GST-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`,
            subtitle: `CONTROL DE GASTOS — DESGLOSE (${presentationCurrency})`
        });
        
        const totalUsd = filtered.reduce((s, e) => s + e.amountUsd, 0);
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`TOTAL GASTOS CONSOLIDADOS: ${renderFmt(totalUsd)}`, 14, contentY + 4);

        const tableData = filtered.map(exp => {
            const mat = matters.find(m => m.id === exp.matterId);
            return [
                exp.date,
                mat?.title || '---',
                exp.category,
                exp.description,
                exp.currency,
                renderFmt(exp.amount, exp.currency),
                renderFmt(exp.amountUsd)
            ];
        });

        autoTable(doc, {
            startY: contentY + 14,
            head: [['Fecha', 'Asunto', 'Cat.', 'Descripción', 'Divisa', 'Nominal', `Total (${presentationCurrency})`]],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229], fontSize: 8 },
            styles: { fontSize: 7 }
        });
        
        // Pie corporativo HermesAI
        drawPdfBrandFooter(doc, { generatedBy: 'Sistema LegalDoc VE' });

        doc.save(`reporte_gastos_${presentationCurrency}_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const renderClients = () => (
        <div className="premium-card fade-in" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3 style={{ margin: 0, fontWeight: 800 }}>Directorio de Clientes</h3>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ position: 'relative' }}>
                        <SearchIcon size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input type="text" placeholder="Buscar cliente..." style={{ ...inputStyle, paddingLeft: '2.75rem', width: '300px' }} />
                    </div>
                    <button className="btn-primary" onClick={() => { setClientForm({ name: '', idNumber: '', email: '', phone: '', address: '', creditRisk: 'LOW' }); setShowClientModal(true); }}>
                        <Plus size={18} /> Nuevo Cliente
                    </button>
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
                {clients.map(c => (
                    <div key={c.id} style={{ border: '1px solid #f1f5f9', borderRadius: '20px', padding: '1.5rem', transition: 'all 0.2s', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                            <div>
                                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', fontWeight: 800 }}>{c.name}</h4>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{c.idNumber || 'S/ID'}</span>
                            </div>
                            <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, background: c.creditRisk === 'LOW' ? '#dcfce7' : c.creditRisk === 'MEDIUM' ? '#fef9c3' : '#fee2e2', color: c.creditRisk === 'LOW' ? '#166534' : c.creditRisk === 'MEDIUM' ? '#854d0e' : '#991b1b' }}>
                                RIESGO {c.creditRisk}
                            </span>
                        </div>
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            {c.email && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#475569' }}><Mail size={14} /> {c.email}</div>}
                            {c.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#475569' }}><Phone size={14} /> {c.phone}</div>}
                            <button 
                                className="btn-secondary" 
                                style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', marginTop: '0.5rem', width: 'fit-content' }}
                                onClick={() => handleEditClient(c)}
                            >
                                Editar Datos
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderMatters = () => (
        <div className="premium-card fade-in" style={{ padding: '2rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3 style={{ margin: 0, fontWeight: 800 }}>Gestión de Asuntos</h3>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ position: 'relative' }}>
                        <SearchIcon size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input type="text" placeholder="Código o título..." style={{ ...inputStyle, paddingLeft: '2.75rem', width: '300px' }} />
                    </div>
                    <button className="btn-primary" style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem' }} onClick={handleStartSync}>
                        <RefreshCw size={16} /> Sincronizar
                    </button>
                </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left' }}>
                        <th style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b' }}>CÓDIGO / CASO</th>
                        <th style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b' }}>CLIENTE</th>
                        <th style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b' }}>TIPO / FEE</th>
                        <th style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b' }}>PRESUPUESTADO ({presentationCurrency})</th>
                        <th style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b' }}>ESTADO</th>
                        <th style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b' }}>ACCIÓN</th>
                    </tr>
                </thead>
                <tbody>
                    {matters.map(m => (
                        <tr key={m.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '1rem' }}>
                                <div style={{ fontWeight: 800, color: '#1e293b' }}>{m.code || 'S/C'}</div>
                                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{m.title}</div>
                            </td>
                            <td style={{ padding: '1rem', fontSize: '0.9rem', fontWeight: 600 }}>{m.clientName}</td>
                            <td style={{ padding: '1rem' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>{m.type}</div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{m.feeType}</div>
                            </td>
                            <td style={{ padding: '1rem' }}>
                                <div style={{ fontWeight: 800 }}>{renderFmt(m.budgetUsd)}</div>
                                <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Original: {renderFmt(m.budget, m.currency)}</div>
                            </td>
                            <td style={{ padding: '1rem' }}>
                                <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, background: m.status === 'ACTIVE' ? '#e0e7ff' : '#f1f5f9', color: m.status === 'ACTIVE' ? '#4338ca' : '#475569' }}>
                                    {m.status}
                                </span>
                            </td>
                            <td style={{ padding: '1rem' }}>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button 
                                        style={{ border: 'none', background: 'none', color: '#6366f1', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                        onClick={() => handleEditMatter(m)} title="Editar Asunto"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button 
                                        style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                        onClick={() => handleDeleteMatter(m.id)} title="Eliminar Asunto"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                    <button style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer' }}><Eye size={18} /></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderTimeTracking = () => (
        <div className="premium-card fade-in" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3 style={{ margin: 0, fontWeight: 800 }}>Bitácora de Horas</h3>
                <button 
                    className="btn-primary" 
                    style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
                    onClick={() => setShowTimeModal(true)}
                >
                    <Plus size={16} /> Registrar Tiempo
                </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left' }}>
                        <th style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b' }}>FECHA</th>
                        <th style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b' }}>CASO / DESCRIPCIÓN</th>
                        <th style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b' }}>ABOGADO</th>
                        <th style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b' }}>HORAS</th>
                        <th style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b' }}>MONTO ({presentationCurrency})</th>
                        <th style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b' }}>FACTURADO</th>
                    </tr>
                </thead>
                <tbody>
                    {timeEntries.map(e => (
                        <tr key={e.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: 600 }}>{new Date(e.date).toLocaleDateString()}</td>
                            <td style={{ padding: '1rem' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{e.matterTitle}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{e.description}</div>
                            </td>
                             <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{e.lawyerName}</td>
                            <td style={{ padding: '1rem', fontWeight: 800 }}>{e.hours}h</td>
                            <td style={{ padding: '1rem' }}>
                                <div style={{ fontWeight: 800 }}>{renderFmt(e.amountUsd)}</div>
                                <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Rate: {renderFmt(e.rate, e.currency)}/h</div>
                            </td>
                            <td style={{ padding: '1rem' }}>
                                {e.isInvoiced ? <CheckCircle2 size={16} color="#16a34a" /> : <AlertTriangle size={16} color="#f59e0b" />}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderInvoices = () => (
        <div className="premium-card fade-in" style={{ padding: '2rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3 style={{ margin: 0, fontWeight: 800 }}>Historial de Facturación</h3>
                <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={handleExportCSV}>
                    <DownloadIcon size={18} /> Exportar Reporte (.CSV)
                </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left' }}>
                        <th style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b' }}>NÚMERO</th>
                        <th style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b' }}>EMISIÓN / VENC.</th>
                        <th style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b' }}>CLIENTE / ASUNTO</th>
                        <th style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b' }}>TOTAL ({presentationCurrency})</th>
                        <th style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b' }}>PENDIENTE ({presentationCurrency})</th>
                        <th style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b' }}>ESTADO</th>
                        <th style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b' }}>ACCIONES</th>
                    </tr>
                </thead>
                <tbody>
                    {invoices.map(inv => (
                        <tr key={inv.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '1rem', fontWeight: 800 }}>{inv.number}</td>
                            <td style={{ padding: '1rem' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{new Date(inv.issuedAt).toLocaleDateString()}</div>
                                <div style={{ fontSize: '0.7rem', color: inv.status === 'OVERDUE' ? '#e11d48' : '#64748b' }}>Vence: {inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : '—'}</div>
                            </td>
                            <td style={{ padding: '1rem' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{inv.clientName}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{inv.matterTitle}</div>
                            </td>
                            <td style={{ padding: '1rem', fontWeight: 800 }}>
                                <div style={{ fontWeight: 800 }}>{renderFmt(inv.totalUsd)}</div>
                                <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Original: {renderFmt(inv.total, inv.currency)}</div>
                            </td>
                            <td style={{ padding: '1rem', fontWeight: 800, color: inv.balance > 0 ? '#e11d48' : '#16a34a' }}>
                                <div style={{ fontWeight: 800 }}>{renderFmt(inv.balanceUsd)}</div>
                            </td>
                            <td style={{ padding: '1rem' }}>
                                <span className={`status-badge status-${inv.status.toLowerCase()}`}>
                                    {inv.status}
                                </span>
                            </td>
                            <td style={{ padding: '1rem' }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    {inv.balance > 0 && (
                                        <button 
                                            className="btn-primary" 
                                            style={{ padding: '6px 12px', fontSize: '0.65rem' }}
                                            onClick={() => { setSelectedInvoice(inv); setPaymentForm({...paymentForm, amount: inv.balance}); setShowPaymentModal(true); }}
                                        >
                                            Cobrar
                                        </button>
                                    )}
                                    <button 
                                        className="btn-secondary" 
                                        style={{ padding: '6px', fontSize: '0.65rem', display: 'flex', alignItems: 'center' }}
                                        onClick={() => handleEditInvoice(inv)}
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button 
                                        className="btn-secondary" 
                                        style={{ padding: '6px', fontSize: '0.65rem', color: '#ef4444', display: 'flex', alignItems: 'center' }}
                                        onClick={() => handleDeleteInvoice(inv.id)}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderDashboard = () => {
        const totalBudgeted = matters.reduce((sum, m) => sum + m.budgetUsd, 0);
        const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.totalUsd, 0);
        const totalPaid = invoices.reduce((sum, inv) => sum + inv.paidUsd, 0);
        const totalPendingCollect = totalInvoiced - totalPaid;
        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amountUsd, 0);
        
        const rateForGraphs = (presentationCurrency === 'USD') ? 1 : latestRates[`USD_${presentationCurrency}`] || 1;

        // Datos para gráfico de barras (Facturación vs Cobro vs Gastos) en la moneda actual
        const barData = [
            { name: 'Estimado', monto: totalBudgeted * rateForGraphs },
            { name: 'Emitido', monto: totalInvoiced * rateForGraphs },
            { name: 'Cobrado', monto: totalPaid * rateForGraphs },
            { name: 'Gastos', monto: totalExpenses * rateForGraphs }
        ];

        // Distribución de gastos por categoría en la moneda actual
        const pieData = Object.keys(EXPENSE_CATEGORIES).map(catKey => {
            const amount = expenses.filter(e => e.category === catKey).reduce((s, e) => s + e.amountUsd, 0) * rateForGraphs;
            return { name: EXPENSE_CATEGORIES[catKey as ExpenseCategory].label, value: amount, color: EXPENSE_CATEGORIES[catKey as ExpenseCategory].color };
        }).filter(d => d.value > 0);

        return (
            <div style={{ display: 'grid', gap: '2rem' }} className="fade-in">
                {/* BARRA DE CONTROLES FINANCIEROS (MASTER SWITCH) */}
                <div className="premium-card" style={{ padding: '1.25rem 2rem', borderLeft: '6px solid #6366f1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to right, #ffffff, #f8fafc)' }}>
                    <div>
                        <h4 style={{ margin: 0, fontWeight: 800, color: '#1e293b' }}>Controlador de Divisas</h4>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Visualización global reconvertida mediante tasas BCV/Live</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>MOSTRAR TODO EN:</span>
                        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px', gap: '4px' }}>
                            {(['USD', 'EUR', 'VES'] as Currency[]).map(cur => (
                                <button
                                    key={cur}
                                    onClick={() => setPresentationCurrency(cur)}
                                    style={{
                                        padding: '0.5rem 1.25rem',
                                        borderRadius: '10px',
                                        border: 'none',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        background: presentationCurrency === cur ? '#6366f1' : 'transparent',
                                        color: presentationCurrency === cur ? 'white' : '#64748b',
                                        boxShadow: presentationCurrency === cur ? '0 4px 6px -1px rgba(99, 102, 241, 0.4)' : 'none'
                                    }}
                                >
                                    {CURRENCY_SYMBOLS[cur]} {cur}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* KPIs Superiores */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }}>
                    <div className="premium-card" style={{ padding: '1.25rem', borderLeft: '4px solid #6366f1' }}>
                        <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', margin: '0 0 0.5rem 0' }}>ESTIMADO TOTAL ({presentationCurrency})</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>{renderFmt(totalBudgeted)}</h3>
                        <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>Presupuesto total en cartera</p>
                    </div>

                    <div className="premium-card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
                        <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', margin: '0 0 0.5rem 0' }}>COBROS PENDIENTES ({presentationCurrency})</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, color: '#d97706' }}>{renderFmt(totalPendingCollect)}</h3>
                        <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>Por facturas emitidas</p>
                    </div>

                    <div className="premium-card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
                        <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', margin: '0 0 0.5rem 0' }}>LIQUIDEZ REAL ({presentationCurrency})</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, color: '#059669' }}>{renderFmt(totalPaid)}</h3>
                        <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>Ingresos efectivos</p>
                    </div>

                    <div className="premium-card" style={{ padding: '1.25rem', borderLeft: '4px solid #ef4444' }}>
                        <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', margin: '0 0 0.5rem 0' }}>GASTOS OPERATIVOS ({presentationCurrency})</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, color: '#dc2626' }}>{renderFmt(totalExpenses)}</h3>
                        <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>Costos directos del despacho</p>
                    </div>
                </div>

                {/* Gráficos Principales */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
                    <div className="premium-card" style={{ padding: '2rem', height: '400px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h4 style={{ margin: 0, fontWeight: 800 }}>Rendimiento Financiero ({presentationCurrency})</h4>
                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem', fontWeight: 700 }}>
                                <span style={{ color: '#6366f1' }}>■ Facturación</span>
                                <span style={{ color: '#10b981' }}>■ Cobro Real</span>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height="85%">
                            <BarChart data={barData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <Tooltip 
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                    formatter={(value: any) => [`${renderFmt(value / rateForGraphs)}`, `Monto (${presentationCurrency})`]}
                                />
                                <Bar dataKey="monto" radius={[8, 8, 0, 0]}>
                                    {barData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#6366f1' : index === 1 ? '#818cf8' : index === 2 ? '#10b981' : '#ef4444'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="premium-card" style={{ padding: '2rem', height: '400px' }}>
                        <h4 style={{ margin: '0 0 1.5rem 0', fontWeight: 800 }}>Distribución de Gastos</h4>
                        <ResponsiveContainer width="100%" height="80%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: any) => [`${renderFmt(value / rateForGraphs)}`, presentationCurrency]} />
                                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Listados Rápidos */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: '2rem' }}>
                    <div className="premium-card" style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h4 style={{ margin: 0, fontWeight: 800 }}>Últimas Facturas Emitidas</h4>
                            <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: '0.7rem' }} onClick={() => setActiveTab('FACTURAS')}>Ver Todas</button>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #f1f5f9', textAlign: 'left' }}>
                                    <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Filtro / ID</th>
                                    <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Cliente</th>
                                    <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.slice(0, 5).map(inv => (
                                    <tr key={inv.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                        <td style={{ padding: '0.75rem 0.5rem' }}>
                                            <div style={{ fontWeight: 800, fontSize: '0.8rem' }}>{inv.number}</div>
                                            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{new Date(inv.issuedAt).toLocaleDateString()}</div>
                                        </td>
                                        <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>{inv.clientName}</td>
                                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 900, textAlign: 'right', color: '#1e293b' }}>
                                            {CURRENCY_SYMBOLS[inv.currency] || '$'}{inv.total.toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    
                    <div className="premium-card" style={{ padding: '1.5rem' }}>
                        <h4 style={{ margin: '0 0 1.5rem 0', fontWeight: 800 }}>Estado de Portafolio</h4>
                        <div style={{ display: 'grid', gap: '1.25rem' }}>
                            {matters.slice(0, 5).map(m => {
                                const invoiced = invoices.filter(i => i.matterId === m.id).reduce((s, i) => s + i.totalUsd, 0);
                                const pct = (invoiced / m.budgetUsd) * 100;
                                return (
                                    <div key={m.id}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                            <div>
                                                <p style={{ margin: 0, fontWeight: 800, fontSize: '0.8rem', color: '#1e293b' }}>{m.title}</p>
                                                <p style={{ margin: 0, fontSize: '0.65rem', color: '#64748b' }}>{m.clientName}</p>
                                            </div>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#6366f1' }}>{pct.toFixed(0)}%</span>
                                        </div>
                                        <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', background: '#6366f1', width: `${Math.min(pct, 100)}%`, borderRadius: '10px' }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ── GASTOS ────────────────────────────────────────────
    const EXPENSE_CATEGORIES: Record<string, { label: string; color: string; icon: string }> = {
        COURT_FEE:  { label: 'Aranceles / Tasas',   color: '#dc2626', icon: '⚖️' },
        NOTARY:     { label: 'Notaría',              color: '#7c3aed', icon: '📜' },
        EXPERT:     { label: 'Perito / Experto',     color: '#0284c7', icon: '🔬' },
        TRAVEL:     { label: 'Traslados',            color: '#059669', icon: '🚗' },
        PRINTING:   { label: 'Impresiones',          color: '#d97706', icon: '🖨️' },
        APOSTILLE:  { label: 'Apostilla',            color: '#db2777', icon: '🌐' },
        OTHER:      { label: 'Otros',                color: '#64748b', icon: '📎' },
    };

    const handleSaveExpense = async () => {
        if (!expenseForm.matterId || !expenseForm.description || !expenseForm.amountUsd) return;
        setSavingExpense(true);
        try {
            // 1. Subir comprobante si hay archivo seleccionado
            let receiptUrl = expenseForm.receiptUrl;
            if (receiptFile) {
                setUploadingReceipt(true);
                const ext = receiptFile.name.split('.').pop();
                const path = `receipts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                const { data: uploadData, error: uploadErr } = await supabase.storage
                    .from('expense-receipts')
                    .upload(path, receiptFile, { upsert: true });
                setUploadingReceipt(false);
                if (uploadErr) throw new Error('Error subiendo comprobante: ' + uploadErr.message);
                const { data: urlData } = supabase.storage.from('expense-receipts').getPublicUrl(uploadData.path);
                receiptUrl = urlData.publicUrl;
            }
            await expenseService.save({ ...expenseForm, receiptUrl });
            // Recargar
            const expPromises = matters.map(m => expenseService.getByMatter(m.id));
            const expArrays = await Promise.all(expPromises);
            setExpenses(expArrays.flat());
            setShowExpenseModal(false);
            setReceiptFile(null);
            setExpenseForm({ matterId: '', date: new Date().toISOString().split('T')[0], description: '', category: 'OTHER', amount: 0, amountUsd: 0, currency: 'USD', exchangeRate: 1, paidBy: 'FIRM', isReimbursed: false });
        } catch (e: any) {
            alert('Error al guardar gasto: ' + e.message);
        } finally {
            setSavingExpense(false);
            setUploadingReceipt(false);
        }
    };

    const renderExpenses = () => {
        const filtered = expenses.filter(e => 
            !expenseFilterMatter || e.matterId === expenseFilterMatter
        );
        const totalUsd = filtered.reduce((s, e) => s + e.amountUsd, 0);
        const byFirm   = filtered.filter(e => e.paidBy === 'FIRM').reduce((s, e) => s + e.amountUsd, 0);
        const byClient = filtered.filter(e => e.paidBy === 'CLIENT').reduce((s, e) => s + e.amountUsd, 0);
        const pending  = filtered.filter(e => !e.isReimbursed && e.paidBy === 'FIRM').reduce((s, e) => s + e.amountUsd, 0);

        const values = {
            total: renderFmt(totalUsd),
            firm: renderFmt(byFirm),
            client: renderFmt(byClient),
            pend: renderFmt(pending)
        };


        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
                    {[
                        { label: `Total Gastos (${presentationCurrency})`, value: values.total, color: '#6366f1', sub: `${filtered.length} registros` },
                        { label: `Pagados x Despacho (${presentationCurrency})`, value: values.firm, color: '#dc2626', sub: 'Financiados por el despacho' },
                        { label: `Pagados x Cliente (${presentationCurrency})`, value: values.client, color: '#059669', sub: 'A cargo del cliente' },
                        { label: `Sin Reembolsar (${presentationCurrency})`, value: values.pend, color: '#d97706', sub: 'Pendiente de reembolso' },
                    ].map((kpi, i) => (
                        <div key={i} className="premium-card" style={{ padding: '1.5rem', borderLeft: `4px solid ${kpi.color}` }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</p>
                            <p style={{ margin: '0.5rem 0 0', fontSize: '1.6rem', fontWeight: 900, color: kpi.color }}>{kpi.value}</p>
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>{kpi.sub}</p>
                        </div>
                    ))}
                </div>

                {/* Toolbar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Filter size={16} color="#64748b" />
                        <select
                            value={expenseFilterMatter}
                            onChange={e => setExpenseFilterMatter(e.target.value)}
                            style={{ ...inputStyle, width: '260px', padding: '0.6rem 1rem' }}
                        >
                            <option value="">— Todos los asuntos —</option>
                            {matters.map(m => (
                                <option key={m.id} value={m.id}>{m.title}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        {/* Exportar PDF */}
                        <button
                            className="btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            onClick={() => handleExportExpensesPDF(filtered)}
                            disabled={filtered.length === 0}
                        >
                            <FileDown size={16}/> Exportar PDF
                        </button>
                        {/* Facturar gastos seleccionados */}
                        {selectedExpenses.length > 0 && (
                            <button
                                className="btn-secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', borderColor: '#6366f1', color: '#6366f1' }}
                                onClick={() => setShowInvoiceFromExpenses(true)}
                            >
                                <Receipt size={16}/> Facturar ({selectedExpenses.length})
                            </button>
                        )}
                        <button
                            className="btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            onClick={() => {
                                setExpenseForm({ matterId: expenseFilterMatter || '', date: new Date().toISOString().split('T')[0], description: '', category: 'OTHER', amount: 0, amountUsd: 0, currency: 'USD', exchangeRate: 1, paidBy: 'FIRM', isReimbursed: false });
                                setReceiptFile(null);
                                setShowExpenseModal(true);
                            }}
                        >
                            <Plus size={18}/> Registrar Gasto
                        </button>
                    </div>
                </div>

                {/* Tabla */}
                <div className="premium-card" style={{ overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc' }}>
                                <th style={{ padding: '1rem', width: '40px' }}>
                                    <input type="checkbox"
                                        checked={filtered.length > 0 && selectedExpenses.length === filtered.length}
                                        onChange={e => setSelectedExpenses(e.target.checked ? filtered.map(x => x.id) : [])}
                                    />
                                </th>
                                {['Fecha', 'Asunto', 'Categoría', 'Descripción', 'Pagado por', `Monto (${presentationCurrency})`, 'Reembolsado', 'Comprobante', ''].map((h, i) => (
                                    <th key={i} style={{ padding: '1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No hay gastos registrados. Pulsa «Registrar Gasto» para comenzar.</td></tr>
                            ) : filtered.map(exp => {
                                const cat = EXPENSE_CATEGORIES[exp.category] || EXPENSE_CATEGORIES.OTHER;
                                const matter = matters.find(m => m.id === exp.matterId);
                                const isSelected = selectedExpenses.includes(exp.id);
                                return (
                                    <tr key={exp.id} style={{ borderBottom: '1px solid #f1f5f9', background: isSelected ? '#f5f7ff' : 'white' }}>
                                        <td style={{ padding: '0.875rem 1rem' }}>
                                            <input type="checkbox" checked={isSelected}
                                                onChange={e => setSelectedExpenses(
                                                    e.target.checked ? [...selectedExpenses, exp.id] : selectedExpenses.filter(id => id !== exp.id)
                                                )}
                                            />
                                        </td>
                                        <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: '#64748b' }}>{exp.date}</td>
                                        <td style={{ padding: '0.875rem 1rem', fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>{matter?.title ?? '—'}</td>
                                        <td style={{ padding: '0.875rem 1rem' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: `${cat.color}15`, color: cat.color, fontWeight: 700, fontSize: '0.72rem', padding: '3px 10px', borderRadius: '20px' }}>
                                                {cat.icon} {cat.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.875rem 1rem', fontSize: '0.82rem', maxWidth: '180px' }}>{exp.description}</td>
                                        <td style={{ padding: '0.875rem 1rem' }}>
                                            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: exp.paidBy === 'FIRM' ? '#dc2626' : '#059669' }}>
                                                {exp.paidBy === 'FIRM' ? '🏢 Despacho' : '👤 Cliente'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.875rem 1rem' }}>
                                            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
                                                {renderFmt(exp.amountUsd)}
                                            </div>
                                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>
                                                Original: {renderFmt(exp.amount, exp.currency)}
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.875rem 1rem' }}>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: exp.isReimbursed ? '#059669' : '#d97706' }}>
                                                {exp.isReimbursed ? '✓ Sí' : '⏳ Pendiente'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.875rem 1rem' }}>
                                            {exp.receiptUrl ? (
                                                <a href={exp.receiptUrl} target="_blank" rel="noopener noreferrer"
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#6366f1', fontWeight: 700, textDecoration: 'none' }}>
                                                    <Paperclip size={12}/> Ver
                                                </a>
                                            ) : <span style={{ color: '#cbd5e1', fontSize: '0.72rem' }}>—</span>}
                                        </td>
                                        <td style={{ padding: '0.875rem 1rem' }}>
                                            <button
                                                onClick={() => { setExpenseForm({ ...exp, matterId: exp.matterId ?? '', date: exp.date ?? new Date().toISOString().split('T')[0], description: exp.description ?? '', category: exp.category ?? 'OTHER', amount: exp.amount ?? exp.amountUsd ?? 0, paidBy: exp.paidBy ?? 'FIRM', isReimbursed: exp.isReimbursed ?? false }); setReceiptFile(null); setShowExpenseModal(true); }}
                                                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6366f1' }}
                                            ><Edit2 size={14}/></button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Modal */}
                {showExpenseModal && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                        <div className="premium-card fade-in" style={{ width: '100%', maxWidth: '520px', padding: '2.5rem', background: 'white' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.2rem' }}>
                                    {expenseForm.id ? '✏️ Editar Gasto' : '🧾 Registrar Gasto'}
                                </h3>
                                <button onClick={() => setShowExpenseModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20}/></button>
                            </div>
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.73rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.4rem' }}>ASUNTO / CASO *</label>
                                    <select value={expenseForm.matterId || ''} onChange={e => setExpenseForm({...expenseForm, matterId: e.target.value})} style={inputStyle}>
                                        <option value="">Seleccionar asunto...</option>
                                        {matters.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.73rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.4rem' }}>FECHA *</label>
                                        <input type="date" value={expenseForm.date || ''} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} style={inputStyle}/>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.73rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.4rem' }}>MONEDA</label>
                                        <select
                                            value={expenseCurrency}
                                            onChange={e => {
                                                const c = e.target.value as 'USD'|'EUR'|'VES';
                                                setExpenseCurrency(c);
                                                setExpenseForm({...expenseForm, currency: c, exchangeRate: c === 'USD' ? 1 : expenseForm.exchangeRate});
                                            }}
                                            style={{ ...inputStyle, fontWeight: 700 }}
                                        >
                                            <option value="USD">🇺🇸 USD — Dólar</option>
                                            <option value="EUR">🇪🇺 EUR — Euro</option>
                                            <option value="VES">🇻🇪 Bs. — Bolívar</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: expenseCurrency === 'USD' ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.73rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.4rem' }}>
                                            MONTO EN {expenseCurrency === 'VES' ? 'Bs.' : expenseCurrency} *
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>
                                                {expenseCurrency === 'USD' ? '$' : expenseCurrency === 'EUR' ? '€' : 'Bs.'}
                                            </span>
                                            <input
                                                type="number" min="0" step="0.01"
                                                value={expenseForm.amount || expenseForm.amountUsd || 0}
                                                onChange={e => setExpenseForm({...expenseForm, amount: parseFloat(e.target.value) || 0, amountUsd: expenseCurrency === 'USD' ? parseFloat(e.target.value) || 0 : expenseForm.amountUsd})}
                                                style={{ ...inputStyle, paddingLeft: expenseCurrency === 'VES' ? '40px' : '32px' }}
                                            />
                                        </div>
                                    </div>
                                    {expenseCurrency !== 'USD' && (
                                        <div>
                                            <label style={{ fontSize: '0.73rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.4rem' }}>
                                                TASA {expenseCurrency}/USD
                                            </label>
                                            <input
                                                type="number" min="0" step="0.01"
                                                placeholder={expenseCurrency === 'EUR' ? 'Ej: 1.08' : 'Ej: 36.50'}
                                                value={expenseForm.exchangeRate || ''}
                                                onChange={e => setExpenseForm({...expenseForm, exchangeRate: parseFloat(e.target.value) || 1})}
                                                style={inputStyle}
                                            />
                                            {(expenseForm.amount || 0) > 0 && (expenseForm.exchangeRate || 0) > 0 && (
                                                <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#6366f1', fontWeight: 700 }}>
                                                    ≈ ${((expenseForm.amount || 0) / (expenseForm.exchangeRate || 1)).toFixed(2)} USD
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.73rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.4rem' }}>CATEGORÍA</label>
                                    <select value={expenseForm.category || 'OTHER'} onChange={e => setExpenseForm({...expenseForm, category: e.target.value as ExpenseCategory})} style={inputStyle}>
                                        {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                                            <option key={k} value={k}>{v.icon} {v.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.73rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.4rem' }}>DESCRIPCIÓN *</label>
                                    <input value={expenseForm.description || ''} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} placeholder="Ej: Arancel de presentación ante tribunal..." style={inputStyle}/>
                                </div>
                                {/* COMPROBANTE */}
                                <div>
                                    <label style={{ fontSize: '0.73rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.4rem' }}>COMPROBANTE (PDF / Imagen)</label>
                                    <div style={{ border: '2px dashed #e2e8f0', borderRadius: '12px', padding: '1rem', textAlign: 'center', cursor: 'pointer', background: receiptFile ? '#f0fdf4' : '#fafafa' }}
                                        onClick={() => document.getElementById('receipt-file-input')?.click()}>
                                        <input id="receipt-file-input" type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                                            onChange={e => setReceiptFile(e.target.files?.[0] || null)}/>
                                        {receiptFile ? (
                                            <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 700 }}>✓ {receiptFile.name}</span>
                                        ) : expenseForm.receiptUrl ? (
                                            <span style={{ fontSize: '0.8rem', color: '#6366f1' }}><Paperclip size={12}/> Comprobante adjunto — click para reemplazar</span>
                                        ) : (
                                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}><Paperclip size={14}/> Click para adjuntar comprobante</span>
                                        )}
                                    </div>
                                    {expenseForm.receiptUrl && !receiptFile && (
                                        <a href={expenseForm.receiptUrl} target="_blank" rel="noopener noreferrer"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#6366f1', marginTop: '0.4rem' }}>
                                            <ExternalLink size={12}/> Ver comprobante actual
                                        </a>
                                    )}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.73rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.4rem' }}>PAGADO POR</label>
                                        <select value={expenseForm.paidBy || 'FIRM'} onChange={e => setExpenseForm({...expenseForm, paidBy: e.target.value as 'FIRM'|'CLIENT'})} style={inputStyle}>
                                            <option value="FIRM">🏢 Despacho</option>
                                            <option value="CLIENT">👤 Cliente</option>
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '1.5rem' }}>
                                        <input type="checkbox" id="isReimbursed" checked={expenseForm.isReimbursed || false} onChange={e => setExpenseForm({...expenseForm, isReimbursed: e.target.checked})} style={{ width: '16px', height: '16px' }}/>
                                        <label htmlFor="isReimbursed" style={{ fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>Ya reembolsado</label>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                                <button onClick={() => setShowExpenseModal(false)} style={{ padding: '0.75rem 1.5rem', border: '1px solid #e2e8f0', borderRadius: '12px', background: 'white', cursor: 'pointer', fontWeight: 700 }}>Cancelar</button>
                                <button onClick={handleSaveExpense} disabled={savingExpense} className="btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
                                    {savingExpense ? <RefreshCw size={16} className="animate-spin"/> : <Receipt size={16}/>}
                                    {' '}{savingExpense ? 'Guardando...' : 'Guardar Gasto'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {/* Modal — Facturar Gastos Seleccionados */}
                {showInvoiceFromExpenses && (() => {
                    const selExp = expenses.filter(e => selectedExpenses.includes(e.id));
                    const subtotal = selExp.reduce((s, e) => s + e.amountUsd, 0);
                    const matterForInvoice = matters.find(m => m.id === selExp[0]?.matterId);
                    const clientForInvoice = clients.find(c => c.id === matterForInvoice?.clientId);
                    return (
                        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 }}>
                            <div className="premium-card fade-in" style={{ width: '100%', maxWidth: '500px', padding: '2.5rem', background: 'white' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                    <h3 style={{ margin: 0, fontWeight: 900 }}>🧾 Facturar Gastos Seleccionados</h3>
                                    <button onClick={() => setShowInvoiceFromExpenses(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20}/></button>
                                </div>
                                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                                    <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Resumen</p>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#475569' }}>Asunto:</span>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{matterForInvoice?.title ?? '—'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#475569' }}>Cliente:</span>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{clientForInvoice?.name ?? '—'}</span>
                                    </div>
                                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', display: 'grid', gap: '0.35rem', marginBottom: '0.75rem' }}>
                                        {selExp.map((e, i) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b' }}>
                                                <span>• {e.description}</span>
                                                <span style={{ fontWeight: 700 }}>{CURRENCY_SYMBOLS[e.currency] || '$'}{e.amount.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '2px solid #e2e8f0' }}>
                                        <span style={{ fontWeight: 800 }}>TOTAL (USD)</span>
                                        <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#6366f1' }}>{CURRENCY_SYMBOLS['USD']}{subtotal.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                    <button onClick={() => setShowInvoiceFromExpenses(false)} style={{ padding: '0.75rem 1.5rem', border: '1px solid #e2e8f0', borderRadius: '12px', background: 'white', cursor: 'pointer', fontWeight: 700 }}>Cancelar</button>
                                    <button
                                        className="btn-primary"
                                        disabled={creatingExpenseInvoice || !matterForInvoice || !clientForInvoice}
                                        onClick={async () => {
                                            if (!matterForInvoice || !clientForInvoice) { alert('Los gastos deben pertenecer al mismo asunto'); return; }
                                            setCreatingExpenseInvoice(true);
                                            try {
                                                const num = `EXP-${Date.now().toString().slice(-6)}`;
                                                await invoiceService.save({
                                                    number: num, matterId: matterForInvoice.id, clientId: clientForInvoice.id,
                                                    type: 'EXPENSE', status: 'SENT', subtotalUsd: subtotal,
                                                    taxPct: 0, islrPct: 0,
                                                    notes: `Gastos procesales: ${selExp.map(e => e.description).join(', ')}`,
                                                    issuedAt: new Date().toISOString().split('T')[0],
                                                    dueAt: new Date(Date.now() + 15*864e5).toISOString().split('T')[0],
                                                });
                                                setInvoices(await invoiceService.getAll());
                                                setSelectedExpenses([]);
                                                setShowInvoiceFromExpenses(false);
                                                alert(`✅ Factura ${num} generada`);
                                            } catch(e: any) { alert('Error: ' + (e as any).message); }
                                            finally { setCreatingExpenseInvoice(false); }
                                        }}
                                        style={{ padding: '0.75rem 1.5rem' }}
                                    >
                                        {creatingExpenseInvoice ? <RefreshCw size={16}/> : <Receipt size={16}/>}
                                        {' '}{creatingExpenseInvoice ? 'Generando...' : 'Emitir Factura'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>
        );
    };





    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                        Honorarios <span style={{ color: '#6366f1' }}>& Facturación</span>
                    </h1>
                    <p style={{ color: '#64748b', margin: '0.5rem 0 0 0' }}>Administración operativa global y control de cobros</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    {/* Widget rápido de tasas */}
                    {latestRates['USD_VES'] > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.76rem', fontWeight: 700, color: '#166534', cursor: 'pointer' }}
                            onClick={() => setShowRatesModal(true)}>
                            <ArrowLeftRight size={14}/>
                            {latestRates['USD_VES'] > 0 && <span>{CURRENCY_SYMBOLS['USD']}1 = {CURRENCY_SYMBOLS['VES']}{latestRates['USD_VES'].toLocaleString()}</span>}
                            {latestRates['EUR_VES'] > 0 && <span style={{ borderLeft: '1px solid #bbf7d0', paddingLeft: '0.5rem' }}>{CURRENCY_SYMBOLS['EUR']}1 = {CURRENCY_SYMBOLS['VES']}{latestRates['EUR_VES'].toLocaleString()}</span>}
                        </div>
                    )}
                    <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', borderColor: '#059669', color: '#059669' }} onClick={() => setShowRatesModal(true)}>
                        <DollarSign size={18} /> Tasas
                    </button>
                    <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setShowForensicModal(true)}>
                        <TrendingUp size={18} /> Reporte Forense
                    </button>
                    <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setShowInvoiceModal(true)}>
                        <Plus size={18} /> Nueva Factura
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', background: '#f1f5f9', padding: '0.4rem', borderRadius: '16px', width: 'fit-content' }}>
                {[
                    { id: 'DASHBOARD', label: 'Dashboard', icon: TrendingUp },
                    { id: 'CLIENTES', label: 'Clientes', icon: Users },
                    { id: 'CASOS', label: 'Casos / Asuntos', icon: Briefcase },
                    { id: 'TIME', label: 'Time Tracking', icon: Clock },
                    { id: 'FACTURAS', label: 'Facturación', icon: FileText },
                    { id: 'GASTOS', label: 'Gastos', icon: Receipt }
                ].map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as Tab)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '0.75rem 1.25rem', border: 'none', borderRadius: '12px',
                            background: activeTab === tab.id ? 'white' : 'transparent',
                            color: activeTab === tab.id ? '#6366f1' : '#64748b',
                            fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
                            boxShadow: activeTab === tab.id ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        <tab.icon size={18} /> {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ padding: '4rem', textAlign: 'center' }}>
                    <p>Cargando datos operativos...</p>
                </div>
            ) : (
                <div className="fade-in">
                    {activeTab === 'DASHBOARD' && renderDashboard()}
                    {activeTab === 'CLIENTES' && renderClients()}
                    {activeTab === 'CASOS' && renderMatters()}
                    {activeTab === 'TIME' && renderTimeTracking()}
                    {activeTab === 'FACTURAS' && renderInvoices()}
                    {activeTab === 'GASTOS' && renderExpenses()}
                </div>
            )}

            {showSyncModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                    <div className="premium-card fade-in" style={{ width: '100%', maxWidth: '500px', padding: '2.5rem', background: 'white' }}>
                        <h2 style={{ margin: '0 0 0.5rem 0', fontWeight: 900 }}>Sincronizador Inteligente</h2>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '2rem' }}>Seleccione la fuente judicial o legal para habilitar el control de honorarios.</p>
                        
                        <div style={{ display: 'grid', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Fuente de Origen</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <button 
                                        onClick={() => { setSyncSource('EXPEDIENTE'); setSyncSelection(''); }}
                                        style={{ padding: '1rem', borderRadius: '12px', border: syncSource === 'EXPEDIENTE' ? '2px solid #6366f1' : '1px solid #e2e8f0', background: syncSource === 'EXPEDIENTE' ? '#f5f7ff' : 'white', cursor: 'pointer', fontWeight: 700 }}
                                    >
                                        <Gavel size={20} style={{ display: 'block', margin: '0 auto 8px', color: '#6366f1' }} />
                                        Expediente
                                    </button>
                                    <button 
                                        onClick={() => { setSyncSource('CONTRATO'); setSyncSelection(''); }}
                                        style={{ padding: '1rem', borderRadius: '12px', border: syncSource === 'CONTRATO' ? '2px solid #6366f1' : '1px solid #e2e8f0', background: syncSource === 'CONTRATO' ? '#f5f7ff' : 'white', cursor: 'pointer', fontWeight: 700 }}
                                    >
                                        <FileSignature size={20} style={{ display: 'block', margin: '0 auto 8px', color: '#6366f1' }} />
                                        Contrato
                                    </button>
                                </div>
                            </div>

                            {syncSource && (
                                <div className="fade-in">
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Seleccionar {syncSource.toLowerCase()}</label>
                                    <select 
                                        style={inputStyle} 
                                        value={syncSelection} 
                                        onChange={(e) => setSyncSelection(e.target.value)}
                                    >
                                        <option value="">— Seleccionar —</option>
                                        {syncSource === 'EXPEDIENTE' ? (
                                            availableExpedientes.map(e => <option key={e.id} value={e.id}>{e.numeroExpediente || 'S/N'} | {e.parteActora}</option>)
                                        ) : (
                                            availableContracts.map(c => <option key={c.id} value={c.id}>{c.title}</option>)
                                        )}
                                    </select>
                                    {syncSource === 'EXPEDIENTE' && availableExpedientes.length === 0 && <p style={{ fontSize: '0.75rem', color: '#e11d48', marginTop: '4px' }}>No hay expedientes pendientes.</p>}
                                    {syncSource === 'CONTRATO' && availableContracts.length === 0 && <p style={{ fontSize: '0.75rem', color: '#e11d48', marginTop: '4px' }}>No hay contratos pendientes.</p>}
                                </div>
                            )}

                            {syncSelection && (
                                <div className="fade-in">
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Vincular a Cliente del Despacho</label>
                                    <select 
                                        style={inputStyle} 
                                        value={syncClientId} 
                                        onChange={(e) => setSyncClientId(e.target.value)}
                                    >
                                        <option value="">— Seleccionar Cliente —</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    {clients.length === 0 && <p style={{ fontSize: '0.75rem', color: '#e11d48', marginTop: '4px' }}>Debe registrar al menos un cliente primero.</p>}
                                </div>
                            )}

                            {syncSelection && (
                                <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem' }}>ESQUEMA (FEE)</label>
                                        <select style={inputStyle} value={syncFeeType} onChange={(e: any) => setSyncFeeType(e.target.value)}>
                                            <option value="FIXED">Monto Fijo</option>
                                            <option value="HOURLY">Por Horas</option>
                                            <option value="CONTINGENCY">Cuota Litis</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem' }}>PRESUPUESTO ({CURRENCY_SYMBOLS['USD']})</label>
                                        <input type="number" style={inputStyle} value={syncBudget} onChange={(e) => setSyncBudget(Number(e.target.value))} />
                                    </div>
                                </div>
                            )}
                            
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowSyncModal(false)}>Cancelar</button>
                                <button 
                                    className="btn-primary" 
                                    style={{ flex: 2 }} 
                                    disabled={!syncSelection || !syncClientId || syncing}
                                    onClick={handleSync}
                                >
                                    {syncing ? 'Sincronizando...' : 'Habilitar Cobro'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showClientModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                    <div className="premium-card fade-in" style={{ width: '100%', maxWidth: '600px', padding: '2.5rem', background: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0, fontWeight: 900 }}>{clientForm.id ? 'Actualizar Cliente' : 'Nuevo Cliente'}</h2>
                            <button onClick={() => { setShowClientModal(false); setClientForm({ name: '', idNumber: '', email: '', phone: '', address: '', creditRisk: 'LOW' }); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <Plus size={24} style={{ transform: 'rotate(45deg)' }} />
                            </button>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem' }}>NOMBRE O RAZÓN SOCIAL</label>
                                <input 
                                    type="text" style={inputStyle} 
                                    value={clientForm.name || ''} 
                                    onChange={e => setClientForm({...clientForm, name: e.target.value})}
                                    placeholder="Ej. Inversiones Globales C.A."
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem' }}>ID / RIF / CÉDULA</label>
                                <input 
                                    type="text" style={inputStyle} 
                                    value={clientForm.idNumber || ''} 
                                    onChange={e => setClientForm({...clientForm, idNumber: e.target.value})}
                                    placeholder="J-12345678-9"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem' }}>NIVEL DE RIESGO</label>
                                <select 
                                    style={inputStyle} 
                                    value={clientForm.creditRisk || 'LOW'}
                                    onChange={e => setClientForm({...clientForm, creditRisk: e.target.value as any})}
                                >
                                    <option value="LOW">Bajo</option>
                                    <option value="MEDIUM">Medio</option>
                                    <option value="HIGH">Alto</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem' }}>CORREO ELECTRÓNICO</label>
                                <input 
                                    type="email" style={inputStyle} 
                                    value={clientForm.email || ''} 
                                    onChange={e => setClientForm({...clientForm, email: e.target.value})}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem' }}>TELÉFONO</label>
                                <input 
                                    type="text" style={inputStyle} 
                                    value={clientForm.phone || ''} 
                                    onChange={e => setClientForm({...clientForm, phone: e.target.value})}
                                />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem' }}>DIRECCIÓN FISCAL</label>
                                <textarea 
                                    style={{ ...inputStyle, height: '80px', resize: 'none' }} 
                                    value={clientForm.address || ''} 
                                    onChange={e => setClientForm({...clientForm, address: e.target.value})}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowClientModal(false); setClientForm({ name: '', idNumber: '', email: '', phone: '', address: '', creditRisk: 'LOW' }); }}>Cancelar</button>
                            <button 
                                className="btn-primary" style={{ flex: 2 }} 
                                disabled={!clientForm.name || savingClient}
                                onClick={handleCreateClient}
                            >
                                {savingClient ? 'Guardando...' : clientForm.id ? 'Actualizar Cliente' : 'Crear Cliente'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showInvoiceModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                    <div className="premium-card fade-in" style={{ width: '100%', maxWidth: '540px', padding: '2.5rem', background: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0, fontWeight: 900 }}>Generar Factura</h2>
                            <button onClick={() => setShowInvoiceModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <Plus size={24} style={{ transform: 'rotate(45deg)' }} />
                            </button>
                        </div>

                        <div style={{ display: 'grid', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem' }}>ASUNTO / CASO ORIGEN</label>
                                <select 
                                    style={inputStyle} 
                                    value={selectedMatterId}
                                    onChange={e => setSelectedMatterId(e.target.value)}
                                >
                                    <option value="">— Seleccionar Asunto —</option>
                                    {matters.map(m => (
                                        <option key={m.id} value={m.id}>{m.title} ({m.clientName})</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem' }}>Nº FACTURA (OPCIONAL)</label>
                                    <input 
                                        type="text" style={inputStyle} 
                                        value={invoiceData.number || ''}
                                        onChange={e => setInvoiceData({...invoiceData, number: e.target.value})}
                                        placeholder="Ej. F-001"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem' }}>VENCIMIENTO (DÍAS)</label>
                                    <input 
                                        type="number" style={inputStyle} 
                                        value={invoiceData.dueDays}
                                        onChange={e => setInvoiceData({...invoiceData, dueDays: Number(e.target.value)})}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem' }}>MONEDA</label>
                                    <select 
                                        style={inputStyle} 
                                        value={invoiceData.currency}
                                        onChange={e => {
                                            const c = e.target.value as Currency;
                                            setInvoiceData({...invoiceData, currency: c, exchangeRate: c === 'USD' ? 1 : (latestRates[`${c}_VES`] / latestRates['USD_VES']) || 1});
                                        }}
                                    >
                                        <option value="USD">🇺🇸 USD — Dólar</option>
                                        <option value="EUR">🇪🇺 EUR — Euro</option>
                                        <option value="VES">🇻🇪 Bs. — Bolívar</option>
                                    </select>
                                </div>
                                {invoiceData.currency !== 'USD' && (
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem' }}>TASA {invoiceData.currency}/USD</label>
                                        <input 
                                            type="number" step="0.0001" style={inputStyle} 
                                            value={invoiceData.exchangeRate}
                                            onChange={e => setInvoiceData({...invoiceData, exchangeRate: Number(e.target.value)})}
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem' }}>
                                    MONTO TOTAL ({CURRENCY_SYMBOLS[invoiceData.currency] || '$'})
                                </label>
                                <input 
                                    type="number" style={{ ...inputStyle, fontSize: '1.5rem', fontWeight: 900, textAlign: 'center', color: '#6366f1' }}
                                    value={invoiceData.amount}
                                    onChange={e => setInvoiceData({...invoiceData, amount: Number(e.target.value)})}
                                />
                                {invoiceData.currency !== 'USD' && invoiceData.amount > 0 && (
                                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#64748b', textAlign: 'center' }}>
                                        ≈ {CURRENCY_SYMBOLS['USD']}{ (invoiceData.amount / (invoiceData.exchangeRate || 1)).toLocaleString() } USD
                                    </p>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
                            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowInvoiceModal(false)}>Cancelar</button>
                            <button 
                                className="btn-primary" style={{ flex: 2 }} 
                                disabled={!selectedMatterId || invoiceData.amount <= 0 || creatingInvoice}
                                onClick={handleCreateInvoice}
                            >
                                {creatingInvoice ? 'Generando...' : 'Emitir Factura'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showForensicModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                    <div className="premium-card fade-in" style={{ width: '100%', maxWidth: '800px', padding: '2.5rem', background: 'white', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <div>
                                <h2 style={{ margin: 0, fontWeight: 900 }}>Analítica Forense Financiera</h2>
                                <p style={{ margin: 0, color: '#64748b' }}>Estado del despacho al {new Date().toLocaleDateString()}</p>
                            </div>
                            <button onClick={() => setShowForensicModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <Plus size={24} style={{ transform: 'rotate(45deg)' }} />
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            <div style={{ border: '1px solid #f1f5f9', padding: '1.5rem', borderRadius: '16px' }}>
                                <h4 style={{ margin: '0 0 1rem 0' }}>Matriz de Riesgo de Cobro</h4>
                                <div style={{ display: 'grid', gap: '0.75rem' }}>
                                    {['HIGH', 'MEDIUM', 'LOW'].map(risk => {
                                        const count = clients.filter(c => c.creditRisk === risk).length;
                                        return (
                                            <div key={risk} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{ flex: 1, height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${(count / (clients.length || 1)) * 100}%`, height: '100%', background: risk === 'HIGH' ? '#ef4444' : risk === 'MEDIUM' ? '#f59e0b' : '#10b981' }} />
                                                </div>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 800, width: '60px' }}>{risk}: {count}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ border: '1px solid #f1f5f9', padding: '1.5rem', borderRadius: '16px' }}>
                                <h4 style={{ margin: '0 0 1rem 0' }}>Eficiencia Operativa</h4>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 900, color: '#6366f1' }}>
                                        {timeEntries.reduce((acc, curr) => acc + curr.hours, 0).toFixed(1)}h
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Horas registradas este mes</p>
                                </div>
                            </div>

                            <div style={{ gridColumn: 'span 2', border: '1px solid #f1f5f9', padding: '1.5rem', borderRadius: '16px', background: '#f8fafc' }}>
                                <h4 style={{ margin: '0 0 1rem 0' }}>Proyección de Liquidez (USD)</h4>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Pendiente por cobrar</p>
                                        <h3 style={{ margin: 0, color: '#ef4444' }}>{CURRENCY_SYMBOLS['USD']}{invoices.reduce((acc, curr) => acc + curr.balanceUsd, 0).toLocaleString()}</h3>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Facturado (MTD)</p>
                                        <h3 style={{ margin: 0 }}>{CURRENCY_SYMBOLS['USD']}{invoices.reduce((acc, curr) => acc + curr.totalUsd, 0).toLocaleString()}</h3>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem' }}>
                            <button 
                                className="btn-primary" 
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                onClick={handleExportPDF}
                            >
                                <DownloadIcon size={18} /> Exportar Reporte Certificado (PDF)
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {showPaymentModal && selectedInvoice && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                    <div className="premium-card fade-in" style={{ width: '100%', maxWidth: '500px', padding: '2.5rem', background: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0, fontWeight: 900 }}>Registrar Cobro</h2>
                            <button onClick={() => setShowPaymentModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <Plus size={24} style={{ transform: 'rotate(45deg)' }} />
                            </button>
                        </div>
                        
                        <p style={{ margin: '-1rem 0 1.5rem 0', color: '#64748b', fontSize: '0.9rem' }}>
                            Factura: <strong>{selectedInvoice.number}</strong> | Pendiente: <strong style={{ color: '#ef4444' }}>{CURRENCY_SYMBOLS[selectedInvoice.currency] || '$'}{selectedInvoice.balance.toLocaleString()}</strong>
                        </p>

                        <div style={{ display: 'grid', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem' }}>MÉTODO DE PAGO</label>
                                <select 
                                    style={inputStyle} 
                                    value={paymentForm.method} 
                                    onChange={e => setPaymentForm({...paymentForm, method: e.target.value as any})}
                                >
                                    <option value="TRANSFER">Transferencia Bancaria</option>
                                    <option value="ZELLE">Zelle / Divisas</option>
                                    <option value="CASH">Efectivo</option>
                                    <option value="CRYPTO">Crypto / USDT</option>
                                    <option value="CHECK">Cheque</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem' }}>MONTO A COBRAR ({CURRENCY_SYMBOLS[selectedInvoice.currency] || '$'})</label>
                                <input 
                                    type="number" step="0.01" style={{ ...inputStyle, fontSize: '1.25rem', fontWeight: 900, color: '#16a34a' }}
                                    value={paymentForm.amount}
                                    onChange={e => setPaymentForm({...paymentForm, amount: Number(e.target.value)})}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem' }}>FECHA DE PAGO</label>
                                    <input 
                                        type="date" style={inputStyle} 
                                        value={paymentForm.date}
                                        onChange={e => setPaymentForm({...paymentForm, date: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem' }}>REFERENCIA / NOTAS</label>
                                <input 
                                    type="text" style={inputStyle} 
                                    value={paymentForm.reference || ''}
                                    onChange={e => setPaymentForm({...paymentForm, reference: e.target.value})}
                                    placeholder="Nº Confirmación o Banco"
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
                            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowPaymentModal(false)}>Cancelar</button>
                            <button 
                                className="btn-primary" style={{ flex: 2 }} 
                                disabled={paymentForm.amount <= 0 || savingPayment}
                                onClick={handleRegisterPayment}
                            >
                                {savingPayment ? 'Registrando...' : 'Confirmar Cobro'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {showTimeModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                    <div className="premium-card fade-in" style={{ width: '100%', maxWidth: '500px', padding: '2.5rem', background: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0, fontWeight: 900 }}>Bitácora de Horas</h2>
                            <button onClick={() => setShowTimeModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <Plus size={24} style={{ transform: 'rotate(45deg)' }} />
                            </button>
                        </div>
                        
                        <div style={{ display: 'grid', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem' }}>ASUNTO / CASO</label>
                                <select style={inputStyle} value={timeForm.matterId || ''} onChange={e => setTimeForm({...timeForm, matterId: e.target.value})}>
                                    <option value="">— Seleccionar —</option>
                                    {matters.map(m => <option key={m.id} value={m.id}>{m.title} ({m.clientName})</option>)}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem' }}>ABOGADO ENCARGADO</label>
                                <select style={inputStyle} value={timeForm.lawyerId || ''} onChange={e => setTimeForm({...timeForm, lawyerId: e.target.value})}>
                                    <option value="">— Seleccionar —</option>
                                    {lawyers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem' }}>HORAS</label>
                                    <input type="number" step="0.5" style={inputStyle} value={timeForm.hours || 0} onChange={e => setTimeForm({...timeForm, hours: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem' }}>MONEDA</label>
                                    <select style={inputStyle} value={timeForm.currency} onChange={e => setTimeForm({...timeForm, currency: e.target.value as any})}>
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="VES">VES</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem' }}>RATE ({CURRENCY_SYMBOLS[timeForm.currency]})</label>
                                    <input type="number" style={inputStyle} value={timeForm.rate || 0} onChange={e => setTimeForm({...timeForm, rate: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem' }}>FECHA</label>
                                    <input type="date" style={inputStyle} value={timeForm.date || ''} onChange={e => setTimeForm({...timeForm, date: e.target.value})} />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem' }}>ACTIVIDAD REALIZADA</label>
                                <textarea style={{ ...inputStyle, minHeight: '80px' }} value={timeForm.description || ''} onChange={e => setTimeForm({...timeForm, description: e.target.value})} placeholder="Ej: Redacción de escrito de demanda..." />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
                            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowTimeModal(false)}>Cancelar</button>
                            <button className="btn-primary" style={{ flex: 2 }} disabled={savingTime || !timeForm.matterId} onClick={handleSaveTime}>
                                {savingTime ? 'Guardando...' : 'Registrar Horas'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {showMatterModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                    <div className="premium-card fade-in" style={{ width: '100%', maxWidth: '540px', padding: '2.5rem', background: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0, fontWeight: 900 }}>{matterForm.id ? 'Editar Asunto' : 'Nuevo Asunto'}</h2>
                            <button onClick={() => setShowMatterModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <Plus size={24} style={{ transform: 'rotate(45deg)' }} />
                            </button>
                        </div>
                        
                        <div style={{ display: 'grid', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem' }}>TÍTULO DEL ASUNTO</label>
                                <input type="text" style={inputStyle} value={matterForm.title || ''} onChange={e => setMatterForm({...matterForm, title: e.target.value})} />
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem' }}>CLIENTE</label>
                                    <select style={inputStyle} value={matterForm.clientId || ''} onChange={e => setMatterForm({...matterForm, clientId: e.target.value})}>
                                        <option value="">— Seleccionar —</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem' }}>CÓDIGO (REF)</label>
                                    <input type="text" style={inputStyle} value={matterForm.code || ''} onChange={e => setMatterForm({...matterForm, code: e.target.value})} />
                                </div>
                            </div>

                             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem' }}>TIPO DE FEE</label>
                                    <select style={inputStyle} value={matterForm.feeType || 'FIXED'} onChange={e => setMatterForm({...matterForm, feeType: e.target.value as any})}>
                                        <option value="FIXED">Honorario Fijo</option>
                                        <option value="HOURLY">Por Horas</option>
                                        <option value="CONTINGENCY">Cuota Litis</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem' }}>MONEDA</label>
                                    <select style={inputStyle} value={matterForm.currency} onChange={e => setMatterForm({...matterForm, currency: e.target.value as any})}>
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="VES">VES</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem' }}>PRESUPUESTO ({CURRENCY_SYMBOLS[matterForm.currency || 'USD']})</label>
                                    <input type="number" style={inputStyle} value={matterForm.budget || 0} onChange={e => setMatterForm({...matterForm, budget: Number(e.target.value)})} />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
                            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowMatterModal(false)}>Cancelar</button>
                            <button className="btn-primary" style={{ flex: 2 }} disabled={savingMatter} onClick={handleSaveMatter}>
                                {savingMatter ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <style>{`
                .premium-card {
                    background: white;
                    border-radius: 20px;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
                }
                .btn-primary {
                    background: #6366f1;
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 12px;
                    font-weight: 700;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
                }
                .btn-secondary {
                    background: white;
                    color: #475569;
                    border: 1px solid #e2e8f0;
                    padding: 0.75rem 1.5rem;
                    border-radius: 12px;
                    font-weight: 700;
                    cursor: pointer;
                }
                .status-badge {
                    padding: 4px 10px;
                    border-radius: 6px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    text-transform: uppercase;
                }
                .status-paid { background: #dcfce7; color: #166534; }
                .status-sent { background: #e0e7ff; color: #3730a3; }
                .status-overdue { background: #fee2e2; color: #991b1b; }
                .status-draft { background: #f1f5f9; color: #475569; }
                .fade-in { animation: fadeIn 0.4s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>

            {/* ═══ MODAL TASAS DE CAMBIO ═══ */}
            {showRatesModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10002, padding: '1rem' }}>
                    <div className="premium-card fade-in" style={{ width: '100%', maxWidth: '780px', maxHeight: '90vh', overflow: 'auto', background: 'white', padding: '2.5rem' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <div>
                                <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Globe color="#6366f1" size={28}/> Gestión de Tasas y Conversión
                                </h3>
                                <p style={{ margin: '0.4rem 0 0', color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>Control financiero multi-moneda para honorarios y gastos operativos</p>
                            </div>
                            <button onClick={() => setShowRatesModal(false)} className="btn-secondary" style={{ padding: '0.5rem', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={20}/>
                            </button>
                        </div>

                        {/* Widget de Conversión Rápida */}
                        <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', borderRadius: '24px', padding: '2rem', marginBottom: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px', borderRadius: '10px' }}><ArrowLeftRight color="#818cf8" size={20}/></div>
                                <h4 style={{ margin: 0, color: 'white', fontWeight: 800, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Calculadora en Tiempo Real</h4>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr auto 0.8fr 1.2fr', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="number" min="0" step="0.01"
                                        value={convertAmount}
                                        onChange={e => setConvertAmount(parseFloat(e.target.value) || 0)}
                                        style={{ width: '100%', padding: '1rem 1rem', borderRadius: '16px', border: 'none', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '1.25rem', fontWeight: 900, outline: 'none', textAlign: 'center' }}
                                    />
                                </div>
                                <select value={convertFrom} onChange={e => setConvertFrom(e.target.value as any)}
                                    style={{ padding: '1rem', borderRadius: '16px', border: 'none', background: 'rgba(255,255,255,0.12)', color: 'white', fontWeight: 800, cursor: 'pointer', outline: 'none', appearance: 'none' }}>
                                    <option value="USD">🇺🇸 USD</option>
                                    <option value="EUR">🇪🇺 EUR</option>
                                    <option value="VES">🇻🇪 VES</option>
                                </select>
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 900, fontSize: '1.5rem' }}>⇉</div>
                                <select value={convertTo} onChange={e => setConvertTo(e.target.value as any)}
                                    style={{ padding: '1rem', borderRadius: '16px', border: 'none', background: 'rgba(255,255,255,0.12)', color: 'white', fontWeight: 800, cursor: 'pointer', outline: 'none', appearance: 'none' }}>
                                    <option value="VES">🇻🇪 VES</option>
                                    <option value="USD">🇺🇸 USD</option>
                                    <option value="EUR">🇪🇺 EUR</option>
                                </select>
                                <div style={{ background: 'white', borderRadius: '16px', padding: '1rem', textAlign: 'center', minWidth: '140px' }}>
                                    {(() => {
                                        const key = `${convertFrom}_${convertTo}`;
                                        const rate = latestRates[key] || 0;
                                        const result = rate > 0 ? (convertAmount * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—';
                                        const sym = CURRENCY_SYMBOLS[convertTo] || '$';
                                        return <span style={{ color: '#1e1b4b', fontWeight: 900, fontSize: '1.25rem' }}>{sym}{result}</span>;
                                    })()}
                                </div>
                            </div>

                            {/* Dashboard de Tasas Críticas */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                                {[
                                    { label: 'DÓLAR (BCV)', sub: 'USD → VES', key: 'USD_VES', color: '#10b981', sym: 'Bs.' },
                                    { label: 'EURO (ECB)', sub: 'EUR → VES', key: 'EUR_VES', color: '#3b82f6', sym: 'Bs.' },
                                    { label: 'VARIACIÓN Bs.', sub: 'VES → USD', key: 'VES_USD', color: '#f59e0b', sym: '$', dec: 6 },
                                ].map((t, i) => (
                                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', fontWeight: 800, textTransform: 'uppercase' }}>{t.label}</span>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                                            <span style={{ color: 'white', fontSize: '1.1rem', fontWeight: 900 }}>{t.sym}{latestRates[t.key]?.toLocaleString(undefined, { maximumFractionDigits: t.dec ?? 2 }) || 'N/A'}</span>
                                            <span style={{ color: t.color, fontSize: '0.6rem', fontWeight: 800, background: `${t.color}20`, padding: '2px 6px', borderRadius: '4px' }}>LIVE</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Nueva Tasa e Historial */}
                        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem' }}>
                            {/* Registro */}
                            <div style={{ background: '#f8fafc', borderRadius: '20px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
                                <h5 style={{ margin: '0 0 1.25rem', fontWeight: 800, color: '#1e293b', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Calendar size={16} color="#6366f1"/> Nueva Entrada
                                </h5>
                                <div style={{ display: 'grid', gap: '1rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                        <div>
                                            <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.35rem' }}>DESDE</label>
                                            <select value={rateForm.currencyFrom} onChange={e => setRateForm({...rateForm, currencyFrom: e.target.value as any})} style={{ ...inputStyle, padding: '0.5rem' }}>
                                                <option value="USD">USD</option>
                                                <option value="EUR">EUR</option>
                                                <option value="VES">VES</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.35rem' }}>HACIA</label>
                                            <select value={rateForm.currencyTo} onChange={e => setRateForm({...rateForm, currencyTo: e.target.value as any})} style={{ ...inputStyle, padding: '0.5rem' }}>
                                                <option value="VES">VES</option>
                                                <option value="USD">USD</option>
                                                <option value="EUR">EUR</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.35rem' }}>VALOR DE CONVERSIÓN *</label>
                                        <input type="number" step="0.00000001" value={rateForm.rate || ''} onChange={e => setRateForm({...rateForm, rate: parseFloat(e.target.value)})} style={inputStyle} placeholder="Ej: 36.52" />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.35rem' }}>FUENTE OFICIAL</label>
                                        <select value={rateForm.source} onChange={e => setRateForm({...rateForm, source: e.target.value})} style={inputStyle}>
                                            <option value="BCV">🏦 BCV (Banco Central Vzla)</option>
                                            <option value="ECB">🇪🇺 ECB (European Central Bank)</option>
                                            <option value="MANUAL">✍️ Actualización Manual</option>
                                        </select>
                                    </div>
                                    <button
                                        className="btn-primary"
                                        style={{ width: '100%', marginTop: '0.5rem' }}
                                        disabled={savingRate || !rateForm.rate || rateForm.currencyFrom === rateForm.currencyTo}
                                        onClick={async () => {
                                            setSavingRate(true);
                                            try {
                                                await exchangeRateService.save(rateForm);
                                                const [hist, latest] = await Promise.all([exchangeRateService.getAll(), exchangeRateService.getLatestAll()]);
                                                setExchangeRates(hist);
                                                setLatestRates(latest);
                                                setRateForm({ currencyFrom: 'USD', currencyTo: 'VES', rate: 0, source: 'BCV' });
                                            } catch (e: any) { alert(e.message); }
                                            finally { setSavingRate(false); }
                                        }}
                                    >
                                        {savingRate ? <RefreshCw className="spin" size={16}/> : <CheckCircle2 size={16}/>}
                                        {' '}Guardar Registro
                                    </button>
                                </div>
                            </div>

                            {/* Historial */}
                            <div style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
                                <h5 style={{ margin: '0 0 1rem', fontWeight: 800, color: '#1e293b', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Clock size={16} color="#64748b"/> Historial Reciente
                                </h5>
                                <div style={{ flex: 1, overflow: 'auto', border: '1px solid #f1f5f9', borderRadius: '16px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 1, boxShadow: '0 1px 0 #f1f5f9' }}>
                                            <tr>
                                                <th style={{ padding: '1rem', fontSize: '0.65rem', color: '#64748b', textAlign: 'left' }}>FECHA</th>
                                                <th style={{ padding: '1rem', fontSize: '0.65rem', color: '#64748b', textAlign: 'left' }}>PAR</th>
                                                <th style={{ padding: '1rem', fontSize: '0.65rem', color: '#64748b', textAlign: 'left' }}>TASA</th>
                                                <th style={{ padding: '1rem', fontSize: '0.65rem', color: '#64748b', textAlign: 'center' }}>ACC.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {exchangeRates.map(r => (
                                                <tr key={r.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#64748b' }}>{new Date(r.effectiveDate).toLocaleDateString()}</td>
                                                    <td style={{ padding: '0.75rem 1rem' }}>
                                                        <span style={{ fontWeight: 800, fontSize: '0.7rem', color: '#3730a3', background: '#e0e7ff', padding: '2px 8px', borderRadius: '6px' }}>{r.currencyFrom}/{r.currencyTo}</span>
                                                    </td>
                                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 900, fontSize: '0.85rem' }}>{r.rate.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                        <button onClick={async () => {
                                                            if (!confirm('¿Eliminar esta tasa?')) return;
                                                            await exchangeRateService.delete(r.id);
                                                            setExchangeRates(exchangeRates.filter(x => x.id !== r.id));
                                                            setLatestRates(await exchangeRateService.getLatestAll());
                                                        }} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                                            <Trash2 size={14}/>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
