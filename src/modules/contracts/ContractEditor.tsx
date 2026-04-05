import { useRef, useEffect, useState } from 'react';
import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Save, MessageSquare, Send, Clock, AlertCircle } from 'lucide-react';

interface ContractEditorProps {
    initialContent: string;
    onChange: (html: string) => void;
    onSave?: () => void;
    comments?: any[];
    onAddComment?: (text: string) => void;
}

export const ContractEditor: React.FC<ContractEditorProps> = ({ 
    initialContent, 
    onChange, 
    onSave, 
    comments = [], 
    onAddComment 
}) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [newComment, setNewComment] = useState('');

    // Sincronización de contenido inicial
    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== initialContent) {
            editorRef.current.innerHTML = initialContent || '';
            setIsDirty(false);
        }
    }, [initialContent]);

    const executeCommand = (command: string, value: string = '') => {
        document.execCommand(command, false, value);
        handleContentChange();
    };

    const [isSaving, setIsSaving] = useState(false);

    // Motor de Autosave (2 segundos de inactividad)
    useEffect(() => {
        if (!isDirty || !onSave) return;

        const timer = setTimeout(async () => {
            setIsSaving(true);
            try {
                await onSave();
                setIsDirty(false);
            } catch (err) {
                console.error('Error in autosave:', err);
            } finally {
                setIsSaving(false);
            }
        }, 2000);

        return () => clearTimeout(timer);
    }, [isDirty, onSave]);

    const handleContentChange = () => {
        if (editorRef.current) {
            const currentHTML = editorRef.current.innerHTML;
            onChange(currentHTML);
            setIsDirty(currentHTML !== initialContent);
        }
    };

    const insertTemplate = () => {
        const template = `
            <h1 style="text-align: center; margin-bottom: 2rem;">CONTRATO DE [TIPO]</h1>
            <p style="text-align: justify; line-height: 1.8;">Entre los suscritos...</p>
            <h2>PRIMERA: OBJETO</h2>
            <p>[Describir el objeto del contrato...]</p>
            <h2>SEGUNDA: OBLIGACIONES</h2>
            <ul><li>[Obligación 1]</li></ul>
            <div style="margin-top: 5rem; display: flex; justify-content: space-between;">
                <div style="text-align: center; width: 40%; border-top: 2px solid #000;"><strong>[PARTE A]</strong></div>
                <div style="text-align: center; width: 40%; border-top: 2px solid #000;"><strong>[PARTE B]</strong></div>
            </div>
        `;
        if (editorRef.current) {
            editorRef.current.innerHTML = template;
            handleContentChange();
        }
    };

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 320px',
            height: '100%',
            background: '#fff',
            borderRadius: '20px',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
        }}>
            {/* Main Editor Column */}
            <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0', background: '#fcfcfc' }}>
                {/* Toolbar */}
                <div style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid #e2e8f0',
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                    position: 'sticky',
                    top: 0,
                    zIndex: 2
                }}>
                    <div style={{ display: 'flex', gap: '4px', marginRight: '1rem' }}>
                        {[
                            { cmd: 'bold', icon: <Bold size={16} />, title: 'Negrita' },
                            { cmd: 'italic', icon: <Italic size={16} />, title: 'Cursiva' },
                        ].map(btn => (
                            <button key={btn.cmd} type="button" onClick={() => executeCommand(btn.cmd)} style={btnStyle} title={btn.title}>
                                {btn.icon}
                            </button>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: '4px', marginRight: '1rem' }}>
                        <button type="button" onClick={() => executeCommand('formatBlock', '<h1>')} style={btnStyle} title="Título H1"><Heading1 size={16} /></button>
                        <button type="button" onClick={() => executeCommand('formatBlock', '<h2>')} style={btnStyle} title="Título H2"><Heading2 size={16} /></button>
                    </div>

                    <div style={{ display: 'flex', gap: '4px', marginRight: '1rem' }}>
                        <button type="button" onClick={() => executeCommand('insertUnorderedList')} style={btnStyle} title="Viñetas"><List size={16} /></button>
                        <button type="button" onClick={() => executeCommand('insertOrderedList')} style={btnStyle} title="Lista"><ListOrdered size={16} /></button>
                    </div>

                    <button type="button" onClick={insertTemplate} style={{ ...btnStyle, color: '#7c3aed', background: '#f5f3ff', borderColor: '#ddd6fe', fontWeight: 700 }}>
                        📋 Plantilla
                    </button>

                    {isSaving ? (
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', background: '#ecfdf5', padding: '4px 10px', borderRadius: '8px', border: '1px solid #10b981' }}>
                            <Clock size={14} style={{ animation: 'spin 2s linear infinite' }} />
                            <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>GUARDANDO...</span>
                        </div>
                    ) : isDirty && (
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', background: '#fffbeb', padding: '4px 10px', borderRadius: '8px', border: '1px solid #fcd34d' }}>
                            <AlertCircle size={14} />
                            <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>BORRADOR PENDIENTE</span>
                        </div>
                    )}

                    {onSave && (
                        <button type="button" onClick={() => { onSave(); setIsDirty(false); }} style={{ marginLeft: (isDirty || isSaving) ? '12px' : 'auto', padding: '8px 16px', border: 'none', background: isDirty ? '#7c3aed' : '#10b981', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}>
                            <Save size={16} /> {isDirty ? 'Guardar' : 'Blindado'}
                        </button>
                    )}
                </div>

                {/* Editor Content Area */}
                <div
                    ref={editorRef}
                    contentEditable
                    onInput={handleContentChange}
                    onBlur={handleContentChange}
                    style={{
                        flex: 1,
                        padding: '4rem 5rem',
                        overflowY: 'auto',
                        fontFamily: "'Source Serif 4', Georgia, serif",
                        fontSize: '1.1rem',
                        lineHeight: '1.8',
                        color: '#1e293b',
                        outline: 'none',
                        background: '#fff',
                        minHeight: '600px',
                        boxShadow: 'inset 0 0 40px rgba(0,0,0,0.02)'
                    }}
                    suppressContentEditableWarning
                />
            </div>

            {/* Comments Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', background: '#f8fafc', borderLeft: '1px solid #e2e8f0' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MessageSquare size={16} color="#6366f1" />
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Observaciones Legales</span>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {comments.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                            <MessageSquare size={32} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
                            <p style={{ margin: 0, fontSize: '0.75rem' }}>No hay comentarios en este borrador.</p>
                        </div>
                    ) : (
                        comments.map((c, i) => (
                            <div key={i} style={{ background: '#fff', padding: '0.875rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6366f1' }}>{(c.details as any)?.author || 'Abogado'}</span>
                                    <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}><Clock size={10} style={{ verticalAlign: 'middle' }} /> {new Date(c.createdAt).toLocaleDateString()}</span>
                                </div>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#334155', lineHeight: 1.4 }}>{(c.details as any)?.text}</p>
                            </div>
                        ))
                    )}
                </div>

                <div style={{ padding: '1rem', background: '#fff', borderTop: '1px solid #e2e8f0' }}>
                    <textarea 
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        placeholder="Agregar nota..."
                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem', resize: 'none', height: '60px', outline: 'none', fontFamily: 'inherit' }}
                    />
                    <button 
                        onClick={() => { if(newComment.trim() && onAddComment) { onAddComment(newComment); setNewComment(''); } }}
                        disabled={!newComment.trim()}
                        style={{ marginTop: '8px', width: '100%', padding: '8px', background: !newComment.trim() ? '#cbd5e1' : '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                        <Send size={12} /> ENVIAR NOTA
                    </button>
                </div>
            </div>

            <style>{`
                [contenteditable] h1 { font-size: 1.75rem; font-weight: 800; margin: 2rem 0; text-align: center; text-transform: uppercase; color: #0f172a; }
                [contenteditable] h2 { font-size: 1.25rem; font-weight: 700; margin: 1.5rem 0 0.75rem 0; color: #1e293b; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem; }
                [contenteditable] p { margin: 1rem 0; text-align: justify; }
                [contenteditable] ul, [contenteditable] ol { margin: 1rem 0; padding-left: 2rem; }
                [contenteditable]:focus { background: #fff; }
            `}</style>
        </div>
    );
};

const btnStyle: React.CSSProperties = {
    padding: '8px',
    border: '1px solid #e2e8f0',
    background: '#fff',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
};

