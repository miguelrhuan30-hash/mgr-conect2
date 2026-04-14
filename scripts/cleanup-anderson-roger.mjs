/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  SCRIPT DE LIMPEZA — anderson.roger (technician)                ║
 * ║  Projeto: mgr-conect2                                            ║
 * ║  Data de execução: 14/04/2026                                    ║
 * ║  Executor: Admin MGR                                             ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * OBJETIVO:
 *   Remover FISICAMENTE todos os registros de time_entries do colaborador
 *   anderson.roger com timestamp > 09/04/2026 00:00:00.
 *   Esses registros foram criados por bug no formulário de ajuste manual
 *   que permitia selecionar datas futuras (21/04 e 27/04/2026).
 *
 * COLEÇÃO AFETADA: time_entries (produção — sem prefixo dev_)
 *
 * PRÉ-REQUISITOS:
 *   1. Firebase CLI autenticado: firebase login
 *   2. Credenciais ADC ativas: gcloud auth application-default login
 *   OU definir GOOGLE_APPLICATION_CREDENTIALS apontando para service account JSON
 *
 * EXECUÇÃO:
 *   node scripts/cleanup-anderson-roger.mjs
 *   node scripts/cleanup-anderson-roger.mjs --dry-run   (só lista, não deleta)
 *   node scripts/cleanup-anderson-roger.mjs --force     (pula confirmação manual)
 */

import { initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createInterface } from 'readline';

// ─── Configuração ─────────────────────────────────────────────────────────────
const PROJECT_ID       = 'mgr-conect2';
const COLLECTION       = 'time_entries';
const TARGET_USER_UID  = 'ETvEVzYDjrhux1G1vM8Z59HG5aA3'; // anderson.roger (anderson.roger@hotmail.com)
const CUTOFF_DATE      = '2026-04-09';         // Deletar tudo APÓS este dia (exclusive)
const DRY_RUN          = process.argv.includes('--dry-run');
const FORCE            = process.argv.includes('--force');

// ─── Inicializar Firebase Admin ───────────────────────────────────────────────
let app;
try {
  app = getApp();
} catch {
  app = initializeApp({ projectId: PROJECT_ID });
}
const db = getFirestore(app);

// ─── Utilitários ──────────────────────────────────────────────────────────────
const formatTs = (ts) => {
  const d = ts.toDate();
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
};

const typeLabel = (type) => ({
  entry: '🟢 Entrada',
  lunch_start: '🍽️  Ida Almoço',
  lunch_end: '🍽️  Volta Almoço',
  exit: '🔴 Saída',
}[type] || `❓ ${type}`);

const ask = (question) => new Promise(resolve => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.question(question, answer => { rl.close(); resolve(answer.trim().toLowerCase()); });
});

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🗑️  LIMPEZA DE REGISTROS BUGADOS — MGR Conect2              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\n  Projeto   : ${PROJECT_ID}`);
  console.log(`  Coleção   : ${COLLECTION}`);
  console.log(`  Usuário   : ${TARGET_USER_UID}`);
  console.log(`  Corte     : timestamps APÓS ${CUTOFF_DATE} 00:00:00`);
  if (DRY_RUN) {
    console.log('\n  ⚠️  MODO DRY-RUN — Nenhum dado será alterado.\n');
  } else {
    console.log('\n  ❗ MODO REAL — Documentos serão deletados FISICAMENTE (irreversível).\n');
  }

  // ── 1. Buscar registros a deletar ──────────────────────────────────────────
  const cutoffTs = Timestamp.fromDate(new Date(CUTOFF_DATE + 'T23:59:59.999-03:00'));

  console.log('🔍 Buscando registros...\n');
  const snap = await db.collection(COLLECTION)
    .where('userId', '==', TARGET_USER_UID)
    .where('timestamp', '>', cutoffTs)
    .orderBy('timestamp', 'asc')
    .get();

  if (snap.empty) {
    console.log('✅ Nenhum registro encontrado após a data de corte. Nada a deletar.');
    process.exit(0);
  }

  // ── 2. Preview: listar todos os registros encontrados ─────────────────────
  console.log(`📋 ${snap.size} registro(s) encontrado(s) para deleção:\n`);
  console.log('  ┌─────────────┬────────────────────────┬──────────────────────┬───────────┐');
  console.log('  │ ID (últimos)│ Tipo                   │ Timestamp            │ Local     │');
  console.log('  ├─────────────┼────────────────────────┼──────────────────────┼───────────┤');

  snap.forEach(docSnap => {
    const d = docSnap.data();
    const id = docSnap.id.slice(-6);
    const tipo = typeLabel(d.type).padEnd(22);
    const ts = formatTs(d.timestamp);
    const loc = (d.locationId || '?').slice(0, 9).padEnd(9);
    console.log(`  │ ${id}      │ ${tipo} │ ${ts} │ ${loc} │`);
  });
  console.log('  └─────────────┴────────────────────────┴──────────────────────┴───────────┘\n');

  // ── 3. Validação extra: garantir que NENHUM é de data real (≤ 09/04) ──────
  const dataAnterior = snap.docs.filter(docSnap => {
    const ts = docSnap.data().timestamp.toDate();
    return ts <= new Date(CUTOFF_DATE + 'T23:59:59.999-03:00');
  });

  if (dataAnterior.length > 0) {
    console.error('❌ ABORTANDO: Detectados registros com data ≤ 09/04/2026 na lista.');
    console.error('   Isso indica um erro na query. Nenhum dado foi deletado.');
    process.exit(1);
  }

  // ── 4. Confirmação do usuário ──────────────────────────────────────────────
  if (DRY_RUN) {
    console.log('✅ DRY-RUN concluído. Para executar de verdade, rode sem --dry-run.');
    process.exit(0);
  }

  if (!FORCE) {
    console.log('⚠️  ATENÇÃO: Esta operação é IRREVERSÍVEL.');
    console.log(`   Serão deletados FISICAMENTE ${snap.size} documentos do Firestore.\n`);
    const resp = await ask('   Digite "CONFIRMAR" para prosseguir ou qualquer outra coisa para cancelar: ');
    if (resp !== 'confirmar') {
      console.log('\n❌ Operação cancelada pelo usuário. Nenhum dado foi alterado.');
      process.exit(0);
    }
    console.log('');
  }

  // ── 5. Deletar em batch (máx 500 por batch no Firestore) ──────────────────
  console.log('🗑️  Iniciando deleção...\n');

  const BATCH_SIZE = 450;
  const docs = snap.docs;
  let totalDeleted = 0;
  let totalErrors = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + BATCH_SIZE);

    chunk.forEach(docSnap => {
      batch.delete(docSnap.ref);
    });

    try {
      await batch.commit();
      totalDeleted += chunk.length;
      chunk.forEach(docSnap => {
        const d = docSnap.data();
        console.log(`  ✅ Deletado: ${docSnap.id} | ${typeLabel(d.type)} | ${formatTs(d.timestamp)}`);
      });
    } catch (err) {
      totalErrors += chunk.length;
      console.error(`  ❌ Erro no batch ${i}–${i + chunk.length - 1}:`, err.message);
    }
  }

  // ── 6. Log de auditoria no Firestore ─────────────────────────────────────
  try {
    await db.collection('system_logs').add({
      action: 'ponto_bulk_hard_delete',
      level: 'warning',
      message: `BULK HARD DELETE: ${totalDeleted} TimeEntries de ${TARGET_USER_UID} após ${CUTOFF_DATE} deletados por script de limpeza`,
      userId: 'system_cleanup_script',
      timestamp: Timestamp.now(),
      metadata: {
        targetUserId: TARGET_USER_UID,
        cutoffDate: CUTOFF_DATE,
        totalFound: snap.size,
        totalDeleted,
        totalErrors,
        executedAt: new Date().toISOString(),
        scriptVersion: '1.0.0',
        reason: 'Bug no formulário de ajuste manual permitia selecionar datas futuras',
      },
    });
    console.log('\n📋 Log de auditoria gravado em system_logs.');
  } catch (logErr) {
    console.warn('\n⚠️  Aviso: Falha ao gravar log de auditoria (não crítico):', logErr.message);
  }

  // ── 7. Resumo final ───────────────────────────────────────────────────────
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  if (totalErrors === 0) {
    console.log(`║  ✅ LIMPEZA CONCLUÍDA COM SUCESSO                            ║`);
  } else {
    console.log(`║  ⚠️  LIMPEZA CONCLUÍDA COM ERROS                             ║`);
  }
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Deletados : ${String(totalDeleted).padEnd(47)} ║`);
  console.log(`║  Erros     : ${String(totalErrors).padEnd(47)} ║`);
  console.log(`║  Coleção   : ${COLLECTION.padEnd(47)} ║`);
  console.log(`║  Usuário   : ${TARGET_USER_UID.padEnd(47)} ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');

  if (totalErrors === 0) {
    console.log('\n✅ O ponto do anderson.roger deve estar desbloqueado.');
    console.log('   Acesse o app e verifique se o colaborador consegue registrar entrada.\n');
  }

  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\n❌ ERRO FATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
