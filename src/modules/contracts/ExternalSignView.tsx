import React, { useState, useEffect } from 'react';
import { PenLine, ShieldCheck, FileText, Download, UserCheck, AlertTriangle } from 'lucide-react';
import { supabase } from '../../core/supabase.ts';
import { signatureService } from './signature.service.ts';
import { SignaturePanel } from './SignaturePanel.tsx';
import type { Contract } from './types.ts';

interface ExternalSignViewProps {
    token: string;
}

export const ExternalSignView: React.FC<ExternalSignViewProps> = ({ token }) => {
    const [contract, setContract] = useState<Contract | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadExternalDoc = async () => {
            try {
                // Búsqueda directa por token — NO depende de sesión autenticada
                // RLS debe tener una política SELECT que permita acceso cuando signature_token coincide
                const { data, error: dbError } = await supabase
                    .from('contracts')
                    .select('*')
                    .eq('signature_token', token)
                    .eq('signature_status', 'pending')
                    .single();

                if (dbError || !data) {
                    throw new Error('El enlace de firma ha caducado, ya fue utilizado, o es inválido.');
                }

                // Mapear al tipo Contract del frontend
                const found: Contract = {
                    id: data.id,
                    title: data.title,
                    type: data.type,
                    status: data.status,
                    parties: data.parties,
                    startDate: data.start_date,
                    endDate: data.end_date,
                    value: Number(data.value),
                    currency: data.currency,
                    assignedLawyerId: data.assigned_lawyer_id,
                    assignedLawyerName: data.assigned_lawyer_name || undefined,
                    description: data.description,
                    content_draft: data.content_draft,
                    file_url: data.file_url,
                    metadata: data.metadata,
                    organizationId: data.organization_id,
                    signature_status: data.signature_status || 'unsigned',
                    signature_hash: data.signature_hash || undefined,
                    signature_token: data.signature_token || undefined,
                    signed_at: data.signed_at || undefined,
                    signed_by_name: data.signed_by_name || undefined,
                    signed_by_email: data.signed_by_email || undefined,
                };

                setContract(found);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error de enlace.');
            } finally {
                setLoading(false);
            }
        };
        loadExternalDoc();
    }, [token]);

    if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Validando Token Legal Doc-VE...</div>;

    if (error || !contract) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                <div style={{ padding: '2rem', background: '#fff', borderRadius: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', textAlign: 'center', maxWidth: '400px' }}>
                    <AlertTriangle size={48} color="#dc2626" style={{ marginBottom: '1rem' }} />
                    <h2 style={{ color: '#0f172a' }}>Acceso Denegado</h2>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{error}</p>
                    <button onClick={() => window.location.href = '/'} style={{ marginTop: '1.5rem', background: '#1e3a8a', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>Volver al Portal</button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '2rem' }}>
            <div style={{ maxWidth: '900px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 320px', gap: '2rem' }}>
                
                {/* Contenido del Documento */}
                <div style={{ background: '#fff', borderRadius: '24px', padding: '3rem', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                        <div style={{ padding: '12px', background: '#eff6ff', borderRadius: '12px' }}><FileText color="#2563eb" /></div>
                        <div>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>{contract.title}</h1>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>ID Certificado: {contract.id}</p>
                        </div>
                    </div>

                    <div style={{ 
                        border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', 
                        minHeight: '400px', fontSize: '0.95rem', color: '#334155', lineHeight: 1.7,
                        background: '#fcfcfc', fontFamily: 'serif' 
                    }}>
                        {contract.content_draft || contract.description || 'Contenido del contrato no disponible para previsualización directa.'}
                    </div>
                </div>

                {/* Panel de Firma */}
                <div style={{ position: 'sticky', top: '2rem' }}>
                    <div style={{ background: '#fff', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 40px 100px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#1e3a8a' }}>
                            <UserCheck size={20} />
                            <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Firmar Documento</h2>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1.5rem' }}>
                            Usted ha sido invitado a firmar digitalmente este documento. Este proceso es legalmente vinculante.
                        </p>
                        
                        <SignaturePanel 
                            contract={contract} 
                            onSigned={() => window.location.reload()} 
                        />

                        <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontSize: '0.7rem', fontWeight: 700 }}>
                                <ShieldCheck size={14} /> CERTIFICACIÓN LEGALDOC VE
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
