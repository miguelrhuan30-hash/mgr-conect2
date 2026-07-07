/**
 * FieldNotificacoes — sino + painel da Central de Notificações no app de campo.
 * Escuta via useNotificacoes (F-A): som ao chegar nova, badge de não lidas,
 * painel com histórico e navegação ao tocar.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, Check, UtensilsCrossed, HelpCircle, Car, ClipboardList, Info } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useNotificacoes } from '../../src/hooks/useNotificacoes';
import type { NotificacaoCanal } from '../../types';

const CANAL_ICON: Record<NotificacaoCanal, React.ReactNode> = {
  almoco:  <UtensilsCrossed size={15} className="text-orange-400" />,
  duvida:  <HelpCircle size={15} className="text-amber-400" />,
  veiculo: <Car size={15} className="text-sky-400" />,
  os:      <ClipboardList size={15} className="text-blue-400" />,
  geral:   <Info size={15} className="text-gray-400" />,
};

const fmt = (ts?: Timestamp): string => {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())} · ${p(d.getDate())}/${p(d.getMonth() + 1)}`;
};

export default function FieldNotificacoes() {
  const { notificacoes, naoLidas, marcar, marcarTodas } = useNotificacoes();
  const [aberto, setAberto] = useState(false);
  const navigate = useNavigate();

  const abrirNotif = (id: string, rota?: string) => {
    marcar(id);
    if (rota) { setAberto(false); navigate(rota); }
  };

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="relative w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center active:bg-gray-700 border border-gray-700"
        aria-label="Notificações"
      >
        <Bell size={15} className="text-gray-300" />
        {naoLidas > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 rounded-full flex items-center justify-center border border-gray-900">
            <span className="text-[9px] font-black text-white">{naoLidas > 9 ? '9+' : naoLidas}</span>
          </span>
        )}
      </button>

      {aberto && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-gray-950">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 safe-area-top">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-orange-400" />
              <span className="font-bold text-sm text-white">Notificações</span>
              {naoLidas > 0 && (
                <span className="text-[10px] font-bold text-orange-400 bg-orange-500/15 px-2 py-0.5 rounded-full">
                  {naoLidas} nova{naoLidas > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {naoLidas > 0 && (
                <button onClick={marcarTodas} className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 active:text-white px-2 py-1">
                  <Check size={13} /> Marcar todas
                </button>
              )}
              <button onClick={() => setAberto(false)} className="p-2 -mr-2 rounded-full active:bg-gray-800">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto p-3">
            {notificacoes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-600">
                <Bell size={36} className="mb-3 opacity-30" />
                <p className="text-sm font-semibold text-gray-500">Nenhuma notificação</p>
                <p className="text-xs mt-1 text-gray-600">Você está em dia</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notificacoes.map(n => (
                  <button
                    key={n.id}
                    onClick={() => abrirNotif(n.id, n.rota)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
                      n.lida
                        ? 'bg-gray-900 border-gray-800'
                        : 'bg-gray-800/80 border-gray-700 active:bg-gray-800'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {CANAL_ICON[n.canal] ?? CANAL_ICON.geral}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-bold truncate ${n.lida ? 'text-gray-400' : 'text-white'}`}>{n.titulo}</p>
                        {!n.lida && <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />}
                      </div>
                      <p className={`text-xs mt-0.5 line-clamp-2 ${n.lida ? 'text-gray-600' : 'text-gray-400'}`}>{n.corpo}</p>
                      <p className="text-[10px] text-gray-600 mt-1">{fmt(n.criadoEm)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
