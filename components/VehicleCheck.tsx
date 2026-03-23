import React, { useState, useRef, useCallback, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CollectionName } from '../types';
import { Analytics } from '../utils/mgr-analytics';
import { Camera, CheckCircle, AlertCircle, Car, Gauge, Loader2, X, Check } from 'lucide-react';
import { SlotConfig, FOTO_SLOTS_DEFAULT } from './VehicleCheckConfig';

// ─── Tipo dinâmico (string em vez de literal union) ───────────────────────────

type FotoKey = string;

// ─── Helper de máscara de placa ───────────────────────────────────────────────

function aplicarMascara(valor: string): string {
  const v = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (v.length <= 3) return v;
  // Mercosul: AAA0A00 — detecta pelo 5º char
  if (v.length >= 5 && /[A-Z]/.test(v[4])) {
    return v.slice(0, 3) + '-' + v.slice(3, 7);
  }
  // Padrão: AAA-0000
  return v.slice(0, 3) + '-' + v.slice(3, 7);
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface VehicleCheckProps {
  timeEntryId?: string;
  onComplete?: () => void;
  onSkip?: () => void;
}

const VehicleCheck: React.FC<VehicleCheckProps> = ({ timeEntryId, onComplete, onSkip }) => {
  const { currentUser, userProfile } = useAuth();

  // ── Config de slots (dinâmica) ─────────────────────────────────────────────
  const [fotoSlots, setFotoSlots]         = useState<SlotConfig[]>(FOTO_SLOTS_DEFAULT);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    getDoc(doc(db, 'vehicle_check_config', 'default'))
      .then(snap => {
        if (snap.exists() && Array.isArray(snap.data().slots)) {
          const ativos = (snap.data().slots as SlotConfig[])
            .filter(s => s.active)
            .sort((a, b) => a.order - b.order);
          if (ativos.length > 0) setFotoSlots(ativos);
        }
      })
      .catch(() => { /* mantém o fallback */ })
      .finally(() => setLoadingConfig(false));
  }, []);

  const [placa, setPlaca]           = useState('');
  const [kmInicial, setKmInicial]   = useState('');
  const [fotos, setFotos]           = useState<Partial<Record<FotoKey, File>>>({});
  const [previews, setPreviews]     = useState<Partial<Record<FotoKey, string>>>({});
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const inputRefs = useRef<Partial<Record<FotoKey, HTMLInputElement | null>>>({});

  // ── Captura de foto ────────────────────────────────────────────────────────
  const handleFoto = useCallback((key: FotoKey, file: File) => {
    setFotos(prev => ({ ...prev, [key]: file }));
    const url = URL.createObjectURL(file);
    setPreviews(prev => ({ ...prev, [key]: url }));
  }, []);

  const removerFoto = useCallback((key: FotoKey) => {
    setFotos(prev => { const n = { ...prev }; delete n[key]; return n; });
    setPreviews(prev => { const n = { ...prev }; delete n[key]; return n; });
  }, []);

  // ── Validação ──────────────────────────────────────────────────────────────
  const placaValida = placa.length >= 8;
  const kmValido    = kmInicial !== '' && Number(kmInicial) >= 0;
  // Apenas slots required bloqueiam o salvar
  const todasFotos  = fotoSlots
    .filter(s => s.required)
    .every(s => !!fotos[s.key]);
  const podeSalvar  = placaValida && kmValido && todasFotos && !saving && !loadingConfig;

  // ── Upload e gravação ──────────────────────────────────────────────────────
  const handleSalvar = async () => {
    if (!currentUser || !podeSalvar) return;
    setSaving(true);
    setError(null);

    try {
      const urls: Record<FotoKey, string> = {};

      for (const slot of fotoSlots) {
        const file = fotos[slot.key];
        if (!file) continue; // slots opcionais sem foto são pulados
        const path = `vehicle_checks/${currentUser.uid}/${Date.now()}_${slot.key}.jpg`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file);
        urls[slot.key] = await getDownloadURL(storageRef);
      }

      const docRef = await addDoc(collection(db, CollectionName.VEHICLE_CHECKS), {
        userId:      currentUser.uid,
        userName:    userProfile?.displayName || currentUser.email || 'Colaborador',
        userSector:  userProfile?.sectorName  || '',
        placa:       placa.toUpperCase(),
        kmInicial:   Number(kmInicial),
        timestamp:   serverTimestamp(),
        fotos:       urls,
        ...(timeEntryId ? { timeEntryId } : {}),
      });

      await Analytics.logEvent({
        eventType: 'veiculo_abertura',
        area: 'veiculos',
        userId: currentUser.uid,
        entityId: docRef.id,
        entityType: 'vehicle_check',
        payload: { placa: placa.toUpperCase(), kmInicial: Number(kmInicial), timeEntryId: timeEntryId ?? null },
      });

      setSaved(true);
      setTimeout(() => onComplete?.(), 1800);
    } catch (err: any) {
      console.error('[VehicleCheck] Erro ao salvar:', err);
      setError('Erro ao salvar. Verifique a conexão e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  // ── Tela de sucesso ────────────────────────────────────────────────────────
  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <CheckCircle className="w-16 h-16 text-emerald-500" />
        <h2 className="text-xl font-semibold text-gray-800">Abertura de veículo registrada!</h2>
        <p className="text-gray-500 text-sm">Placa {placa} · KM {kmInicial}</p>
      </div>
    );
  }

  // ── Loading config ─────────────────────────────────────────────────────────
  if (loadingConfig) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Overlay de envio bloqueante ───────────────────────────────────── */}
      {saving && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4
                        bg-black/70 backdrop-blur-sm"
          style={{ touchAction: 'none' }}
        >
          <div className="bg-white rounded-2xl shadow-2xl px-8 py-7 flex flex-col items-center gap-4 max-w-xs w-full mx-4">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            <div className="text-center">
              <p className="font-semibold text-gray-800 text-base">Enviando fotos...</p>
              <p className="text-sm text-gray-500 mt-1">Aguarde, não saia desta tela</p>
            </div>
            {/* barra de progresso animada */}
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full animate-[progress_1.5s_ease-in-out_infinite]"
                style={{ animation: 'progress 1.5s ease-in-out infinite' }} />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Car className="w-5 h-5 text-blue-600" /> Abertura de veículo
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">Preencha antes de iniciar o deslocamento</p>
          </div>
          {/* Oculta "Fazer depois" enquanto enviando */}
          {onSkip && !saving && (
            <button onClick={onSkip} className="text-xs text-gray-400 hover:text-gray-600 underline">
              Fazer depois
            </button>
          )}
        </div>

        {/* Placa */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Placa do veículo *</label>
          <input
            type="text"
            maxLength={8}
            placeholder="ABC-1234 ou ABC1D23"
            value={placa}
            onChange={e => setPlaca(aplicarMascara(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono uppercase
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* KM inicial */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <Gauge className="w-4 h-4" /> KM inicial *
          </label>
          <input
            type="number"
            min={0}
            placeholder="Ex: 54320"
            value={kmInicial}
            onChange={e => setKmInicial(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Grade de fotos — dinâmica */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fotos *{' '}
            <span className="text-gray-400 font-normal">
              ({Object.keys(fotos).length}/{fotoSlots.filter(s => s.required).length} obrigatórias)
            </span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {fotoSlots.map(slot => {
              const preview = previews[slot.key];
              const capturada = !!fotos[slot.key];
              return (
                <div key={slot.key} className="relative">
                  {preview ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200 aspect-video bg-gray-100">
                      <img src={preview} alt={slot.label} className="w-full h-full object-cover" />

                      {/* Badge ✓ confirmação */}
                      {capturada && (
                        <div className="absolute top-1 left-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-md">
                          <Check className="w-3 h-3" />
                        </div>
                      )}

                      <button
                        onClick={() => removerFoto(slot.key)}
                        className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-black/70"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/40 px-2 py-1">
                        <p className="text-white text-xs font-medium truncate">{slot.label}</p>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => inputRefs.current[slot.key]?.click()}
                      className={`w-full aspect-video rounded-xl border-2 border-dashed
                                 hover:border-blue-400 hover:bg-blue-50 transition-colors
                                 flex flex-col items-center justify-center gap-1.5 bg-gray-50
                                 ${slot.required ? 'border-gray-300' : 'border-gray-200'}`}
                    >
                      <Camera className="w-6 h-6 text-gray-400" />
                      <span className="text-xs font-medium text-gray-600 text-center px-2">{slot.label}</span>
                      <span className="text-xs text-gray-400 text-center px-2 leading-tight">{slot.hint}</span>
                      {!slot.required && (
                        <span className="text-[10px] text-gray-300 font-mono">opcional</span>
                      )}
                    </button>
                  )}
                  <input
                    ref={el => { inputRefs.current[slot.key] = el; }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleFoto(slot.key, file);
                      // BUG FIX: reset para garantir que novo onChange dispare
                      // mesmo que o mesmo arquivo seja selecionado novamente
                      e.target.value = '';
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Botão */}
        <button
          onClick={handleSalvar}
          disabled={!podeSalvar}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all
                     disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed
                     bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]
                     flex items-center justify-center gap-2"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Salvando fotos...</>
          ) : (
            <><CheckCircle className="w-4 h-4" /> Confirmar abertura de veículo</>
          )}
        </button>

        {/* Checklist visual */}
        <div className="text-xs text-gray-400 space-y-1 border-t border-gray-100 pt-4">
          {[
            { ok: placaValida, label: 'Placa informada' },
            { ok: kmValido,    label: 'KM inicial informado' },
            { ok: todasFotos,  label: `${fotoSlots.filter(s => s.required).length} fotos obrigatórias capturadas` },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className={item.ok ? 'text-emerald-500' : 'text-gray-300'}>
                {item.ok ? '✓' : '○'}
              </span>
              <span className={item.ok ? 'text-gray-600' : ''}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Animação da barra de progresso */}
      <style>{`
        @keyframes progress {
          0%   { width: 0%;   margin-left: 0; }
          50%  { width: 70%;  margin-left: 15%; }
          100% { width: 0%;   margin-left: 100%; }
        }
      `}</style>
    </>
  );
};

export default VehicleCheck;
