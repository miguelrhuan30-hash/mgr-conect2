/**
 * components/Fleet/RegistrarManutencaoHistorica.tsx
 * Registro rápido de manutenção de frota JÁ REALIZADA, feito pela equipe MGR
 * (staff) — pra digitalizar histórico de um cliente (planilha, papel etc)
 * sem forçar o fluxo de autoatendimento do Portal (solicitação → conversão
 * → finalização), que não faz sentido pra algo que já aconteceu.
 *
 * Grava o registro já como 'concluída' direto — staff (!isCliente()) tem
 * permissão de escrita irrestrita em fleet_maintenances (firestore.rules),
 * não precisa passar pela Cloud Function fleetFinalizarManutencao (essa é a
 * fonte da verdade só pro fluxo self-service do cliente, com a trava de
 * autoria que não se aplica aqui).
 *
 * Depois de salvar, o formulário reseta (sem fechar o modal) — pensado pra
 * lançar vários registros do mesmo veículo em sequência.
 */
import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { CollectionName, FleetVehicle, FleetProvider } from '../../types';
import { Wrench, Loader2, X, Save, CheckCircle2 } from 'lucide-react';

interface Props {
  vehicle: FleetVehicle;
  onClose: () => void;
}

export default function RegistrarManutencaoHistorica({ vehicle, onClose }: Props) {
  const { userProfile } = useAuth();
  const [providers, setProviders] = useState<FleetProvider[]>([]);

  const [data, setData] = useState('');
  const [providerId, setProviderId] = useState('');
  const [tipo, setTipo] = useState<'corretiva' | 'preventiva'>('corretiva');
  const [servicos, setServicos] = useState('');
  const [pecas, setPecas] = useState('');
  const [custo, setCusto] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState(0); // contador — mostra "N registros salvos" enquanto o modal fica aberto

  useEffect(() => {
    return onSnapshot(
      query(collection(db, CollectionName.FLEET_PROVIDERS), where('clientId', '==', vehicle.clientId)),
      snap => setProviders(snap.docs.map(d => ({ id: d.id, ...d.data() } as FleetProvider))), () => {},
    );
  }, [vehicle.clientId]);

  const limpar = () => {
    setData(''); setProviderId(''); setTipo('corretiva');
    setServicos(''); setPecas(''); setCusto(''); setObservacoes('');
  };

  const handleSubmit = async () => {
    setErro('');
    if (!data) { setErro('Informe a data da manutenção.'); return; }
    if (!servicos.trim()) { setErro('Descreva pelo menos um serviço realizado.'); return; }
    setSaving(true);
    try {
      const provider = providers.find(p => p.id === providerId);
      const dataVisita = Timestamp.fromDate(new Date(`${data}T12:00:00`));
      const nomeStaff = userProfile?.nomeCompleto || userProfile?.displayName || 'MGR';
      await addDoc(collection(db, CollectionName.FLEET_MAINTENANCES), {
        clientId: vehicle.clientId,
        clientName: vehicle.clientName,
        vehicleId: vehicle.id,
        vehiclePlaca: vehicle.placa,
        providerId: provider?.id || null,
        providerNome: provider?.nome || null,
        problemaRelatado: servicos.split('\n').map(s => s.trim()).filter(Boolean)[0] || 'Manutenção registrada retroativamente',
        tipo,
        servicosRealizados: servicos.split('\n').map(s => s.trim()).filter(Boolean).map((descricao, i) => ({ id: `s${i}`, descricao })),
        pecasUtilizadas: pecas.split('\n').map(s => s.trim()).filter(Boolean).map((descricao, i) => ({ id: `p${i}`, descricao })),
        abertoPorUid: userProfile?.uid,
        abertoPorNome: nomeStaff,
        createdAt: dataVisita,
        status: 'concluida',
        finalizadoEm: dataVisita,
        finalizadoPorUid: userProfile?.uid,
        finalizadoPorNome: nomeStaff,
        observacoesFinais: observacoes.trim() || null,
        ...(custo ? { custo: parseFloat(custo) } : {}),
        updatedAt: serverTimestamp(),
      });
      setSalvo(s => s + 1);
      limpar();
    } catch {
      setErro('Erro ao salvar o registro.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between bg-gray-50 sticky top-0">
          <div>
            <h2 className="font-bold text-gray-900 flex items-center gap-2"><Wrench className="w-4 h-4 text-brand-600" /> Registrar Manutenção — {vehicle.placa}</h2>
            {salvo > 0 && <p className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5"><CheckCircle2 className="w-3 h-3" /> {salvo} registro(s) salvo(s) nesta sessão</p>}
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-[11px] text-gray-400">Histórico já realizado (backfill) — grava direto como concluída, sem passar pelo fluxo de solicitação do Portal.</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Data da manutenção</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value as 'corretiva' | 'preventiva')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                <option value="corretiva">Corretiva</option>
                <option value="preventiva">Preventiva</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Prestador</label>
            <select value={providerId} onChange={e => setProviderId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
              <option value="">Não identificado</option>
              {providers.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Serviços realizados (um por linha)</label>
            <textarea value={servicos} onChange={e => setServicos(e.target.value)} rows={4}
              placeholder={'Ex:\nCarga de gás completa\nLimpeza\nTroca de ventilador'}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white resize-none" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Peças utilizadas (opcional, uma por linha)</label>
            <textarea value={pecas} onChange={e => setPecas(e.target.value)} rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white resize-none" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Custo (R$, opcional)</label>
            <input type="number" step="0.01" value={custo} onChange={e => setCusto(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Observações (opcional)</label>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white resize-none" />
          </div>

          {erro && <p className="text-xs text-red-600">{erro}</p>}

          <div className="flex gap-3 pt-2 border-t">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600">Terminar</button>
            <button onClick={handleSubmit} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar e Lançar Próxima
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
