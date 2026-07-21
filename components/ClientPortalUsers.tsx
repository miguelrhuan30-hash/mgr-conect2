/**
 * components/ClientPortalUsers.tsx
 * Gestão de usuários com acesso ao Portal do Cliente — permite cadastrar um
 * ou mais logins (role 'cliente') vinculados a este clientId, que poderão
 * abrir chamados de contrato SLA. Mesmo padrão visual de ClientContratoSLA.tsx.
 */
import React, { useState, useEffect } from 'react';
import {
  UserPlus, Loader2, Check, X, Mail, ShieldOff, ShieldCheck, Settings,
  KeyRound, Eye, EyeOff, AlertTriangle,
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { CollectionName, UserProfile } from '../types';

interface Props {
  clientId: string;
  clientName?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAINEL DE GESTÃO DE UM USUÁRIO DO PORTAL
   Ativar/Desativar, autorizações (abrir chamado / ver contrato / ver ativos)
   e redefinir senha — mesmos Cloud Functions usados pra colaborador interno
   em Users.tsx (adminSetUserActive, adminResetUserPassword), mais a nova
   adminUpdateClientAuthorizations.
   ═══════════════════════════════════════════════════════════════════════════ */
const GerenciarUsuarioPortal: React.FC<{ user: UserProfile; onClose: () => void }> = ({ user, onClose }) => {
  const [togglingActive, setTogglingActive] = useState(false);

  const [podeAbrirChamado, setPodeAbrirChamado] = useState(user.podeAbrirChamado !== false);
  const [podeVerContrato, setPodeVerContrato] = useState(user.podeVerContrato !== false);
  const [podeVerAtivos, setPodeVerAtivos] = useState(user.podeVerAtivos !== false);
  const [savingAuth, setSavingAuth] = useState(false);
  const [authSaved, setAuthSaved] = useState(false);

  const [showSenha, setShowSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  const nomeUsuario = user.nomeCompleto || user.displayName || user.email;

  const handleToggleActive = async () => {
    const ativo = user.ativo === false;
    const confirmMsg = ativo
      ? `Reativar ${nomeUsuario}? Ele volta a ter acesso ao Portal.`
      : `Desativar ${nomeUsuario}?\n\nEle perde o acesso ao Portal imediatamente.`;
    if (!window.confirm(confirmMsg)) return;
    setTogglingActive(true);
    try {
      const fn = httpsCallable(functions, 'adminSetUserActive');
      await fn({ targetUid: user.uid, ativo });
    } catch (e: any) {
      alert(e?.message?.replace('FirebaseError: ', '').replace('functions/', '') || 'Erro ao alterar o acesso.');
    } finally {
      setTogglingActive(false);
    }
  };

  const handleSalvarAutorizacoes = async () => {
    setSavingAuth(true);
    setAuthSaved(false);
    try {
      const fn = httpsCallable(functions, 'adminUpdateClientAuthorizations');
      await fn({ targetUid: user.uid, podeAbrirChamado, podeVerContrato, podeVerAtivos });
      setAuthSaved(true);
    } catch (e: any) {
      alert(e?.message?.replace('FirebaseError: ', '').replace('functions/', '') || 'Erro ao salvar autorizações.');
    } finally {
      setSavingAuth(false);
    }
  };

  const handleResetSenha = async () => {
    setResetError('');
    setResetSuccess(false);
    if (novaSenha.length < 8) { setResetError('A senha deve ter pelo menos 8 caracteres.'); return; }
    if (novaSenha !== confirmSenha) { setResetError('As senhas não coincidem.'); return; }
    setResetLoading(true);
    try {
      const fn = httpsCallable(functions, 'adminResetUserPassword');
      await fn({ targetUid: user.uid, newPassword: novaSenha });
      setResetSuccess(true);
      setNovaSenha(''); setConfirmSenha('');
    } catch (e: any) {
      setResetError(e?.message?.replace('FirebaseError: ', '').replace('functions/', '') || 'Erro ao redefinir senha.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="border-2 border-dashed border-brand-200 rounded-xl p-4 bg-brand-50/20 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-bold text-brand-700">Gerenciar {nomeUsuario}</p>
        <button type="button" onClick={onClose}><X size={14} className="text-gray-400" /></button>
      </div>

      {/* Ativo/Inativo */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
        <div>
          <p className="text-xs font-bold text-gray-700">Acesso ao Portal</p>
          <p className="text-[10px] text-gray-400">{user.ativo === false ? 'Desativado — sem acesso' : 'Ativo'}</p>
        </div>
        <button onClick={handleToggleActive} disabled={togglingActive}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 ${
            user.ativo === false
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
          }`}>
          {togglingActive ? <Loader2 size={13} className="animate-spin" /> : user.ativo === false ? <ShieldCheck size={13} /> : <ShieldOff size={13} />}
          {user.ativo === false ? 'Reativar' : 'Desativar'}
        </button>
      </div>

      {/* Autorizações */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
        <p className="text-xs font-bold text-gray-700">Autorizações no Portal</p>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={podeAbrirChamado} onChange={e => setPodeAbrirChamado(e.target.checked)} />
          Pode abrir chamado novo
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={podeVerContrato} onChange={e => setPodeVerContrato(e.target.checked)} />
          Pode ver o contrato SLA
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={podeVerAtivos} onChange={e => setPodeVerAtivos(e.target.checked)} />
          Pode ver os ativos
        </label>
        <button onClick={handleSalvarAutorizacoes} disabled={savingAuth}
          className="w-full py-2 bg-brand-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">
          {savingAuth ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          {authSaved ? 'Salvo!' : 'Salvar Autorizações'}
        </button>
      </div>

      {/* Alterar senha */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
        <p className="text-xs font-bold text-gray-700">Alterar senha</p>
        {resetSuccess ? (
          <p className="text-xs text-emerald-700 flex items-center gap-1.5"><Check size={13} /> Senha redefinida com sucesso.</p>
        ) : (
          <>
            <div className="relative">
              <input type={showSenha ? 'text' : 'password'} value={novaSenha} onChange={e => setNovaSenha(e.target.value)}
                placeholder="Nova senha (mín. 8 caracteres)" className="w-full pr-9 px-3 py-2 text-xs border border-gray-200 rounded-lg" />
              <button type="button" onClick={() => setShowSenha(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                {showSenha ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <input type={showSenha ? 'text' : 'password'} value={confirmSenha} onChange={e => setConfirmSenha(e.target.value)}
              placeholder="Confirmar senha" className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg" />
            {resetError && (
              <div className="flex items-center gap-1.5 text-[10px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                <AlertTriangle size={11} className="flex-shrink-0" /> {resetError}
              </div>
            )}
            <button onClick={handleResetSenha} disabled={resetLoading || !novaSenha || !confirmSenha}
              className="w-full py-2 bg-orange-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">
              {resetLoading ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
              Definir Senha
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const ClientPortalUsers: React.FC<Props> = ({ clientId, clientName }) => {
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [criado, setCriado] = useState<{ email: string; senha: string } | null>(null);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [managingUid, setManagingUid] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    const q = query(collection(db, CollectionName.USERS), where('clientId', '==', clientId), where('role', '==', 'cliente'));
    return onSnapshot(q, snap => {
      setUsuarios(snap.docs.map(d => ({ ...d.data() } as UserProfile)));
      setLoading(false);
    }, () => setLoading(false));
  }, [clientId]);

  const handleCriar = async () => {
    setError('');
    if (!nome.trim()) { setError('Informe o nome.'); return; }
    if (!email.trim() || !email.includes('@')) { setError('Informe um e-mail válido.'); return; }
    if (senha.length < 8) { setError('A senha temporária deve ter pelo menos 8 caracteres.'); return; }
    if (senha !== confirmSenha) { setError('As senhas não coincidem.'); return; }

    setSaving(true);
    try {
      const createFn = httpsCallable(functions, 'adminCreateClientUser');
      await createFn({
        email: email.trim(),
        password: senha,
        nomeCompleto: nome.trim(),
        clientId,
        clientName: clientName || null,
      });
      setCriado({ email: email.trim(), senha });
      setNome(''); setEmail(''); setSenha(''); setConfirmSenha('');
      setShowAdd(false);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao criar usuário.';
      setError(msg.replace('FirebaseError: ', '').replace('functions/', ''));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-10 text-brand-600">
      <Loader2 size={20} className="animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <UserPlus size={16} className="text-brand-600" />
          Usuários do Portal ({usuarios.length})
        </h3>
        {!showAdd && (
          <button onClick={() => { setShowAdd(true); setCriado(null); }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-brand-600 text-white font-bold hover:bg-brand-700">
            <UserPlus size={12} /> Adicionar Usuário
          </button>
        )}
      </div>

      {criado && (
        <div className="border-2 border-emerald-200 bg-emerald-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5"><Check size={14} /> Acesso criado com sucesso</p>
          <p className="text-xs text-emerald-800">Repasse esses dados ao cliente (ele deve trocar a senha no primeiro acesso):</p>
          <div className="bg-white rounded-lg border border-emerald-200 p-2.5 space-y-1 font-mono text-xs">
            <p><span className="text-gray-400">E-mail:</span> {criado.email}</p>
            <p><span className="text-gray-400">Senha:</span> {criado.senha}</p>
          </div>
          <button onClick={() => setCriado(null)} className="text-xs font-bold text-emerald-700 underline">Fechar</button>
        </div>
      )}

      {showAdd && (
        <div className="border-2 border-dashed border-brand-200 rounded-xl p-4 bg-brand-50/20 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-brand-700">Novo usuário do Portal</p>
            <button type="button" onClick={() => setShowAdd(false)}><X size={14} className="text-gray-400" /></button>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 mb-1 block">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do contato"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 mb-1 block">E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@cliente.com"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 mb-1 block">Senha temporária</label>
              <input type="text" value={senha} onChange={e => setSenha(e.target.value)} placeholder="mín. 8 caracteres"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 mb-1 block">Confirmar senha</label>
              <input type="text" value={confirmSenha} onChange={e => setConfirmSenha(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button onClick={handleCriar} disabled={saving}
            className="w-full py-2 bg-brand-600 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Criar Acesso
          </button>
        </div>
      )}

      {usuarios.length === 0 && !showAdd && !criado ? (
        <div className="text-center py-10 text-gray-400">
          <ShieldOff size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum usuário com acesso ao Portal ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {usuarios.map(u => (
            <div key={u.uid}>
              <div className="flex items-center gap-3 bg-white rounded-lg p-3 border border-gray-200">
                <ShieldCheck size={16} className={u.ativo === false ? 'text-gray-300' : 'text-emerald-500'} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{u.nomeCompleto || u.displayName}</p>
                  <p className="text-[10px] text-gray-400 flex items-center gap-1"><Mail size={9} /> {u.email}</p>
                </div>
                {u.ativo === false && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-gray-50 text-gray-500 border-gray-200">Inativo</span>
                )}
                <button onClick={() => setManagingUid(managingUid === u.uid ? null : u.uid)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 flex-shrink-0">
                  <Settings size={12} /> Gerenciar
                </button>
              </div>
              {managingUid === u.uid && (
                <div className="mt-2">
                  <GerenciarUsuarioPortal user={u} onClose={() => setManagingUid(null)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientPortalUsers;
