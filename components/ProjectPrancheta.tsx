/**
 * components/ProjectPrancheta.tsx — Sprint Projetos v2
 *
 * Formulário digital da prancheta do projetista.
 * Campos técnicos: dimensões, BTU, voltagem, gás, isolamento, etc.
 * Upload de fotos e croquis. Salvamento automático.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Save, Upload, Loader2, Trash2, Image, FileText, Check,
} from 'lucide-react';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { useProject } from '../hooks/useProject';
import { ProjectV2Prancheta } from '../types';

interface Props {
  projectId: string;
  prancheta?: ProjectV2Prancheta;
}

const VOLTAGENS = ['110V', '220V', '380V', '440V'];
const GASES = ['R-22', 'R-134a', 'R-404A', 'R-407C', 'R-410A', 'R-290', 'R-600a', 'Outro'];
const ISOLAMENTOS = ['EPS (Isopor)', 'PUR (Poliuretano)', 'PIR (Poliisocianurato)', 'Lã de Rocha', 'XPS', 'Outro'];

const ProjectPrancheta: React.FC<Props> = ({ projectId, prancheta }) => {
  const { savePrancheta } = useProject();
  const [form, setForm] = useState<ProjectV2Prancheta>({
    dimensoes: '',
    tipoEquipamento: '',
    capacidadeBTU: undefined,
    voltagem: '',
    tipoGas: '',
    isolamento: '',
    estruturaExistente: '',
    temperaturaAlvo: '',
    finalidade: '',
    localizacao: '',
    metragem: '',
    observacoesTecnicas: '',
    fotosLevantamento: [],
    croquis: [],
    ...prancheta,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'foto' | 'croqui'>('foto');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prancheta) setForm((prev) => ({ ...prev, ...prancheta }));
  }, [prancheta]);

  const update = (field: keyof ProjectV2Prancheta, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePrancheta(projectId, form);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowed = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
    if (!allowed.includes(ext)) return;
    if (file.size > 10 * 1024 * 1024) return;

    setUploading(true);
    try {
      const path = `projects/${projectId}/${uploadType}s/${Date.now()}_${file.name}`;
      const sRef = storageRef(storage, path);
      const task = uploadBytesResumable(sRef, file, { contentType: file.type });
      await new Promise<void>((resolve, reject) => {
        task.on('state_changed', undefined, reject, async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          if (uploadType === 'foto') {
            setForm((prev) => ({
              ...prev,
              fotosLevantamento: [...(prev.fotosLevantamento || []), url],
            }));
          } else {
            setForm((prev) => ({
              ...prev,
              croquis: [...(prev.croquis || []), url],
            }));
          }
          setSaved(false);
          resolve();
        });
      });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (type: 'foto' | 'croqui', idx: number) => {
    if (type === 'foto') {
      setForm((prev) => ({
        ...prev,
        fotosLevantamento: (prev.fotosLevantamento || []).filter((_, i) => i !== idx),
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        croquis: (prev.croquis || []).filter((_, i) => i !== idx),
      }));
    }
    setSaved(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">📐 Prancheta do Projetista</h3>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            saved
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
              : 'bg-brand-600 text-white hover:bg-brand-700'
          }`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando...' : saved ? 'Salvo ✓' : 'Salvar'}
        </button>
      </div>

      {/* Dados Gerais */}
      <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Dados Gerais</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Finalidade *" value={form.finalidade || ''} onChange={(v) => update('finalidade', v)} placeholder="Ex: Armazenamento de perecíveis" />
          <Field label="Localização" value={form.localizacao || ''} onChange={(v) => update('localizacao', v)} placeholder="Ex: Indaiatuba, SP" />
          <Field label="Metragem / Dimensões gerais" value={form.metragem || ''} onChange={(v) => update('metragem', v)} placeholder="Ex: 120 m²" />
          <Field label="Temperatura Alvo" value={form.temperaturaAlvo || ''} onChange={(v) => update('temperaturaAlvo', v)} placeholder="Ex: -18°C" />
        </div>
      </div>

      {/* Especificações Técnicas */}
      <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Especificações Técnicas</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Dimensões detalhadas" value={form.dimensoes || ''} onChange={(v) => update('dimensoes', v)} placeholder="Ex: 10 x 8 x 4m (C x L x A)" />
          <Field label="Tipo de Equipamento" value={form.tipoEquipamento || ''} onChange={(v) => update('tipoEquipamento', v)} placeholder="Ex: Split, Monobloco, Central" />
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Capacidade (BTU)</label>
            <input
              type="number"
              value={form.capacidadeBTU || ''}
              onChange={(e) => update('capacidadeBTU', e.target.value ? Number(e.target.value) : undefined)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              placeholder="Ex: 60000"
            />
          </div>
          <SelectField label="Voltagem" value={form.voltagem || ''} onChange={(v) => update('voltagem', v)} options={VOLTAGENS} />
          <SelectField label="Tipo de Gás Refrigerante" value={form.tipoGas || ''} onChange={(v) => update('tipoGas', v)} options={GASES} />
          <SelectField label="Isolamento" value={form.isolamento || ''} onChange={(v) => update('isolamento', v)} options={ISOLAMENTOS} />
          <Field label="Estrutura Existente" value={form.estruturaExistente || ''} onChange={(v) => update('estruturaExistente', v)} placeholder="Ex: Galpão metálico com pé-direito 6m" />
        </div>
      </div>

      {/* Observações */}
      <div className="bg-gray-50 rounded-2xl p-5 space-y-3">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Observações Técnicas</p>
        <textarea
          value={form.observacoesTecnicas || ''}
          onChange={(e) => update('observacoesTecnicas', e.target.value)}
          rows={4}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none"
          placeholder="Anotações livres do projetista..."
        />
      </div>

      {/* Fotos de Levantamento */}
      <div className="bg-gray-50 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
            <Image className="w-3.5 h-3.5" /> Fotos de Levantamento
          </p>
          <button
            onClick={() => { setUploadType('foto'); fileRef.current?.click(); }}
            disabled={uploading}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100"
          >
            {uploading && uploadType === 'foto' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Upload Foto
          </button>
        </div>
        {(form.fotosLevantamento && form.fotosLevantamento.length > 0) ? (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {form.fotosLevantamento.map((url, i) => (
              <div key={i} className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-square bg-white">
                <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => removeFile('foto', i)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-4">Nenhuma foto adicionada</p>
        )}
      </div>

      {/* Croquis/Desenhos */}
      <div className="bg-gray-50 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Croquis / Desenhos
          </p>
          <button
            onClick={() => { setUploadType('croqui'); fileRef.current?.click(); }}
            disabled={uploading}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100"
          >
            {uploading && uploadType === 'croqui' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Upload
          </button>
        </div>
        {(form.croquis && form.croquis.length > 0) ? (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {form.croquis.map((url, i) => (
              <div key={i} className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-square bg-white">
                {url.endsWith('.pdf') ? (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                ) : (
                  <img src={url} alt={`Croqui ${i + 1}`} className="w-full h-full object-cover" />
                )}
                <button
                  onClick={() => removeFile('croqui', i)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-4">Nenhum croqui adicionado</p>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = '';
        }}
      />
    </div>
  );
};

// ── Sub-componentes ──
const Field: React.FC<{
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="text-xs font-bold text-gray-600 block mb-1">{label}</label>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
      placeholder={placeholder}
    />
  </div>
);

const SelectField: React.FC<{
  label: string; value: string; onChange: (v: string) => void; options: string[];
}> = ({ label, value, onChange, options }) => (
  <div>
    <label className="text-xs font-bold text-gray-600 block mb-1">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
    >
      <option value="">Selecione...</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  </div>
);

export default ProjectPrancheta;
