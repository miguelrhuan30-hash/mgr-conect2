import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  collection, query, where, getDocs, addDoc, Timestamp,
} from 'firebase/firestore';
import { CollectionName } from '../../types';
import {
  User, Mail, LogOut, Shield, Phone, CreditCard, Building2,
  Clock, CalendarDays, Award, AlertTriangle, ChevronRight,
  CheckCircle2, AlertCircle, XCircle, Send, X, FileText,
  Briefcase, BadgeCheck, Loader2,
} from 'lucide-react';

/* ── helpers ────────────────────────────────────────────── */
const DAYS: Record<string, string> = {
  monday: 'Seg', tuesday: 'Ter', wednesday: 'Qua',
  thursday: 'Qui', friday: 'Sex', saturday: 'Sáb', sunday: 'Dom',
};
const DAY_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const;

function fmtDate(ts: Timestamp | undefined | null): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function certDaysLeft(ts: Timestamp | undefined | null): number | null {
  if (!ts) return null;
  return Math.ceil((ts.toDate().getTime() - Date.now()) / 86400000);
}

type CertStatusKey = 'valida' | 'vencendo' | 'vencida' | 'sem_validade';
function certStatusOf(ts: Timestamp | undefined | null): CertStatusKey {
  if (!ts) return 'sem_validade';
  const d = certDaysLeft(ts)!;
  if (d < 0)  return 'vencida';
  if (d <= 30) return 'vencendo';
  return 'valida';
}
const CERT_BADGE: Record<CertStatusKey, { label: string; cls: string; icon: React.ReactNode }> = {
  valida:      { label: 'Válida',       cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: <CheckCircle2 size={10} /> },
  vencendo:    { label: 'Vencendo',     cls: 'bg-yellow-500/15  text-yellow-400  border-yellow-500/30',  icon: <AlertCircle  size={10} /> },
  vencida:     { label: 'Vencida',      cls: 'bg-red-500/15     text-red-400     border-red-500/30',     icon: <XCircle      size={10} /> },
  sem_validade:{ label: 'Sem validade', cls: 'bg-gray-500/15    text-gray-400    border-gray-500/30',    icon: <BadgeCheck   size={10} /> },
};

type Tab = 'dados' | 'jornada' | 'certificacoes';

/* ── campo de solicitação de alteração ─────────────────── */
interface CampoAlteracao {
  campo: string;
  label: string;
  valorAtual: string;
  valorNovo: string;
}

/* ═══════════════════════════════════════════════════════ */

export default function FieldPerfil() {
  const { currentUser, userProfile } = useAuth();
  const [tab, setTab]               = useState<Tab>('dados');
  const [certs, setCerts]           = useState<any[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(true);

  /* Solicitação de alteração */
  const [showSolicitar, setShowSolicitar] = useState(false);
  const [campos, setCampos]         = useState<CampoAlteracao[]>([]);
  const [motivo, setMotivo]         = useState('');
  const [sending, setSending]       = useState(false);
  const [enviado, setEnviado]       = useState(false);

  const p = userProfile as any;

  /* ── campos incompletos ─────────────────────────────── */
  const camposObrigatorios = [
    { campo: 'nomeCompleto', label: 'Nome completo',  valor: p?.nomeCompleto },
    { campo: 'cpf',          label: 'CPF',            valor: p?.cpf },
    { campo: 'phone',        label: 'Telefone',       valor: p?.phone },
    { campo: 'pixKey',       label: 'Chave Pix',      valor: p?.pixKey },
  ];
  const incompletos = camposObrigatorios.filter(c => !c.valor?.trim());

  /* ── certificações ──────────────────────────────────── */
  useEffect(() => {
    if (!currentUser) return;
    setLoadingCerts(true);
    getDocs(query(
      collection(db, CollectionName.EMPLOYEE_CERTIFICATIONS),
      where('colaboradorId', '==', currentUser.uid),
    )).then(snap => {
      setCerts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(() => setCerts([]))
    .finally(() => setLoadingCerts(false));
  }, [currentUser]);

  /* ── abrir modal de solicitação ─────────────────────── */
  const abrirSolicitar = () => {
    setCampos([
      { campo: 'nomeCompleto', label: 'Nome completo',      valorAtual: p?.nomeCompleto || '', valorNovo: p?.nomeCompleto || '' },
      { campo: 'cargo',        label: 'Cargo / Função',     valorAtual: p?.cargo || '',        valorNovo: p?.cargo || '' },
      { campo: 'cpf',          label: 'CPF',                valorAtual: p?.cpf || '',          valorNovo: p?.cpf || '' },
      { campo: 'phone',        label: 'Telefone',           valorAtual: p?.phone || '',        valorNovo: p?.phone || '' },
      { campo: 'pixKey',       label: 'Chave Pix',         valorAtual: p?.pixKey || '',       valorNovo: p?.pixKey || '' },
      { campo: 'banco',        label: 'Banco',              valorAtual: p?.banco || '',        valorNovo: p?.banco || '' },
      { campo: 'agencia',      label: 'Agência',            valorAtual: p?.agencia || '',      valorNovo: p?.agencia || '' },
      { campo: 'conta',        label: 'Conta',              valorAtual: p?.conta || '',        valorNovo: p?.conta || '' },
    ]);
    setMotivo('');
    setEnviado(false);
    setShowSolicitar(true);
  };

  const enviarSolicitacao = async () => {
    const alterados = campos.filter(c => c.valorNovo.trim() !== c.valorAtual.trim());
    if (alterados.length === 0) { alert('Nenhum campo foi alterado.'); return; }
    if (!motivo.trim()) { alert('Informe o motivo da solicitação.'); return; }
    setSending(true);
    try {
      await addDoc(collection(db, 'profile_change_requests'), {
        uid:            currentUser!.uid,
        nomeRequerente: p?.nomeCompleto || p?.displayName || currentUser!.email,
        emailRequerente: currentUser!.email,
        dadosSolicitados: alterados.map(c => ({
          campo: c.campo, label: c.label,
          valorAtual: c.valorAtual || null,
          valorNovo:  c.valorNovo.trim(),
        })),
        motivoAlteracao: motivo.trim(),
        status: 'pendente',
        criadoEm: Timestamp.now(),
      });
      setEnviado(true);
    } catch { alert('Erro ao enviar solicitação. Tente novamente.'); }
    finally { setSending(false); }
  };

  const updateCampo = (campo: string, valorNovo: string) =>
    setCampos(prev => prev.map(c => c.campo === campo ? { ...c, valorNovo } : c));

  /* ── logout ─────────────────────────────────────────── */
  const handleLogout = () => signOut(auth);

  /* ── jornada ─────────────────────────────────────────── */
  const ws = p?.workSchedule;
  const scheduleType = p?.scheduleType;
  const isFlexivel = scheduleType === 'FLEXIBLE';

  const iniciais = (p?.nomeCompleto || p?.displayName || currentUser?.email || 'U')
    .split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase();
  const photoURL = p?.photoURL || p?.avatar;

  /* ════════════════════ RENDER ═══════════════════════ */
  const lbl = 'block text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-0.5';

  return (
    <>
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header do perfil ────────────────────────── */}
      <div className="flex-shrink-0 bg-gray-900 border-b border-gray-800 px-4 pt-5 pb-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {photoURL ? (
              <img src={photoURL} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500/40" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-emerald-700 flex items-center justify-center text-xl font-black text-white border-2 border-emerald-500/40">
                {iniciais}
              </div>
            )}
            {incompletos.length > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                <span className="text-[9px] font-black text-white">{incompletos.length}</span>
              </div>
            )}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white leading-tight truncate">
              {p?.nomeCompleto || p?.displayName || 'Colaborador'}
            </h2>
            <p className="text-xs text-gray-500 truncate">{p?.cargo || p?.sectorName || 'Sem cargo definido'}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full capitalize">
                {p?.role || 'técnico'}
              </span>
            </div>
          </div>
        </div>

        {/* Banner de dados incompletos */}
        {incompletos.length > 0 && (
          <button
            onClick={abrirSolicitar}
            className="w-full mt-3 flex items-center gap-2.5 bg-orange-500/10 border border-orange-500/30 rounded-xl px-3 py-2.5 active:bg-orange-500/20"
          >
            <AlertTriangle size={15} className="text-orange-400 flex-shrink-0" />
            <div className="flex-1 text-left min-w-0">
              <p className="text-xs font-bold text-orange-300">Perfil incompleto</p>
              <p className="text-[10px] text-orange-500/80 truncate">
                Falta: {incompletos.map(c => c.label).join(', ')}
              </p>
            </div>
            <ChevronRight size={14} className="text-orange-500 flex-shrink-0" />
          </button>
        )}
      </div>

      {/* ── Tabs ────────────────────────────────────── */}
      <div className="flex border-b border-gray-800 bg-gray-900 flex-shrink-0">
        {(['dados','jornada','certificacoes'] as Tab[]).map(t => {
          const LABELS: Record<Tab,string> = { dados: 'Dados', jornada: 'Jornada', certificacoes: 'Certificações' };
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
                tab === t ? 'text-emerald-400 border-b-2 border-emerald-500' : 'text-gray-500 border-b-2 border-transparent'
              }`}
            >
              {LABELS[t]}
              {t === 'certificacoes' && certs.length > 0 && (
                <span className="ml-1 text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">{certs.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Conteúdo ────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">

        {/* ═══ ABA DADOS ══════════════════════════════ */}
        {tab === 'dados' && (
          <div className="space-y-3">
            <InfoRow icon={<User size={14} className="text-blue-400" />}      label="Nome completo"  valor={p?.nomeCompleto} />
            <InfoRow icon={<Briefcase size={14} className="text-purple-400" />} label="Cargo"         valor={p?.cargo} />
            <InfoRow icon={<Mail size={14} className="text-gray-400" />}       label="E-mail"         valor={currentUser?.email} />
            <InfoRow icon={<Phone size={14} className="text-emerald-400" />}   label="Telefone"       valor={p?.phone} />
            <InfoRow icon={<FileText size={14} className="text-yellow-400" />} label="CPF"            valor={p?.cpf} />
            <InfoRow icon={<Shield size={14} className="text-emerald-400" />}  label="Função no sistema" valor={p?.role} />
            <InfoRow icon={<Building2 size={14} className="text-blue-400" />}  label="Setor"          valor={p?.sectorName} />

            {/* Financeiro */}
            <div className="pt-2 border-t border-gray-800/60">
              <p className={`${lbl} text-gray-700 pb-2`}>Dados financeiros</p>
              <div className="space-y-3">
                <InfoRow icon={<CreditCard size={14} className="text-yellow-400" />} label="Chave Pix" valor={p?.pixKey} sensitive />
                <InfoRow icon={<Building2 size={14} className="text-gray-400" />}   label="Banco"     valor={p?.banco} />
                <InfoRow icon={<FileText size={14} className="text-gray-400" />}    label="Agência"   valor={p?.agencia} />
                <InfoRow icon={<FileText size={14} className="text-gray-400" />}    label="Conta"     valor={p?.conta} />
              </div>
            </div>

            {/* Botão de solicitação */}
            <button
              onClick={abrirSolicitar}
              className="w-full flex items-center justify-center gap-2 py-3.5 mt-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl font-bold text-sm active:bg-blue-500/20"
            >
              <Send size={15} /> Solicitar alteração de dados
            </button>
          </div>
        )}

        {/* ═══ ABA JORNADA ════════════════════════════ */}
        {tab === 'jornada' && (
          <div className="space-y-4">
            {!ws ? (
              <div className="flex flex-col items-center py-12 text-gray-600">
                <Clock size={36} className="mb-3 opacity-20" />
                <p className="text-sm font-medium">Jornada não cadastrada</p>
                <p className="text-xs mt-1 text-gray-700">Entre em contato com o RH para cadastrar</p>
              </div>
            ) : !isFlexivel ? (
              /* Jornada fixa */
              <div className="space-y-3">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-3">Horário Fixo</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-[10px] text-gray-600 mb-1">Entrada</p>
                      <p className="text-base font-black text-emerald-400">{ws.startTime || '—'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-600 mb-1">Almoço</p>
                      <p className="text-base font-black text-yellow-400">
                        {ws.lunchDuration ? `${ws.lunchDuration} min` : '—'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-600 mb-1">Saída</p>
                      <p className="text-base font-black text-red-400">{ws.endTime || '—'}</p>
                    </div>
                  </div>
                  {ws.dailyWorkMinutes ? (
                    <div className="mt-3 pt-3 border-t border-gray-800 text-center">
                      <p className="text-[10px] text-gray-600">Carga diária</p>
                      <p className="text-sm font-bold text-white">
                        {Math.floor(ws.dailyWorkMinutes / 60)}h{ws.dailyWorkMinutes % 60 > 0 ? `${ws.dailyWorkMinutes % 60}min` : ''}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              /* Jornada flexível por dia */
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">Jornada Flexível</p>
                {DAY_KEYS.map(day => {
                  const d = ws[day];
                  if (!d?.active) return (
                    <div key={day} className="flex items-center gap-3 bg-gray-900/50 border border-gray-800/50 rounded-xl px-4 py-3 opacity-40">
                      <span className="w-8 text-xs font-bold text-gray-600">{DAYS[day]}</span>
                      <span className="text-xs text-gray-700">Folga</span>
                    </div>
                  );
                  return (
                    <div key={day} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                      <span className="w-8 text-xs font-bold text-emerald-400">{DAYS[day]}</span>
                      <div className="flex items-center gap-1 text-xs text-gray-300">
                        <span>{d.startTime}</span>
                        <span className="text-gray-700">–</span>
                        <span>{d.endTime}</span>
                      </div>
                      <span className="ml-auto text-[10px] text-yellow-500 font-bold">
                        {d.lunchDuration}min almoço
                      </span>
                      {d.dailyWorkMinutes ? (
                        <span className="text-[10px] text-gray-500">
                          {Math.floor(d.dailyWorkMinutes / 60)}h{d.dailyWorkMinutes % 60 > 0 ? `${d.dailyWorkMinutes % 60}m` : ''}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ ABA CERTIFICAÇÕES ══════════════════════ */}
        {tab === 'certificacoes' && (
          <div className="space-y-3">
            {loadingCerts ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-emerald-400" />
              </div>
            ) : certs.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-gray-600">
                <Award size={36} className="mb-3 opacity-20" />
                <p className="text-sm font-medium">Nenhuma certificação registrada</p>
                <p className="text-xs mt-1 text-gray-700">Solicite ao RH o registro das suas NRs e certificados</p>
              </div>
            ) : (
              <>
                {/* Alerta de vencimento */}
                {certs.some(c => ['vencendo','vencida'].includes(certStatusOf(c.dataValidade))) && (
                  <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 mb-1">
                    <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-300">
                      Você tem certificações <strong>vencidas ou próximas do vencimento</strong>. Renove com o RH.
                    </p>
                  </div>
                )}

                {certs.map(cert => {
                  const st = certStatusOf(cert.dataValidade);
                  const badge = CERT_BADGE[st];
                  const dias = cert.dataValidade ? certDaysLeft(cert.dataValidade) : null;
                  return (
                    <div key={cert.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white leading-tight">{cert.nome || cert.tipo}</p>
                          {cert.tipo && cert.nome && cert.tipo !== cert.nome && (
                            <p className="text-[10px] text-blue-400 font-bold mt-0.5">{cert.tipo}</p>
                          )}
                          {cert.emitidoPor && (
                            <p className="text-[10px] text-gray-500 mt-0.5">{cert.emitidoPor}</p>
                          )}
                        </div>
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold flex-shrink-0 ${badge.cls}`}>
                          {badge.icon} {badge.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-800">
                        <div>
                          <p className="text-[10px] text-gray-600">Obtido em</p>
                          <p className="text-xs font-semibold text-gray-300">{fmtDate(cert.dataObtencao)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-600">Validade</p>
                          <div>
                            <p className="text-xs font-semibold text-gray-300">{fmtDate(cert.dataValidade)}</p>
                            {dias !== null && dias >= 0 && dias <= 60 && (
                              <p className={`text-[10px] font-bold ${dias <= 30 ? 'text-red-400' : 'text-yellow-400'}`}>
                                Vence em {dias}d
                              </p>
                            )}
                            {dias !== null && dias < 0 && (
                              <p className="text-[10px] font-bold text-red-400">Venceu há {Math.abs(dias)}d</p>
                            )}
                          </div>
                        </div>
                      </div>
                      {cert.documentoUrl && (
                        <a href={cert.documentoUrl} target="_blank" rel="noreferrer"
                          className="mt-2 flex items-center gap-1.5 text-[10px] text-blue-400 font-semibold">
                          <FileText size={11} /> Ver certificado
                        </a>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-red-600/10 border border-red-500/20 text-red-400 font-bold text-sm active:bg-red-600/20 mt-6"
        >
          <LogOut size={16} /> Sair do app
        </button>
        <div className="h-4" />
      </div>
    </div>

    {/* ═══ MODAL SOLICITAR ALTERAÇÃO ══════════════════════ */}
    {showSolicitar && (
      <div className="fixed inset-0 z-[70] flex flex-col bg-gray-950">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800">
          <button onClick={() => setShowSolicitar(false)} className="p-2 -ml-2 rounded-full active:bg-gray-800">
            <X size={20} className="text-gray-400" />
          </button>
          <div className="flex-1">
            <h2 className="text-base font-bold text-white">Solicitar Alteração</h2>
            <p className="text-[11px] text-gray-500">Aguardará aprovação do administrador</p>
          </div>
        </div>

        {enviado ? (
          /* Confirmação */
          <div className="flex-1 flex flex-col items-center justify-center px-8 gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-emerald-400" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white mb-1">Solicitação enviada!</h3>
              <p className="text-sm text-gray-400">
                O administrador receberá sua solicitação e entrará em contato para confirmar as alterações.
              </p>
            </div>
            <button
              onClick={() => setShowSolicitar(false)}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-sm active:bg-emerald-700 mt-4"
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Aviso */}
            <div className="flex items-start gap-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-3">
              <AlertCircle size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-300">
                Preencha apenas os campos que deseja <strong>alterar ou adicionar</strong>. O administrador
                comparará os valores atuais antes de aprovar.
              </p>
            </div>

            {campos.map(c => (
              <div key={c.campo}>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  {c.label}
                  {c.valorAtual && (
                    <span className="ml-2 normal-case font-normal text-gray-700">
                      atual: <span className="text-gray-600">{c.campo === 'pixKey' && c.valorAtual ? '•••••' + c.valorAtual.slice(-3) : c.valorAtual}</span>
                    </span>
                  )}
                </label>
                <input
                  value={c.valorNovo}
                  onChange={e => updateCampo(c.campo, e.target.value)}
                  placeholder={c.valorAtual || `Informe ${c.label.toLowerCase()}...`}
                  className={`w-full bg-gray-800 border rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors ${
                    c.valorNovo !== c.valorAtual && c.valorNovo.trim()
                      ? 'border-blue-500/60 bg-blue-500/5'
                      : 'border-gray-700'
                  }`}
                />
              </div>
            ))}

            {/* Motivo */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Motivo da solicitação <span className="text-red-400">*</span>
              </label>
              <textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Ex: Troca de conta bancária, número antigo desativado..."
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="h-2" />
          </div>

          {/* Footer */}
          <div className="px-4 py-4 bg-gray-900 border-t border-gray-800">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowSolicitar(false)}
                className="py-4 bg-gray-800 text-gray-300 rounded-2xl font-bold text-sm active:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={enviarSolicitacao}
                disabled={sending || !motivo.trim()}
                className="flex items-center justify-center gap-2 py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm disabled:opacity-50 active:bg-blue-700"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
          </>
        )}
      </div>
    )}
    </>
  );
}

/* ── sub-componente linha de info ─────────────────────── */
function InfoRow({ icon, label, valor, sensitive }: {
  icon: React.ReactNode;
  label: string;
  valor?: string | null;
  sensitive?: boolean;
}) {
  const [mostrar, setMostrar] = useState(false);
  const vazio = !valor?.trim();
  const display = sensitive && !mostrar && !vazio
    ? '••••••••'
    : (valor || '—');

  return (
    <div className={`flex items-center gap-3 bg-gray-900 border rounded-xl px-4 py-3 ${vazio ? 'border-orange-800/30 bg-orange-900/10' : 'border-gray-800'}`}>
      <div className="flex-shrink-0 text-gray-600">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-600 uppercase tracking-wide">{label}</p>
        <p className={`text-sm font-semibold truncate ${vazio ? 'text-orange-500/70 italic' : 'text-white'}`}>
          {vazio ? 'Não informado' : display}
        </p>
      </div>
      {sensitive && !vazio && (
        <button onClick={() => setMostrar(v => !v)} className="flex-shrink-0 p-1 text-gray-600 active:text-gray-400">
          {mostrar
            ? <XCircle size={13} />
            : <CheckCircle2 size={13} />
          }
        </button>
      )}
      {vazio && <AlertTriangle size={13} className="text-orange-500/60 flex-shrink-0" />}
    </div>
  );
}
