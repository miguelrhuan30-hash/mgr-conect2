/**
 * components/PropostaDocPublica.tsx
 *
 * Página pública de aceite de proposta comercial.
 * Acessível sem login via rota /proposta/:slug
 *
 * Fluxo: busca projeto por propostaDocumento.slug → exibe cláusulas →
 * cliente aceita preenchendo nome/email → WOW MOMENT com confetti CSS.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  collection, query, where, getDocs, updateDoc, doc, Timestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { CollectionName, ProjectV2, PropostaDocumento } from '../types';
import {
  Check, Loader2, AlertCircle, X, Mail, User, ChevronDown,
  FileText, Download, ExternalLink, Eye, Upload, Image, Camera,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Paleta MGR ────────────────────────────────────────────────────────────────
const C = {
  bg:         '#0A1628',
  bgCard:     '#0d1f35',
  bgCard2:    '#112040',
  accent:     '#E8593C',
  accentDark: '#c04830',
  border:     '#1e3550',
  text:       '#f8fafc',
  textMuted:  '#94a3b8',
  green:      '#22c55e',
  greenDark:  '#16a34a',
} as const;

// ── Logo MGR ─────────────────────────────────────────────────────────────────
const MGRLogo: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{
      width: size, height: size, borderRadius: 12,
      background: `linear-gradient(135deg, ${C.accent}, ${C.accent}99)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 0 20px ${C.accent}44`, flexShrink: 0,
    }}>
      <svg viewBox="0 0 24 24" fill="white" width={size * 0.55} height={size * 0.55}>
        <polygon points="12,2 22,8 22,16 12,22 2,16 2,8" />
      </svg>
    </div>
    <span style={{ color: 'white', fontWeight: 800, fontSize: size * 0.45, letterSpacing: 2 }}>
      MGR
    </span>
  </div>
);

// ── CSS injetado ──────────────────────────────────────────────────────────────
const KEYFRAMES = `
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes popIn { 0% { transform: scale(0.7); opacity: 0; } 60% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
@keyframes pulsering {
  0%   { transform: scale(1);    opacity: 0.8; }
  50%  { transform: scale(1.18); opacity: 0.3; }
  100% { transform: scale(1);    opacity: 0.8; }
}
@keyframes checkDraw {
  from { stroke-dashoffset: 100; opacity: 0; }
  to   { stroke-dashoffset: 0;   opacity: 1; }
}
@keyframes confettiFall1 {
  0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
  100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
}
@keyframes confettiFall2 {
  0%   { transform: translateY(-20px) rotate(45deg);  opacity: 1; }
  100% { transform: translateY(110vh) rotate(-540deg);opacity: 0; }
}
@keyframes confettiFall3 {
  0%   { transform: translateY(-20px) rotate(-30deg); opacity: 1; }
  100% { transform: translateY(110vh) rotate(600deg); opacity: 0; }
}
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes modalIn {
  from { opacity: 0; transform: scale(0.94) translateY(20px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
`;

// ── Confetti CSS puro ─────────────────────────────────────────────────────────
type Piece = { left: number; color: string; delay: number; duration: number; anim: string; size: number; shape: string };
const CONFETTI_COLORS = ['#E8593C','#f59e0b','#22c55e','#3b82f6','#a855f7','#ec4899','#ffffff'];
const CONFETTI_ANIMS = ['confettiFall1','confettiFall2','confettiFall3'];

const ConfettiPiece: React.FC<{ p: Piece }> = ({ p }) => (
  <div style={{
    position: 'fixed',
    left: `${p.left}%`,
    top: -20,
    width: p.size,
    height: p.size * (p.shape === 'rect' ? 1.6 : 1),
    borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'rect' ? 2 : 0,
    background: p.color,
    animation: `${p.anim} ${p.duration}s ${p.delay}s ease-in forwards`,
    pointerEvents: 'none',
    zIndex: 9999,
  }} />
);

const Confetti: React.FC = () => {
  const pieces: Piece[] = React.useMemo(() => (
    Array.from({ length: 80 }, (_, i) => ({
      left:     Math.random() * 100,
      color:    CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay:    Math.random() * 3,
      duration: 3 + Math.random() * 3,
      anim:     CONFETTI_ANIMS[i % 3],
      size:     6 + Math.random() * 10,
      shape:    ['rect','circle','rect','diamond'][i % 4],
    }))
  ), []);
  return <>{pieces.map((p, i) => <ConfettiPiece key={i} p={p} />)}</>;
};

// ── WOW MOMENT ────────────────────────────────────────────────────────────────
const WowMoment: React.FC<{
  nome: string;
  mensagem?: string;
  aceitoEm: Date;
}> = ({ nome, mensagem, aceitoEm }) => {
  const defaultMsg =
    'Em breve nossa equipe comercial entrará em contato para enviar o contrato de execução. ' +
    'Assim que o contrato for assinado, iniciamos o planejamento e a execução do seu projeto. 🚀';

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: `radial-gradient(ellipse at 50% 30%, #3d1a10 0%, ${C.bg} 65%)`,
      fontFamily: 'system-ui, sans-serif',
      padding: '40px 20px', boxSizing: 'border-box', position: 'relative', overflow: 'hidden',
    }}>
      <Confetti />

      {/* Pulsing rings */}
      <div style={{ position: 'relative', marginBottom: 32 }}>
        {[1,2,3].map(n => (
          <div key={n} style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            width: 100 + n * 50, height: 100 + n * 50,
            borderRadius: '50%', border: `2px solid ${C.accent}${n === 1 ? '60' : n === 2 ? '35' : '18'}`,
            animation: `pulsering 2s ${n * 0.4}s ease-in-out infinite`,
          }} />
        ))}
        {/* Checkmark circle */}
        <div style={{
          width: 120, height: 120, borderRadius: '50%',
          background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 60px ${C.accent}55`,
          animation: 'popIn 0.6s cubic-bezier(.16,1,.3,1) both',
          position: 'relative', zIndex: 1,
        }}>
          <svg viewBox="0 0 50 50" width={60} height={60}>
            <polyline
              points="10,26 21,37 40,15"
              fill="none" stroke="white" strokeWidth={4}
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray={100} strokeDashoffset={0}
              style={{ animation: 'checkDraw 0.5s 0.4s ease both' }}
            />
          </svg>
        </div>
      </div>

      {/* Título */}
      <h1 style={{
        color: C.text, fontSize: 'clamp(28px, 6vw, 48px)', fontWeight: 900,
        margin: '0 0 12px', textAlign: 'center',
        animation: 'fadeIn 0.6s 0.3s both',
      }}>
        🎉 Proposta Aceita!
      </h1>

      {/* Subtítulo */}
      <p style={{
        color: C.textMuted, fontSize: 'clamp(15px, 2.5vw, 20px)',
        margin: '0 0 32px', textAlign: 'center', maxWidth: 520,
        animation: 'fadeIn 0.6s 0.5s both',
      }}>
        Obrigado, <strong style={{ color: C.text }}>{nome}</strong>! Recebemos sua confirmação.
      </p>

      {/* Card próximos passos */}
      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: '28px 32px', maxWidth: 560, width: '100%',
        animation: 'fadeIn 0.6s 0.7s both',
        boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
      }}>
        <h3 style={{ color: C.accent, fontWeight: 700, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 12px' }}>
          Próximos Passos
        </h3>
        <p style={{ color: C.textMuted, fontSize: 15, lineHeight: 1.7, margin: 0 }}>
          {mensagem || defaultMsg}
        </p>
      </div>

      {/* Data do aceite */}
      <p style={{
        color: C.textMuted, fontSize: 13, marginTop: 24,
        animation: 'fadeIn 0.6s 0.9s both',
      }}>
        Aceite registrado em {format(aceitoEm, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
      </p>

      {/* Rodapé */}
      <div style={{
        marginTop: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        animation: 'fadeIn 0.6s 1s both',
      }}>
        <MGRLogo size={36} />
        <p style={{ color: C.textMuted, fontSize: 12, margin: 0, textAlign: 'center' }}>
          MGR Refrigeração Industrial · mgrrefrigeracao.com.br
        </p>
      </div>
    </div>
  );
};

// ── Modal de aceite / assinatura de contrato ─────────────────────────────────
const ModalAceite: React.FC<{
  onClose: () => void;
  onConfirm: (nome: string, email: string, contratoUrls?: string[]) => Promise<void>;
  contratoPdfUrl?: string | null;
  projectId: string;
}> = ({ onClose, onConfirm, contratoPdfUrl, projectId }) => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [concordo, setConcordo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  // Upload do contrato assinado
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputPdfRef = useRef<HTMLInputElement>(null);
  const fileInputFotoRef = useRef<HTMLInputElement>(null);

  // Fechar com ESC
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const adicionarArquivos = (novos: FileList | null) => {
    if (!novos) return;
    setArquivos(prev => [...prev, ...Array.from(novos)]);
    setErro('');
  };

  const removerArquivo = (idx: number) => {
    setArquivos(prev => prev.filter((_, i) => i !== idx));
  };

  const uploadArquivos = async (): Promise<string[]> => {
    const urls: string[] = [];
    const total = arquivos.length;
    for (let i = 0; i < total; i++) {
      const file = arquivos[i];
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `projects/${projectId}/contrato_assinado/${Date.now()}_${i}.${ext}`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, file);
      const url = await getDownloadURL(ref);
      urls.push(url);
      setUploadProgress(Math.round(((i + 1) / total) * 100));
    }
    return urls;
  };

  const handleConfirm = async () => {
    if (!nome.trim()) { setErro('Por favor, informe seu nome completo.'); return; }
    if (contratoPdfUrl && arquivos.length === 0) {
      setErro('Envie pelo menos uma foto ou o PDF do contrato assinado.');
      return;
    }
    if (!concordo) { setErro('Você precisa confirmar a assinatura para continuar.'); return; }
    setErro('');
    setSaving(true);
    try {
      let urls: string[] = [];
      if (arquivos.length > 0) {
        setUploadProgress(0);
        urls = await uploadArquivos();
        setUploadProgress(null);
      }
      await onConfirm(nome.trim(), email.trim(), urls.length > 0 ? urls : undefined);
    } catch {
      setErro('Erro ao registrar. Tente novamente.');
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: '12px 14px 12px 42px',
    color: C.text, fontSize: 15, outline: 'none',
    fontFamily: 'system-ui, sans-serif',
    transition: 'border-color 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', color: C.textMuted, fontSize: 11, fontWeight: 700,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6,
  };

  // ── Layout com contrato PDF (tela cheia com PDF + assinatura) ─────────────
  if (contratoPdfUrl) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', flexDirection: 'column', background: C.bg, animation: 'fadeIn 0.2s both' }}>

        {/* Barra superior */}
        <div style={{ height: 56, background: C.bgCard2, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0, gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MGRLogo size={28} />
            <span style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>Assinatura de Contrato</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a href={contratoPdfUrl} target="_blank" rel="noopener noreferrer" download
              style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.textMuted, fontSize: 13, textDecoration: 'none', padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.border}`, fontFamily: 'system-ui, sans-serif' }}>
              <Download size={14} /> Baixar PDF
            </a>
            <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer', color: C.textMuted, padding: '6px 10px', display: 'flex', alignItems: 'center' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Corpo scrollável */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>

          {/* Visualizador do contrato */}
          <div style={{ padding: '24px 20px 0' }}>
            <p style={{ color: C.textMuted, fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 10px' }}>Contrato de Serviço</p>
            <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}`, background: '#000' }}>
              <iframe src={`${contratoPdfUrl}#toolbar=0&navpanes=0`}
                style={{ width: '100%', height: 'min(55vh, 480px)', border: 'none', display: 'block' }}
                title="Contrato" />
            </div>
          </div>

          {/* Instruções de assinatura */}
          <div style={{ margin: '20px 20px 0', padding: '16px 20px', background: `${C.accent}10`, border: `1px solid ${C.accent}30`, borderRadius: 12 }}>
            <p style={{ color: C.accent, fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 10px' }}>📋 Instruções para Assinatura</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>✏️</span>
                <span style={{ color: C.textMuted, fontSize: 14, lineHeight: 1.5 }}>
                  <strong style={{ color: C.text }}>Rubrique todas as páginas</strong> — coloque sua rubrica no canto inferior direito de cada folha
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>✍️</span>
                <span style={{ color: C.textMuted, fontSize: 14, lineHeight: 1.5 }}>
                  <strong style={{ color: C.text }}>Na última página</strong> — assine com seu nome completo e apresente documento de identificação
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>📤</span>
                <span style={{ color: C.textMuted, fontSize: 14, lineHeight: 1.5 }}>
                  Após assinar, envie o contrato abaixo — <strong style={{ color: C.text }}>PDF escaneado</strong> ou <strong style={{ color: C.text }}>fotos de todas as páginas</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Upload do contrato assinado */}
          <div style={{ margin: '20px 20px 0', padding: '18px 20px', background: C.bgCard2, border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <p style={{ ...labelStyle, marginBottom: 12 }}>📤 Enviar Contrato Assinado *</p>
            <div style={{ display: 'flex', gap: 10, marginBottom: arquivos.length > 0 ? 14 : 0, flexWrap: 'wrap' }}>
              {/* Botão PDF */}
              <input type="file" accept=".pdf" ref={fileInputPdfRef} className="hidden" style={{ display: 'none' }}
                onChange={e => adicionarArquivos(e.target.files)} />
              <button onClick={() => fileInputPdfRef.current?.click()} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 10, border: `1.5px dashed ${C.border}`, background: 'transparent', cursor: 'pointer', color: C.textMuted, fontSize: 13, fontFamily: 'system-ui, sans-serif', fontWeight: 600, transition: 'border-color 0.2s, color 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.accent; (e.currentTarget as HTMLButtonElement).style.color = C.accent; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; (e.currentTarget as HTMLButtonElement).style.color = C.textMuted; }}
              >
                <FileText size={15} /> Enviar PDF assinado
              </button>
              {/* Botão Fotos */}
              <input type="file" accept="image/*" multiple ref={fileInputFotoRef} style={{ display: 'none' }}
                onChange={e => adicionarArquivos(e.target.files)} />
              <button onClick={() => fileInputFotoRef.current?.click()} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 10, border: `1.5px dashed ${C.border}`, background: 'transparent', cursor: 'pointer', color: C.textMuted, fontSize: 13, fontFamily: 'system-ui, sans-serif', fontWeight: 600, transition: 'border-color 0.2s, color 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#3b82f6'; (e.currentTarget as HTMLButtonElement).style.color = '#3b82f6'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; (e.currentTarget as HTMLButtonElement).style.color = C.textMuted; }}
              >
                <Camera size={15} /> Enviar fotos (múltiplas)
              </button>
            </div>

            {/* Lista de arquivos selecionados */}
            {arquivos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {arquivos.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: `${C.green}15`, border: `1px solid ${C.green}40`, borderRadius: 8 }}>
                    {f.type.startsWith('image/') ? <Image size={14} color={C.green} /> : <FileText size={14} color={C.green} />}
                    <span style={{ color: C.text, fontSize: 13, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    <span style={{ color: C.textMuted, fontSize: 11, flexShrink: 0 }}>{(f.size / 1024).toFixed(0)} KB</span>
                    {!saving && (
                      <button onClick={() => removerArquivo(i)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 2, display: 'flex', alignItems: 'center' }}>
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Barra de progresso */}
            {uploadProgress !== null && (
              <div style={{ marginTop: 12 }}>
                <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: C.green, width: `${uploadProgress}%`, transition: 'width 0.3s ease', borderRadius: 2 }} />
                </div>
                <p style={{ color: C.textMuted, fontSize: 12, margin: '6px 0 0', textAlign: 'center' }}>Enviando arquivos… {uploadProgress}%</p>
              </div>
            )}
          </div>

          {/* Dados do signatário */}
          <div style={{ margin: '20px 20px 0' }}>
            <div style={{ marginBottom: 14, position: 'relative' }}>
              <label style={labelStyle}>Nome completo *</label>
              <div style={{ position: 'relative' }}>
                <User size={16} color={C.textMuted} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input type="text" placeholder="Seu nome completo" value={nome} onChange={e => setNome(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: 16, position: 'relative' }}>
              <label style={labelStyle}>E-mail <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color={C.textMuted} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
              </div>
            </div>
          </div>

          {/* Checkbox + botão */}
          <div style={{ margin: '0 20px 32px' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: 20 }}>
              <div onClick={() => setConcordo(c => !c)} style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1, border: `2px solid ${concordo ? C.green : C.border}`, background: concordo ? C.green : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', cursor: 'pointer' }}>
                {concordo && <Check size={14} color="white" strokeWidth={3} />}
              </div>
              <span style={{ color: C.textMuted, fontSize: 14, lineHeight: 1.5, userSelect: 'none' }}>
                Confirmo que assinei e rubrique o contrato conforme as instruções acima e enviei o arquivo assinado
              </span>
            </label>

            {erro && (
              <div style={{ background: '#ef444418', border: '1px solid #ef444444', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={15} color="#ef4444" />
                <span style={{ color: '#ef4444', fontSize: 13 }}>{erro}</span>
              </div>
            )}

            <button onClick={handleConfirm} disabled={saving} style={{ width: '100%', padding: '15px 0', background: saving ? `${C.green}88` : C.green, border: 'none', borderRadius: 12, cursor: saving ? 'not-allowed' : 'pointer', color: 'white', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: 'system-ui, sans-serif', boxShadow: saving ? 'none' : `0 4px 20px ${C.green}44` }}>
              {saving
                ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />{uploadProgress !== null ? `Enviando arquivos ${uploadProgress}%…` : 'Registrando…'}</>
                : <><Check size={18} /> Confirmar Assinatura</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Sem contrato PDF: modal flutuante simples ─────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, boxSizing: 'border-box' }}
      onClick={onClose}>
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 20, padding: '32px 28px', maxWidth: 480, width: '100%', boxShadow: '0 20px 80px rgba(0,0,0,0.6)', animation: 'modalIn 0.3s cubic-bezier(.16,1,.3,1) both', position: 'relative' }}
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 4, borderRadius: 8, display: 'flex', alignItems: 'center' }}>
          <X size={18} />
        </button>
        <h2 style={{ color: C.text, fontSize: 20, fontWeight: 800, margin: '0 0 6px' }}>Confirmar Aprovação</h2>
        <p style={{ color: C.textMuted, fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>
          Para formalizar a aprovação desta proposta, preencha seus dados abaixo.
        </p>
        {/* Nome */}
        <div style={{ marginBottom: 16, position: 'relative' }}>
          <label style={labelStyle}>Nome completo *</label>
          <div style={{ position: 'relative' }}>
            <User size={16} color={C.textMuted} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input type="text" placeholder="Seu nome completo" value={nome} onChange={e => setNome(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ marginBottom: 20, position: 'relative' }}>
          <label style={labelStyle}>E-mail <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></label>
          <div style={{ position: 'relative' }}>
            <Mail size={16} color={C.textMuted} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: 24 }}>
          <div onClick={() => setConcordo(c => !c)} style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1, border: `2px solid ${concordo ? C.green : C.border}`, background: concordo ? C.green : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', cursor: 'pointer' }}>
            {concordo && <Check size={14} color="white" strokeWidth={3} />}
          </div>
          <span style={{ color: C.textMuted, fontSize: 14, lineHeight: 1.5, userSelect: 'none' }}>Li e concordo com todos os termos desta proposta</span>
        </label>
        {erro && (
          <div style={{ background: '#ef444418', border: '1px solid #ef444444', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={15} color="#ef4444" />
            <span style={{ color: '#ef4444', fontSize: 13 }}>{erro}</span>
          </div>
        )}
        <button onClick={handleConfirm} disabled={saving} style={{ width: '100%', padding: '14px 0', background: saving ? `${C.green}88` : C.green, border: 'none', borderRadius: 12, cursor: saving ? 'not-allowed' : 'pointer', color: 'white', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: 'system-ui, sans-serif', boxShadow: saving ? 'none' : `0 4px 20px ${C.green}44` }}>
          {saving ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Registrando…</> : <><Check size={18} /> Confirmar Aprovação</>}
        </button>
      </div>
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────────────────────
const PropostaDocPublica: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const [loading, setLoading]               = useState(true);
  const [notFound, setNotFound]             = useState(false);
  const [projectId, setProjectId]           = useState<string>('');
  const [proposta, setProposta]             = useState<PropostaDocumento | null>(null);
  const [projectNome, setProjectNome]       = useState('');
  const [clienteNome, setClienteNome]       = useState('');
  const [htmlApresentacao, setHtmlApresentacao] = useState<string | null>(null);
  const [pdfApresentacao, setPdfApresentacao]   = useState<string | null>(null);
  const [pdfDescritivo, setPdfDescritivo]       = useState<string | null>(null);
  const [contratoPdfUrl, setContratoPdfUrl]     = useState<string | null>(null);
  const [slidesSlug, setSlidesSlug]             = useState<string | null>(null);
  const [viewerError, setViewerError]           = useState(false);
  const [showModal, setShowModal]           = useState(false);
  const [showPdfModal, setShowPdfModal]     = useState(false);
  const [wowMoment, setWowMoment]           = useState(false);
  const [wowNome, setWowNome]               = useState('');
  const [wowData, setWowData]               = useState<Date>(new Date());

  // ── Busca por slug ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return; }
    const fetch = async () => {
      try {
        const q = query(
          collection(db, CollectionName.PROJECTS_V2),
          where('propostaDocumento.slug', '==', slug),
        );
        const snap = await getDocs(q);
        if (snap.empty) { setNotFound(true); setLoading(false); return; }
        const d = snap.docs[0];
        const data = { id: d.id, ...d.data() } as ProjectV2;
        if (!data.propostaDocumento) { setNotFound(true); setLoading(false); return; }
        setProjectId(d.id);
        setProposta(data.propostaDocumento);
        setProjectNome(data.nome ?? '');
        setClienteNome(data.clientName ?? '');
        setHtmlApresentacao(data.propostaDados?.htmlUrl ?? null);
        setPdfApresentacao(data.propostaDados?.pdfUrl ?? null);
        setPdfDescritivo(data.propostaDados?.pdfDescritivo ?? null);
        setContratoPdfUrl(data.propostaDocumento?.contratoPdfUrl ?? null);
        // Fallback: slug da apresentação de slides do sistema
        const versoes = data.propostaVersoes;
        if (!data.propostaDados?.pdfUrl && versoes?.length) {
          const slug = versoes[versoes.length - 1].slug;
          if (slug) setSlidesSlug(slug);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [slug]);

  // ── Aceite ────────────────────────────────────────────────────────────────
  const handleConfirm = useCallback(async (nome: string, email: string, contratoUrls?: string[]) => {
    const now = Timestamp.now();
    const updateData: Record<string, unknown> = {
      'propostaDocumento.status':         'aceito',
      'propostaDocumento.aceitoEm':       now,
      'propostaDocumento.aceitoPor':      nome,
      'propostaDocumento.aceitoPorEmail': email,
    };
    if (contratoUrls && contratoUrls.length > 0) {
      updateData['propostaDocumento.contratoAssinadoUrls'] = contratoUrls;
    }
    await updateDoc(doc(db, CollectionName.PROJECTS_V2, projectId), updateData);
    setWowNome(nome);
    setWowData(now.toDate());
    setShowModal(false);
    setWowMoment(true);
    // Atualiza estado local
    setProposta(prev => prev ? {
      ...prev,
      status: 'aceito',
      aceitoEm: now,
      aceitoPor: nome,
      aceitoPorEmail: email,
      ...(contratoUrls && contratoUrls.length > 0 ? { contratoAssinadoUrls: contratoUrls } : {}),
    } : prev);
  }, [projectId]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: C.bg, fontFamily: 'system-ui, sans-serif',
    }}>
      <style>{KEYFRAMES}</style>
      <Loader2 size={40} color={C.accent} style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );

  // ── Not found ─────────────────────────────────────────────────────────────
  if (notFound || !proposta) return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: C.bg, color: C.textMuted, gap: 16,
      fontFamily: 'system-ui, sans-serif', padding: 24, textAlign: 'center',
    }}>
      <style>{KEYFRAMES}</style>
      <AlertCircle size={48} color="#ef4444" />
      <h1 style={{ color: C.text, fontSize: 26, fontWeight: 800, margin: 0 }}>
        Proposta não encontrada
      </h1>
      <p style={{ maxWidth: 360, margin: 0 }}>
        O link pode ter expirado ou a proposta foi removida. Entre em contato com a MGR.
      </p>
      <div style={{ marginTop: 16 }}>
        <MGRLogo size={34} />
      </div>
    </div>
  );

  // ── WOW MOMENT ───────────────────────────────────────────────────────────
  if (wowMoment) return (
    <>
      <style>{KEYFRAMES}</style>
      <WowMoment
        nome={wowNome}
        mensagem={proposta.mensagemProxPassos}
        aceitoEm={wowData}
      />
    </>
  );

  // ── Cláusulas ordenadas ───────────────────────────────────────────────────
  const clausulas = [...(proposta.clausulas ?? [])].sort((a, b) => a.ordem - b.ordem);
  const jaAceita   = proposta.status === 'aceito';
  const eRascunho  = proposta.status === 'rascunho';

  const aceitoEmFormatado = proposta.aceitoEm
    ? format(proposta.aceitoEm.toDate(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
    : '';

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      fontFamily: 'system-ui, sans-serif', color: C.text,
    }}>
      <style>{KEYFRAMES}</style>

      {/* ── Header fixo ────────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: `${C.bg}f0`, backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${C.border}`,
        padding: '0 24px',
      }}>
        <div style={{
          maxWidth: 800, margin: '0 auto',
          height: 64, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 16,
        }}>
          <MGRLogo size={36} />
          <div style={{ textAlign: 'right', minWidth: 0 }}>
            {projectNome && (
              <div style={{
                color: C.text, fontWeight: 700, fontSize: 14,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {projectNome}
              </div>
            )}
            {clienteNome && (
              <div style={{ color: C.textMuted, fontSize: 12 }}>{clienteNome}</div>
            )}
          </div>
        </div>
      </header>

      {/* ── Corpo ──────────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px 120px' }}>

        {/* Título do documento */}
        <div style={{ marginBottom: 40, animation: 'fadeIn 0.5s both' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: `${C.accent}18`, border: `1px solid ${C.accent}40`,
            borderRadius: 20, padding: '4px 14px', marginBottom: 20,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent }} />
            <span style={{ color: C.accent, fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              Proposta Comercial
            </span>
          </div>
          <h1 style={{
            fontSize: 'clamp(24px, 5vw, 38px)', fontWeight: 900,
            color: C.text, margin: 0, lineHeight: 1.2,
          }}>
            {proposta.titulo || 'Proposta Comercial'}
          </h1>
          {clienteNome && (
            <p style={{ color: C.textMuted, fontSize: 16, margin: '10px 0 0' }}>
              Destinatário: <strong style={{ color: C.text }}>{clienteNome}</strong>
            </p>
          )}
        </div>

        {/* Banner "Já aceita" */}
        {jaAceita && (
          <div style={{
            background: `${C.green}15`, border: `1px solid ${C.green}44`,
            borderRadius: 14, padding: '18px 22px', marginBottom: 40,
            display: 'flex', alignItems: 'flex-start', gap: 14,
            animation: 'slideDown 0.4s both',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: C.green,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Check size={18} color="white" strokeWidth={3} />
            </div>
            <div>
              <p style={{ color: C.green, fontWeight: 700, fontSize: 15, margin: '0 0 4px' }}>
                Esta proposta já foi aceita
              </p>
              <p style={{ color: C.textMuted, fontSize: 14, margin: 0, lineHeight: 1.5 }}>
                Aceita em <strong style={{ color: C.text }}>{aceitoEmFormatado}</strong>
                {proposta.aceitoPor && (
                  <> por <strong style={{ color: C.text }}>{proposta.aceitoPor}</strong></>
                )}
              </p>
            </div>
          </div>
        )}

        {/* ── Viewer Apresentação (HTML, PDF ou Slides do sistema) ── */}
        {(htmlApresentacao || pdfApresentacao || slidesSlug) && (() => {
          const isHtml = !!htmlApresentacao;
          const isSlidesEmbed = !htmlApresentacao && !pdfApresentacao && !!slidesSlug;

          // Prioridade: HTML > PDF > Slides do sistema
          const viewerSrc = htmlApresentacao
            ? htmlApresentacao
            : pdfApresentacao
            ? `${pdfApresentacao}#toolbar=0&navpanes=0&view=FitH`
            : `${window.location.origin}/#/p/${slidesSlug}`;

          const openHref = htmlApresentacao || pdfApresentacao || `${window.location.origin}/#/p/${slidesSlug}`;

          const viewerLabel = isHtml
            ? 'Apresentação da Proposta'
            : isSlidesEmbed
            ? 'Apresentação da Proposta'
            : 'Apresentação da Proposta (PDF)';

          return (
            <div style={{
              marginBottom: 40, borderRadius: 16, overflow: 'hidden',
              border: `1px solid ${C.border}`, animation: 'fadeIn 0.6s 0.1s both',
            }}>
              {/* Barra do viewer */}
              <div style={{
                background: C.bgCard2, padding: '12px 18px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: `1px solid ${C.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `${C.accent}22`, border: `1px solid ${C.accent}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Eye size={15} color={C.accent} />
                  </div>
                  <span style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>
                    {viewerLabel}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {pdfDescritivo && (
                    <button
                      onClick={() => setShowPdfModal(true)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        color: 'white', fontSize: 12, fontFamily: 'system-ui, sans-serif',
                        padding: '6px 12px', borderRadius: 8, border: 'none',
                        background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`,
                        cursor: 'pointer', fontWeight: 700,
                        boxShadow: `0 2px 10px ${C.accent}44`,
                      }}>
                      <FileText size={13} /> Ver Proposta Descritiva
                    </button>
                  )}
                  <a href={openHref} target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      color: C.textMuted, fontSize: 12, textDecoration: 'none',
                      padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
                    }}>
                    <ExternalLink size={13} /> Abrir em nova aba
                  </a>
                </div>
              </div>

              {/* Viewer da apresentação */}
              <div style={{ background: '#000' }}>
                <iframe
                  key={viewerSrc}
                  src={viewerSrc}
                  style={{ width: '100%', height: 'min(80vh, 640px)', border: 'none', display: 'block' }}
                  title="Apresentação da Proposta"
                  onError={() => setViewerError(true)}
                  {...(isHtml ? { sandbox: 'allow-scripts allow-same-origin allow-popups' } : {})}
                />
              </div>
            </div>
          );
        })()}

        {/* Cláusulas — exibidas apenas se existirem (uso interno/opcional) */}
        {clausulas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {clausulas.map((clausula, idx) => (
              <ClausulaCard key={clausula.id} clausula={clausula} index={idx} />
            ))}
          </div>
        )}
      </main>

      {/* ── Modal PDF Descritivo ── */}
      {showPdfModal && pdfDescritivo && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column',
          animation: 'fadeIn 0.2s both',
        }}>
          {/* Barra superior */}
          <div style={{
            height: 56, background: C.bgCard2, borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 20px', flexShrink: 0, gap: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MGRLogo size={28} />
              <span style={{ color: C.text, fontWeight: 700, fontSize: 14, marginLeft: 4 }}>
                Proposta Descritiva
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <a href={pdfDescritivo} target="_blank" rel="noopener noreferrer" download
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, color: C.textMuted,
                  fontSize: 13, textDecoration: 'none', padding: '6px 14px',
                  borderRadius: 8, border: `1px solid ${C.border}`, fontFamily: 'system-ui, sans-serif',
                }}>
                <Download size={14} /> Baixar
              </a>
              <button
                onClick={() => setShowPdfModal(false)}
                style={{
                  background: 'transparent', border: `1px solid ${C.border}`,
                  borderRadius: 8, cursor: 'pointer', color: C.textMuted,
                  padding: '6px 10px', display: 'flex', alignItems: 'center',
                  transition: 'color 0.2s',
                }}>
                <X size={16} />
              </button>
            </div>
          </div>
          {/* iframe PDF direto com hash params */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <iframe
              src={`${pdfDescritivo}#toolbar=0&navpanes=0`}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Proposta Descritiva"
            />
          </div>
        </div>
      )}

      {/* ── Aviso rascunho ─────────────────────────────────────────────────── */}
      {eRascunho && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
          background: `${C.bg}f5`, backdropFilter: 'blur(20px)',
          borderTop: `1px solid ${C.border}`,
          padding: '14px 24px',
        }}>
          <div style={{
            maxWidth: 800, margin: '0 auto',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
            <p style={{ color: C.textMuted, fontSize: 13, margin: 0, textAlign: 'center' }}>
              Esta proposta está em preparação e ainda não está disponível para aceite online.
            </p>
          </div>
        </div>
      )}

      {/* ── Rodapé com botão de aceite ──────────────────────────────────────── */}
      {!jaAceita && !eRascunho && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
          background: `${C.bg}f5`, backdropFilter: 'blur(20px)',
          borderTop: `1px solid ${C.border}`,
          padding: '20px 24px',
        }}>
          <div style={{
            maxWidth: 800, margin: '0 auto',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          }}>
            <button
              onClick={() => setShowModal(true)}
              style={{
                background: `linear-gradient(135deg, ${C.green}, ${C.greenDark})`,
                border: 'none', borderRadius: 14, cursor: 'pointer',
                color: 'white', fontWeight: 800, fontSize: 17,
                padding: '16px 48px', width: '100%', maxWidth: 440,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                fontFamily: 'system-ui, sans-serif',
                boxShadow: `0 6px 30px ${C.green}44`,
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 10px 40px ${C.green}55`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 6px 30px ${C.green}44`;
              }}
            >
              <Check size={20} strokeWidth={3} />
              ✅ Aprovar Proposta
            </button>
            <p style={{ color: C.textMuted, fontSize: 12, margin: 0, textAlign: 'center' }}>
              Ao aceitar, você confirma que leu e concorda com todos os termos desta proposta.
            </p>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ModalAceite
          onClose={() => setShowModal(false)}
          onConfirm={handleConfirm}
          contratoPdfUrl={contratoPdfUrl}
          projectId={projectId}
        />
      )}
    </div>
  );
};

// ── Card de cláusula (componente separado para evitar re-render) ──────────────
const ClausulaCard: React.FC<{
  clausula: { id: string; titulo: string; corpo: string; ordem: number };
  index: number;
}> = ({ clausula, index }) => {
  const [expanded, setExpanded] = useState(true);

  // Cláusulas longas começam colapsadas em mobile
  useEffect(() => {
    if (clausula.corpo.length > 600 && window.innerWidth < 640) {
      setExpanded(false);
    }
  }, [clausula.corpo]);

  return (
    <div
      style={{
        background: C.bgCard, border: `1px solid ${C.border}`,
        borderRadius: 14, overflow: 'hidden',
        animation: `fadeIn 0.5s ${index * 0.07}s both`,
        boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
      }}
    >
      {/* Header da cláusula */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', background: 'transparent', border: 'none',
          cursor: 'pointer', padding: '18px 22px',
          display: 'flex', alignItems: 'center', gap: 16,
          textAlign: 'left', fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Número */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `${C.accent}22`, border: `1px solid ${C.accent}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: C.accent, fontWeight: 800, fontSize: 14,
        }}>
          {String(clausula.ordem).padStart(2, '0')}
        </div>

        {/* Título */}
        <span style={{
          color: C.text, fontWeight: 700, fontSize: 16, flex: 1, lineHeight: 1.3,
        }}>
          {clausula.titulo}
        </span>

        {/* Chevron */}
        <ChevronDown
          size={18}
          color={C.textMuted}
          style={{
            flexShrink: 0,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.25s ease',
          }}
        />
      </button>

      {/* Corpo */}
      {expanded && (
        <div style={{
          padding: '0 22px 22px 74px',
          borderTop: `1px solid ${C.border}`,
          paddingTop: 16,
          animation: 'slideDown 0.25s ease both',
        }}>
          <div style={{
            color: C.textMuted, fontSize: 15, lineHeight: 1.8,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {clausula.corpo}
          </div>
        </div>
      )}
    </div>
  );
};

export default PropostaDocPublica;
