const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * adminResetUserPassword
 * Callable Cloud Function — Redefine a senha de um colaborador.
 * Requer: canResetUserPasswords no perfil do chamador, OU role === 'admin'.
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

    // Busca o perfil do chamador no Firestore para verificar permissão
    const callerDoc = await admin.firestore().doc(`users/${callerId}`).get();
    const callerData = callerDoc.data();

    const isAdmin = callerData?.role === 'admin';
    const hasPermission = callerData?.permissions?.canResetUserPasswords === true;

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
