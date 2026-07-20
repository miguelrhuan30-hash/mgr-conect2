/**
 * components/NotificacoesBell.tsx
 *
 * Sino de notificações pessoais (tema claro), pra web gestor e Portal do
 * Cliente — mesma central de notificações (`useNotificacoes`/coleção
 * `notifications`) já usada no FieldApp via FieldNotificacoes.tsx, só com
 * visual claro em vez de dark.
 */
import React, { useState } from 'react';
import { Bell, X, Check, UtensilsCrossed, HelpCircle, Car, ClipboardList, Info, Download } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useNotificacoes } from '../src/hooks/useNotificacoes';
import type { NotificacaoCanal, Notificacao } from '../types';

const CANAL_ICON: Record<NotificacaoCanal, React.ReactNode> = {
  almoco:  <UtensilsCrossed size={15} className="text-orange-500" />,
  duvida:  <HelpCircle size={15} className="text-amber-500" />,
  veiculo: <Car size={15} className="text-sky-500" />,
  os:      <ClipboardList size={15} className="text-blue-500" />,
  geral:   <Info size={15} className="text-gray-400" />,
};

const iconeDe = (n: Notificacao): React.ReactNode =>
  n.tipo === 'sistema_atualizado' ? <Download size={15} className="text-emerald-500" /> : (CANAL_ICON[n.canal] ?? CANAL_ICON.geral);

const fmt = (ts?: Timestamp): string => {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())} · ${p(d.getDate())}/${p(d.getMonth() + 1)}`;
};

export default function NotificacoesBell() {
  const { notificacoes, naoLidas, marcar, marcarTodas } = useNotificacoes();
  const [aberto, setAberto] = useState(false);
  const navigate = useNavigate();

  const abrirNotif = (id: string, rota?: string) => {
    marcar(id);
    if (rota) { setAberto(false); navigate(rota); }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setAberto(v => !v)}
        className={`relative p-2 rounded-xl hover:bg-gray-100 transition-colors ${aberto ? 'bg-gray-100' : ''}`}
        aria-label="Notificações"
        title="Notificações"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 rounded-full flex items-center justify-center border border-white">
            <span className="text-[9px] font-black text-white">{naoLidas > 9 ? '9+' : naoLidas}</span>
          </span>
        )}
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-[70]" onClick={() => setAberto(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden z-[80]">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-gray-500" />
                <span className="font-bold text-sm text-gray-900">Notificações</span>
                {naoLidas > 0 && (
                  <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                    {naoLidas} nova{naoLidas > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {naoLidas > 0 && (
                  <button onClick={marcarTodas} className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-900 px-2 py-1">
                    <Check size={13} /> Marcar todas
                  </button>
                )}
                <button onClick={() => setAberto(false)} className="p-1.5 rounded-lg hover:bg-gray-200">
                  <X size={16} className="text-gray-500" />
                </button>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto p-2">
              {notificacoes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <Bell size={32} className="mb-2 opacity-30" />
                  <p className="text-sm font-semibold text-gray-500">Nenhuma notificação</p>
                  <p className="text-xs mt-1 text-gray-400">Você está em dia</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {notificacoes.map(n => (
                    <button
                      key={n.id}
                      onClick={() => abrirNotif(n.id, n.rota)}
                      className={`w-full flex items-start gap-3 p-2.5 rounded-xl border text-left transition-colors ${
                        n.lida ? 'bg-white border-gray-100' : 'bg-brand-50/60 border-brand-100 hover:bg-brand-50'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        {iconeDe(n)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-bold truncate ${n.lida ? 'text-gray-500' : 'text-gray-900'}`}>{n.titulo}</p>
                          {!n.lida && <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />}
                        </div>
                        <p className={`text-xs mt-0.5 line-clamp-2 ${n.lida ? 'text-gray-400' : 'text-gray-600'}`}>{n.corpo}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{fmt(n.criadoEm)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
