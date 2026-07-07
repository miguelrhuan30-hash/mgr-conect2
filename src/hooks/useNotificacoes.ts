/**
 * useNotificacoes — listener in-app da Central de Notificações (F-A).
 *
 * - Escuta as notificações do usuário logado em tempo real.
 * - Ao chegar uma notificação NOVA (após a carga inicial), dispara alerta
 *   local (som + bandeja) via notificationService.
 * - Expõe lista, contagem de não lidas e ações de marcação.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  ouvirNotificacoes, dispararAlertaLocal, marcarLida, marcarTodasLidas, atualizarBadgeApp,
} from '../../services/notificationService';
import type { Notificacao } from '../../types';

export function useNotificacoes() {
  const { currentUser } = useAuth();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const primeiraCarga = useRef(true);
  const vistosRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUser?.uid) return;
    primeiraCarga.current = true;
    vistosRef.current = new Set();

    const unsub = ouvirNotificacoes(currentUser.uid, notifs => {
      if (primeiraCarga.current) {
        // marca todos os já existentes como "vistos" para não tocar som na abertura
        notifs.forEach(n => vistosRef.current.add(n.id));
        primeiraCarga.current = false;
      } else {
        // detecta as que chegaram agora e ainda não estavam vistas
        const novas = notifs.filter(n => !vistosRef.current.has(n.id) && !n.lida);
        for (const n of novas) {
          vistosRef.current.add(n.id);
          dispararAlertaLocal(n.titulo, n.corpo, n.som !== false);
        }
      }
      setNotificacoes(notifs);
    });

    return unsub;
  }, [currentUser?.uid]);

  const naoLidas = notificacoes.filter(n => !n.lida).length;

  // Badge numérico no ícone do app (PWA instalado) — reflete o total de
  // notificações não lidas, suporte incluso, já que toda dúvida/resposta de
  // suporte passa por notificarVarios() e cai nesta mesma coleção.
  useEffect(() => {
    atualizarBadgeApp(naoLidas);
  }, [naoLidas]);

  const marcar = useCallback((id: string) => { marcarLida(id); }, []);
  const marcarTodas = useCallback(() => {
    if (currentUser?.uid) marcarTodasLidas(currentUser.uid);
  }, [currentUser?.uid]);

  return { notificacoes, naoLidas, marcar, marcarTodas };
}
