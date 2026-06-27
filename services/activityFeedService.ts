/**
 * activityFeedService — Feed de Gestão em tempo real
 * Registra atividades das equipes de campo (ponto, O.S., fotos, veículo, dúvidas).
 * Cada atividade vira um card no feed estilo rede social para gestores acompanharem.
 */
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export type ActivityTipo =
  | 'ponto_entrada'
  | 'ponto_saida'
  | 'ponto_almoco_inicio'
  | 'ponto_almoco_fim'
  | 'os_aberta'
  | 'os_iniciada'
  | 'os_concluida'
  | 'tarefa_concluida'
  | 'foto_tarefa'
  | 'veiculo_aberto'
  | 'veiculo_fechado'
  | 'duvida_os';

export interface FeedAtividade {
  id: string;
  tipo: ActivityTipo;
  autorId: string;
  autorNome: string;
  autorFotoUrl?: string;
  criadoEm: Timestamp;
  titulo: string;
  descricao?: string;
  // Contexto de O.S.
  osId?: string;
  osNumero?: string;
  osTitulo?: string;
  clienteNome?: string;
  // Mídia
  fotoUrl?: string;
  // Localização
  lat?: number;
  lng?: number;
  endereco?: string;
  // Para duvida_os
  respondida?: boolean;
  respostasCount?: number;
  // Extra
  meta?: Record<string, any>;
}

export interface FeedResposta {
  id: string;
  autorId: string;
  autorNome: string;
  texto: string;
  criadoEm: Timestamp;
  fotoUrl?: string;
}

export interface RegistrarParams {
  tipo: ActivityTipo;
  autorId: string;
  autorNome: string;
  autorFotoUrl?: string;
  titulo: string;
  descricao?: string;
  osId?: string;
  osNumero?: string;
  osTitulo?: string;
  clienteNome?: string;
  fotoUrl?: string;
  lat?: number;
  lng?: number;
  endereco?: string;
  meta?: Record<string, any>;
}

export const ACTIVITY_FEED_COLLECTION = 'activity_feed';

/**
 * Registra uma atividade no feed.
 * Fire-and-forget: erros são logados mas não propagados ao chamador.
 */
export const registrarAtividade = (params: RegistrarParams): void => {
  const payload: any = {
    ...params,
    criadoEm: Timestamp.now(),
  };
  if (params.tipo === 'duvida_os') {
    payload.respondida    = false;
    payload.respostasCount = 0;
  }
  // Remove undefined fields
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

  addDoc(collection(db, ACTIVITY_FEED_COLLECTION), payload).catch(e => {
    console.error('[activityFeed] registrar:', e);
  });
};
