/**
 * components/VehicleDetail.tsx — /app/veiculos/:id
 * Gestor/Admin: detalhe de um registro de abertura de veículo.
 * Grade 2x2 de fotos + lightbox ao clicar + rodapé de auditoria.
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, VehicleCheck as VehicleCheckType } from '../types';
import {
  Car, ArrowLeft, Loader2, AlertCircle, X, ZoomIn,
  MapPin, Hash, User, Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';

// ── Photo labels ────────────────────────────────────────────────────────────
const FOTO_INFO = [
  { key: 'motorista' as const,  label: 'Lado Motorista',     emoji: '🚗' },
  { key: 'passageiro' as const, label: 'Lado Passageiro',    emoji: '🚕' },
  { key: 'traseira' as const,   label: 'Carroceria Traseira', emoji: '🔙' },
  { key: 'painel' as const,     label: 'Painel / KM',         emoji: '📊' },
];

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

// ── Main ─────────────────────────────────────────────────────────────────────
const VehicleDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [record, setRecord] = useState<VehicleCheckType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);

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

  return (
    <>
      {lightbox && (
        <Lightbox url={lightbox.url} label={lightbox.label} onClose={() => setLightbox(null)} />
      )}

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
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
            </h1>
            <p className="text-sm text-gray-500">{dataFormatada}</p>
          </div>
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

        {/* Grade 2x2 fotos */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Fotos do veículo</h2>
          <div className="grid grid-cols-2 gap-3">
            {FOTO_INFO.map(info => {
              const url = record.fotos[info.key];
              return (
                <div key={info.key} className="space-y-1">
                  <button
                    onClick={() => url && setLightbox({ url, label: info.label })}
                    className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100 border border-gray-200
                               hover:border-blue-400 hover:shadow-md transition-all group"
                  >
                    {url ? (
                      <>
                        <img src={url} alt={info.label} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                          <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">
                        {info.emoji}
                      </div>
                    )}
                  </button>
                  <p className="text-xs text-center text-gray-500 font-medium">{info.label}</p>
                </div>
              );
            })}
          </div>
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
