/**
 * components/ClientPortalUsers.tsx
 * Gestão de usuários com acesso ao Portal do Cliente — permite cadastrar um
 * ou mais logins (role 'cliente') vinculados a este clientId, que poderão
 * abrir chamados de contrato SLA. Mesmo padrão visual de ClientContratoSLA.tsx.
 */
import React, { useState, useEffect } from 'react';
import {
  UserPlus, Loader2, Check, X, Mail, ShieldOff, ShieldCheck, Settings,
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { CollectionName, UserProfile } from '../types';
import GerenciarUsuarioPortal from './GerenciarUsuarioPortal';

interface Props {
  clientId: string;
  clientName?: string;
}

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
