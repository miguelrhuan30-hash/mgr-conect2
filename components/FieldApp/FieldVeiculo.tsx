import React, { useState, useRef, useCallback, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { CollectionName } from '../../types';
import { Camera, CheckCircle, AlertCircle, Car, Gauge, Loader2, X, Check } from 'lucide-react';
import { SlotConfig, FOTO_SLOTS_DEFAULT } from '../VehicleCheckConfig';

type FotoKey = string;

function aplicarMascara(valor: string): string {
  const v = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (v.length <= 3) return v;
  if (v.length >= 5 && /[A-Z]/.test(v[4])) return v.slice(0, 3) + '-' + v.slice(3, 7);
  return v.slice(0, 3) + '-' + v.slice(3, 7);
}

const MAX_DIMENSION = 1920;
const JPEG_QUALITY  = 0.7;

function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio); height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context failed')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('toBlob null'))),
        'image/jpeg', JPEG_QUALITY,
      );
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = URL.createObjectURL(file);
  });
}

async function uploadWithRetry(storageRef: ReturnType<typeof ref>, blob: Blob): Promise<string> {
  const attempt = async () => { await uploadBytes(storageRef, blob); return getDownloadURL(storageRef); };
  try { return await attempt(); } catch { await new Promise(r => setTimeout(r, 1000)); return await attempt(); }
}

export default function FieldVeiculo() {
  const { currentUser, userProfile } = useAuth();

  const [fotoSlots, setFotoSlots]   = useState<SlotConfig[]>(FOTO_SLOTS_DEFAULT);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    getDoc(doc(db, 'vehicle_check_config', 'default'))
      .then(snap => {
        if (snap.exists() && Array.isArray(snap.data().slots)) {
          const ativos = (snap.data().slots as SlotConfig[]).filter(s => s.active).sort((a, b) => a.order - b.order);
          if (ativos.length > 0) setFotoSlots(ativos);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingConfig(false));
  }, []);

  const [placa, setPlaca]         = useState('');
  const [kmInicial, setKmInicial] = useState('');
  const [fotos, setFotos]         = useState<Partial<Record<FotoKey, File>>>({});
  const [previews, setPreviews]   = useState<Partial<Record<FotoKey, string>>>({});
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [progress, setProgress]   = useState('');

  const inputRefs = useRef<Partial<Record<FotoKey, HTMLInputElement | null>>>({});

  const handleFoto = useCallback((key: FotoKey, file: File) => {
    setFotos(prev => ({ ...prev, [key]: file }));
    setPreviews(prev => ({ ...prev, [key]: URL.createObjectURL(file) }));
  }, []);

  const removerFoto = useCallback((key: FotoKey) => {
    setFotos(prev => { const n = { ...prev }; delete n[key]; return n; });
    setPreviews(prev => { const n = { ...prev }; delete n[key]; return n; });
  }, []);

  const placaValida = placa.length >= 8;
  const kmValido    = kmInicial !== '' && Number(kmInicial) >= 0;
  const todasFotos  = fotoSlots.filter(s => s.required).every(s => !!fotos[s.key]);
  const podeSalvar  = placaValida && kmValido && todasFotos && !saving && !loadingConfig;

  const handleSalvar = async () => {
    if (!currentUser || !podeSalvar) return;
    setSaving(true); setError(null); setProgress('Comprimindo fotos...');
    try {
      const slotsComFoto = fotoSlots.filter(s => !!fotos[s.key]);
      const compressed: { key: string; blob: Blob }[] = [];
      for (let i = 0; i < slotsComFoto.length; i++) {
        const slot = slotsComFoto[i];
        setProgress(`Comprimindo foto ${i + 1}/${slotsComFoto.length}...`);
        try { compressed.push({ key: slot.key, blob: await compressImage(fotos[slot.key]!) }); }
        catch { compressed.push({ key: slot.key, blob: fotos[slot.key]! }); }
      }
      setProgress(`Enviando ${compressed.length} fotos...`);
      let uploaded = 0;
      const results = await Promise.allSettled(compressed.map(async ({ key, blob }) => {
        const storageRef = ref(storage, `vehicle_checks/${currentUser.uid}/${Date.now()}_${key}.jpg`);
        const url = await uploadWithRetry(storageRef, blob);
        setProgress(`Enviando foto ${++uploaded}/${compressed.length}...`);
        return { key, url };
      }));
      if (results.some(r => r.status === 'rejected'))
        throw new Error(`Falha no envio de ${results.filter(r => r.status === 'rejected').length} foto(s).`);
      const urls: Record<FotoKey, string> = {};
      results.forEach(r => { if (r.status === 'fulfilled') urls[r.value.key] = r.value.url; });
      setProgress('Salvando registro...');
      await addDoc(collection(db, CollectionName.VEHICLE_CHECKS), {
        userId: currentUser.uid,
        userName: userProfile?.displayName || currentUser.email || 'Colaborador',
        userSector: userProfile?.sectorName || '',
        placa: placa.toUpperCase(),
        kmInicial: Number(kmInicial),
        timestamp: serverTimestamp(),
        fotos: urls,
        origem: 'field_app',
      });
      setSaved(true);
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar. Verifique a conexão e tente novamente.');
    } finally {
      setSaving(false); setProgress('');
    }
  };

  if (saved) return (
    <div className="flex flex-col items-center justify-center gap-5 h-full text-center px-6">
      <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
        <CheckCircle className="w-10 h-10 text-emerald-400" />
      </div>
      <div>
        <h2 className="text-xl font-black text-white">Abertura registrada!</h2>
        <p className="text-gray-400 text-sm mt-1">Placa {placa} · KM {kmInicial}</p>
      </div>
      <button onClick={() => { setSaved(false); setPlaca(''); setKmInicial(''); setFotos({}); setPreviews({}); }}
        className="px-6 py-3 bg-gray-800 text-gray-300 rounded-xl text-sm font-semibold">
        Registrar outro veículo
      </button>
    </div>
  );

  if (loadingConfig) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
    </div>
  );

  return (
    <>
      {/* Overlay de envio */}
      {saving && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl px-8 py-7 flex flex-col items-center gap-4 max-w-xs w-full mx-4">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
            <div className="text-center">
              <p className="font-semibold text-white text-base">{progress || 'Enviando fotos...'}</p>
              <p className="text-sm text-gray-400 mt-1">Aguarde, não saia desta tela</p>
            </div>
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ animation: 'progress 1.5s ease-in-out infinite' }} />
            </div>
          </div>
        </div>
      )}

      <div className="overflow-y-auto h-full px-4 py-5 space-y-5">
        {/* Header */}
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Car className="w-5 h-5 text-emerald-400" /> Abertura de Veículo
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Preencha antes de iniciar o deslocamento</p>
        </div>

        {/* Placa */}
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Placa do veículo *</label>
          <input
            type="text" maxLength={8} placeholder="ABC-1234 ou ABC1D23"
            value={placa} onChange={e => setPlaca(aplicarMascara(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-base font-mono uppercase text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* KM */}
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
            <Gauge className="w-3.5 h-3.5" /> KM inicial *
          </label>
          <input
            type="number" min={0} placeholder="Ex: 54320"
            value={kmInicial} onChange={e => setKmInicial(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-base text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Fotos */}
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
            Fotos * <span className="text-gray-600 font-normal normal-case">({Object.keys(fotos).length}/{fotoSlots.filter(s => s.required).length} obrigatórias)</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {fotoSlots.map(slot => {
              const preview = previews[slot.key];
              return (
                <div key={slot.key} className="relative">
                  {preview ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-700 aspect-video bg-gray-800">
                      <img src={preview} alt={slot.label} className="w-full h-full object-cover" />
                      <div className="absolute top-1 left-1 bg-emerald-500 text-white rounded-full p-0.5 shadow">
                        <Check className="w-3 h-3" />
                      </div>
                      <button onClick={() => removerFoto(slot.key)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5">
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                        <p className="text-white text-xs font-medium truncate">{slot.label}</p>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => inputRefs.current[slot.key]?.click()}
                      className={`w-full aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 bg-gray-800/60 transition-colors active:bg-gray-800 ${slot.required ? 'border-gray-600' : 'border-gray-700'}`}>
                      <Camera className="w-6 h-6 text-gray-500" />
                      <span className="text-xs font-medium text-gray-400 text-center px-2 leading-tight">{slot.label}</span>
                      <span className="text-[10px] text-gray-600 text-center px-2 leading-tight">{slot.hint}</span>
                      {!slot.required && <span className="text-[10px] text-gray-700 font-mono">opcional</span>}
                    </button>
                  )}
                  <input ref={el => { inputRefs.current[slot.key] = el; }}
                    type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFoto(slot.key, f); e.target.value = ''; }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Checklist */}
        <div className="text-xs text-gray-600 space-y-1.5 border-t border-gray-800 pt-4">
          {[
            { ok: placaValida, label: 'Placa informada' },
            { ok: kmValido,    label: 'KM inicial informado' },
            { ok: todasFotos,  label: `${fotoSlots.filter(s => s.required).length} fotos obrigatórias capturadas` },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <span className={item.ok ? 'text-emerald-400' : 'text-gray-700'}>{item.ok ? '✓' : '○'}</span>
              <span className={item.ok ? 'text-gray-300' : ''}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Botão */}
        <button onClick={handleSalvar} disabled={!podeSalvar}
          className="w-full py-4 rounded-xl text-sm font-bold transition-all disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed bg-emerald-600 text-white active:bg-emerald-700 flex items-center justify-center gap-2">
          <CheckCircle className="w-4 h-4" /> Confirmar abertura de veículo
        </button>
      </div>

      <style>{`@keyframes progress { 0%{width:0%;margin-left:0} 50%{width:70%;margin-left:15%} 100%{width:0%;margin-left:100%} }`}</style>
    </>
  );
}
