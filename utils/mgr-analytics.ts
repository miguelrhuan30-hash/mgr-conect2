/**
 * MGR Analytics — Utilitário central de coleta de eventos e KPIs
 *
 * USO: importar logEvent() em qualquer componente/operação do sistema.
 * Nunca chamar addDoc('mgr_events') diretamente — sempre usar este utilitário.
 */

import {
  collection, addDoc, updateDoc, doc, serverTimestamp,
  Timestamp, arrayUnion, getDoc, query, where,
  getDocs, orderBy, limit,
} from 'firebase/firestore';
import { db } from '../firebase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type EventArea =
  | 'pipeline'
  | 'clientes'
  | 'financeiro'
  | 'rh'
  | 'campo'
  | 'veiculos'
  | 'estoque'
  | 'intel'
  | 'agenda'
  | 'usuarios';

export type EventType =
  // Pipeline / O.S.
  | 'os_criada'
  | 'os_status_changed'
  | 'os_agendada'
  | 'os_checkin'
  | 'os_checkout'
  | 'os_concluida'
  // Clientes
  | 'cliente_criado'
  | 'cliente_status_changed'   // novo → ativo → inativo → reativado
  | 'cliente_inativado'
  // Financeiro
  | 'fatura_gerada'
  | 'payment_confirmed'
  | 'receivable_vencido'
  // RH
  | 'ponto_entrada'
  | 'ponto_saida'
  | 'ponto_almoco'
  // Campo / Veículos
  | 'veiculo_abertura'
  | 'geofencing_falha'
  | 'evidencia_registrada'
  // Estoque
  | 'estoque_baixa'
  | 'estoque_reposicao'
  // Intel
  | 'intel_nota_criada'
  | 'intel_acao_aplicada'
  | 'intel_melhoria_concluida'
  // Usuários
  | 'usuario_criado'
  | 'usuario_ativo'
  | 'usuario_inativo';

export interface MgrEvent {
  id?: string;
  eventType: EventType;
  area: EventArea;
  userId: string;        // quem executou a ação
  userName?: string;
  entityId?: string;     // ID do documento relacionado (task, client, etc.)
  entityType?: string;   // 'task' | 'client' | 'receivable' | etc.
  payload?: Record<string, any>;
  timestamp: Timestamp;
  // Campos calculados (preenchidos automaticamente)
  mes: string;           // 'YYYY-MM' — facilita aggregations mensais
  semana: string;        // 'YYYY-WNN'
  dia: string;           // 'YYYY-MM-DD'
}

export interface MetaTransition {
  de: string;
  para: string;
  at: Timestamp;
  by: string;            // uid
  byName?: string;
  duracaoSegundos?: number;  // tempo desde a transição anterior
}

export interface MetaField {
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  area: EventArea;
  transitions?: MetaTransition[];
  kpis?: {
    tempoTotalSegundos?: number;
    faseAtual?: string;
    eficiencia?: number;
    valorFaturado?: number;
  };
}

// ─── Helper de datas ──────────────────────────────────────────────────────────

function getMes(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getSemana(d: Date = new Date()): string {
  const start = new Date(d.getFullYear(), 0, 1);
  const week  = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getDia(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

// ─── logEvent — função principal ──────────────────────────────────────────────

/**
 * Grava um evento analítico na coleção mgr_events.
 * Usar em todos os pontos de ação do sistema.
 *
 * @example
 * await logEvent({
 *   eventType: 'os_status_changed',
 *   area: 'pipeline',
 *   userId: currentUser.uid,
 *   entityId: task.id,
 *   payload: { de: WorkflowStatus.TRIAGEM, para: WorkflowStatus.PRE_ORCAMENTO }
 * });
 */
export async function logEvent(params: Omit<MgrEvent, 'id' | 'timestamp' | 'mes' | 'semana' | 'dia'>): Promise<string | null> {
  try {
    const now = new Date();
    const ref = await addDoc(collection(db, 'mgr_events'), {
      ...params,
      timestamp: serverTimestamp(),
      mes:    getMes(now),
      semana: getSemana(now),
      dia:    getDia(now),
    });
    return ref.id;
  } catch (err) {
    console.error('[MGR Analytics] logEvent falhou:', err);
    return null;
  }
}

// ─── logTransition — para mudanças de status com duração ─────────────────────

/**
 * Atualiza o campo _meta.transitions de um documento
 * e grava o evento correspondente.
 * Usar sempre que um workflowStatus ou clientStatus mudar.
 */
export async function logTransition(params: {
  collectionName: string;
  docId: string;
  de: string;
  para: string;
  userId: string;
  userName?: string;
  area: EventArea;
  eventType: EventType;
  extraPayload?: Record<string, any>;
}): Promise<void> {
  const { collectionName, docId, de, para, userId, userName, area, eventType, extraPayload } = params;

  try {
    // Calcula duração desde a última transição
    let duracaoSegundos: number | undefined;
    const snap = await getDoc(doc(db, collectionName, docId));
    if (snap.exists()) {
      const data = snap.data();
      const transitions: MetaTransition[] = data._meta?.transitions ?? [];
      if (transitions.length > 0) {
        const ultima = transitions[transitions.length - 1];
        const ultimaAt = ultima.at?.toDate?.()?.getTime() ?? 0;
        duracaoSegundos = Math.round((Date.now() - ultimaAt) / 1000);
      }
    }

    const transition: MetaTransition = {
      de,
      para,
      at: Timestamp.now(),
      by: userId,
      ...(userName ? { byName: userName } : {}),
      ...(duracaoSegundos !== undefined ? { duracaoSegundos } : {}),
    };

    // Atualiza _meta no documento original
    await updateDoc(doc(db, collectionName, docId), {
      '_meta.updatedAt':    serverTimestamp(),
      '_meta.updatedBy':    userId,
      '_meta.kpis.faseAtual': para,
      '_meta.transitions':  arrayUnion(transition),
    });

    // Grava evento crítico
    await logEvent({
      eventType,
      area,
      userId,
      userName,
      entityId:   docId,
      entityType: collectionName,
      payload:    { de, para, duracaoSegundos, ...extraPayload },
    });
  } catch (err) {
    console.error('[MGR Analytics] logTransition falhou:', err);
  }
}

// ─── initMeta — inicializa _meta ao criar um documento ───────────────────────

/**
 * Retorna o objeto _meta inicial para incluir ao criar qualquer documento.
 *
 * @example
 * await addDoc(collection(db, 'tasks'), {
 *   ...dadosDaTask,
 *   _meta: initMeta({ userId, area: 'pipeline', faseInicial: WorkflowStatus.TRIAGEM })
 * });
 */
export function initMeta(params: {
  userId: string;
  userName?: string;
  area: EventArea;
  faseInicial?: string;
}): Omit<MetaField, 'createdAt' | 'updatedAt'> & { createdAt: any; updatedAt: any } {
  return {
    createdAt:   serverTimestamp(),
    createdBy:   params.userId,
    updatedAt:   serverTimestamp(),
    updatedBy:   params.userId,
    area:        params.area,
    transitions: params.faseInicial
      ? [{ de: 'CRIADO', para: params.faseInicial, at: Timestamp.now(), by: params.userId, byName: params.userName }]
      : [],
    kpis: {
      faseAtual: params.faseInicial,
    },
  };
}

// ─── checkClientInactivity — regra de 90 dias ────────────────────────────────

/**
 * Verifica clientes que ultrapassaram 90 dias sem O.S. e os marca como inativos.
 * Deve ser chamada pelo Cloud Scheduler (função backend) ou manualmente pelo admin.
 */
export async function checkClientInactivity(calledByUserId: string): Promise<{ atualizados: number; ids: string[] }> {
  const DIAS_LIMITE = 90;
  const limite = new Date();
  limite.setDate(limite.getDate() - DIAS_LIMITE);
  const limiteTs = Timestamp.fromDate(limite);

  const clientsSnap = await getDocs(
    query(collection(db, 'clients'), where('status', 'in', ['ativo', 'reativado']))
  );

  const atualizados: string[] = [];

  for (const clientDoc of clientsSnap.docs) {
    const osSnap = await getDocs(
      query(
        collection(db, 'tasks'),
        where('clientId', '==', clientDoc.id),
        orderBy('createdAt', 'desc'),
        limit(1),
      )
    );

    const semOsRecente =
      osSnap.empty ||
      (osSnap.docs[0].data().createdAt as Timestamp)?.toMillis() < limiteTs.toMillis();

    if (semOsRecente) {
      await updateDoc(doc(db, 'clients', clientDoc.id), {
        status:            'inativo',
        inativoDesde:      serverTimestamp(),
        '_meta.updatedAt': serverTimestamp(),
        '_meta.updatedBy': calledByUserId,
        '_meta.kpis.faseAtual': 'inativo',
        '_meta.transitions': arrayUnion({
          de:     'ativo',
          para:   'inativo',
          at:     Timestamp.now(),
          by:     calledByUserId,
          byName: 'Sistema automático',
        }),
      });

      await logEvent({
        eventType:  'cliente_status_changed',
        area:       'clientes',
        userId:     calledByUserId,
        entityId:   clientDoc.id,
        entityType: 'client',
        payload: {
          de:         'ativo',
          para:       'inativo',
          motivo:     'inatividade_90_dias',
          clientName: clientDoc.data().name,
        },
      });

      atualizados.push(clientDoc.id);
    }
  }

  return { atualizados: atualizados.length, ids: atualizados };
}

// ─── Exportações para uso nos componentes ─────────────────────────────────────

export const Analytics = {
  logEvent,
  logTransition,
  initMeta,
  checkClientInactivity,
};

export default Analytics;
