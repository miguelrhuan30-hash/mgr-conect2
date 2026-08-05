/**
 * components/HistoricoEquipamento.tsx
 * "Ver Histórico de Equipamento" in loco — lê o QR/código de um Ativo Final
 * ou Maquinário e mostra o histórico de O.S. dele na hora, sem precisar
 * navegar até o cadastro do cliente. Se for um Ativo Final, mostra também o
 * histórico de todos os Maquinários vinculados a ele.
 */
import React, { useState } from 'react';
import EquipamentoScanModal, { EquipamentoResolvido } from './EquipamentoScanModal';
import { HistoricoMaquinario } from './Assets';
import { QrCode, Building2, Cog, Wrench, RotateCcw } from 'lucide-react';

export default function HistoricoEquipamento() {
  const [equip, setEquip] = useState<EquipamentoResolvido | null>(null);
  const [mostrarScan, setMostrarScan] = useState(false);

  const handleResolve = (resolvido: EquipamentoResolvido) => {
    setEquip(resolvido);
    setMostrarScan(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-gray-900">Histórico de Equipamento</h1>
        <p className="text-sm text-gray-500">Leia o QR code do adesivo ou digite o código do equipamento pra consultar o histórico de manutenção na hora.</p>
      </div>

      {!equip ? (
        <button onClick={() => setMostrarScan(true)}
          className="w-full py-10 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-brand-300 hover:text-brand-600 flex flex-col items-center gap-2">
          <QrCode className="w-8 h-8" />
          <span className="text-sm font-bold">Ler QR Code ou Digitar Código</span>
        </button>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                {equip.tipo === 'ativo' ? <Cog className="w-3 h-3" /> : <Wrench className="w-3 h-3" />}
                {equip.tipo === 'ativo' ? 'Ativo Final' : 'Maquinário'}
              </p>
              <h2 className="font-bold text-gray-900">{equip.nome}</h2>
              {equip.clientName && (
                <p className="text-xs text-sky-600 flex items-center gap-1 mt-0.5"><Building2 className="w-3 h-3" /> {equip.clientName}</p>
              )}
            </div>
            <button onClick={() => { setEquip(null); setMostrarScan(true); }}
              className="shrink-0 text-xs font-bold text-gray-500 hover:text-brand-600 flex items-center gap-1 border border-gray-200 rounded-lg px-2.5 py-1.5">
              <RotateCcw className="w-3 h-3" /> Consultar outro
            </button>
          </div>

          {equip.tipo === 'ativo' ? (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-3">Histórico deste Ativo</p>
                <HistoricoMaquinario ativoId={equip.id} />
              </div>
              {(equip.ativosVinculados || []).map(m => (
                <div key={m.id} className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-3 flex items-center gap-1">
                    <Wrench className="w-3 h-3" /> Maquinário: {m.nome}
                  </p>
                  <HistoricoMaquinario maquinarioId={m.id} />
                </div>
              ))}
              {(equip.ativosVinculados || []).length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">Nenhum maquinário vinculado a este ativo.</p>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-3">Histórico deste Maquinário</p>
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
