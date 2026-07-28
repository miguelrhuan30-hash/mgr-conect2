/**
 * components/ProjectPlanoExecucao.tsx
 *
 * "Plano de Execução" do projeto — serviços, fases de execução (dias) e valor
 * de mão de obra. Migrado da Prancheta Técnica (fase pré-venda) pra dentro da
 * aba Planejamento (pós-contrato), onde essa organização operacional realmente
 * se aplica. Mantém o mesmo campo de dados no Firestore (project.prancheta.servicosExecucao)
 * pra não exigir migração — só muda onde é editado.
 */
import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import {
  HardHat, ChevronDown, ChevronUp, Plus, Trash2, X, Calendar, DollarSign,
  ChevronRight, Loader2, Check,
} from 'lucide-react';
import { db } from '../firebase';
import { CollectionName, FaseExecucaoPrancheta, ServicoExecucaoPrancheta } from '../types';

interface Props {
  projectId: string;
}

const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

export default function ProjectPlanoExecucao({ projectId }: Props) {
  const [servicos, setServicos] = useState<ServicoExecucaoPrancheta[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expandido, setExpandido] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    const unsub = onSnapshot(doc(db, CollectionName.PROJECTS_V2, projectId), snap => {
      // Só sincroniza na primeira carga — depois disso o formulário local manda,
      // até o gestor salvar (mesmo comportamento que a Prancheta tinha antes).
      setLoaded(prevLoaded => {
        if (!prevLoaded) {
          setServicos(((snap.data() as any)?.prancheta?.servicosExecucao as ServicoExecucaoPrancheta[]) || []);
        }
        return true;
      });
    }, () => {});
    return () => unsub();
  }, [projectId]);

  const salvar = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, CollectionName.PROJECTS_V2, projectId), { 'prancheta.servicosExecucao': servicos });
      setDirty(false);
    } catch {
      alert('Erro ao salvar o Plano de Execução.');
    } finally {
      setSaving(false);
    }
  };

  const addServico = () => {
    const novo: ServicoExecucaoPrancheta = { id: makeId(), nome: 'Novo Serviço', fases: [], valorMaoDeObra: 0 };
    setServicos(prev => [...prev, novo]);
    setDirty(true);
  };
  const updateServico = (sId: string, field: keyof ServicoExecucaoPrancheta, value: any) => {
    setServicos(prev => prev.map(s => s.id === sId ? { ...s, [field]: value } : s));
    setDirty(true);
  };
  const removeServico = (sId: string) => {
    setServicos(prev => prev.filter(s => s.id !== sId));
    setDirty(true);
  };
  const addFase = (sId: string) => {
    const nova: FaseExecucaoPrancheta = { id: makeId(), nome: '', diasExecucao: 1 };
    setServicos(prev => prev.map(s => s.id === sId ? { ...s, fases: [...s.fases, nova] } : s));
    setDirty(true);
  };
  const updateFase = (sId: string, fId: string, field: keyof FaseExecucaoPrancheta, value: any) => {
    setServicos(prev => prev.map(s =>
      s.id === sId ? { ...s, fases: s.fases.map(f => f.id === fId ? { ...f, [field]: value } : f) } : s
    ));
    setDirty(true);
  };
  const removeFase = (sId: string, fId: string) => {
    setServicos(prev => prev.map(s =>
      s.id === sId ? { ...s, fases: s.fases.filter(f => f.id !== fId) } : s
    ));
    setDirty(true);
  };

  const totalDiasGeral = servicos.reduce((acc, s) => acc + s.fases.reduce((a, f) => a + (f.diasExecucao || 0), 0), 0);
  const totalMdoGeral = servicos.reduce((acc, s) => acc + (s.valorMaoDeObra || 0), 0);

  if (!loaded) {
    return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <button onClick={() => setExpandido(!expandido)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-orange-100 rounded-lg flex items-center justify-center">
            <HardHat className="w-3.5 h-3.5 text-orange-600" />
          </div>
          <span className="text-sm font-bold text-gray-800">🏗️ Plano de Execução</span>
          {servicos.length > 0 && (
            <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-bold">
              {servicos.length} serviço(s) · {totalDiasGeral}d · {totalMdoGeral > 0 ? `R$ ${totalMdoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : 'sem valor'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span onClick={e => { e.stopPropagation(); salvar(); }}
              role="button"
              className="flex items-center gap-1 px-2.5 py-1 bg-brand-600 text-white rounded-lg text-[11px] font-bold hover:bg-brand-700">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Salvar
            </span>
          )}
          {expandido ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expandido && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-800">
            <strong>Organização de execução:</strong> cadastre os serviços que serão executados, as fases de cada serviço com os dias estimados e o valor total da mão de obra — pra organizar antes de liberar as O.S. pra equipe de campo.
          </div>

          {servicos.map((srv, sIdx) => {
            const totalDias = srv.fases.reduce((acc, f) => acc + (f.diasExecucao || 0), 0);
            return (
              <div key={srv.id} className="border border-gray-200 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <span className="w-6 h-6 rounded-lg bg-orange-100 flex items-center justify-center text-[10px] font-extrabold text-orange-700 flex-shrink-0">
                    {sIdx + 1}
                  </span>
                  <input
                    value={srv.nome}
                    onChange={e => updateServico(srv.id, 'nome', e.target.value)}
                    placeholder="Nome do serviço (ex: Câmara Fria, Sistema de Refrigeração)"
                    className="flex-1 bg-transparent text-sm font-bold text-gray-800 outline-none placeholder:text-gray-400 placeholder:font-normal border-b border-transparent focus:border-orange-300 transition-colors"
                  />
                  <button onClick={() => removeServico(srv.id)}
                    className="w-7 h-7 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="px-4 py-4 space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" /> Fases de Execução
                      </p>
                      <button onClick={() => addFase(srv.id)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-orange-50 text-orange-600 border border-orange-200 rounded-lg text-xs font-bold hover:bg-orange-100 transition-colors">
                        <Plus className="w-3 h-3" /> Fase
                      </button>
                    </div>

                    {srv.fases.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-3 border border-dashed border-gray-200 rounded-xl">
                        Clique em "+ Fase" para adicionar etapas de execução
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {srv.fases.map((fase, fIdx) => (
                          <div key={fase.id} className="flex items-center gap-2 group">
                            <span className="text-[10px] font-extrabold text-gray-400 w-5 text-center flex-shrink-0">{fIdx + 1}</span>
                            <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                            <input
                              value={fase.nome}
                              onChange={e => updateFase(srv.id, fase.id, 'nome', e.target.value)}
                              placeholder="Nome da fase (ex: Fundação e piso, Isolamento, Instalação elétrica)"
                              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                            />
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <input
                                type="number"
                                min={1}
                                value={fase.diasExecucao}
                                onChange={e => updateFase(srv.id, fase.id, 'diasExecucao', Math.max(1, Number(e.target.value)))}
                                className="w-16 border border-gray-200 rounded-xl px-2 py-2 text-xs text-center outline-none focus:ring-2 focus:ring-orange-300"
                              />
                              <span className="text-[10px] text-gray-400 font-medium w-7">dia{fase.diasExecucao !== 1 ? 's' : ''}</span>
                            </div>
                            <button onClick={() => removeFase(srv.id, fase.id)}
                              className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-lg transition-all flex-shrink-0">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}

                        <div className="flex items-center gap-2 pt-1 pl-8 border-t border-gray-100">
                          <Calendar className="w-3 h-3 text-orange-500" />
                          <span className="text-xs font-bold text-orange-700">
                            Total estimado: {totalDias} dia{totalDias !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                    <DollarSign className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <label className="text-xs font-bold text-gray-700 flex-shrink-0">Valor total da Mão de Obra:</label>
                    <div className="flex items-center gap-1 flex-1">
                      <span className="text-xs font-bold text-gray-500">R$</span>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={srv.valorMaoDeObra || ''}
                        onChange={e => updateServico(srv.id, 'valorMaoDeObra', Number(e.target.value))}
                        placeholder="0,00"
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-300"
                      />
                    </div>
                    {srv.valorMaoDeObra > 0 && (
                      <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg flex-shrink-0">
                        {srv.valorMaoDeObra.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <button onClick={addServico}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-orange-200 text-orange-500 rounded-2xl text-sm font-bold hover:border-orange-400 hover:bg-orange-50 transition-all">
            <Plus className="w-4 h-4" /> Adicionar Serviço
          </button>

          {servicos.length > 1 && (
            <div className="flex items-center gap-4 px-4 py-3 bg-orange-50 border border-orange-200 rounded-2xl">
              <HardHat className="w-5 h-5 text-orange-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-extrabold text-orange-800">Totais do Projeto</p>
                <p className="text-[10px] text-orange-600 mt-0.5">
                  {servicos.length} serviços · {totalDiasGeral} dia{totalDiasGeral !== 1 ? 's' : ''} de execução
                </p>
              </div>
              {totalMdoGeral > 0 && (
                <span className="text-sm font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                  {totalMdoGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
