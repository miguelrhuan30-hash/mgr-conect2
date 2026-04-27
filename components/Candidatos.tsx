import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName } from '../types';
import {
  UserPlus, Search, Mail, Phone, MapPin, Briefcase, FileText, Download,
  Filter, X, Trash2, Calendar, ExternalLink, ChevronDown,
} from 'lucide-react';

type CandidatoStatus = 'novo' | 'triagem' | 'entrevista' | 'aprovado' | 'descartado';

interface Candidato {
  id: string;
  nomeCompleto: string;
  email: string;
  telefone: string;
  cidade: string;
  areaInteresse: string;
  nivelExperiencia: string;
  mensagem?: string | null;
  cvUrl?: string | null;
  cvNome?: string | null;
  cvTamanho?: number | null;
  origem: string;
  status: CandidatoStatus;
  criadoEm?: Timestamp;
  notas?: string | null;
}

const STATUS_CONFIG: Record<CandidatoStatus, { label: string; color: string; bg: string }> = {
  novo:        { label: 'Novo',        color: '#1B5E8A', bg: '#E8F1F8' },
  triagem:     { label: 'Em triagem',  color: '#D4792A', bg: '#FDF0E4' },
  entrevista:  { label: 'Entrevista',  color: '#7C3AED', bg: '#EDE9FE' },
  aprovado:    { label: 'Aprovado',    color: '#16A34A', bg: '#DCFCE7' },
  descartado:  { label: 'Descartado',  color: '#6B7280', bg: '#F3F4F6' },
};

const STATUS_ORDER: CandidatoStatus[] = ['novo', 'triagem', 'entrevista', 'aprovado', 'descartado'];

const formatDate = (ts?: Timestamp): string => {
  if (!ts) return '-';
  return ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const Candidatos: React.FC = () => {
  const [list, setList] = useState<Candidato[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CandidatoStatus | 'todos'>('todos');
  const [areaFilter, setAreaFilter] = useState<string>('todas');
  const [selected, setSelected] = useState<Candidato | null>(null);

  useEffect(() => {
    const q = query(collection(db, CollectionName.CANDIDATOS), orderBy('criadoEm', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setList(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Candidato, 'id'>) })));
      setLoading(false);
    }, (err) => {
      console.error('Erro carregando candidatos:', err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const areas = useMemo(() => {
    const set = new Set(list.map((c) => c.areaInteresse).filter(Boolean));
    return ['todas', ...Array.from(set).sort()];
  }, [list]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return list.filter((c) => {
      if (statusFilter !== 'todos' && c.status !== statusFilter) return false;
      if (areaFilter !== 'todas' && c.areaInteresse !== areaFilter) return false;
      if (s && !`${c.nomeCompleto} ${c.email} ${c.cidade}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [list, search, statusFilter, areaFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: list.length };
    STATUS_ORDER.forEach((s) => { c[s] = list.filter((x) => x.status === s).length; });
    return c;
  }, [list]);

  const updateStatus = async (id: string, novoStatus: CandidatoStatus) => {
    try {
      await updateDoc(doc(db, CollectionName.CANDIDATOS, id), { status: novoStatus });
      if (selected?.id === id) setSelected({ ...selected, status: novoStatus });
    } catch (err) {
      console.error('Falha ao atualizar status:', err);
      alert('Não foi possível atualizar o status.');
    }
  };

  const removeCandidato = async (id: string) => {
    if (!window.confirm('Apagar este candidato definitivamente? O currículo no Storage permanecerá.')) return;
    try {
      await deleteDoc(doc(db, CollectionName.CANDIDATOS, id));
      if (selected?.id === id) setSelected(null);
    } catch (err) {
      console.error('Falha ao apagar:', err);
      alert('Sem permissão para apagar (apenas admin).');
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
          <UserPlus size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banco de Candidatos</h1>
          <p className="text-sm text-gray-500">Currículos recebidos via site Trabalhe Conosco</p>
        </div>
      </div>

      {/* Pipeline counters */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-5">
        <button
          onClick={() => setStatusFilter('todos')}
          className={`p-3 rounded-lg border text-left transition ${statusFilter === 'todos' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
        >
          <div className="text-xs text-gray-500">Todos</div>
          <div className="text-2xl font-bold text-gray-900">{counts.todos}</div>
        </button>
        {STATUS_ORDER.map((s) => {
          const cfg = STATUS_CONFIG[s];
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`p-3 rounded-lg border text-left transition ${active ? 'border-2' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
              style={active ? { borderColor: cfg.color, background: cfg.bg } : {}}
            >
              <div className="text-xs" style={{ color: cfg.color }}>{cfg.label}</div>
              <div className="text-2xl font-bold" style={{ color: cfg.color }}>{counts[s] || 0}</div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail ou cidade..."
            className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-400"
          >
            {areas.map((a) => (
              <option key={a} value={a}>{a === 'todas' ? 'Todas as áreas' : a}</option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-16 bg-white rounded-lg border border-dashed border-gray-200">
          <UserPlus size={32} className="mx-auto text-gray-300 mb-3" />
          {list.length === 0 ? 'Nenhum candidato cadastrado ainda.' : 'Nenhum candidato com esses filtros.'}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {filtered.map((c) => {
            const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.novo;
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="w-full text-left p-4 hover:bg-gray-50 transition flex flex-col md:flex-row md:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 truncate">{c.nomeCompleto}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1"><Briefcase size={12} /> {c.areaInteresse}</span>
                    <span className="flex items-center gap-1">{c.nivelExperiencia}</span>
                    <span className="flex items-center gap-1"><MapPin size={12} /> {c.cidade}</span>
                    <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(c.criadoEm)}</span>
                  </div>
                </div>
                {c.cvUrl && (
                  <span className="flex items-center gap-1 text-xs text-blue-600 font-medium flex-shrink-0">
                    <FileText size={14} /> CV anexo
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Modal de detalhes */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setSelected(null)}>
          <div
            className="bg-white w-full md:max-w-2xl md:rounded-xl rounded-t-xl shadow-2xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selected.nomeCompleto}</h2>
                <p className="text-xs text-gray-500">Candidatura recebida em {formatDate(selected.criadoEm)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Status pipeline */}
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Status</div>
                <div className="flex flex-wrap gap-2">
                  {STATUS_ORDER.map((s) => {
                    const cfg = STATUS_CONFIG[s];
                    const active = selected.status === s;
                    return (
                      <button
                        key={s}
                        onClick={() => updateStatus(selected.id, s)}
                        className="text-xs px-3 py-1.5 rounded-full font-medium transition border"
                        style={{
                          background: active ? cfg.color : cfg.bg,
                          color: active ? '#fff' : cfg.color,
                          borderColor: active ? cfg.color : 'transparent',
                        }}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Contact info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-gray-700">
                  <Mail size={14} className="text-gray-400" />
                  <a href={`mailto:${selected.email}`} className="text-blue-600 hover:underline truncate">{selected.email}</a>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Phone size={14} className="text-gray-400" />
                  <a href={`https://wa.me/55${selected.telefone.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="text-green-600 hover:underline">
                    {selected.telefone}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <MapPin size={14} className="text-gray-400" />
                  <span>{selected.cidade}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Briefcase size={14} className="text-gray-400" />
                  <span>{selected.areaInteresse} · {selected.nivelExperiencia}</span>
                </div>
              </div>

              {/* CV download */}
              {selected.cvUrl && (
                <div className="bg-blue-50 rounded-lg p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-white text-blue-600 flex items-center justify-center flex-shrink-0">
                    <FileText size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{selected.cvNome || 'curriculo.pdf'}</div>
                    {selected.cvTamanho && (
                      <div className="text-xs text-gray-500">{(selected.cvTamanho / 1024).toFixed(0)} KB</div>
                    )}
                  </div>
                  <a
                    href={selected.cvUrl}
                    target="_blank"
                    rel="noopener"
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded-md flex items-center gap-2 flex-shrink-0"
                  >
                    <Download size={14} /> Abrir CV
                  </a>
                </div>
              )}

              {/* Mensagem */}
              {selected.mensagem && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Mensagem</div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-md border border-gray-100">
                    {selected.mensagem}
                  </p>
                </div>
              )}

              {/* Footer actions */}
              <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                <button
                  onClick={() => removeCandidato(selected.id)}
                  className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1"
                >
                  <Trash2 size={14} /> Apagar candidato
                </button>
                <div className="text-xs text-gray-400">Origem: {selected.origem}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Candidatos;
