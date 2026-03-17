import React, { useState, useRef, useCallback } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CollectionName } from '../types';
import { Analytics } from '../utils/mgr-analytics';
import { Camera, CheckCircle, AlertCircle, Car, Gauge, Loader2, X } from 'lucide-react';

// ─── Tipos ───────────────────────────────────────────────────────────────────

// ─── Config de fotos ─────────────────────────────────────────────────────────

const FOTO_SLOTS = [
  { key: 'motorista',  label: 'Lado motorista',      hint: 'Lateral esquerda completa do veículo' },
  { key: 'passageiro', label: 'Lado passageiro',      hint: 'Lateral direita completa do veículo' },
  { key: 'traseira',   label: 'Carroceria traseira',  hint: 'Ferramentas visíveis e organizadas' },
  { key: 'painel',     label: 'Painel + KM inicial',  hint: 'Hodômetro legível na foto' },
] as const;

type FotoKey = typeof FOTO_SLOTS[number]['key'];

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
  const placaValida  = placa.length >= 8;
  const kmValido     = kmInicial !== '' && Number(kmInicial) >= 0;
  const todasFotos   = FOTO_SLOTS.every(s => !!fotos[s.key]);
  const podeSalvar   = placaValida && kmValido && todasFotos && !saving;

  // ── Upload e gravação ──────────────────────────────────────────────────────
  const handleSalvar = async () => {
    if (!currentUser || !podeSalvar) return;
    setSaving(true);
    setError(null);

    try {
      const urls: Partial<Record<FotoKey, string>> = {};

      for (const slot of FOTO_SLOTS) {
        const file = fotos[slot.key]!;
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
        fotos: {
          motorista:  urls.motorista!,
          passageiro: urls.passageiro!,
          traseira:   urls.traseira!,
          painel:     urls.painel!,
        },
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Car className="w-5 h-5 text-blue-600" /> Abertura de veículo
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Preencha antes de iniciar o deslocamento</p>
        </div>
        {onSkip && (
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

      {/* Grade de fotos */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Fotos obrigatórias * <span className="text-gray-400 font-normal">({Object.keys(fotos).length}/4)</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {FOTO_SLOTS.map(slot => {
            const preview = previews[slot.key];
            return (
              <div key={slot.key} className="relative">
                {preview ? (
                  <div className="relative rounded-xl overflow-hidden border border-gray-200 aspect-video bg-gray-100">
                    <img src={preview} alt={slot.label} className="w-full h-full object-cover" />
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
                    className="w-full aspect-video rounded-xl border-2 border-dashed border-gray-300
                               hover:border-blue-400 hover:bg-blue-50 transition-colors
                               flex flex-col items-center justify-center gap-1.5 bg-gray-50"
                  >
                    <Camera className="w-6 h-6 text-gray-400" />
                    <span className="text-xs font-medium text-gray-600 text-center px-2">{slot.label}</span>
                    <span className="text-xs text-gray-400 text-center px-2 leading-tight">{slot.hint}</span>
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
          { ok: todasFotos,  label: '4 fotos capturadas' },
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
  );
};

export default VehicleCheck;
