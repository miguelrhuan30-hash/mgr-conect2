/**
 * ProjectTaskBacklog — Hub de Tarefas do Projeto (M1 + Frentes)
 *
 * Pool de tarefas do projeto, independente de O.S. específica:
 *  - Gestor cadastra tarefas ao planejar (status: 'backlog'), agrupadas por
 *    "Frente" (ex: "Montagem de Isopainéis" / Equipe 1) — lista fechada de
 *    frentes cadastrada por projeto (ProjectV2.frentes)
 *  - Ao criar uma O.S. para o projeto (OSCreationModal), o gestor seleciona
 *    itens daqui (por tarefa ou a Frente inteira de uma vez) para distribuir
 *    (status vira 'em_os')
 *  - Tarefas marcadas "não concluída" em qualquer O.S. do projeto retornam
 *    aqui automaticamente (origem: 'nao_concluida') para redistribuição
 *  - Técnicos podem "pegar" uma tarefa avulsa direto no app de campo,
 *    o que cria uma O.S. mínima automaticamente
 *
 * Três formas de cadastrar tarefas em massa: formulário rápido, colar lista
 * (uma tarefa por linha) e importar planilha (.xlsx/.csv) no formato
 * Equipe | Frente | Tarefa | Evidência de conclusão.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, writeBatch, Timestamp,
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CollectionName, BacklogTarefa, ProjetoFrente } from '../types';
import {
  ListTodo, Plus, Trash2, Loader2, CheckCircle2, ClipboardList, XCircle,
  Layers, Pencil, ClipboardPaste, Upload, ChevronDown, ChevronUp,
} from 'lucide-react';

interface Props {
  projectId: string;
  projectName?: string;
  clientId?: string;
  clientName?: string;
}

const STATUS_CFG: Record<BacklogTarefa['status'], { label: string; cls: string; icon: React.ReactNode }> = {
  backlog:  { label: 'No backlog',   cls: 'bg-gray-100 text-gray-600',       icon: <ListTodo size={11} /> },
  em_os:    { label: 'Em O.S.',      cls: 'bg-blue-100 text-blue-700',       icon: <ClipboardList size={11} /> },
  concluida:{ label: 'Concluída',    cls: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 size={11} /> },
};

const CORES_FRENTE = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const makeId = () => `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

type ModoCadastro = 'rapido' | 'colar' | 'importar';

export default function ProjectTaskBacklog({ projectId, projectName, clientId, clientName }: Props) {
  const { currentUser, userProfile } = useAuth();
  const [itens, setItens]       = useState<BacklogTarefa[]>([]);
  const [loading, setLoading]   = useState(true);
  const [salvando, setSalvando] = useState(false);

  // ── Frentes do projeto ──
  const [frentes, setFrentes] = useState<ProjetoFrente[]>([]);
  const [gerenciarFrentes, setGerenciarFrentes] = useState(false);
  const [novaFrenteNome, setNovaFrenteNome] = useState('');
  const [novaFrenteEquipe, setNovaFrenteEquipe] = useState('');
  const [editandoFrenteId, setEditandoFrenteId] = useState<string | null>(null);

  // ── Cadastro de tarefas ──
  const [modo, setModo] = useState<ModoCadastro>('rapido');
  const [frenteAtiva, setFrenteAtiva] = useState<string>(''); // frenteId escolhido/lembrado
  const [novaDesc, setNovaDesc] = useState('');
  const [novaEvidencia, setNovaEvidencia] = useState('');
  const [colarTexto, setColarTexto] = useState('');
  const [importPreview, setImportPreview] = useState<{ frenteNome: string; equipe: string; tarefa: string; evidencia: string }[]>([]);
  const [importErro, setImportErro] = useState('');

  useEffect(() => {
    if (!projectId) return;
    const q = query(collection(db, CollectionName.PROJECT_TASK_BACKLOG), where('projectId', '==', projectId));
    return onSnapshot(q, snap => {
      setItens(snap.docs.map(d => ({ id: d.id, ...d.data() } as BacklogTarefa)));
      setLoading(false);
    }, () => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    return onSnapshot(doc(db, CollectionName.PROJECTS_V2, projectId), snap => {
      setFrentes((snap.data()?.frentes as ProjetoFrente[]) || []);
    }, () => {});
  }, [projectId]);

  const salvarFrentes = async (novas: ProjetoFrente[]) => {
    setFrentes(novas);
    await updateDoc(doc(db, CollectionName.PROJECTS_V2, projectId), { frentes: novas }).catch(() => {});
  };

  const addFrente = () => {
    if (!novaFrenteNome.trim()) return;
    const nova: ProjetoFrente = {
      id: makeId(),
      nome: novaFrenteNome.trim(),
      equipe: novaFrenteEquipe.trim(),
      cor: CORES_FRENTE[frentes.length % CORES_FRENTE.length],
    };
    salvarFrentes([...frentes, nova]);
    setNovaFrenteNome('');
    setNovaFrenteEquipe('');
  };
  const updateFrente = (id: string, patch: Partial<ProjetoFrente>) =>
    salvarFrentes(frentes.map(f => f.id === id ? { ...f, ...patch } : f));
  const removeFrente = (id: string) => {
    if (!confirm('Remover esta frente? Tarefas já cadastradas nela continuam existindo, só sem o agrupamento.')) return;
    salvarFrentes(frentes.filter(f => f.id !== id));
  };

  // Acha/cria uma frente por nome (usado na importação de planilha)
  const encontrarOuCriarFrente = (novasFrentes: ProjetoFrente[], nome: string, equipe: string): { frentes: ProjetoFrente[]; id: string } => {
    const existente = novasFrentes.find(f => norm(f.nome) === norm(nome));
    if (existente) return { frentes: novasFrentes, id: existente.id };
    const nova: ProjetoFrente = { id: makeId(), nome: nome.trim(), equipe: equipe.trim(), cor: CORES_FRENTE[novasFrentes.length % CORES_FRENTE.length] };
    return { frentes: [...novasFrentes, nova], id: nova.id };
  };

  const nomeUsuario = () => (userProfile as any)?.nomeCompleto || userProfile?.displayName || 'Gestor';

  const baseNovaTarefa = () => ({
    projectId, projectName: projectName || '', clientId: clientId || '', clientName: clientName || '',
    status: 'backlog' as const,
    origem: 'planejada' as const,
    criadoEm: Timestamp.now(),
    criadoPor: currentUser?.uid || '',
    criadoPorNome: nomeUsuario(),
  });

  // ── 1) Cadastro rápido ──
  const adicionarRapido = async () => {
    if (!novaDesc.trim() || !currentUser) return;
    setSalvando(true);
    try {
      await addDoc(collection(db, CollectionName.PROJECT_TASK_BACKLOG), {
        ...baseNovaTarefa(),
        descricao: novaDesc.trim(),
        ...(frenteAtiva ? { frenteId: frenteAtiva } : {}),
        ...(novaEvidencia.trim() ? { evidenciaExigida: novaEvidencia.trim() } : {}),
      });
      setNovaDesc('');
      setNovaEvidencia('');
      // frenteAtiva permanece selecionada — "lembra a última Frente" pra agilizar cadastro sequencial
    } catch {
      alert('Erro ao adicionar tarefa ao backlog.');
    } finally {
      setSalvando(false);
    }
  };

  // ── 2) Colar lista em massa (uma tarefa por linha, "Tarefa" ou "Tarefa; Evidência") ──
  const linhasColar = useMemo(() => colarTexto.split('\n').map(l => l.trim()).filter(Boolean), [colarTexto]);

  const adicionarColados = async () => {
    if (!linhasColar.length || !currentUser) return;
    setSalvando(true);
    try {
      const batch = writeBatch(db);
      for (const linha of linhasColar) {
        const [tarefa, evidencia] = linha.split(';').map(s => s?.trim());
        if (!tarefa) continue;
        const ref = doc(collection(db, CollectionName.PROJECT_TASK_BACKLOG));
        batch.set(ref, {
          ...baseNovaTarefa(),
          descricao: tarefa,
          ...(frenteAtiva ? { frenteId: frenteAtiva } : {}),
          ...(evidencia ? { evidenciaExigida: evidencia } : {}),
        });
      }
      await batch.commit();
      setColarTexto('');
    } catch {
      alert('Erro ao adicionar tarefas coladas.');
    } finally {
      setSalvando(false);
    }
  };

  // ── 3) Importar planilha (.xlsx/.csv) — colunas Equipe | Frente | Tarefa | Evidência de conclusão ──
  const processarArquivo = async (file: File) => {
    setImportErro('');
    setImportPreview([]);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const linhas: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!linhas.length) { setImportErro('Planilha vazia ou sem dados reconhecíveis.'); return; }

      const headers = Object.keys(linhas[0]);
      const acharCol = (...chaves: string[]) => headers.find(h => chaves.some(c => norm(h).includes(c)));
      const colEquipe   = acharCol('equipe');
      const colFrente   = acharCol('frente');
      const colTarefa   = acharCol('tarefa');
      const colEvidencia= acharCol('evidenc');

      if (!colTarefa) { setImportErro('Não encontrei uma coluna de "Tarefa" na planilha.'); return; }

      const preview = linhas
        .map(l => ({
          frenteNome: colFrente ? String(l[colFrente] ?? '').trim() : '',
          equipe: colEquipe ? String(l[colEquipe] ?? '').trim() : '',
          tarefa: String(l[colTarefa] ?? '').trim(),
          evidencia: colEvidencia ? String(l[colEvidencia] ?? '').trim() : '',
        }))
        .filter(l => l.tarefa);

      if (!preview.length) { setImportErro('Nenhuma linha com Tarefa preenchida.'); return; }
      setImportPreview(preview);
    } catch (e) {
      setImportErro('Não consegui ler esse arquivo. Confirme que é .xlsx ou .csv.');
    }
  };

  const confirmarImportacao = async () => {
    if (!importPreview.length || !currentUser) return;
    setSalvando(true);
    try {
      let frentesAtualizadas = [...frentes];
      const batch = writeBatch(db);

      for (const linha of importPreview) {
        let frenteId: string | undefined;
        if (linha.frenteNome) {
          const res = encontrarOuCriarFrente(frentesAtualizadas, linha.frenteNome, linha.equipe);
          frentesAtualizadas = res.frentes;
          frenteId = res.id;
        }
        const ref = doc(collection(db, CollectionName.PROJECT_TASK_BACKLOG));
        batch.set(ref, {
          ...baseNovaTarefa(),
          descricao: linha.tarefa,
          ...(frenteId ? { frenteId } : {}),
          ...(linha.evidencia ? { evidenciaExigida: linha.evidencia } : {}),
        });
      }

      if (frentesAtualizadas.length !== frentes.length) {
        await updateDoc(doc(db, CollectionName.PROJECTS_V2, projectId), { frentes: frentesAtualizadas }).catch(() => {});
        setFrentes(frentesAtualizadas);
      }
      await batch.commit();
      setImportPreview([]);
    } catch {
      alert('Erro ao importar tarefas da planilha.');
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (id: string) => {
    if (!confirm('Remover esta tarefa do backlog?')) return;
    await deleteDoc(doc(db, CollectionName.PROJECT_TASK_BACKLOG, id)).catch(() => {});
  };

  // ── Agrupamento por Frente ──
  const frenteById = useMemo(() => new Map(frentes.map(f => [f.id, f])), [frentes]);
  const grupos = useMemo(() => {
    const map = new Map<string, BacklogTarefa[]>();
    for (const it of itens) {
      const key = it.frenteId && frenteById.has(it.frenteId) ? it.frenteId : '__sem_frente__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    const ordemStatus = { backlog: 0, em_os: 1, concluida: 2 };
    for (const arr of map.values()) arr.sort((a, b) => ordemStatus[a.status] - ordemStatus[b.status]);
    // Frentes cadastradas primeiro (na ordem em que existem), "Sem Frente" por último
    const ordenado: [string, BacklogTarefa[]][] = [];
    for (const f of frentes) if (map.has(f.id)) ordenado.push([f.id, map.get(f.id)!]);
    if (map.has('__sem_frente__')) ordenado.push(['__sem_frente__', map.get('__sem_frente__')!]);
    return ordenado;
  }, [itens, frentes, frenteById]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <ListTodo size={13} /> Hub de Tarefas do Projeto ({itens.length})
        </h3>
        <button onClick={() => setGerenciarFrentes(v => !v)}
          className="flex items-center gap-1 text-[11px] font-bold text-brand-600 hover:text-brand-700">
          <Layers size={12} /> Frentes ({frentes.length}) {gerenciarFrentes ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* ── Gestão de Frentes ── */}
      {gerenciarFrentes && (
        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
          {frentes.map(f => (
            <div key={f.id} className="flex items-center gap-2">
              {editandoFrenteId === f.id ? (
                <>
                  <input defaultValue={f.nome} onBlur={e => updateFrente(f.id, { nome: e.target.value })}
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs" placeholder="Nome da frente" />
                  <input defaultValue={f.equipe} onBlur={e => updateFrente(f.id, { equipe: e.target.value })}
                    className="w-32 border border-gray-200 rounded-lg px-2 py-1 text-xs" placeholder="Equipe" />
                  <button onClick={() => setEditandoFrenteId(null)} className="p-1.5 rounded-lg hover:bg-white text-emerald-600"><CheckCircle2 size={14} /></button>
                </>
              ) : (
                <>
                  <span className={`flex-1 text-xs font-bold px-2 py-1 rounded-lg border ${f.cor || CORES_FRENTE[0]}`}>{f.nome}</span>
                  <span className="text-[11px] text-gray-500 w-32 truncate">{f.equipe}</span>
                  <button onClick={() => setEditandoFrenteId(f.id)} className="p-1.5 rounded-lg hover:bg-white text-gray-400"><Pencil size={13} /></button>
                </>
              )}
              <button onClick={() => removeFrente(f.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <input value={novaFrenteNome} onChange={e => setNovaFrenteNome(e.target.value)}
              placeholder="Nova frente (ex: Montagem de Isopainéis)"
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
            <input value={novaFrenteEquipe} onChange={e => setNovaFrenteEquipe(e.target.value)}
              placeholder="Equipe" className="w-32 border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
            <button onClick={addFrente} disabled={!novaFrenteNome.trim()}
              className="px-2.5 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1">
              <Plus size={12} /> Frente
            </button>
          </div>
        </div>
      )}

      {/* ── Cadastro de tarefas — 3 modos ── */}
      <div className="mb-4">
        <div className="flex gap-1 mb-2">
          {([
            { key: 'rapido', label: 'Rápido', icon: <Plus size={12} /> },
            { key: 'colar', label: 'Colar lista', icon: <ClipboardPaste size={12} /> },
            { key: 'importar', label: 'Importar planilha', icon: <Upload size={12} /> },
          ] as { key: ModoCadastro; label: string; icon: React.ReactNode }[]).map(m => (
            <button key={m.key} onClick={() => setModo(m.key)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                modo === m.key ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {frentes.length > 0 && modo !== 'importar' && (
          <select value={frenteAtiva} onChange={e => setFrenteAtiva(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs mb-2 font-medium text-gray-700">
            <option value="">Sem frente</option>
            {frentes.map(f => <option key={f.id} value={f.id}>{f.nome} — {f.equipe}</option>)}
          </select>
        )}

        {modo === 'rapido' && (
          <div className="space-y-2">
            <input type="text" value={novaDesc} onChange={e => setNovaDesc(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && adicionarRapido()}
              placeholder="Descrever nova tarefa..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            <div className="flex gap-2">
              <input type="text" value={novaEvidencia} onChange={e => setNovaEvidencia(e.target.value)}
                placeholder="Evidência exigida pra fechar a tarefa (opcional)"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300" />
              <button onClick={adicionarRapido} disabled={!novaDesc.trim() || salvando}
                className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0">
                {salvando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Adicionar
              </button>
            </div>
          </div>
        )}

        {modo === 'colar' && (
          <div className="space-y-2">
            <textarea value={colarTexto} onChange={e => setColarTexto(e.target.value)} rows={4}
              placeholder={'Uma tarefa por linha. Opcionalmente com evidência separada por ";":\nMarcação do perímetro\nCorte e fixação das canaletas; foto da canaleta fixada'}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-300" />
            <button onClick={adicionarColados} disabled={!linhasColar.length || salvando}
              className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-1.5">
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <ClipboardPaste size={14} />}
              Adicionar {linhasColar.length > 0 ? `${linhasColar.length} tarefa(s)` : ''}
            </button>
          </div>
        )}

        {modo === 'importar' && (
          <div className="space-y-2">
            <input type="file" accept=".xlsx,.xls,.csv"
              onChange={e => e.target.files?.[0] && processarArquivo(e.target.files[0])}
              className="w-full text-xs" />
            <p className="text-[10px] text-gray-400">Colunas reconhecidas: Equipe, Frente, Tarefa, Evidência de conclusão (como a planilha "Tarefas para Abertura de O.S.").</p>
            {importErro && <p className="text-xs text-red-500">{importErro}</p>}
            {importPreview.length > 0 && (
              <div className="bg-brand-50 border border-brand-200 rounded-xl p-3">
                <p className="text-xs font-bold text-brand-700 mb-2">{importPreview.length} tarefa(s) prontas pra importar</p>
                <div className="max-h-32 overflow-y-auto space-y-1 mb-2">
                  {importPreview.slice(0, 8).map((l, i) => (
                    <p key={i} className="text-[11px] text-gray-600 truncate">
                      {l.frenteNome && <span className="font-bold">{l.frenteNome}: </span>}{l.tarefa}
                    </p>
                  ))}
                  {importPreview.length > 8 && <p className="text-[10px] text-gray-400">...e mais {importPreview.length - 8}</p>}
                </div>
                <button onClick={confirmarImportacao} disabled={salvando}
                  className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5">
                  {salvando ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Importar {importPreview.length} tarefa(s)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Lista agrupada por Frente ── */}
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
      ) : itens.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">Nenhuma tarefa cadastrada no backlog ainda.</p>
      ) : (
        <div className="space-y-4">
          {grupos.map(([key, grupoItens]) => {
            const frente = key !== '__sem_frente__' ? frenteById.get(key) : null;
            const pendentes = grupoItens.filter(i => i.status === 'backlog').length;
            const emOSCount = grupoItens.filter(i => i.status === 'em_os').length;
            const concluidasCount = grupoItens.filter(i => i.status === 'concluida').length;
            return (
              <div key={key}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${frente?.cor || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                    {frente ? `${frente.nome} — ${frente.equipe}` : 'Sem Frente'}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {pendentes} pendente{pendentes !== 1 ? 's' : ''} · {emOSCount} em O.S. · {concluidasCount} concluída{concluidasCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {grupoItens.map(it => (
                    <div key={it.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                      it.status === 'concluida' ? 'bg-emerald-50/60' : it.status === 'em_os' ? 'bg-blue-50/60' : 'bg-gray-50'
                    }`}>
                      <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_CFG[it.status].cls}`}>
                        {STATUS_CFG[it.status].icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${it.status === 'concluida' ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{it.descricao}</p>
                        {it.evidenciaExigida && (
                          <p className="text-[10px] text-gray-400 truncate">Evidência: {it.evidenciaExigida}</p>
                        )}
                        {it.origem === 'nao_concluida' && it.motivoNaoConclusao && (
                          <p className="text-[10px] text-red-500 flex items-center gap-1 mt-0.5">
                            <XCircle size={9} /> Retornou: {it.motivoNaoConclusao}
                          </p>
                        )}
                        {it.status === 'em_os' && it.executorNome && (
                          <p className="text-[10px] text-gray-400">{it.executorNome}</p>
                        )}
                      </div>
                      {it.status === 'backlog' && (
                        <button onClick={() => remover(it.id)} className="p-1.5 rounded-lg hover:bg-red-50 flex-shrink-0">
                          <Trash2 size={13} className="text-red-400" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
