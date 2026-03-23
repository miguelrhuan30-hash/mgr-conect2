import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, query, where, orderBy, getDocs,
  Timestamp, limit, startAfter, DocumentSnapshot, deleteDoc, doc,
} from 'firebase/firestore';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CollectionName } from '../types';
import {
  Car, Search, Calendar, Filter, ChevronRight,
  Loader2, AlertCircle, ImageOff, RefreshCw, Plus, Pencil, Trash2,
} from 'lucide-react';
import VehicleCheck from './VehicleCheck';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface VehicleCheckRecord {
  id: string;
  userId: string;
  userName: string;
  userSector: string;
  placa: string;
  kmInicial: number;
  timestamp: Timestamp;
  fotos: Record<string, string>; // dinâmico — suporta slots configurados pelo admin
  timeEntryId?: string;
}

const PAGE_SIZE = 20;

// ─── Componente de thumbnail ─────────────────────────────────────────────────

const Thumb: React.FC<{ url: string; label: string }> = ({ url, label }) => {
  const [err, setErr] = useState(false);
  return (
    <div className="relative w-14 h-10 rounded overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
      {err ? (
        <div className="w-full h-full flex items-center justify-center">
          <ImageOff className="w-4 h-4 text-gray-300" />
        </div>
      ) : (
        <img
          src={url} alt={label}
          className="w-full h-full object-cover"
          onError={() => setErr(true)}
        />
      )}
      <span className="absolute bottom-0 left-0 right-0 text-[8px] text-white bg-black/40 px-0.5 truncate leading-tight">
        {label}
      </span>
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────

const VehicleLog: React.FC = () => {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const navigate = useNavigate();

  // Filtros
  const [filtroPlaca,    setFiltroPlaca]    = useState('');
  const [filtroData,     setFiltroData]     = useState('');  // YYYY-MM-DD
  const [filtroUsuario,  setFiltroUsuario]  = useState('');

  // Dados
  const [registros,     setRegistros]     = useState<VehicleCheckRecord[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [lastDoc,       setLastDoc]       = useState<DocumentSnapshot | null>(null);
  const [hasMore,       setHasMore]       = useState(false);
  const [totalCount,    setTotalCount]    = useState<number | null>(null);
  const [mostrarForm,   setMostrarForm]   = useState(false);
  const [deletandoId,   setDeletandoId]   = useState<string | null>(null);

  // ── Apagar registro direto da lista (admin) ────────────────────────────────
  const handleDeleteFromList = useCallback(async (reg: VehicleCheckRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    const conf = window.confirm(
      `Apagar registro?\n\nPlaca: ${reg.placa}\nColaborador: ${reg.userName}\nEsta ação não pode ser desfeita.`
    );
    if (!conf) return;
    setDeletandoId(reg.id);
    try {
      // Remover fotos do Storage
      for (const url of Object.values(reg.fotos)) {
        try {
          const pathMatch = url.match(/o\/(.*?)\?/);
          if (pathMatch?.[1]) {
            const decoded = decodeURIComponent(pathMatch[1]);
            await deleteObject(storageRef(storage, decoded));
          }
        } catch { /* ignora falha individual */ }
      }
      await deleteDoc(doc(db, CollectionName.VEHICLE_CHECKS, reg.id));
      setRegistros(prev => prev.filter(r => r.id !== reg.id));
      setTotalCount(prev => (prev !== null ? prev - 1 : null));
    } catch (err) {
      console.error('[VehicleLog] Erro ao apagar:', err);
      alert('Erro ao apagar o registro. Tente novamente.');
    } finally {
      setDeletandoId(null);
    }
  }, []);

  // ── Query principal ────────────────────────────────────────────────────────
  const buscar = useCallback(async (paginar = false) => {
    setLoading(true);
    setError(null);

    try {
      let constraints: Parameters<typeof query>[1][] = [
        orderBy('timestamp', 'desc'),
        limit(PAGE_SIZE + 1),
      ];

      // Filtro de data
      if (filtroData) {
        const inicio = new Date(filtroData + 'T00:00:00');
        const fim    = new Date(filtroData + 'T23:59:59');
        constraints = [
          ...constraints,
          where('timestamp', '>=', Timestamp.fromDate(inicio)),
          where('timestamp', '<=', Timestamp.fromDate(fim)),
        ];
      }

      // Filtro de placa (busca por prefixo)
      if (filtroPlaca.trim().length >= 3) {
        const p = filtroPlaca.trim().toUpperCase();
        constraints = [
          ...constraints,
          where('placa', '>=', p),
          where('placa', '<=', p + '\uf8ff'),
        ];
      }

      // Paginação
      if (paginar && lastDoc) {
        constraints = [...constraints, startAfter(lastDoc)];
      }

      const q = query(collection(db, CollectionName.VEHICLE_CHECKS), ...constraints);
      const snap = await getDocs(q);
      const docs = snap.docs;
      const temMais = docs.length > PAGE_SIZE;
      const itens = docs.slice(0, PAGE_SIZE).map(d => ({
        id: d.id,
        ...d.data(),
      })) as VehicleCheckRecord[];

      // Filtro local de usuário (nome — evita índice extra)
      const filtrados = filtroUsuario.trim()
        ? itens.filter(r =>
            r.userName.toLowerCase().includes(filtroUsuario.toLowerCase()) ||
            r.userSector?.toLowerCase().includes(filtroUsuario.toLowerCase())
          )
        : itens;

      if (paginar) {
        setRegistros(prev => [...prev, ...filtrados]);
      } else {
        setRegistros(filtrados);
        setTotalCount(filtrados.length);
      }

      setLastDoc(docs[PAGE_SIZE - 1] ?? null);
      setHasMore(temMais);
    } catch (err: any) {
      console.error('[VehicleLog] Erro na query:', err);
      setError('Erro ao carregar registros. Verifique se os índices do Firestore foram criados.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroPlaca, filtroData, filtroUsuario]);

  // Busca inicial e ao mudar filtros
  useEffect(() => {
    setLastDoc(null);
    buscar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroPlaca, filtroData, filtroUsuario]);

  const temFiltro = !!(filtroPlaca || filtroData || filtroUsuario);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <Car className="w-5 h-5 text-blue-600" /> Controle de Veículos
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Registros de abertura de veículos com fotos e KM
            {totalCount !== null && (
              <span className="ml-2 text-gray-400">
                · {totalCount} registro{totalCount !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMostrarForm(f => !f)}
            className="flex items-center gap-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Nova abertura
          </button>
          <button
            onClick={() => buscar(false)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
          <Filter className="w-4 h-4" /> Filtros
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Placa */}
          <div className="relative">
            <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Placa (ex: ABC-1234)"
              maxLength={8}
              value={filtroPlaca}
              onChange={e => setFiltroPlaca(e.target.value.toUpperCase())}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          {/* Data */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={filtroData}
              onChange={e => setFiltroData(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Colaborador */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Colaborador ou setor"
              value={filtroUsuario}
              onChange={e => setFiltroUsuario(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Limpar filtros — only when active */}
        {temFiltro && (
          <button
            onClick={() => { setFiltroPlaca(''); setFiltroData(''); setFiltroUsuario(''); }}
            className="text-xs text-blue-600 hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Formulário inline — Nova abertura */}
      {mostrarForm && (
        <div className="bg-white border border-blue-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 pt-4 pb-1 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Nova abertura de veículo</h3>
            <button onClick={() => setMostrarForm(false)} className="text-xs text-gray-400 hover:text-gray-600">✕ Fechar</button>
          </div>
          <VehicleCheck
            onComplete={() => { setMostrarForm(false); buscar(false); }}
            onSkip={() => setMostrarForm(false)}
          />
        </div>
      )}

      {/* Estado de erro */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Lista de registros */}
      {loading && registros.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : registros.length === 0 && !temFiltro ? (
        // Empty state sem filtros: CTA primário
        <div className="bg-blue-50 border-2 border-dashed border-blue-300 rounded-2xl p-8 text-center">
          <Car className="w-14 h-14 mx-auto mb-4 text-blue-400" />
          <h3 className="text-lg font-semibold text-blue-800 mb-2">
            Nenhuma abertura registrada hoje
          </h3>
          <p className="text-sm text-blue-600 mb-5">
            Registre a abertura do veículo antes de iniciar o deslocamento.
          </p>
          <button
            onClick={() => setMostrarForm(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold
                       text-sm hover:bg-blue-700 active:scale-95 transition-all"
          >
            + Registrar abertura de veículo
          </button>
        </div>
      ) : registros.length === 0 ? (
        // Empty state com filtros: mensagem simples
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">Nenhum registro com os filtros aplicados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {registros.map(reg => {
            const data = reg.timestamp?.toDate?.();
            const dataStr = data
              ? data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
              : '—';
            const horaStr = data
              ? data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              : '—';

            const isDeletando = deletandoId === reg.id;
            const fotosEntries = Object.entries(reg.fotos ?? {}).slice(0, 4);

            return (
              <div
                key={reg.id}
                className="group relative bg-white border border-gray-200 rounded-xl px-4 py-3
                           hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <button
                  onClick={() => navigate(`/app/veiculos/${reg.id}`)}
                  className="w-full flex items-center gap-4 text-left"
                >
                  {/* Thumbnails dinâmicos (até 4) */}
                  <div className="hidden sm:flex gap-1.5 flex-shrink-0">
                    {fotosEntries.map(([key, url]) => (
                      <Thumb key={key} url={url} label={key} />
                    ))}
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-blue-700 text-sm bg-blue-50 px-2 py-0.5 rounded">
                        {reg.placa}
                      </span>
                      <span className="text-xs text-gray-500">KM {reg.kmInicial.toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 truncate">{reg.userName}</p>
                    {reg.userSector && (
                      <p className="text-xs text-gray-400 truncate">{reg.userSector}</p>
                    )}
                  </div>

                  {/* Data/hora */}
                  <div className="text-right flex-shrink-0 space-y-0.5">
                    <p className="text-sm font-medium text-gray-700">{dataStr}</p>
                    <p className="text-xs text-gray-400">{horaStr}</p>
                  </div>

                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </button>

                {/* Botões admin — aparecem no hover */}
                {isAdmin && (
                  <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1 z-10">
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/app/veiculos/${reg.id}`); }}
                      title="Editar registro"
                      className="p-1.5 rounded-lg bg-white border border-blue-200 text-blue-600
                                 hover:bg-blue-50 shadow-sm transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => handleDeleteFromList(reg, e)}
                      disabled={isDeletando}
                      title="Apagar registro"
                      className="p-1.5 rounded-lg bg-white border border-red-200 text-red-500
                                 hover:bg-red-50 shadow-sm transition-colors disabled:opacity-50"
                    >
                      {isDeletando
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Carregar mais */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => buscar(true)}
            disabled={loading}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800
                       border border-blue-200 rounded-lg px-5 py-2 hover:bg-blue-50 transition-colors
                       disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Carregar mais registros
          </button>
        </div>
      )}
    </div>
  );
};

export default VehicleLog;
