/**
 * CentralPendencias — widget para o Dashboard (gestores/admin).
 * Agrega intervenções manuais pendentes:
 *   • Solicitações de alteração de perfil (profile_change_requests)
 * Expandível para outras fontes futuras.
 */
import React, { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot,
  updateDoc, doc, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  ShieldAlert, User, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  Clock, ArrowRight, Loader2, AlertTriangle,
} from 'lucide-react';

/* ─────────────────────────────────────────────── tipos ── */
interface DadoSolicitado {
  campo: string;
  label: string;
  valorAtual: string | null;
  valorNovo: string;
}

interface ProfileChangeRequest {
  id: string;
  uid: string;
  nomeRequerente: string;
  emailRequerente: string;
  dadosSolicitados: DadoSolicitado[];
  motivoAlteracao: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  criadoEm: Timestamp;
}

/* ─────────────────────────────────────────── helpers ── */
const fmtDate = (ts: Timestamp | undefined) =>
  ts ? ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

/* ═══════════════════════════════════════════════════════ */

export default function CentralPendencias() {
  const { currentUser, userProfile } = useAuth();
  const isAdmin = ['admin', 'gestor', 'manager'].includes(userProfile?.role || '');

  const [requests, setRequests]   = useState<ProfileChangeRequest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'profile_change_requests'), where('status', '==', 'pendente'));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProfileChangeRequest));
      docs.sort((a, b) => (b.criadoEm?.seconds ?? 0) - (a.criadoEm?.seconds ?? 0));
      setRequests(docs);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [isAdmin]);

  if (!isAdmin || (requests.length === 0 && !loading)) return null;

  /* ── Aprovar ────────────────────────────────────────── */
  const aprovar = async (req: ProfileChangeRequest) => {
    setProcessing(req.id);
    try {
      // Aplica as mudanças no documento do usuário
      const updates: Record<string, any> = {};
      req.dadosSolicitados.forEach(d => { updates[d.campo] = d.valorNovo; });

      await updateDoc(doc(db, 'users', req.uid), updates);
      await updateDoc(doc(db, 'profile_change_requests', req.id), {
        status: 'aprovado',
        aprovadoPor: currentUser!.uid,
        aprovadoPorNome: (userProfile as any)?.nomeCompleto || (userProfile as any)?.displayName || currentUser!.email,
        aprovadoEm: Timestamp.now(),
      });
      setExpanded(null);
    } catch (e) {
      console.error(e);
      alert('Erro ao aprovar. Tente novamente.');
    } finally {
      setProcessing(null);
    }
  };

  /* ── Rejeitar ───────────────────────────────────────── */
  const rejeitar = async (req: ProfileChangeRequest) => {
    if (!motivoRejeicao.trim()) { alert('Informe o motivo da rejeição.'); return; }
    setProcessing(req.id);
    try {
      await updateDoc(doc(db, 'profile_change_requests', req.id), {
        status: 'rejeitado',
        rejeitadoPor: currentUser!.uid,
        rejeitadoPorNome: (userProfile as any)?.nomeCompleto || currentUser!.email,
        rejeitadoMotivo: motivoRejeicao.trim(),
        rejeitadoEm: Timestamp.now(),
      });
      setRejecting(null);
      setMotivoRejeicao('');
      setExpanded(null);
    } catch (e) {
      alert('Erro ao rejeitar. Tente novamente.');
    } finally {
      setProcessing(null);
    }
  };

  /* ══════════════════════════════ RENDER ════════════════ */
  return (
    <div id="pendencias" className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-amber-50 border-b border-amber-100">
        <div className="flex items-center gap-2.5">
          <ShieldAlert size={17} className="text-amber-600" />
          <div>
            <h3 className="text-sm font-extrabold text-amber-800">Central de Pendências</h3>
            <p className="text-[10px] text-amber-600 mt-0.5">Intervenções que requerem ação do administrador</p>
          </div>
        </div>
        {loading
          ? <Loader2 size={16} className="animate-spin text-amber-500" />
          : <span className="text-[11px] font-extrabold bg-amber-600 text-white px-2.5 py-1 rounded-full">{requests.length}</span>
        }
      </div>

      {/* Requests */}
      <div className="divide-y divide-gray-100">
        {requests.map(req => {
          const isOpen    = expanded === req.id;
          const isReject  = rejecting === req.id;
          const isBusy    = processing === req.id;

          return (
            <div key={req.id} className={`transition-colors ${isOpen ? 'bg-blue-50/40' : 'hover:bg-gray-50'}`}>
              {/* Row summary */}
              <button
                onClick={() => { setExpanded(isOpen ? null : req.id); setRejecting(null); setMotivoRejeicao(''); }}
                className="w-full text-left px-5 py-3.5 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <User size={14} className="text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{req.nomeRequerente}</p>
                  <p className="text-[10px] text-gray-500 truncate">
                    {req.emailRequerente} · {req.dadosSolicitados.length} campo{req.dadosSolicitados.length > 1 ? 's' : ''} · {fmtDate(req.criadoEm)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Clock size={9} /> Pendente
                  </span>
                  {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </div>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="px-5 pb-5 space-y-4">

                  {/* Motivo */}
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-1">Motivo informado</p>
                    <p className="text-sm text-blue-900">{req.motivoAlteracao}</p>
                  </div>

                  {/* Campos solicitados */}
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">Alterações solicitadas</p>
                    <div className="space-y-2">
                      {req.dadosSolicitados.map(d => (
                        <div key={d.campo} className="grid grid-cols-3 gap-2 items-center bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs">
                          <div>
                            <p className="text-[9px] text-gray-400 uppercase font-bold">{d.label}</p>
                            <p className="text-gray-500 line-through mt-0.5">{d.valorAtual || <em className="text-gray-300">vazio</em>}</p>
                          </div>
                          <div className="flex items-center justify-center">
                            <ArrowRight size={13} className="text-gray-300" />
                          </div>
                          <div>
                            <p className="text-[9px] text-emerald-600 uppercase font-bold">Novo</p>
                            <p className="font-bold text-gray-900 mt-0.5">{d.valorNovo}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Alerta para chave Pix */}
                  {req.dadosSolicitados.some(d => d.campo === 'pixKey') && (
                    <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                      <AlertTriangle size={14} className="text-orange-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-orange-700">
                        <strong>Atenção:</strong> Esta solicitação inclui alteração de <strong>Chave Pix</strong>.
                        Confirme com o colaborador por outro canal antes de aprovar.
                      </p>
                    </div>
                  )}

                  {/* Rejeição — campo de motivo */}
                  {isReject && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-red-600 uppercase tracking-wide">Motivo da rejeição</p>
                      <textarea
                        value={motivoRejeicao}
                        onChange={e => setMotivoRejeicao(e.target.value)}
                        placeholder="Explique ao colaborador o motivo da rejeição..."
                        rows={2}
                        className="w-full border border-red-200 bg-red-50 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:border-red-400"
                      />
                    </div>
                  )}

                  {/* Ações */}
                  <div className="flex gap-2.5 pt-1">
                    {!isReject ? (
                      <>
                        <button
                          onClick={() => aprovar(req)}
                          disabled={isBusy}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                          Aprovar alterações
                        </button>
                        <button
                          onClick={() => setRejecting(req.id)}
                          disabled={isBusy}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
                        >
                          <XCircle size={13} />
                          Rejeitar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => rejeitar(req)}
                          disabled={isBusy || !motivoRejeicao.trim()}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                          Confirmar rejeição
                        </button>
                        <button
                          onClick={() => { setRejecting(null); setMotivoRejeicao(''); }}
                          disabled={isBusy}
                          className="px-4 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold text-xs rounded-xl transition-colors"
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
