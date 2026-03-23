/**
 * components/VehicleDetail.tsx — /app/veiculos/:id
 * Gestor/Admin: detalhe de um registro de abertura de veículo.
 * Grade dinâmica de fotos + lightbox ao clicar + editar/apagar (somente admin).
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CollectionName, VehicleCheck as VehicleCheckType } from '../types';
import {
  Car, ArrowLeft, Loader2, AlertCircle, X, ZoomIn,
  MapPin, Hash, User, Clock, Pencil, Trash2, Save, CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';

// ── Lightbox ────────────────────────────────────────────────────────────────
const Lightbox: React.FC<{ url: string; label: string; onClose: () => void }> = ({ url, label, onClose }) => (
  <div
    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
    onClick={onClose}
  >
    <button
      className="absolute top-4 right-4 text-white/70 hover:text-white z-10"
      onClick={onClose}
    >
      <X className="w-8 h-8" />
    </button>
    <div className="max-w-3xl w-full" onClick={e => e.stopPropagation()}>
      <img
        src={url}
        alt={label}
        className="w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
      />
      <p className="text-center text-white/70 text-sm mt-3">{label}</p>
    </div>
  </div>
);

// ── Modal de edição inline ───────────────────────────────────────────────────
interface EditModalProps {
  placa: string;
  kmInicial: number;
  onSave: (placa: string, km: number) => Promise<void>;
  onCancel: () => void;
}

function aplicarMascara(valor: string): string {
  const v = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (v.length <= 3) return v;
  if (v.length >= 5 && /[A-Z]/.test(v[4])) return v.slice(0, 3) + '-' + v.slice(3, 7);
  return v.slice(0, 3) + '-' + v.slice(3, 7);
}

const EditModal: React.FC<EditModalProps> = ({ placa: placaInicial, kmInicial, onSave, onCancel }) => {
  const [placa, setPlaca]   = useState(placaInicial);
  const [km, setKm]         = useState(String(kmInicial));
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  const valid = placa.length >= 8 && km !== '' && Number(km) >= 0;

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    setErr(null);
    try {
      await onSave(placa.toUpperCase(), Number(km));
    } catch {
      setErr('Erro ao salvar. Tente novamente.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Pencil className="w-4 h-4 text-blue-600" /> Editar registro
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Placa *</label>
          <input
            type="text"
            maxLength={8}
            value={placa}
            onChange={e => setPlaca(aplicarMascara(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono uppercase
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">KM Inicial *</label>
          <input
            type="number"
            min={0}
            value={km}
            onChange={e => setKm(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
          As fotos <strong>não são editáveis</strong> para preservar a integridade das evidências.
        </div>

        {err && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {err}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={!valid || saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white
                       text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2.5 border border-gray-200 text-sm text-gray-500 rounded-xl hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main ─────────────────────────────────────────────────────────────────────
const VehicleDetail: React.FC = () => {
  const { id }         = useParams<{ id: string }>();
  const navigate       = useNavigate();
  const { userProfile } = useAuth();
  const isAdmin        = userProfile?.role === 'admin';

  const [record, setRecord]     = useState<VehicleCheckType | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);
  const [editando, setEditando] = useState(false);
  const [deletando, setDeletando] = useState(false);
  const [savedOk, setSavedOk]   = useState(false);

  useEffect(() => {
    if (!id) { setError('ID inválido'); setLoading(false); return; }
    getDoc(doc(db, CollectionName.VEHICLE_CHECKS, id))
      .then(snap => {
        if (!snap.exists()) { setError('Registro não encontrado.'); return; }
        setRecord({ id: snap.id, ...snap.data() } as VehicleCheckType);
      })
      .catch(err => {
        console.error('[VehicleDetail]', err);
        setError('Erro ao carregar registro.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // ── Salvar edição ─────────────────────────────────────────────────────────
  const handleSaveEdit = async (novaPlaca: string, novoKm: number) => {
    if (!id || !record) return;
    await updateDoc(doc(db, CollectionName.VEHICLE_CHECKS, id), {
      placa:    novaPlaca,
      kmInicial: novoKm,
    });
    setRecord(prev => prev ? { ...prev, placa: novaPlaca, kmInicial: novoKm } : prev);
    setEditando(false);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2500);
  };

  // ── Apagar registro ───────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!id || !record) return;
    const conf = window.confirm(
      `Tem certeza que deseja APAGAR este registro?\n\nPlaca: ${record.placa}\nEsta ação não pode ser desfeita.`
    );
    if (!conf) return;

    setDeletando(true);
    try {
      // Remover fotos do Storage
      const fotos = (record as any).fotos as Record<string, string> ?? {};
      for (const url of Object.values(fotos)) {
        try {
          // Extrair path do URL do Storage e deletar
          const pathMatch = url.match(/o\/(.*?)\?/);
          if (pathMatch?.[1]) {
            const decoded = decodeURIComponent(pathMatch[1]);
            await deleteObject(storageRef(storage, decoded));
          }
        } catch {
          // Ignora falha de remoção de foto individual (pode já ter sido removida)
        }
      }
      // Remover documento do Firestore
      await deleteDoc(doc(db, CollectionName.VEHICLE_CHECKS, id));
      navigate('/app/veiculos');
    } catch (err: any) {
      console.error('[VehicleDetail] Erro ao apagar:', err);
      alert('Erro ao apagar o registro. Tente novamente.');
    } finally {
      setDeletando(false);
    }
  };

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !record) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
        <p className="text-gray-600">{error || 'Registro não encontrado.'}</p>
        <button onClick={() => navigate('/app/veiculos')} className="text-blue-600 hover:underline text-sm">
          ← Voltar para a lista
        </button>
      </div>
    );
  }

  const ts = record.timestamp instanceof Timestamp ? record.timestamp.toDate() : new Date();
  const dataFormatada = format(ts, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });

  // Fotos dinâmicas (Record<string,string>)
  const fotosEntries = Object.entries((record as any).fotos ?? {}) as [string, string][];

  return (
    <>
      {lightbox && (
        <Lightbox url={lightbox.url} label={lightbox.label} onClose={() => setLightbox(null)} />
      )}

      {editando && (
        <EditModal
          placa={record.placa}
          kmInicial={record.kmInicial}
          onSave={handleSaveEdit}
          onCancel={() => setEditando(false)}
        />
      )}

      {/* Overlay de deleção */}
      {deletando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-red-500" />
            <p className="text-sm font-medium text-gray-700">Apagando registro...</p>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => navigate('/app/veiculos')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <Car className="w-5 h-5 text-blue-600" />
              <span className="font-mono text-blue-700">{record.placa}</span>
              {savedOk && (
                <span className="flex items-center gap-1 text-sm text-emerald-600 font-normal">
                  <CheckCircle2 className="w-4 h-4" /> Salvo!
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-500">{dataFormatada}</p>
          </div>

          {/* Ações admin */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditando(true)}
                className="flex items-center gap-1.5 text-sm text-blue-600 border border-blue-200
                           bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-1.5 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>
              <button
                onClick={handleDelete}
                disabled={deletando}
                className="flex items-center gap-1.5 text-sm text-red-600 border border-red-200
                           bg-red-50 hover:bg-red-100 rounded-lg px-3 py-1.5 transition-colors
                           disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Apagar
              </button>
            </div>
          )}
        </div>

        {/* Info card */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 shadow-sm">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Car className="w-3 h-3" /> Placa
            </span>
            <span className="text-sm font-mono font-bold text-blue-700">{record.placa}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3 h-3" /> KM Inicial
            </span>
            <span className="text-sm font-bold text-gray-800">{record.kmInicial.toLocaleString('pt-BR')}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <User className="w-3 h-3" /> Colaborador
            </span>
            <span className="text-sm font-bold text-gray-800 truncate">{record.userName}</span>
            {record.userSector && <span className="text-xs text-gray-400">{record.userSector}</span>}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3" /> Horário
            </span>
            <span className="text-sm font-bold text-gray-800">{format(ts, 'HH:mm')}</span>
            <span className="text-xs text-gray-400">{format(ts, 'dd/MM/yyyy')}</span>
          </div>
        </div>

        {/* Grade dinâmica de fotos */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Fotos do veículo
            <span className="ml-2 text-xs font-normal text-gray-400">({fotosEntries.length} foto{fotosEntries.length !== 1 ? 's' : ''})</span>
          </h2>
          {fotosEntries.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Nenhuma foto registrada.</p>
          ) : (
            <div className={`grid gap-3 ${fotosEntries.length === 1 ? 'grid-cols-1 max-w-xs' : 'grid-cols-2'}`}>
              {fotosEntries.map(([key, url]) => (
                <div key={key} className="space-y-1">
                  <button
                    onClick={() => url && setLightbox({ url, label: key })}
                    className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100 border border-gray-200
                               hover:border-blue-400 hover:shadow-md transition-all group"
                  >
                    {url ? (
                      <>
                        <img src={url} alt={key} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                          <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">📷</div>
                    )}
                  </button>
                  <p className="text-xs text-center text-gray-500 font-medium capitalize">{key.replace(/_/g, ' ')}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé de auditoria */}
        <div className="border-t border-gray-100 pt-4 space-y-1">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
            <Hash className="w-3 h-3" /> Auditoria
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-500 font-mono">
            <span><span className="text-gray-400">doc_id:</span> {record.id}</span>
            <span><span className="text-gray-400">user_id:</span> {record.userId}</span>
            {record.timeEntryId && (
              <span><span className="text-gray-400">time_entry:</span> {record.timeEntryId}</span>
            )}
          </div>
        </div>

      </div>
    </>
  );
};

export default VehicleDetail;
