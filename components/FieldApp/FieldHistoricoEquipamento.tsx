/**
 * components/FieldApp/FieldHistoricoEquipamento.tsx
 * Versão campo (MGR Campo, tema escuro) de "Ver Histórico de Equipamento" —
 * mesmo mecanismo do lado web (components/HistoricoEquipamento.tsx), técnico
 * lê o QR/código do adesivo em loco e vê o histórico de manutenção na hora.
 */
import React, { useState } from 'react';
import EquipamentoScanModal, { EquipamentoResolvido } from '../EquipamentoScanModal';
import { HistoricoMaquinario } from '../Assets';
import { QrCode, Building2, Cog, Wrench, RotateCcw, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function FieldHistoricoEquipamento() {
  const { userProfile } = useAuth();
  const podeVer = ['admin', 'gestor', 'manager'].includes(userProfile?.role || '')
    || !!(userProfile?.permissions?.canViewAssetHistory)
    || !!(userProfile?.permissions?.canManageClients)
    || !!(userProfile?.permissions?.canManageProjects);

  const [equip, setEquip] = useState<EquipamentoResolvido | null>(null);
  const [mostrarScan, setMostrarScan] = useState(false);

  if (!podeVer) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center text-gray-500 py-16">
        <Shield size={40} className="mb-3 opacity-30" />
        <p className="text-sm font-medium text-gray-300">Acesso restrito</p>
        <p className="text-xs mt-1">Você não tem permissão pra consultar histórico de equipamento.</p>
      </div>
    );
  }

  const handleResolve = (resolvido: EquipamentoResolvido) => {
    setEquip(resolvido);
    setMostrarScan(false);
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-lg font-extrabold text-white">Histórico de Equipamento</h1>
        <p className="text-xs text-gray-400">Leia o QR do adesivo ou digite o código pra ver o histórico de manutenção na hora.</p>
      </div>

      {!equip ? (
        <button onClick={() => setMostrarScan(true)}
          className="w-full py-10 rounded-2xl border-2 border-dashed border-gray-700 text-gray-500 active:border-emerald-500 active:text-emerald-400 flex flex-col items-center gap-2">
          <QrCode className="w-8 h-8" />
          <span className="text-sm font-bold">Ler QR Code ou Digitar Código</span>
        </button>
      ) : (
        <>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                {equip.tipo === 'ativo' ? <Cog className="w-3 h-3" /> : <Wrench className="w-3 h-3" />}
                {equip.tipo === 'ativo' ? 'Ativo Final' : 'Maquinário'}
              </p>
              <h2 className="font-bold text-white">{equip.nome}</h2>
              {equip.clientName && (
                <p className="text-xs text-emerald-400 flex items-center gap-1 mt-0.5"><Building2 className="w-3 h-3" /> {equip.clientName}</p>
              )}
            </div>
            <button onClick={() => { setEquip(null); setMostrarScan(true); }}
              className="shrink-0 text-xs font-bold text-gray-400 active:text-emerald-400 flex items-center gap-1 border border-gray-700 rounded-lg px-2.5 py-1.5">
              <RotateCcw className="w-3 h-3" /> Outro
            </button>
          </div>

          {equip.tipo === 'ativo' ? (
            <div className="space-y-3">
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <p className="text-[10px] font-bold text-gray-500 uppercase mb-3">Histórico deste Ativo</p>
                <HistoricoMaquinario ativoId={equip.id} />
              </div>
              {(equip.ativosVinculados || []).map(m => (
                <div key={m.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <p className="text-[10px] font-bold text-gray-500 uppercase mb-3 flex items-center gap-1">
                    <Wrench className="w-3 h-3" /> Maquinário: {m.nome}
                  </p>
                  <HistoricoMaquinario maquinarioId={m.id} />
                </div>
              ))}
              {(equip.ativosVinculados || []).length === 0 && (
                <p className="text-xs text-gray-500 text-center py-2">Nenhum maquinário vinculado a este ativo.</p>
              )}
            </div>
          ) : (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <p className="text-[10px] font-bold text-gray-500 uppercase mb-3">Histórico deste Maquinário</p>
              <HistoricoMaquinario maquinarioId={equip.id} />
            </div>
          )}
        </>
      )}

      {mostrarScan && (
        <EquipamentoScanModal
          titulo="Consultar histórico de equipamento"
          onResolve={handleResolve}
          onClose={() => setMostrarScan(false)}
        />
      )}
    </div>
  );
}
