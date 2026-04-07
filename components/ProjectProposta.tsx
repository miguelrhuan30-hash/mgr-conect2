/**
 * components/ProjectProposta.tsx — Sprint 6
 *
 * Tab "Proposta" do ProjectDetail:
 * - Vincula uma apresentação existente ao projeto
 * - Gera link público compartilhável (/ slug)
 * - Histórico de versões de proposta
 * - Permite enviar link por WhatsApp
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Link2, ExternalLink, Send, Copy, Check, Plus,
  History, RefreshCw, AlertCircle, Loader2, Trash2,
} from 'lucide-react';
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, arrayUnion, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CollectionName, ProjectV2, ProjectV2PropostaVersao } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  project: ProjectV2;
}

interface Apresentacao {
  id: string;
  title?: string;
  nome?: string;
  slug?: string;
  clienteNome?: string;
  updatedAt?: Timestamp;
  createdAt?: Timestamp;
}

const fmtDate = (ts: Timestamp | undefined | null) => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date((ts as any).seconds * 1000);
    return format(d, "dd/MM/yy 'às' HH:mm", { locale: ptBR });
  } catch { return '—'; }
};

const ProjectProposta: React.FC<Props> = ({ project }) => {
  const { currentUser } = useAuth();
  const [apresentacoes, setApresentacoes] = useState<Apresentacao[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState(project.apresentacaoId || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [enviandoWhats, setEnviandoWhats] = useState(false);

  // Carregar apresentações disponíveis
  useEffect(() => {
    const q = query(
      collection(db, CollectionName.PRESENTATIONS),
      orderBy('updatedAt', 'desc'),
    );
    return onSnapshot(q, snap => {
      setApresentacoes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Apresentacao)));
      setLoadingList(false);
    }, () => setLoadingList(false));
  }, []);

  // Apresentação vinculada atualmente
  const apresentacaoVinculada = apresentacoes.find(a => a.id === (project.apresentacaoId || selectedId));
  const linkPublico = apresentacaoVinculada?.slug
    ? `${window.location.origin}/#/apresentacao/${apresentacaoVinculada.slug}`
    : apresentacaoVinculada
    ? `${window.location.origin}/#/apresentacao/${apresentacaoVinculada.id}`
    : null;

  // Versões de proposta
  const versoes: ProjectV2PropostaVersao[] = project.propostaVersoes || [];

  // Vincular apresentação ao projeto
  const handleVincular = useCallback(async () => {
    if (!currentUser || !selectedId) return;
    setSaving(true);
    try {
      const apres = apresentacoes.find(a => a.id === selectedId);
      const novaVersao: ProjectV2PropostaVersao = {
        versao: versoes.length + 1,
        apresentacaoId: selectedId,
        slug: apres?.slug || undefined,
        criadaEm: Timestamp.now(),
      };
      await updateDoc(doc(db, CollectionName.PROJECTS_V2, project.id), {
        apresentacaoId: selectedId,
        propostaVersoes: arrayUnion(novaVersao),
        updatedAt: serverTimestamp(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  }, [currentUser, selectedId, apresentacoes, versoes.length, project.id]);

  // Copiar link
  const copyLink = async () => {
    if (!linkPublico) return;
    await navigator.clipboard.writeText(linkPublico);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Enviar WhatsApp
  const enviarWhatsApp = () => {
    if (!linkPublico) return;
    const msg = encodeURIComponent(
      `Olá! Segue a proposta comercial do seu projeto: ${linkPublico}\n\nQualquer dúvida estou à disposição.`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold text-gray-900 flex items-center gap-2">
          🎨 Proposta Comercial
        </h3>
        {project.apresentacaoId && (
          <a href={`#/app/apresentacoes/${project.apresentacaoId}`}
            className="flex items-center gap-1.5 text-xs text-brand-600 font-bold hover:underline">
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir no Editor
          </a>
        )}
      </div>

      {/* Vinculação de apresentação */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <p className="text-sm font-bold text-gray-700">Vincular Apresentação ao Projeto</p>
        {loadingList ? (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando apresentações...
          </div>
        ) : apresentacoes.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-yellow-800">Nenhuma apresentação encontrada</p>
              <p className="text-xs text-yellow-600 mt-1">Crie uma apresentação no módulo de Apresentações e vincule aqui.</p>
              <a href="#/app/apresentacoes" className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-xs font-bold hover:bg-yellow-700">
                <Plus className="w-3.5 h-3.5" /> Criar Apresentação
              </a>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 flex-col sm:flex-row">
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="">— Selecione uma apresentação —</option>
              {apresentacoes.map(a => (
                <option key={a.id} value={a.id}>
                  {a.title || a.nome || a.id}
                  {a.clienteNome ? ` (${a.clienteNome})` : ''}
                </option>
              ))}
            </select>
            <button
              onClick={handleVincular}
              disabled={!selectedId || saving || selectedId === project.apresentacaoId}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 ${
                saved ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-600 text-white hover:bg-brand-700'
              }`}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
              {saved ? 'Vinculado!' : 'Vincular'}
            </button>
          </div>
        )}
      </div>

      {/* Link público */}
      {linkPublico && (
        <div className="bg-gradient-to-br from-brand-50 to-indigo-50 border border-brand-200 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-extrabold text-brand-800 flex items-center gap-2">
            🔗 Link Público da Proposta
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={linkPublico}
              className="flex-1 bg-white border border-brand-200 rounded-xl px-3 py-2 text-xs font-mono text-gray-700 outline-none"
            />
            <button onClick={copyLink}
              className={`p-2.5 rounded-xl border transition-all ${copied ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={enviarWhatsApp}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors">
              <Send className="w-4 h-4" /> Enviar via WhatsApp
            </button>
            <a href={linkPublico} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors">
              <ExternalLink className="w-4 h-4" /> Pré-visualizar
            </a>
          </div>
          <p className="text-[10px] text-brand-600">
            📋 Este link pode ser compartilhado diretamente com o cliente. Não requer login.
          </p>
        </div>
      )}

      {/* Histórico de versões */}
      {versoes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
            <History className="w-4 h-4 text-gray-500" /> Histórico de Versões
          </p>
          <div className="space-y-2">
            {[...versoes].reverse().map((v, i) => {
              const apres = apresentacoes.find(a => a.id === v.apresentacaoId);
              return (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center text-xs font-extrabold text-brand-700">
                    v{v.versao}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">
                      {apres?.title || apres?.nome || v.apresentacaoId}
                    </p>
                    <p className="text-[10px] text-gray-400">{fmtDate(v.criadaEm)}</p>
                  </div>
                  {v.apresentacaoId && (
                    <a href={`#/app/apresentacoes/${v.apresentacaoId}`}
                      className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors text-gray-500">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!project.apresentacaoId && versoes.length === 0 && !loadingList && (
        <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <p className="text-sm text-gray-400 font-medium">Nenhuma proposta vinculada ainda.</p>
          <p className="text-xs text-gray-400 mt-1">Selecione uma apresentação acima para gerar o link da proposta.</p>
        </div>
      )}
    </div>
  );
};

export default ProjectProposta;
