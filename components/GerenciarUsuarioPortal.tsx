/**
 * components/GerenciarUsuarioPortal.tsx
 * Painel de gestão de um usuário do Portal do Cliente — ativar/desativar,
 * autorizações (abrir chamado / ver contrato / ver ativos), papel na
 * hierarquia do cliente (clientRole), matriz de permissões de Frota do
 * admin_secundario, veículos vinculados ao motorista, e redefinir senha.
 * Mesmos Cloud Functions usados pra colaborador interno em Users.tsx
 * (adminSetUserActive, adminResetUserPassword), mais a adminUpdateClientAuthorizations
 * (estendida na Fase 0 do subsistema multi-tenant pra aceitar clientRole/
 * clientPermissions/vehicleIds — a função valida tudo de novo no servidor).
 * Usado tanto em ClientPortalUsers.tsx (aba Usuários de um cliente) quanto em
 * UsuariosGeral.tsx (Gestão Geral de Usuários) — mesmo componente, sem duplicar.
 *
 * IMPORTANTE: hoje este componente só é renderizado em telas de staff MGR.
 * Se um dia for reaproveitado dentro do próprio Portal (pro Admin Mestre
 * gerenciar o próprio time), o option "Admin Mestre" do select de clientRole
 * precisa ser escondido pra quem não for staff — a Cloud Function já bloqueia
 * isso no servidor, mas a UI não deveria nem oferecer a opção nesse cenário.
 */
import React, { useEffect, useState } from 'react';
import {
  Loader2, Check, X, ShieldOff, ShieldCheck, KeyRound, Eye, EyeOff, AlertTriangle, Crown, Truck,
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { functions, db } from '../firebase';
import { UserProfile, ClientRole, ClientPermissionSet, CollectionName, FleetVehicle } from '../types';

const CLIENT_ROLE_LABEL: Record<ClientRole, string> = {
  admin_mestre: 'Admin Mestre',
  admin_secundario: 'Admin Secundário',
  motorista: 'Motorista',
  equipe_producao: 'Equipe de Produção',
};

const FROTA_PERMISSION_FIELDS: { key: keyof ClientPermissionSet; label: string }[] = [
  { key: 'fleetCadastrarVeiculos', label: 'Cadastrar/editar veículos' },
  { key: 'fleetCadastrarPrestadores', label: 'Cadastrar/editar prestadores de serviço' },
  { key: 'fleetRelatarNecessidade', label: 'Relatar necessidade de manutenção' },
  { key: 'fleetAbrirManutencaoFormal', label: 'Abrir manutenção formal (vincular prestador)' },
  { key: 'fleetVerHistoricoFrota', label: 'Ver histórico de manutenção de toda a frota' },
  { key: 'fleetGerarRelatorios', label: 'Gerar relatórios e exportações' },
];

const GerenciarUsuarioPortal: React.FC<{ user: UserProfile; onClose: () => void }> = ({ user, onClose }) => {
  const [togglingActive, setTogglingActive] = useState(false);

  const [podeAbrirChamado, setPodeAbrirChamado] = useState(user.podeAbrirChamado !== false);
  const [podeVerContrato, setPodeVerContrato] = useState(user.podeVerContrato !== false);
  const [podeVerAtivos, setPodeVerAtivos] = useState(user.podeVerAtivos !== false);

  const [clientRole, setClientRole] = useState<ClientRole>(user.clientRole || 'equipe_producao');
  const [clientPermissions, setClientPermissions] = useState<Partial<ClientPermissionSet>>(user.clientPermissions || {});
  const [vehicleIds, setVehicleIds] = useState<string[]>(user.vehicleIds || []);
  const [veiculos, setVeiculos] = useState<FleetVehicle[]>([]);

  const [savingAuth, setSavingAuth] = useState(false);
  const [authSaved, setAuthSaved] = useState(false);

  const [showSenha, setShowSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  const nomeUsuario = user.nomeCompleto || user.displayName || user.email;

  useEffect(() => {
    if (clientRole !== 'motorista' || !user.clientId) return;
    const q = query(collection(db, CollectionName.FLEET_VEHICLES), where('clientId', '==', user.clientId));
    const unsub = onSnapshot(q, snap => setVeiculos(snap.docs.map(d => ({ id: d.id, ...d.data() } as FleetVehicle))));
    return () => unsub();
  }, [clientRole, user.clientId]);

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
      const payload: Record<string, any> = { targetUid: user.uid, podeAbrirChamado, podeVerContrato, podeVerAtivos, clientRole };
      if (clientRole === 'admin_secundario') payload.clientPermissions = clientPermissions;
      if (clientRole === 'motorista') payload.vehicleIds = vehicleIds;
      await fn(payload);
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

      {/* Papel na hierarquia do cliente */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
        <p className="text-xs font-bold text-gray-700 flex items-center gap-1.5"><Crown size={13} className="text-amber-500" /> Papel no subsistema</p>
        <select value={clientRole} onChange={e => setClientRole(e.target.value as ClientRole)}
          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white">
          {(Object.keys(CLIENT_ROLE_LABEL) as ClientRole[]).map(r => (
            <option key={r} value={r}>{CLIENT_ROLE_LABEL[r]}</option>
          ))}
        </select>
        {clientRole === 'admin_mestre' && (
          <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
            Admin Mestre gerencia os próprios sub-usuários do cliente. Só a equipe MGR pode designar ou remover esse papel.
          </p>
        )}

        {clientRole === 'admin_secundario' && (
          <div className="pt-1 space-y-1.5 border-t border-gray-100 mt-1">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Permissões de Frota</p>
            {FROTA_PERMISSION_FIELDS.map(f => (
              <label key={f.key} className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={clientPermissions[f.key] === true}
                  onChange={e => setClientPermissions(prev => ({ ...prev, [f.key]: e.target.checked }))} />
                {f.label}
              </label>
            ))}
          </div>
        )}

        {clientRole === 'motorista' && (
          <div className="pt-1 space-y-1.5 border-t border-gray-100 mt-1">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><Truck size={11} /> Veículos vinculados</p>
            {veiculos.length === 0 ? (
              <p className="text-[10px] text-gray-400">Nenhum veículo cadastrado ainda pra este cliente.</p>
            ) : (
              veiculos.map(v => (
                <label key={v.id} className="flex items-center gap-2 text-xs text-gray-600">
                  <input type="checkbox" checked={vehicleIds.includes(v.id)}
                    onChange={e => setVehicleIds(prev => e.target.checked ? [...prev, v.id] : prev.filter(id => id !== v.id))} />
                  {v.placa} — {v.modelo}
                </label>
              ))
            )}
          </div>
        )}
      </div>

      {/* Autorizações — Câmaras Frias */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
        <p className="text-xs font-bold text-gray-700">Autorizações — Câmaras Frias</p>
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
          {authSaved ? 'Salvo!' : 'Salvar Autorizações e Papel'}
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
