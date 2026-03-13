import React, { useState, useEffect } from 'react';
import { collection, doc, getDoc, setDoc, query, getDocs, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, CampaignConfig } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Save, RefreshCw, AlertTriangle, Target, DollarSign, Calendar } from 'lucide-react';

const CampaignManagement: React.FC = () => {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [config, setConfig] = useState<CampaignConfig>({
    name: '',
    prizeValue: 0,
    startDate: Timestamp.now(),
    endDate: Timestamp.now(),
    active: false,
  });

  const [startStr, setStartStr] = useState('');
  const [endStr, setEndStr] = useState('');

  const isAdmin = userProfile?.role === 'admin' || userProfile?.permissions?.canManageSettings;

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const fetchConfig = async () => {
      try {
        const docSnap = await getDoc(doc(db, CollectionName.SYSTEM_SETTINGS, 'campaign_config'));
        if (docSnap.exists()) {
          const data = docSnap.data() as CampaignConfig;
          setConfig(data);
          
          if (data.startDate) {
            setStartStr(data.startDate.toDate().toISOString().split('T')[0]);
          }
          if (data.endDate) {
            setEndStr(data.endDate.toDate().toISOString().split('T')[0]);
          }
        } else {
          // Defaults if not exists
          const today = new Date();
          const nextMonth = new Date();
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          setStartStr(today.toISOString().split('T')[0]);
          setEndStr(nextMonth.toISOString().split('T')[0]);
        }
      } catch (error) {
        console.error("Error fetching campaign config:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [isAdmin]);

  const handleSave = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      const newConfig: CampaignConfig = {
        ...config,
        startDate: Timestamp.fromDate(new Date(startStr + 'T00:00:00')),
        endDate: Timestamp.fromDate(new Date(endStr + 'T23:59:59')),
      };

      await setDoc(doc(db, CollectionName.SYSTEM_SETTINGS, 'campaign_config'), newConfig);
      setConfig(newConfig);
      alert('Configurações salvas com sucesso!');
    } catch (error) {
      console.error("Error saving campaign config:", error);
      alert('Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetCycle = async () => {
    if (!isAdmin) return;
    
    const confirmReset = window.confirm(
      "ATENÇÃO: Isso irá zerar o saldo acumulado (Cofre) e os pontos de TODOS os técnicos.\n\n" +
      "Certifique-se de que os valores atuais já foram pagos ou conferidos.\n\n" +
      "Deseja realmente iniciar um novo ciclo?"
    );

    if (!confirmReset) return;

    setResetting(true);
    try {
      // 1. Ensure latest config is saved first
      const newConfig: CampaignConfig = {
        ...config,
        startDate: Timestamp.fromDate(new Date(startStr + 'T00:00:00')),
        endDate: Timestamp.fromDate(new Date(endStr + 'T23:59:59')),
      };
      await setDoc(doc(db, CollectionName.SYSTEM_SETTINGS, 'campaign_config'), newConfig);

      // 2. Fetch all users
      const usersSnap = await getDocs(collection(db, CollectionName.USERS));
      
      // 3. Batch update users
      const batch = writeBatch(db);
      usersSnap.docs.forEach((userDoc) => {
        batch.update(userDoc.ref, {
          accumulatedPrize: 0,
          currentPoints: 0
        });
      });

      await batch.commit();

      alert('Novo ciclo iniciado com sucesso! Todos os saldos foram zerados.');
    } catch (error) {
      console.error("Error resetting campaign cycle:", error);
      alert('Erro ao reiniciar ciclo.');
    } finally {
      setResetting(false);
    }
  };

  if (!isAdmin) {
    return (
        <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900">Acesso Negado</h2>
            <p className="text-gray-500">Apenas administradores podem acessar esta página.</p>
        </div>
    );
  }

  if (loading) {
     return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-brand-600"/></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Campanhas (MGR Coins)</h1>
          <p className="text-gray-500">Configure os parâmetros da campanha de bonificação e gerencie ciclos.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="space-y-2">
               <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                 <Target size={16} className="text-brand-600" />
                 Nome da Campanha
               </label>
               <input 
                 type="text" 
                 value={config.name || ''} 
                 onChange={(e) => setConfig({...config, name: e.target.value})}
                 placeholder="Ex: Campanha de Inverno 2026"
                 className="w-full border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
               />
               <p className="text-xs text-gray-500">Dê um nome para identificar a campanha atual para os técnicos.</p>
            </div>

            <div className="space-y-2">
               <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                 <DollarSign size={16} className="text-green-600" />
                 Valor do Prêmio Total Máximo (R$)
               </label>
               <div className="relative">
                 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                 <input 
                   type="number" 
                   value={config.prizeValue} 
                   onChange={(e) => setConfig({...config, prizeValue: parseFloat(e.target.value) || 0})}
                   className="w-full pl-9 border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                 />
               </div>
               <p className="text-xs text-gray-500">Valor financeiro base utilizado para os cálculos de ganho e perda diários.</p>
            </div>

            <div className="space-y-2">
               <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                 <Calendar size={16} className="text-blue-600" />
                 Data de Início
               </label>
               <input 
                 type="date" 
                 value={startStr} 
                 onChange={(e) => setStartStr(e.target.value)}
                 className="w-full border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
               />
            </div>

            <div className="space-y-2">
               <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                 <Calendar size={16} className="text-purple-600" />
                 Data Final
               </label>
               <input 
                 type="date" 
                 value={endStr} 
                 onChange={(e) => setEndStr(e.target.value)}
                 className="w-full border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
               />
            </div>

          </div>
          
          <div className="flex items-center gap-3">
             <label className="flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={config.active}
                  onChange={(e) => setConfig({...config, active: e.target.checked})}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 h-5 w-5"
                />
                <span className="ml-2 text-sm font-bold text-gray-700">Campanha Ativa</span>
             </label>
             <p className="text-xs text-gray-500 ml-2">Se desmarcado, os técnicos não acumularão mais saldo e o cofre ficará oculto.</p>
          </div>

        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <button
               onClick={handleResetCycle}
               disabled={resetting || saving}
               className="flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
               {resetting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
               Reiniciar Ciclo (Zerar Saldos)
            </button>

            <button
               onClick={handleSave}
               disabled={saving || resetting}
               className="flex items-center px-6 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
               {saving ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
               Salvar Configurações
            </button>
        </div>
      </div>
    
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Target className="text-blue-600 flex-shrink-0 mt-1" />
          <div className="text-sm text-blue-800">
             <h4 className="font-bold mb-1">Como funciona o ciclo da campanha?</h4>
             <ul className="list-disc pl-5 space-y-1">
                <li>O valor definido acima é o montante total. O ganho diário (fatia) é calculado com base nos dias entre a "Data de Início" e a "Data Final".</li>
                <li>Quando a data final expirar, você deve pagar os prêmios aos técnicos usando o Relatório Financeiro.</li>
                <li>Após o pagamento, atualize as configurações para a nova campanha e clique em <strong>Reiniciar Ciclo</strong>. Isso zerará os cofres de todos para recomeçar o processo de ganho limpo.</li>
             </ul>
          </div>
      </div>

    </div>
  );
};

export default CampaignManagement;
