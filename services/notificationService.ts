/**
 * notificationService — Fundação F-A (Central de Notificações)
 *
 * Três camadas:
 *  1. Firestore `notifications`  → centro de avisos in-app (onSnapshot) e fallback web.
 *  2. LocalNotifications         → alerta em tela + SOM no dispositivo (app aberto/2º plano).
 *  3. Push FCM                   → entrega com o app FECHADO, disparada por Cloud Function
 *                                  que observa a coleção `notifications`.
 *
 * As features (almoço, dúvida, observação, veículo…) só precisam chamar
 * `criarNotificacao()` / `notificarVarios()`. O resto (som + push) é automático.
 */
import {
  addDoc, collection, doc, setDoc, updateDoc, query, where,
  orderBy, limit, onSnapshot, getDocs, writeBatch, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import {
  CollectionName, Notificacao, NotificacaoTipo, NotificacaoCanal,
} from '../types';

const isNative = Capacitor.isNativePlatform();

/* ─── Criação de notificações ─────────────────────────────────────────────── */

export interface NotificarParams {
  destinatarioId: string;
  tipo: NotificacaoTipo;
  canal: NotificacaoCanal;
  titulo: string;
  corpo: string;
  som?: boolean;
  prioridade?: 'normal' | 'alta';
  rota?: string;
  osId?: string;
  projetoId?: string;
  autorId?: string;
  autorNome?: string;
  data?: Record<string, any>;
}

/**
 * Cria uma notificação para UM destinatário. Fire-and-forget.
 * A Cloud Function `enviarPushNotificacao` cuida do push FCM ao detectar o doc.
 */
export function criarNotificacao(params: NotificarParams): void {
  const payload: Record<string, any> = {
    destinatarioId: params.destinatarioId,
    tipo: params.tipo,
    canal: params.canal,
    titulo: params.titulo,
    corpo: params.corpo,
    lida: false,
    criadoEm: Timestamp.now(),
    som: params.som ?? true,
    prioridade: params.prioridade ?? 'normal',
  };
  if (params.rota)       payload.rota = params.rota;
  if (params.osId)       payload.osId = params.osId;
  if (params.projetoId)  payload.projetoId = params.projetoId;
  if (params.autorId)    payload.autorId = params.autorId;
  if (params.autorNome)  payload.autorNome = params.autorNome;
  if (params.data)       payload.data = params.data;

  addDoc(collection(db, CollectionName.NOTIFICATIONS), payload).catch(e => {
    console.warn('[notificationService] falha ao criar notificação:', e);
  });
}

/** Fan-out: cria a mesma notificação para vários destinatários. */
export function notificarVarios(
  destinatarioIds: string[],
  params: Omit<NotificarParams, 'destinatarioId'>,
): void {
  const unicos = Array.from(new Set(destinatarioIds.filter(Boolean)));
  for (const uid of unicos) {
    criarNotificacao({ ...params, destinatarioId: uid });
  }
}

/* ─── Leitura / marcação ──────────────────────────────────────────────────── */

/** Escuta as notificações não lidas do usuário em tempo real. Retorna unsubscribe. */
export function ouvirNotificacoes(
  uid: string,
  cb: (notifs: Notificacao[]) => void,
  limite = 50,
): () => void {
  const q = query(
    collection(db, CollectionName.NOTIFICATIONS),
    where('destinatarioId', '==', uid),
    orderBy('criadoEm', 'desc'),
    limit(limite),
  );
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notificacao)));
  }, err => console.warn('[notificationService] listener:', err));
}

export async function marcarLida(id: string): Promise<void> {
  await updateDoc(doc(db, CollectionName.NOTIFICATIONS, id), { lida: true }).catch(() => {});
}

export async function marcarTodasLidas(uid: string): Promise<void> {
  const snap = await getDocs(query(
    collection(db, CollectionName.NOTIFICATIONS),
    where('destinatarioId', '==', uid),
    where('lida', '==', false),
  )).catch(() => null);
  if (!snap || snap.empty) return;
  // batches de 450
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 450) {
    const b = writeBatch(db);
    docs.slice(i, i + 450).forEach(d => b.update(d.ref, { lida: true }));
    await b.commit().catch(() => {});
  }
}

/* ─── Alerta local (som + bandeja) ────────────────────────────────────────── */

let localNotifId = 1;

/** Beep curto via Web Audio API — não depende de nenhum arquivo de áudio. */
function tocarBeepWeb(): void {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // ambiente sem suporte a áudio — silencioso
  }
}

/**
 * Dispara uma notificação LOCAL no dispositivo (som + bandeja do sistema).
 * Usada pelo listener in-app para dar feedback sonoro quando chega notificação
 * com o app aberto/minimizado.
 *
 * Nativo (Capacitor): usa LocalNotifications — o launcher Android já soma
 * essas notificações como badge no ícone do app automaticamente (Android 8+),
 * sem precisar de plugin de badge dedicado.
 *
 * Web (gestor no navegador desktop, ou PWA instalado): usa a Notification API
 * do browser + beep via Web Audio, já que LocalNotifications é no-op fora de
 * app nativo. Silencioso se o usuário nunca concedeu permissão de notificação.
 */
export async function dispararAlertaLocal(titulo: string, corpo: string, comSom = true): Promise<void> {
  if (!isNative) {
    if (comSom) tocarBeepWeb();
    if (typeof Notification === 'undefined') return;
    try {
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission === 'granted') {
        new Notification(titulo, { body: corpo, icon: '/mgr-logo.png' });
      }
    } catch (e) {
      console.warn('[notificationService] notificação web falhou:', e);
    }
    return;
  }
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== 'granted') return;
    }
    await LocalNotifications.schedule({
      notifications: [{
        id: localNotifId++,
        title: titulo,
        body: corpo,
        sound: comSom ? 'default' : undefined,
        smallIcon: 'ic_stat_icon_config_sample',
      }],
    });
  } catch (e) {
    console.warn('[notificationService] alerta local falhou:', e);
  }
}

/* ─── Badge no ícone do app (PWA instalado, sem dependência nova) ─────────── */

/**
 * Atualiza o badge numérico do ícone do app quando instalado como PWA
 * (Web Badging API — suportada em Chrome/Edge desktop e Android quando
 * `display: standalone`, já configurado no manifest). No-op silencioso onde
 * não suportado (ex. iOS Safari, navegador não instalado).
 */
export function atualizarBadgeApp(contagem: number): void {
  try {
    const nav = navigator as any;
    if (contagem > 0 && typeof nav.setAppBadge === 'function') {
      nav.setAppBadge(contagem).catch(() => {});
    } else if (contagem === 0 && typeof nav.clearAppBadge === 'function') {
      nav.clearAppBadge().catch(() => {});
    }
  } catch {
    // Badging API indisponível — silencioso
  }
}

/* ─── Aviso de nova versão do sistema (banner + sino, todo tipo de usuário) ── */

export interface VersaoSistemaInfo {
  build: number;
  version: string;
  url: string;
  notas: string;
  lancadoEm: string;
}

/**
 * Verifica se há uma versão do sistema mais nova que a última já notificada
 * NESTE dispositivo/navegador (localStorage, por uid). Se houver, cria uma
 * notificação `sistema_atualizado` pro próprio usuário (aparece no sino) e
 * retorna os dados pra exibir o banner nesta sessão.
 *
 * Funciona igual para técnico nativo, gestor web e cliente do Portal — não
 * depende de App.getInfo() (plugin nativo, historicamente instável aqui),
 * só do arquivo estático `apk-version.json` já publicado a cada release.
 * Chamar uma vez ao montar o layout autenticado (Field/gestor web/Portal).
 */
export async function verificarNovaVersaoSistema(uid: string, rota?: string): Promise<VersaoSistemaInfo | null> {
  if (!uid) return null;
  const chave = `mgr_versao_sistema_notificada_${uid}`;
  try {
    const res = await fetch('/apk-version.json?t=' + Date.now());
    if (!res.ok) return null;
    const remote = await res.json() as VersaoSistemaInfo;
    const ultimoNotificado = parseInt(localStorage.getItem(chave) || '0', 10);
    if (!remote?.build || remote.build <= ultimoNotificado) return null;

    localStorage.setItem(chave, String(remote.build));
    criarNotificacao({
      destinatarioId: uid,
      tipo: 'sistema_atualizado',
      canal: 'geral',
      titulo: `Sistema atualizado — v${remote.version}`,
      corpo: remote.notas || 'Uma nova versão do sistema MGRConnect está disponível.',
      som: false,
      ...(rota ? { rota } : {}),
    });
    return remote;
  } catch {
    return null;
  }
}

/** Acesso ao plugin nativo custom (LocationPlugin) que expõe utilitários
 *  Android que a WebView do Capacitor não intercepta via URL scheme
 *  (`intent:` só é interceptado automaticamente no navegador Chrome). */
async function getNativeUtilPlugin(): Promise<any> {
  if (!isNative) return null;
  try {
    const { Plugins } = await import('@capacitor/core');
    return (Plugins as any).LocationPlugin ?? null;
  } catch {
    return null;
  }
}

/**
 * Abre a URL do APK pelo instalador nativo do Android, fora da WebView.
 *
 * `window.open(url, '_system')` não é confiável quando a URL do APK está no
 * MESMO domínio configurado em `server.url` do Capacitor (aqui,
 * mgr-connect-app.web.app): a WebView pode tratar como navegação interna e
 * tentar renderizar o binário .apk inline, travando a tela em branco.
 * Usa o plugin nativo (LocationPlugin.instalarApk), que chama
 * Intent.ACTION_VIEW diretamente em Java — garantido de funcionar, ao
 * contrário do esquema `intent:` via window.location (não interceptado
 * pela WebView genérica do Capacitor).
 */
export async function abrirInstaladorApk(url: string): Promise<void> {
  if (Capacitor.getPlatform() === 'android') {
    const plugin = await getNativeUtilPlugin();
    if (plugin?.instalarApk) {
      await plugin.instalarApk({ url }).catch(() => window.open(url, '_system'));
      return;
    }
  }
  window.open(url, '_system');
}

/** Abre a tela "Info do app" nativa (Configurações → Apps → MGR Campo). */
export async function abrirConfiguracoesApp(): Promise<void> {
  const plugin = await getNativeUtilPlugin();
  if (plugin?.abrirConfiguracoesApp) {
    await plugin.abrirConfiguracoesApp().catch(() => {});
  }
}

/* ─── Registro de token de push (FCM) ─────────────────────────────────────── */

/**
 * Registra o dispositivo para receber push FCM e salva o token em `push_tokens`.
 * No Android (Capacitor) usa o plugin nativo — não precisa de VAPID.
 * Na web é no-op por enquanto (entrega via listener in-app da coleção notifications).
 * Chamar após o login, com o uid do usuário.
 */
export async function registrarPushToken(uid: string): Promise<void> {
  if (!isNative || !uid) return;
  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return;

    // registra listeners uma vez
    PushNotifications.removeAllListeners();

    PushNotifications.addListener('registration', async token => {
      const t = token.value;
      if (!t) return;
      await setDoc(doc(db, CollectionName.PUSH_TOKENS, t), {
        token: t,
        userId: uid,
        plataforma: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android',
        atualizadoEm: Timestamp.now(),
      }, { merge: true }).catch(() => {});
    });

    PushNotifications.addListener('registrationError', err => {
      console.warn('[notificationService] erro de registro push:', err);
    });

    await PushNotifications.register();
  } catch (e) {
    console.warn('[notificationService] registrarPushToken falhou:', e);
  }
}
