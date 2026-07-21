const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * adminResetUserPassword
 * Callable Cloud Function — Redefine a senha de um colaborador OU de um
 * usuário do Portal do Cliente (role 'cliente').
 * Requer: canResetUserPasswords no perfil do chamador (alvo colaborador),
 * OU canManageClients (alvo cliente), OU role === 'admin' (qualquer alvo).
 */
exports.adminResetUserPassword = onCall(
  { region: 'southamerica-east1', enforceAppCheck: false },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Você precisa estar autenticado.');
    }

    const callerId = request.auth.uid;
    const { targetUid, newPassword } = request.data;

    if (!targetUid || typeof targetUid !== 'string') {
      throw new HttpsError('invalid-argument', 'targetUid inválido.');
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      throw new HttpsError('invalid-argument', 'A senha temporária deve ter pelo menos 8 caracteres.');
    }

    // Busca o perfil do chamador e do alvo no Firestore para verificar permissão
    const callerDoc = await admin.firestore().doc(`users/${callerId}`).get();
    const callerData = callerDoc.data();
    const targetDoc = await admin.firestore().doc(`users/${targetUid}`).get();
    const isTargetCliente = targetDoc.data()?.role === 'cliente';

    const isAdmin = callerData?.role === 'admin';
    const hasPermission = isTargetCliente
      ? callerData?.permissions?.canManageClients === true
      : callerData?.permissions?.canResetUserPasswords === true;

    if (!isAdmin && !hasPermission) {
      throw new HttpsError('permission-denied', 'Sem permissão para redefinir senhas.');
    }

    // Redefine a senha no Firebase Auth
    await admin.auth().updateUser(targetUid, { password: newPassword });

    // Marca no Firestore que o usuário deve trocar a senha
    await admin.firestore().doc(`users/${targetUid}`).update({
      requiresPasswordChange: true,
      tempPasswordSetAt: admin.firestore.FieldValue.serverTimestamp(),
      tempPasswordSetBy: callerId,
    });

    return { success: true };
  }
);

/**
 * adminCreateUser
 * Callable Cloud Function — Cria um novo colaborador (Auth + perfil Firestore) direto pelo admin,
 * sem exigir autocadastro. Requer: canManageUsers no perfil do chamador, OU role === 'admin'.
 */
exports.adminCreateUser = onCall(
  { region: 'southamerica-east1', enforceAppCheck: false },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Você precisa estar autenticado.');
    }

    const callerId = request.auth.uid;
    const { email, password, nomeCompleto, cargo, sectorId, sectorName, permissions, role } = request.data;

    if (!email || typeof email !== 'string') {
      throw new HttpsError('invalid-argument', 'E-mail inválido.');
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      throw new HttpsError('invalid-argument', 'A senha temporária deve ter pelo menos 8 caracteres.');
    }
    if (!nomeCompleto || typeof nomeCompleto !== 'string') {
      throw new HttpsError('invalid-argument', 'Nome completo é obrigatório.');
    }

    const callerDoc = await admin.firestore().doc(`users/${callerId}`).get();
    const callerData = callerDoc.data();

    const isAdmin = callerData?.role === 'admin';
    const hasPermission = callerData?.permissions?.canManageUsers === true;

    if (!isAdmin && !hasPermission) {
      throw new HttpsError('permission-denied', 'Sem permissão para criar colaboradores.');
    }

    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: nomeCompleto,
      });
    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        throw new HttpsError('already-exists', 'Este e-mail já está cadastrado.');
      }
      throw new HttpsError('internal', err.message || 'Erro ao criar usuário.');
    }

    await admin.firestore().doc(`users/${userRecord.uid}`).set({
      uid: userRecord.uid,
      email,
      displayName: nomeCompleto,
      nomeCompleto,
      cargo: cargo || null,
      role: role || 'employee',
      sectorId: sectorId || null,
      sectorName: sectorName || null,
      permissions: permissions || {},
      hasCustomPermissions: !sectorId,
      ativo: true,
      xp: 0,
      level: 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      requiresPasswordChange: true,
      tempPasswordSetAt: admin.firestore.FieldValue.serverTimestamp(),
      tempPasswordSetBy: callerId,
    });

    return { success: true, uid: userRecord.uid };
  }
);

/**
 * adminCreateClientUser
 * Callable Cloud Function — Cria um usuário de acesso ao Portal do Cliente
 * (Auth + perfil Firestore com role 'cliente', vinculado a um clientId).
 * Requer: canManageClients no perfil do chamador, OU role === 'admin'.
 */
exports.adminCreateClientUser = onCall(
  { region: 'southamerica-east1', enforceAppCheck: false },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Você precisa estar autenticado.');
    }

    const callerId = request.auth.uid;
    const { email, password, nomeCompleto, clientId, clientName } = request.data;

    if (!email || typeof email !== 'string') {
      throw new HttpsError('invalid-argument', 'E-mail inválido.');
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      throw new HttpsError('invalid-argument', 'A senha temporária deve ter pelo menos 8 caracteres.');
    }
    if (!nomeCompleto || typeof nomeCompleto !== 'string') {
      throw new HttpsError('invalid-argument', 'Nome completo é obrigatório.');
    }
    if (!clientId || typeof clientId !== 'string') {
      throw new HttpsError('invalid-argument', 'clientId é obrigatório.');
    }

    const callerDoc = await admin.firestore().doc(`users/${callerId}`).get();
    const callerData = callerDoc.data();

    const isAdmin = callerData?.role === 'admin';
    const hasPermission = callerData?.permissions?.canManageClients === true;

    if (!isAdmin && !hasPermission) {
      throw new HttpsError('permission-denied', 'Sem permissão para criar acesso de cliente.');
    }

    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: nomeCompleto,
      });
    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        throw new HttpsError('already-exists', 'Este e-mail já está cadastrado.');
      }
      throw new HttpsError('internal', err.message || 'Erro ao criar usuário.');
    }

    await admin.firestore().doc(`users/${userRecord.uid}`).set({
      uid: userRecord.uid,
      email,
      displayName: nomeCompleto,
      nomeCompleto,
      role: 'cliente',
      clientId,
      clientName: clientName || null,
      ativo: true,
      xp: 0,
      level: 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      requiresPasswordChange: true,
      tempPasswordSetAt: admin.firestore.FieldValue.serverTimestamp(),
      tempPasswordSetBy: callerId,
    });

    return { success: true, uid: userRecord.uid };
  }
);

/**
 * adminSetUserActive
 * Callable Cloud Function — Ativa/desativa (desliga) um colaborador OU um
 * usuário do Portal do Cliente (role 'cliente').
 * Ao desativar: desabilita o login no Firebase Auth (perde acesso), mas mantém todo o
 * histórico no Firestore intacto (documentos, ocorrências, O.S., ponto, etc.).
 * Requer: canManageUsers no perfil do chamador (alvo colaborador), OU
 * canManageClients (alvo cliente), OU role === 'admin' (qualquer alvo).
 */
exports.adminSetUserActive = onCall(
  { region: 'southamerica-east1', enforceAppCheck: false },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Você precisa estar autenticado.');
    }

    const callerId = request.auth.uid;
    const { targetUid, ativo } = request.data;

    if (!targetUid || typeof targetUid !== 'string') {
      throw new HttpsError('invalid-argument', 'targetUid inválido.');
    }
    if (typeof ativo !== 'boolean') {
      throw new HttpsError('invalid-argument', 'Parâmetro ativo inválido.');
    }
    if (targetUid === callerId) {
      throw new HttpsError('failed-precondition', 'Você não pode desativar sua própria conta.');
    }

    const callerDoc = await admin.firestore().doc(`users/${callerId}`).get();
    const callerData = callerDoc.data();
    const targetDoc = await admin.firestore().doc(`users/${targetUid}`).get();
    const isTargetCliente = targetDoc.data()?.role === 'cliente';

    const isAdmin = callerData?.role === 'admin';
    const hasPermission = isTargetCliente
      ? callerData?.permissions?.canManageClients === true
      : callerData?.permissions?.canManageUsers === true;

    if (!isAdmin && !hasPermission) {
      throw new HttpsError('permission-denied', 'Sem permissão para ativar/desativar este usuário.');
    }

    try {
      await admin.auth().updateUser(targetUid, { disabled: !ativo });
    } catch (err) {
      // Perfis criados manualmente/legados podem não ter conta correspondente no Firebase Auth.
      // Nesse caso não há login a bloquear — seguimos e só atualizamos o status no Firestore.
      if (err.code !== 'auth/user-not-found') {
        throw new HttpsError('internal', err.message || 'Erro ao atualizar o acesso do colaborador.');
      }
    }

    const updateData = ativo
      ? {
          ativo: true,
          reativadoEm: admin.firestore.FieldValue.serverTimestamp(),
        }
      : {
          ativo: false,
          desligadoEm: admin.firestore.FieldValue.serverTimestamp(),
          desligadoPor: callerId,
          desligadoPorNome: callerData?.nomeCompleto || callerData?.displayName || null,
        };

    await admin.firestore().doc(`users/${targetUid}`).update(updateData);

    return { success: true };
  }
);

/**
 * adminUpdateClientAuthorizations
 * Callable Cloud Function — Atualiza as autorizações de um usuário do Portal
 * do Cliente (role 'cliente'): pode abrir chamado, pode ver contrato SLA,
 * pode ver ativos. Requer: canManageClients no perfil do chamador, OU
 * role === 'admin'.
 */
exports.adminUpdateClientAuthorizations = onCall(
  { region: 'southamerica-east1', enforceAppCheck: false },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Você precisa estar autenticado.');
    }

    const callerId = request.auth.uid;
    const { targetUid, podeAbrirChamado, podeVerContrato, podeVerAtivos } = request.data;

    if (!targetUid || typeof targetUid !== 'string') {
      throw new HttpsError('invalid-argument', 'targetUid inválido.');
    }

    const callerDoc = await admin.firestore().doc(`users/${callerId}`).get();
    const callerData = callerDoc.data();
    const targetDoc = await admin.firestore().doc(`users/${targetUid}`).get();

    if (targetDoc.data()?.role !== 'cliente') {
      throw new HttpsError('failed-precondition', 'Esta função só atualiza autorizações de usuários do Portal do Cliente.');
    }

    const isAdmin = callerData?.role === 'admin';
    const hasPermission = callerData?.permissions?.canManageClients === true;

    if (!isAdmin && !hasPermission) {
      throw new HttpsError('permission-denied', 'Sem permissão para gerenciar autorizações de usuários de cliente.');
    }

    const updateData = {};
    if (typeof podeAbrirChamado === 'boolean') updateData.podeAbrirChamado = podeAbrirChamado;
    if (typeof podeVerContrato === 'boolean') updateData.podeVerContrato = podeVerContrato;
    if (typeof podeVerAtivos === 'boolean') updateData.podeVerAtivos = podeVerAtivos;

    if (Object.keys(updateData).length === 0) {
      throw new HttpsError('invalid-argument', 'Nenhuma autorização informada.');
    }

    await admin.firestore().doc(`users/${targetUid}`).update(updateData);

    return { success: true };
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// FUNDAÇÃO F-A — Push FCM ao criar notificação
// Observa a coleção `notifications`; ao surgir um doc, busca os tokens do
// destinatário em `push_tokens` e envia o push. Tokens inválidos são removidos.
// ═══════════════════════════════════════════════════════════════════════════
exports.enviarPushNotificacao = onDocumentCreated(
  { region: 'southamerica-east1', document: 'notifications/{notifId}' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const notif = snap.data() || {};
    const destinatarioId = notif.destinatarioId;
    if (!destinatarioId) return;

    // Busca tokens do destinatário
    const tokensSnap = await admin.firestore()
      .collection('push_tokens')
      .where('userId', '==', destinatarioId)
      .get();

    if (tokensSnap.empty) return;
    const tokens = tokensSnap.docs.map(d => d.id);

    const message = {
      tokens,
      notification: {
        title: notif.titulo || 'MGR Connect',
        body: notif.corpo || '',
      },
      data: {
        tipo: String(notif.tipo || 'geral'),
        canal: String(notif.canal || 'geral'),
        rota: String(notif.rota || ''),
        osId: String(notif.osId || ''),
        notifId: event.params.notifId,
      },
      android: {
        priority: notif.prioridade === 'alta' ? 'high' : 'normal',
        notification: {
          sound: notif.som === false ? undefined : 'default',
          channelId: `mgr_${notif.canal || 'geral'}`,
        },
      },
    };

    try {
      const resp = await admin.messaging().sendEachForMulticast(message);
      // Limpa tokens inválidos
      const paraRemover = [];
      resp.responses.forEach((r, i) => {
        if (!r.success) {
          const code = r.error && r.error.code;
          if (code === 'messaging/invalid-registration-token'
            || code === 'messaging/registration-token-not-registered') {
            paraRemover.push(tokens[i]);
          }
        }
      });
      await Promise.all(paraRemover.map(t =>
        admin.firestore().doc(`push_tokens/${t}`).delete().catch(() => {})
      ));
    } catch (e) {
      console.error('[enviarPushNotificacao] erro ao enviar FCM:', e);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// PORTAL DO CLIENTE — notifica gestores quando um chamado de contrato SLA é
// aberto. Roda com Admin SDK porque o cliente (role 'cliente') não tem
// permissão de leitura ampla sobre `users` para montar a lista de destinatários.
// ═══════════════════════════════════════════════════════════════════════════
exports.notificarGestoresNovoChamadoSla = onDocumentCreated(
  { region: 'southamerica-east1', document: 'chamados_sla/{chamadoId}' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const chamado = snap.data() || {};

    const usersSnap = await admin.firestore().collection('users').get();
    const destinatarios = usersSnap.docs
      .filter(d => {
        const u = d.data() || {};
        return ['admin', 'gestor', 'manager', 'developer'].includes(u.role || '')
          || u.permissions?.canManageChamados === true
          || u.permissions?.canManageProjects === true;
      })
      .map(d => d.id);

    if (destinatarios.length === 0) return;

    const prioridade = chamado.prioridade || 'P3';
    const TIPO_LABEL = {
      falha_parada: 'Falha / Parada de equipamento',
      manutencao_preventiva: 'Manutenção preventiva',
      duvida_tecnica: 'Dúvida técnica',
      solicitacao_visita: 'Solicitação de visita',
      outro: 'Outro',
    };
    const tipoLabel = TIPO_LABEL[chamado.tipo] || null;
    const batch = admin.firestore().batch();
    destinatarios.forEach(uid => {
      const ref = admin.firestore().collection('notifications').doc();
      batch.set(ref, {
        destinatarioId: uid,
        tipo: 'chamado_sla_novo',
        canal: 'os',
        titulo: `📞 Novo chamado — ${prioridade}`,
        corpo: `${chamado.clientName || 'Cliente'}${tipoLabel ? ` (${tipoLabel})` : ''} abriu um chamado: ${chamado.titulo || ''}`,
        lida: false,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        som: true,
        prioridade: (prioridade === 'P1' || prioridade === 'P2') ? 'alta' : 'normal',
        rota: '/app/chamados-sla',
      });
    });
    await batch.commit();
  }
);

/**
 * sincronizarDataAtendimentoChamado
 * Quando uma O.S. nascida de um chamado (Task.chamadoId) tem sua data de
 * atendimento prevista (scheduling.dataPrevista) definida ou alterada pelo
 * gestor, espelha essa data no chamado de origem — o Portal do Cliente lê
 * `dataAtendimentoPrevista` de lá, sem precisar de passo manual extra.
 */
exports.sincronizarDataAtendimentoChamado = onDocumentUpdated(
  { region: 'southamerica-east1', document: 'tasks/{taskId}' },
  async (event) => {
    const before = event.data?.before?.data() || {};
    const after = event.data?.after?.data() || {};
    if (!after.chamadoId) return;

    const antes = before.scheduling?.dataPrevista?.toMillis?.() ?? null;
    const depois = after.scheduling?.dataPrevista?.toMillis?.() ?? null;
    if (antes === depois) return;

    await admin.firestore().doc(`chamados_sla/${after.chamadoId}`).update({
      dataAtendimentoPrevista: after.scheduling?.dataPrevista ?? admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// SUPORTE — resumo de conversa por O.S. (mantém os_suporte_threads)
// Observa `os_suporte_msgs`; a cada mensagem nova, faz upsert do doc-resumo
// correspondente (última mensagem + contagem de não lidas), pra a aba
// Suporte do gestor não precisar reagregar tudo client-side toda vez que abre.
// ═══════════════════════════════════════════════════════════════════════════
exports.atualizarThreadSuporte = onDocumentCreated(
  { region: 'southamerica-east1', document: 'os_suporte_msgs/{msgId}' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const msg = snap.data() || {};
    const osId = msg.osId;
    if (!osId) return;

    const msgsBase = admin.firestore().collection('os_suporte_msgs').where('osId', '==', osId);
    const [naoLidasGestorSnap, naoLidasTecnicoSnap] = await Promise.all([
      msgsBase.where('leitoPorGestor', '==', false).count().get(),
      msgsBase.where('leitoPorTecnico', '==', false).count().get(),
    ]);

    await admin.firestore().doc(`os_suporte_threads/${osId}`).set({
      osCode: msg.osCode || '',
      osTitulo: msg.osTitulo || '',
      clienteNome: msg.clienteNome || '',
      projectId: msg.projectId || '',
      ultimaMsgTexto: msg.texto || '',
      ultimaMsgAutorNome: msg.autorNome || '',
      ultimaMsgEm: msg.criadaEm || admin.firestore.Timestamp.now(),
      naoLidasGestor: naoLidasGestorSnap.data().count,
      naoLidasTecnico: naoLidasTecnicoSnap.data().count,
      archived: false,
    }, { merge: true });
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// SUPORTE — arquivamento automático ao concluir a O.S.
// Observa `tasks`; na transição para status 'completed', marca em lote todas
// as mensagens de suporte daquela O.S. como arquivadas (não apaga — vira
// histórico consultável pelo gestor e dataset futuro de IA/treino).
// ═══════════════════════════════════════════════════════════════════════════
exports.arquivarSuporteAoConcluirOS = onDocumentUpdated(
  { region: 'southamerica-east1', document: 'tasks/{taskId}' },
  async (event) => {
    const before = event.data.before.data() || {};
    const after  = event.data.after.data() || {};
    if (before.status === 'completed' || after.status !== 'completed') return;

    const osId = event.params.taskId;
    const msgsSnap = await admin.firestore()
      .collection('os_suporte_msgs')
      .where('osId', '==', osId)
      .get();

    if (!msgsSnap.empty) {
      const docs = msgsSnap.docs;
      const agora = admin.firestore.Timestamp.now();
      for (let i = 0; i < docs.length; i += 450) {
        const batch = admin.firestore().batch();
        docs.slice(i, i + 450).forEach(d => batch.update(d.ref, { archived: true, archivedEm: agora }));
        await batch.commit();
      }
    }

    await admin.firestore().doc(`os_suporte_threads/${osId}`).set({
      archived: true,
      archivedEm: admin.firestore.Timestamp.now(),
    }, { merge: true });
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// ALMOÇO — Lembrete 10 min antes do horário limite, só p/ quem não pediu
// Roda a cada 5 min; usa um marcador diário em lunch_config/sede para não
// disparar mais de uma vez no mesmo dia.
// ═══════════════════════════════════════════════════════════════════════════
exports.lembreteFechamentoAlmoco = onSchedule(
  { region: 'southamerica-east1', schedule: 'every 5 minutes', timeZone: 'America/Sao_Paulo' },
  async () => {
    const configRef = db().doc('lunch_config/sede');
    const configSnap = await configRef.get();
    if (!configSnap.exists) return;
    const config = configSnap.data() || {};
    const horarioLimite = config.horarioLimite || '10:00';

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const [hh, mm] = horarioLimite.split(':').map(Number);
    const limiteMinutes = hh * 60 + mm;
    const targetMinutes = limiteMinutes - 10; // 10 min antes do fechamento

    // Só age dentro da janela do tick de 5 min que cobre o alvo
    if (nowMinutes < targetMinutes || nowMinutes >= targetMinutes + 5) return;

    const todayISO = now.toISOString().split('T')[0];
    if (config.ultimoLembreteData === todayISO) return; // já disparou hoje

    // Cardápio ativo do dia
    const menuSnap = await db().collection('lunch_menus').where('status', '==', 'ativo').limit(1).get();
    if (menuSnap.empty) { await configRef.set({ ultimoLembreteData: todayISO }, { merge: true }); return; }
    const menuId = menuSnap.docs[0].id;

    // Quem já pediu
    const choicesSnap = await db().collection('lunch_choices').where('menuId', '==', menuId).get();
    const jaPediram = new Set(choicesSnap.docs.map(d => d.data().userId));

    // Todos os colaboradores
    const usersSnap = await db().collection('users').get();
    const semPedido = usersSnap.docs.filter(d => !jaPediram.has(d.id));

    const batchWrites = semPedido.map(d => db().collection('notifications').add({
      destinatarioId: d.id,
      tipo: 'almoco_lembrete_fechamento',
      canal: 'almoco',
      titulo: '⏰ Faltam 10 minutos para o pedido de almoço fechar!',
      corpo: `Você ainda não fez seu pedido de hoje. Prazo: ${horarioLimite}.`,
      lida: false,
      criadoEm: FieldValue.serverTimestamp(),
      som: true,
      prioridade: 'alta',
      rota: '/campo/almoco',
    }));
    await Promise.all(batchWrites);

    await configRef.set({ ultimoLembreteData: todayISO }, { merge: true });
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// MGR ACADEMY — Engine de Prova (correção automática server-side)
// O gabarito NUNCA vai para o cliente. O timer é validado por expiresAt.
// O colaborador vê apenas o % de acertos — nunca quais errou nem o gabarito.
// ═══════════════════════════════════════════════════════════════════════════
const REGION = 'southamerica-east1';
const db = () => admin.firestore();
const FieldValue = admin.firestore.FieldValue;

function badgeFromPercent(percent, passingScore) {
  if (percent < passingScore) return null;
  if (percent >= 90) return 'gold';
  if (percent >= 70) return 'silver';
  if (percent >= 50) return 'bronze';
  return null;
}

// Embaralhamento determinístico simples (Fisher-Yates) — sem Math.random fora de runtime
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function isAcademyAdmin(uid) {
  const snap = await db().doc(`users/${uid}`).get();
  const d = snap.data() || {};
  return d.role === 'admin' || d.role === 'developer'
    || d.role === 'gestor' || d.role === 'manager'
    || d.permissions?.canManageAcademy === true;
}

/**
 * startExam — sorteia as questões, cria a tentativa e devolve as perguntas
 * SEM o gabarito. Define expiresAt (timer à prova de reload).
 */
exports.startExam = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  const uid = request.auth.uid;
  const { moduleId } = request.data || {};
  if (!moduleId) throw new HttpsError('invalid-argument', 'moduleId obrigatório.');

  const modSnap = await db().doc(`academy_modules/${moduleId}`).get();
  if (!modSnap.exists) throw new HttpsError('not-found', 'Módulo não encontrado.');
  const mod = modSnap.data();
  if (!mod.exam?.enabled) throw new HttpsError('failed-precondition', 'Este módulo não tem prova.');

  const progRef = db().doc(`academy_progress/${uid}_${moduleId}`);
  const progSnap = await progRef.get();
  const prog = progSnap.data() || {};
  if (!prog.examUnlocked) throw new HttpsError('failed-precondition', 'Conclua o conteúdo antes da prova.');
  if (prog.examBlocked) throw new HttpsError('failed-precondition', 'Prova bloqueada. Aguarde liberação do administrador.');
  if (prog.badge) throw new HttpsError('failed-precondition', 'Módulo já concluído.');

  // Banco de questões
  const qSnap = await db().collection('academy_questions').where('moduleId', '==', moduleId).get();
  const all = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (all.length === 0) throw new HttpsError('failed-precondition', 'Sem questões cadastradas.');

  const perExam = Math.min(mod.exam.questionsPerExam || all.length, all.length);
  const picked = shuffle(all).slice(0, perExam);

  // Para cada questão, define a ordem servida das alternativas (permutação dos índices ORIGINAIS).
  // Guardamos só a permutação — não revela qual é a correta.
  const servedOptions = {};
  const questionsForClient = picked.map(q => {
    const idxOrder = mod.exam.shuffleOptions ? shuffle(q.options.map((_, i) => i)) : q.options.map((_, i) => i);
    servedOptions[q.id] = idxOrder;
    return { id: q.id, text: q.text, options: idxOrder.map(i => q.options[i]) };
  });

  const now = Date.now();
  const durationMs = (mod.exam.durationMinutes || 30) * 60 * 1000;
  const startedAt = admin.firestore.Timestamp.fromMillis(now);
  const expiresAt = admin.firestore.Timestamp.fromMillis(now + durationMs);

  const attemptRef = await db().collection('academy_exam_attempts').add({
    userId: uid,
    moduleId,
    startedAt,
    expiresAt,
    questionIds: picked.map(q => q.id),
    servedOptions,
    answers: {},
    status: 'in_progress',
  });

  return {
    attemptId: attemptRef.id,
    expiresAt: expiresAt.toMillis(),
    durationMinutes: mod.exam.durationMinutes || 30,
    questions: questionsForClient,
  };
});

/** Corrige a tentativa usando o gabarito (Admin SDK) e grava o resultado. */
async function gradeAttempt(attemptId, uid, { abandoned } = {}) {
  const attemptRef = db().doc(`academy_exam_attempts/${attemptId}`);
  const aSnap = await attemptRef.get();
  if (!aSnap.exists) throw new HttpsError('not-found', 'Tentativa não encontrada.');
  const attempt = aSnap.data();
  if (attempt.userId !== uid) throw new HttpsError('permission-denied', 'Tentativa de outro usuário.');
  if (attempt.status !== 'in_progress') {
    return { alreadyGraded: true, scorePercent: attempt.scorePercent || 0, badge: attempt.badge || null };
  }

  const modSnap = await db().doc(`academy_modules/${attempt.moduleId}`).get();
  const mod = modSnap.data() || {};
  const passingScore = mod.passingScore ?? 50;

  const expired = Date.now() > attempt.expiresAt.toMillis() + 3000; // 3s de tolerância
  const answers = attempt.answers || {};

  // Carrega o gabarito das questões servidas
  let totalWeight = 0, gotWeight = 0, correctCount = 0;
  for (const qId of attempt.questionIds) {
    const qSnap = await db().doc(`academy_questions/${qId}`).get();
    if (!qSnap.exists) continue;
    const q = qSnap.data();
    const weight = q.weight || 1;
    totalWeight += weight;
    const perm = attempt.servedOptions?.[qId] || q.options.map((_, i) => i);
    const displayedIdx = answers[qId];
    if (displayedIdx === undefined || displayedIdx === null) continue;
    const originalIdx = perm[displayedIdx];
    if (originalIdx === q.correctIndex) { gotWeight += weight; correctCount++; }
  }

  const scorePercent = totalWeight > 0 ? Math.round((gotWeight / totalWeight) * 100) : 0;
  const badge = badgeFromPercent(scorePercent, passingScore);
  const status = abandoned ? 'abandoned' : (expired ? 'expired' : 'submitted');

  await attemptRef.update({
    finishedAt: FieldValue.serverTimestamp(),
    score: correctCount,
    scorePercent,
    badge,
    status,
  });

  // Atualiza o progresso
  const progRef = db().doc(`academy_progress/${uid}_${attempt.moduleId}`);
  const progSnap = await progRef.get();
  const prog = progSnap.data() || {};
  const firstBadge = !prog.badge && !!badge;

  const progUpdate = {
    attemptsCount: FieldValue.increment(1),
    atualizadoEm: FieldValue.serverTimestamp(),
  };
  if (badge) {
    progUpdate.badge = badge;
    progUpdate.score = correctCount;
    progUpdate.scorePercent = scorePercent;
    progUpdate.completedAt = FieldValue.serverTimestamp();
    progUpdate.examBlocked = false;
  } else {
    // Reprovou ou abandonou: bloqueia até liberação do admin
    progUpdate.examBlocked = true;
  }
  await progRef.set(progUpdate, { merge: true });

  // Concede XP na primeira aprovação
  if (firstBadge && mod.xpReward) {
    await db().doc(`users/${uid}`).set({
      xp: FieldValue.increment(mod.xpReward),
      xpTotal: FieldValue.increment(mod.xpReward),
    }, { merge: true });
  }

  return { scorePercent, correctCount, total: attempt.questionIds.length, badge, passed: !!badge, status };
}

/** submitExam — colaborador finaliza a prova. Retorna só o placar. */
exports.submitExam = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  const { attemptId } = request.data || {};
  if (!attemptId) throw new HttpsError('invalid-argument', 'attemptId obrigatório.');
  return await gradeAttempt(attemptId, request.auth.uid, { abandoned: false });
});

/** flagAbandon — saída da tela encerra a prova "como está" e bloqueia retry. */
exports.flagAbandon = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  const { attemptId } = request.data || {};
  if (!attemptId) throw new HttpsError('invalid-argument', 'attemptId obrigatório.');
  return await gradeAttempt(attemptId, request.auth.uid, { abandoned: true });
});

/** adminUnlockExam — administrador libera nova tentativa para o colaborador. */
exports.adminUnlockExam = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  if (!(await isAcademyAdmin(request.auth.uid))) {
    throw new HttpsError('permission-denied', 'Sem permissão para liberar provas.');
  }
  const { userId, moduleId } = request.data || {};
  if (!userId || !moduleId) throw new HttpsError('invalid-argument', 'userId e moduleId obrigatórios.');
  await db().doc(`academy_progress/${userId}_${moduleId}`).set({
    examBlocked: false,
    atualizadoEm: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { success: true };
});
