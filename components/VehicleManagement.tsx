import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, Timestamp, getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CollectionName, Vehicle } from '../types';
import {
  Car, Plus, Pencil, Trash2, X, Search, User, CheckCircle2, XCircle, Loader2,
} from 'lucide-react';

function aplicarMascaraPlaca(valor: string): string {
  const v = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (v.length <= 3) return v;
  return v.slice(0, 3) + '-' + v.slice(3, 7);
}

interface UserOption { id: string; nome: string; }

export default function VehicleManagement() {
  const { userProfile } = useAuth();
  const [veiculos, setVeiculos]   = useState<Vehicle[]>([]);
  const [loading, setLoading]     = useState(true);
  const [busca, setBusca]         = useState('');
  const [users, setUsers]         = useState<UserOption[]>([]);

  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Vehicle | null>(null);
  const [saving, setSaving]       = useState(false);

  const [placa, setPlaca]                 = useState('');
  const [modelo, setModelo]               = useState('');
  const [marca, setMarca]                 = useState('');
  const [ano, setAno]                     = useState('');
  const [cor, setCor]                     = useState('');
  const [responsavelId, setResponsavelId] = useState('');

  useEffect(() => {
    const q = query(collection(db, CollectionName.VEHICLES), orderBy('placa', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setVeiculos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  useEffect(() => {
    getDocs(collection(db, CollectionName.USERS)).then(snap => {
      setUsers(snap.docs.map(d => {
        const u = d.data();
        return { id: d.id, nome: u.nomeCompleto || u.displayName || u.email || d.id };
      }).sort((a, b) => a.nome.localeCompare(b.nome)));
    }).catch(() => {});
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return veiculos;
    return veiculos.filter(v =>
      v.placa.toLowerCase().includes(termo) ||
      v.modelo?.toLowerCase().includes(termo) ||
      v.responsavelNome?.toLowerCase().includes(termo)
    );
  }, [veiculos, busca]);

  const resetForm = () => {
    setPlaca(''); setModelo(''); setMarca(''); setAno(''); setCor(''); setResponsavelId('');
    setEditing(null); setShowForm(false);
  };

  const abrirEdicao = (v: Vehicle) => {
    setEditing(v);
    setPlaca(v.placa); setModelo(v.modelo || ''); setMarca(v.marca || '');
    setAno(v.ano ? String(v.ano) : ''); setCor(v.cor || '');
    setResponsavelId(v.responsavelId || '');
    setShowForm(true);
  };

  const salvar = async () => {
    if (!placa.trim() || placa.length < 8) { alert('Informe uma placa válida.'); return; }
    setSaving(true);
    try {
      const responsavel = users.find(u => u.id === responsavelId);
      const payload: any = {
        placa: placa.toUpperCase(),
        modelo: modelo.trim() || null,
        marca: marca.trim() || null,
        ano: ano ? Number(ano) : null,
        cor: cor.trim() || null,
        responsavelId: responsavelId || null,
        responsavelNome: responsavel?.nome || null,
        ativo: true,
      };
      if (editing) {
        await updateDoc(doc(db, CollectionName.VEHICLES, editing.id), {
          ...payload, atualizadoEm: Timestamp.now(),
        });
      } else {
        await addDoc(collection(db, CollectionName.VEHICLES), {
          ...payload, criadoEm: Timestamp.now(), criadoPor: userProfile?.uid || '',
        });
      }
      resetForm();
    } catch (e) {
      alert('Erro ao salvar veículo.');
    } finally {
      setSaving(false);
    }
  };

  const toggleAtivo = async (v: Vehicle) => {
    await updateDoc(doc(db, CollectionName.VEHICLES, v.id), { ativo: !v.ativo, atualizadoEm: Timestamp.now() }).catch(() => {});
  };

  const excluir = async (v: Vehicle) => {
    if (!confirm(`Excluir o veículo ${v.placa}? Isso não apaga o histórico de aberturas/abastecimentos.`)) return;
    await deleteDoc(doc(db, CollectionName.VEHICLES, v.id)).catch(() => {});
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Car className="w-5 h-5 text-brand-600" /> Frota de Veículos
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Cadastro de veículos e responsável fixo por carro</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700"
        >
          <Plus size={16} /> Novo veículo
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por placa, modelo ou responsável..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Car className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-semibold">Nenhum veículo cadastrado</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
          {filtrados.map(v => (
            <div key={v.id} className="flex items-center gap-4 px-4 py-3.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${v.ativo ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                <Car size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-gray-900 font-mono">{v.placa}</p>
                  {!v.ativo && <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Inativo</span>}
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {[v.marca, v.modelo, v.cor].filter(Boolean).join(' · ') || 'Sem detalhes'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 min-w-0 max-w-[220px]">
                <User size={13} className="text-gray-400 flex-shrink-0" />
                <span className={`text-xs truncate ${v.responsavelNome ? 'text-gray-700 font-semibold' : 'text-gray-400 italic'}`}>
                  {v.responsavelNome || 'Sem responsável'}
                </span>
              </div>
              <button onClick={() => toggleAtivo(v)} title={v.ativo ? 'Desativar' : 'Ativar'}
                className="p-2 rounded-lg hover:bg-gray-50">
                {v.ativo ? <CheckCircle2 size={16} className="text-emerald-500" /> : <XCircle size={16} className="text-gray-400" />}
              </button>
              <button onClick={() => abrirEdicao(v)} className="p-2 rounded-lg hover:bg-gray-50">
                <Pencil size={15} className="text-gray-500" />
              </button>
              <button onClick={() => excluir(v)} className="p-2 rounded-lg hover:bg-red-50">
                <Trash2 size={15} className="text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-black text-gray-900">{editing ? 'Editar veículo' : 'Novo veículo'}</h2>
              <button onClick={resetForm}><X size={18} className="text-gray-400" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Placa *</label>
                <input type="text" maxLength={8} value={placa} onChange={e => setPlaca(aplicarMascaraPlaca(e.target.value))}
                  placeholder="ABC-1234"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Marca</label>
                  <input type="text" value={marca} onChange={e => setMarca(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Modelo</label>
                  <input type="text" value={modelo} onChange={e => setModelo(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ano</label>
                  <input type="number" value={ano} onChange={e => setAno(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cor</label>
                  <input type="text" value={cor} onChange={e => setCor(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Responsável fixo</label>
                <select value={responsavelId} onChange={e => setResponsavelId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300">
                  <option value="">Sem responsável (uso compartilhado)</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  Nem todo colaborador dirige — deixe vazio se o veículo não tem responsável fixo.
                  Se definido, o responsável recebe cobrança ao bater ponto sem abrir o veículo.
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={salvar} disabled={saving}
                className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-bold text-sm disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={resetForm} className="px-5 py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold text-sm">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
