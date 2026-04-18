/**
 * components/PropostaDocPublica.tsx
 *
 * Página pública de aceite de proposta comercial.
 * Acessível sem login via rota /proposta/:slug
 *
 * Fluxo: busca projeto por propostaDocumento.slug → exibe cláusulas →
 * cliente aceita preenchendo nome/email → WOW MOMENT com confetti CSS.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  collection, query, where, getDocs, updateDoc, doc, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, ProjectV2, PropostaDocumento } from '../types';
import {
  Check, Loader2, AlertCircle, X, Mail, User, ChevronDown,
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

// ── Modal de aceite ───────────────────────────────────────────────────────────
const ModalAceite: React.FC<{
  onClose: () => void;
  onConfirm: (nome: string, email: string) => Promise<void>;
}> = ({ onClose, onConfirm }) => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [concordo, setConcordo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  const handleConfirm = async () => {
    if (!nome.trim()) { setErro('Por favor, informe seu nome completo.'); return; }
    if (!concordo) { setErro('Você precisa concordar com os termos para continuar.'); return; }
    setErro('');
    setSaving(true);
    try {
      await onConfirm(nome.trim(), email.trim());
    } catch {
      setErro('Erro ao registrar aceite. Tente novamente.');
      setSaving(false);
    }
  };

  // Fechar com ESC
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: '12px 14px 12px 42px',
    color: C.text, fontSize: 15, outline: 'none',
    fontFamily: 'system-ui, sans-serif',
    transition: 'border-color 0.2s',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.bgCard, border: `1px solid ${C.border}`,
          borderRadius: 20, padding: '32px 28px', maxWidth: 480, width: '100%',
          boxShadow: '0 20px 80px rgba(0,0,0,0.6)',
          animation: 'modalIn 0.3s cubic-bezier(.16,1,.3,1) both',
          position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Fechar */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'transparent', border: 'none',
            cursor: 'pointer', color: C.textMuted, padding: 4, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={18} />
        </button>

        <h2 style={{ color: C.text, fontSize: 20, fontWeight: 800, margin: '0 0 6px' }}>
          Confirmar Aceite
        </h2>
        <p style={{ color: C.textMuted, fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>
          Para formalizar o aceite desta proposta, preencha seus dados abaixo.
        </p>

        {/* Nome */}
        <div style={{ marginBottom: 16, position: 'relative' }}>
          <label style={{ display: 'block', color: C.textMuted, fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
            Nome completo *
          </label>
          <div style={{ position: 'relative' }}>
            <User size={16} color={C.textMuted} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Seu nome completo"
              value={nome}
              onChange={e => setNome(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* E-mail */}
        <div style={{ marginBottom: 20, position: 'relative' }}>
          <label style={{ display: 'block', color: C.textMuted, fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
            E-mail <span style={{ color: C.textMuted, fontWeight: 400, textTransform: 'none' }}>(opcional)</span>
          </label>
          <div style={{ position: 'relative' }}>
            <Mail size={16} color={C.textMuted} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Checkbox */}
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          cursor: 'pointer', marginBottom: 24,
        }}>
          <div
            onClick={() => setConcordo(c => !c)}
            style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
              border: `2px solid ${concordo ? C.green : C.border}`,
              background: concordo ? C.green : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s', cursor: 'pointer',
            }}
          >
            {concordo && <Check size={14} color="white" strokeWidth={3} />}
          </div>
          <span style={{ color: C.textMuted, fontSize: 14, lineHeight: 1.5, userSelect: 'none' }}>
            Li e concordo com todos os termos desta proposta
          </span>
        </label>

        {/* Erro */}
        {erro && (
          <div style={{
            background: '#ef444418', border: '1px solid #ef444444',
            borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertCircle size={15} color="#ef4444" />
            <span style={{ color: '#ef4444', fontSize: 13 }}>{erro}</span>
          </div>
        )}

        {/* Botão confirmar */}
        <button
          onClick={handleConfirm}
          disabled={saving}
          style={{
            width: '100%', padding: '14px 0',
            background: saving ? `${C.green}88` : C.green,
            border: 'none', borderRadius: 12, cursor: saving ? 'not-allowed' : 'pointer',
            color: 'white', fontWeight: 800, fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            fontFamily: 'system-ui, sans-serif',
            transition: 'background 0.2s, transform 0.1s',
            boxShadow: saving ? 'none' : `0 4px 20px ${C.green}44`,
          }}
        >
          {saving
            ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Registrando...</>
            : <><Check size={18} /> Confirmar Aceite</>
          }
        </button>
      </div>
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────────────────────
const PropostaDocPublica: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const [loading, setLoading]         = useState(true);
  const [notFound, setNotFound]       = useState(false);
  const [projectId, setProjectId]     = useState<string>('');
  const [proposta, setProposta]       = useState<PropostaDocumento | null>(null);
  const [projectNome, setProjectNome] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [showModal, setShowModal]     = useState(false);
  const [wowMoment, setWowMoment]     = useState(false);
  const [wowNome, setWowNome]         = useState('');
  const [wowData, setWowData]         = useState<Date>(new Date());

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
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [slug]);

  // ── Aceite ────────────────────────────────────────────────────────────────
  const handleConfirm = useCallback(async (nome: string, email: string) => {
    const now = Timestamp.now();
    await updateDoc(doc(db, CollectionName.PROJECTS_V2, projectId), {
      'propostaDocumento.status':        'aceito',
      'propostaDocumento.aceitoEm':      now,
      'propostaDocumento.aceitoPor':     nome,
      'propostaDocumento.aceitoPorEmail': email,
    });
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
  const jaAceita  = proposta.status === 'aceito';

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

        {/* Divisor */}
        <div style={{ width: 60, height: 3, borderRadius: 2, background: C.accent, marginBottom: 40 }} />

        {/* Cláusulas */}
        {clausulas.length === 0 ? (
          <p style={{ color: C.textMuted, textAlign: 'center', padding: '40px 0' }}>
            Esta proposta ainda não possui cláusulas.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {clausulas.map((clausula, idx) => (
              <ClausulaCard key={clausula.id} clausula={clausula} index={idx} />
            ))}
          </div>
        )}
      </main>

      {/* ── Rodapé com botão de aceite ──────────────────────────────────────── */}
      {!jaAceita && (
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
              ✅ Aceitar Proposta
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
