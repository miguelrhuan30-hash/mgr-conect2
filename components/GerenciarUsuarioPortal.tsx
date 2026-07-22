/**
 * components/GerenciarUsuarioPortal.tsx
 * Painel de gestão de um usuário do Portal do Cliente — ativar/desativar,
 * autorizações (abrir chamado / ver contrato / ver ativos) e redefinir senha.
 * Mesmos Cloud Functions usados pra colaborador interno em Users.tsx
 * (adminSetUserActive, adminResetUserPassword), mais a adminUpdateClientAuthorizations.
 * Usado tanto em ClientPortalUsers.tsx (aba Usuários de um cliente) quanto em
 * UsuariosGeral.tsx (Gestão Geral de Usuários) — mesmo componente, sem duplicar.
 */
import React, { useState } from 'react';
import {
  Loader2, Check, X, ShieldOff, ShieldCheck, KeyRound, Eye, EyeOff, AlertTriangle,
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { UserProfile } from '../types';

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

      {!user.clientId && (
        <div className="flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle size={13} className="flex-shrink-0" />
          Este usuário não tem um cliente vinculado (clientId ausente no cadastro) — as autorizações abaixo funcionam normalmente, mas ele não verá dados de nenhum cliente no Portal até isso ser corrigido.
        </div>
      )}

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

export default GerenciarUsuarioPortal;
