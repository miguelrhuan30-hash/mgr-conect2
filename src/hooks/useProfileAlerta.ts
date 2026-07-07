import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

export type ProfileAlertaTipo = 'rejeitado' | 'aprovado' | 'pendente' | 'incompleto' | null;

export interface ProfileAlerta {
  tipo: ProfileAlertaTipo;
  temAlerta: boolean;
  requestId: string | null;
  requestData: any | null;
  marcarComoVisto: (id: string) => void;
}

const STORAGE_KEY = 'mgr_perfil_vistos';

const getVistos = (): string[] => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
};

export function useProfileAlerta(): ProfileAlerta {
  const { currentUser, userProfile } = useAuth();
  const [tipo, setTipo]               = useState<ProfileAlertaTipo>(null);
  const [requestId, setRequestId]     = useState<string | null>(null);
  const [requestData, setRequestData] = useState<any | null>(null);

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'profile_change_requests'),
      where('uid', '==', currentUser.uid),
    );

    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() as any }))
        .sort((a, b) => (b.criadoEm?.seconds ?? 0) - (a.criadoEm?.seconds ?? 0));

      const vistos    = getVistos();
      const rejeitado = docs.find(d => d.status === 'rejeitado' && !vistos.includes(d.id));
      const aprovado  = docs.find(d => d.status === 'aprovado'  && !vistos.includes(d.id));
      const pendente  = docs.find(d => d.status === 'pendente');

      const p = userProfile as any;
      const camposObrigatorios = ['nomeCompleto', 'cpf', 'phone', 'pixKey'];
      const hasIncompleto = camposObrigatorios.some(c => !p?.[c]?.trim());

      if (rejeitado) {
        setTipo('rejeitado'); setRequestId(rejeitado.id); setRequestData(rejeitado);
      } else if (aprovado) {
        setTipo('aprovado');  setRequestId(aprovado.id);  setRequestData(aprovado);
      } else if (pendente) {
        setTipo('pendente');  setRequestId(pendente.id);  setRequestData(pendente);
      } else if (hasIncompleto) {
        setTipo('incompleto'); setRequestId(null); setRequestData(null);
      } else {
        setTipo(null); setRequestId(null); setRequestData(null);
      }
    }, () => {
      // Fallback: checar apenas campos locais se Firestore falhar
      const p = userProfile as any;
      const camposObrigatorios = ['nomeCompleto', 'cpf', 'phone', 'pixKey'];
      const hasIncompleto = camposObrigatorios.some(c => !p?.[c]?.trim());
      setTipo(hasIncompleto ? 'incompleto' : null);
    });

    return unsub;
  }, [currentUser, userProfile]);

  const marcarComoVisto = (id: string) => {
    const vistos = getVistos();
    if (!vistos.includes(id)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...vistos, id]));
    }
    // Limpar alerta imediatamente
    if (requestId === id) {
      const p = userProfile as any;
      const camposObrigatorios = ['nomeCompleto', 'cpf', 'phone', 'pixKey'];
      const hasIncompleto = camposObrigatorios.some(c => !p?.[c]?.trim());
      setTipo(hasIncompleto ? 'incompleto' : null);
      setRequestId(null);
      setRequestData(null);
    }
  };

  return { tipo, temAlerta: tipo !== null, requestId, requestData, marcarComoVisto };
}
