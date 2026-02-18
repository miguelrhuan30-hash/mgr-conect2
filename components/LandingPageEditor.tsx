import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { CollectionName, LandingPageContent, Partner } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { compressImage } from '../utils/compressor';
import { 
  ArrowLeft, Save, Loader2, Monitor, Globe, Image as ImageIcon, Settings, 
  MessageSquare, Plus, Trash2, BarChart2, Users, LayoutDashboard, X, Edit, UploadCloud 
} from 'lucide-react';

const LandingPageEditor: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState<LandingPageContent | null>(null);

  // Stats input state
  const [newStatValue, setNewStatValue] = useState('');
  const [newStatLabel, setNewStatLabel] = useState('');
  
  // Partner (Client) State
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [partnerName, setPartnerName] = useState('');
  const [partnerLogoFile, setPartnerLogoFile] = useState<File | null>(null);
  const [partnerLogoPreview, setPartnerLogoPreview] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  // Security Redirect
  useEffect(() => {
    if (!loading && userProfile?.role !== 'developer' && userProfile?.role !== 'admin') {
      navigate('/app');
    }
  }, [userProfile, loading, navigate]);

  // Load Content
  useEffect(() => {
    // Authorization Check: Only allow if role is admin or developer
    if (!userProfile || (userProfile.role !== 'developer' && userProfile.role !== 'admin')) {
        return;
    }

    const fetchContent = async () => {
      try {
        const docRef = doc(db, CollectionName.SYSTEM_SETTINGS, 'landing_page');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as any;
          
          // Migration Logic for Editor
          let partners = data.clients?.partners || [];
          if (data.clients?.logos && Array.isArray(data.clients.logos) && partners.length === 0) {
            partners = data.clients.logos.map((name: string, index: number) => ({
               id: `legacy-${index}`,
               name: name,
               logoUrl: ''
            }));
          }

          const normalizedData: LandingPageContent = {
             ...data,
             clients: {
                ...data.clients,
                partners: partners
             }
          };
          setContent(normalizedData);
        } else {
          alert("Nenhum conteúdo encontrado. Visite a página inicial primeiro para gerar os dados padrão.");
          navigate('/');
        }
      } catch (err: any) {
        if (err?.code !== 'permission-denied') {
             console.error("Error loading CMS content", err);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [userProfile, navigate]);

  const handleSave = async () => {
    if (!content) return;
    setSaving(true);
    try {
      await setDoc(doc(db, CollectionName.SYSTEM_SETTINGS, 'landing_page'), content, { merge: true });
      alert("Alterações salvas com sucesso!");
    } catch (error) {
      console.error("Error saving content:", error);
      alert("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (section: keyof LandingPageContent, field: string, value: any) => {
    if (!content) return;
    setContent({
      ...content,
      [section]: {
        ...content[section],
        [field]: value
      }
    });
  };

  // Stats Handlers
  const addStat = () => {
    if (!content || !newStatValue || !newStatLabel) return;
    const currentStats = content.stats || [];
    setContent({
      ...content,
      stats: [...currentStats, { value: newStatValue, label: newStatLabel }]
    });
    setNewStatValue('');
    setNewStatLabel('');
  };

  const removeStat = (index: number) => {
    if (!content) return;
    const newStats = [...(content.stats || [])];
    newStats.splice(index, 1);
    setContent({ ...content, stats: newStats });
  };

  // --- PARTNER (CLIENT) LOGIC ---
  
  const openPartnerModal = (partner?: Partner) => {
    if (partner) {
      setEditingPartner(partner);
      setPartnerName(partner.name);
      setPartnerLogoPreview(partner.logoUrl);
    } else {
      setEditingPartner(null);
      setPartnerName('');
      setPartnerLogoPreview('');
    }
    setPartnerLogoFile(null);
    setIsPartnerModalOpen(true);
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPartnerLogoFile(file);
      setPartnerLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSavePartner = async () => {
    if (!content || !partnerName.trim()) return;
    setIsUploading(true);

    try {
      let logoUrl = editingPartner?.logoUrl || '';

      // Upload if new file
      if (partnerLogoFile) {
        // Compress Image
        const compressedFile = await compressImage(partnerLogoFile, 400, 0.8);

        const storageRef = ref(storage, `landing/partners/${Date.now()}_${compressedFile.name}`);
        await uploadBytes(storageRef, compressedFile);
        logoUrl = await getDownloadURL(storageRef);
      }

      const newPartner: Partner = {
        id: editingPartner?.id || Math.random().toString(36).substr(2, 9),
        name: partnerName.trim(),
        logoUrl: logoUrl
      };

      const currentPartners = content.clients?.partners || [];
      let updatedPartners;

      if (editingPartner) {
        updatedPartners = currentPartners.map(p => p.id === editingPartner.id ? newPartner : p);
      } else {
        updatedPartners = [...currentPartners, newPartner];
      }

      setContent({
        ...content,
        clients: {
          ...content.clients,
          partners: updatedPartners
        }
      });

      setIsPartnerModalOpen(false);
    } catch (error) {
      console.error("Error saving partner:", error);
      alert("Erro ao salvar parceiro.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePartner = (id: string) => {
    if (!content || !window.confirm("Remover este parceiro?")) return;
    const updatedPartners = (content.clients?.partners || []).filter(p => p.id !== id);
    setContent({
      ...content,
      clients: {
        ...content.clients,
        partners: updatedPartners
      }
    });
  };

  if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin text-brand-600 w-8 h-8"/></div>;
  if (!content) return <div>Erro ao carregar editor.</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-50 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/app')} 
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
          >
            <ArrowLeft size={16} />
            Voltar ao Dashboard
          </button>
          <div className="h-6 w-px bg-gray-300 mx-2 hidden md:block"></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Monitor size={20} className="text-brand-600" />
              Editor do Site
            </h1>
            <p className="text-xs text-gray-500 hidden md:block">CMS - Gerenciador de Conteúdo</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/')} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2">
            <Globe size={16} /> <span className="hidden md:inline">Ver Site</span>
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-2 font-medium shadow-sm disabled:opacity-70"
          >
            {saving ? <Loader2 className="animate-spin w-4 h-4"/> : <Save className="w-4 h-4" />}
            <span className="hidden md:inline">Salvar Alterações</span>
            <span className="md:hidden">Salvar</span>
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        
        {/* HERO SECTION */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 font-bold text-gray-700 flex items-center gap-2">
            Seção Hero (Topo)
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título Principal</label>
              <input 
                type="text" 
                value={content.hero.title} 
                onChange={e => updateField('hero', 'title', e.target.value)}
                className="w-full rounded-lg border-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo</label>
              <textarea 
                rows={2}
                value={content.hero.subtitle} 
                onChange={e => updateField('hero', 'subtitle', e.target.value)}
                className="w-full rounded-lg border-gray-300 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Imagem de Fundo (URL)</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <ImageIcon className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                  <input 
                    type="text" 
                    value={content.hero.backgroundImageUrl} 
                    onChange={e => updateField('hero', 'backgroundImageUrl', e.target.value)}
                    className="w-full pl-9 rounded-lg border-gray-300 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
             <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Texto do Botão</label>
                <input 
                  type="text" 
                  value={content.hero.ctaText} 
                  onChange={e => updateField('hero', 'ctaText', e.target.value)}
                  className="w-full rounded-lg border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link do Botão</label>
                <input 
                  type="text" 
                  value={content.hero.ctaLink} 
                  onChange={e => updateField('hero', 'ctaLink', e.target.value)}
                  className="w-full rounded-lg border-gray-300"
                />
              </div>
            </div>
          </div>
        </div>

        {/* STATS SECTION */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 font-bold text-gray-700 flex items-center gap-2">
             <BarChart2 size={18} /> Estatísticas (Barra Azul)
          </div>
          <div className="p-6">
            <div className="space-y-3 mb-4">
              {(content.stats || []).map((stat, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 border border-gray-200 rounded-lg">
                   <div className="flex-1 font-bold text-gray-900">{stat.value}</div>
                   <div className="flex-1 text-sm text-gray-500">{stat.label}</div>
                   <button onClick={() => removeStat(idx)} className="text-red-400 hover:text-red-600">
                     <Trash2 size={16} />
                   </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300">
               <input 
                 placeholder="Valor (ex: +10)" 
                 value={newStatValue}
                 onChange={e => setNewStatValue(e.target.value)}
                 className="flex-1 rounded border-gray-300 text-sm"
               />
               <input 
                 placeholder="Rótulo (ex: Anos)" 
                 value={newStatLabel}
                 onChange={e => setNewStatLabel(e.target.value)}
                 className="flex-[2] rounded border-gray-300 text-sm"
               />
               <button onClick={addStat} className="p-2 bg-brand-600 text-white rounded hover:bg-brand-700">
                 <Plus size={16} />
               </button>
            </div>
          </div>
        </div>

        {/* PARTNERS / CLIENTS SECTION */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 font-bold text-gray-700 flex items-center gap-2">
             <Users size={18} /> Clientes e Parceiros
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título da Seção</label>
              <input 
                type="text" 
                value={content.clients?.title || ''} 
                onChange={e => updateField('clients', 'title', e.target.value)}
                className="w-full rounded-lg border-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <input 
                type="text" 
                value={content.clients?.description || ''} 
                onChange={e => updateField('clients', 'description', e.target.value)}
                className="w-full rounded-lg border-gray-300"
              />
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-700">Lista de Parceiros (Logos)</label>
                <button 
                  onClick={() => openPartnerModal()}
                  className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-gray-800"
                >
                  <Plus size={14} /> Adicionar
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(content.clients?.partners || []).map((partner) => (
                  <div key={partner.id} className="border border-gray-200 rounded-lg p-3 flex flex-col items-center gap-2 bg-gray-50 hover:bg-white hover:shadow-sm transition-all group relative">
                    <div className="h-12 w-full flex items-center justify-center bg-white rounded border border-gray-100 overflow-hidden">
                      {partner.logoUrl ? (
                        <img src={partner.logoUrl} alt={partner.name} className="max-h-full max-w-full object-contain p-1" />
                      ) : (
                        <span className="text-xs text-gray-300">Sem Logo</span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-gray-700 truncate w-full text-center">{partner.name}</span>
                    
                    {/* Action Buttons */}
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 rounded p-0.5">
                       <button onClick={() => openPartnerModal(partner)} className="text-blue-500 hover:text-blue-700"><Edit size={14} /></button>
                       <button onClick={() => handleDeletePartner(partner.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SERVICES SECTION */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 font-bold text-gray-700">
            Seção Soluções (Serviços)
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título da Seção</label>
              <input 
                type="text" 
                value={content.services.title} 
                onChange={e => updateField('services', 'title', e.target.value)}
                className="w-full rounded-lg border-gray-300"
              />
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
               <p className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                * Para manter o layout alinhado, os itens de serviço devem ser editados via código ou solicitação específica.
              </p>
            </div>
          </div>
        </div>

        {/* CONTACT INFO */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 font-bold text-gray-700 flex items-center gap-2">
             <MessageSquare size={18} /> Informações de Contato
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
              <input 
                type="text" 
                value={content.contact.address} 
                onChange={e => updateField('contact', 'address', e.target.value)}
                className="w-full rounded-lg border-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
              <input 
                type="text" 
                value={content.contact.whatsapp} 
                onChange={e => updateField('contact', 'whatsapp', e.target.value)}
                className="w-full rounded-lg border-gray-300"
              />
            </div>
          </div>
        </div>

        {/* FEATURES TOGGLE */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 font-bold text-gray-700 flex items-center gap-2">
            <Settings size={18} /> Funcionalidades
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Botão Flutuante WhatsApp</span>
                <input 
                  type="checkbox" 
                  checked={content.features.whatsappFloat}
                  onChange={e => updateField('features', 'whatsappFloat', e.target.checked)}
                  className="h-5 w-5 text-brand-600 focus:ring-brand-500 border-gray-300 rounded"
                />
             </div>
             <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Formulário de Contato</span>
                <input 
                  type="checkbox" 
                  checked={content.features.contactForm}
                  onChange={e => updateField('features', 'contactForm', e.target.checked)}
                  className="h-5 w-5 text-brand-600 focus:ring-brand-500 border-gray-300 rounded"
                />
             </div>
          </div>
        </div>

      </div>

      {/* PARTNER EDIT MODAL */}
      {isPartnerModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900">{editingPartner ? 'Editar Parceiro' : 'Adicionar Parceiro'}</h3>
              <button onClick={() => setIsPartnerModalOpen(false)}><X className="text-gray-500 w-5 h-5"/></button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa</label>
                <input 
                  type="text" 
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  className="w-full rounded-lg border-gray-300"
                  placeholder="Ex: MGR Refrigeração"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logotipo (Imagem)</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
                   <input 
                     type="file" 
                     accept="image/*"
                     onChange={handleLogoFileChange}
                     className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                   />
                   {partnerLogoPreview ? (
                      <div className="flex flex-col items-center">
                        <img src={partnerLogoPreview} alt="Preview" className="h-20 object-contain mb-2" />
                        <span className="text-xs text-brand-600 font-medium">Clique para alterar</span>
                      </div>
                   ) : (
                      <div className="flex flex-col items-center text-gray-500">
                        <UploadCloud className="w-8 h-8 mb-2 text-gray-400" />
                        <span className="text-sm">Clique para upload</span>
                        <span className="text-xs text-gray-400 mt-1">PNG, JPG ou SVG</span>
                      </div>
                   )}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setIsPartnerModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white border border-transparent hover:border-gray-300 rounded-lg transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSavePartner}
                disabled={isUploading}
                className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 flex items-center gap-2 disabled:opacity-70"
              >
                {isUploading ? <Loader2 className="animate-spin w-4 h-4"/> : <Save className="w-4 h-4"/>}
                Salvar Parceiro
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default LandingPageEditor;