/**
 * Limpa registros de time_entries de um usuário via Firebase Admin SDK.
 * Uso: node scripts/limpar-ponto-admin.mjs <email-ou-uid>
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const admin = require('../functions/node_modules/firebase-admin');
admin.initializeApp({ projectId: 'mgr-conect2' });
const db = admin.firestore();

const TARGET = (process.argv[2] || 'miguelrhuan20@mgr.com').toLowerCase();

async function findUser() {
  // Tenta por email exato
  let snap = await db.collection('users').where('email', '==', TARGET).get();
  if (!snap.empty) return snap.docs[0];

  // Tenta por uid direto
  try {
    const d = await db.collection('users').doc(TARGET).get();
    if (d.exists) return d;
  } catch {}

  // Lista primeiros 50 usuários para diagnóstico
  console.log('\n⚠️  Usuário não encontrado por email. Listando usuários cadastrados:\n');
  const all = await db.collection('users').limit(50).get();
  all.docs.forEach(d => {
    const data = d.data();
    console.log(`   ${String(data.email ?? '(sem email)').padEnd(35)} | ${data.displayName ?? '(sem nome)'} | ${d.id}`);
  });
  return null;
}

async function main() {
  console.log(`\n🔍 Buscando: "${TARGET}"`);

  const userDoc = await findUser();
  if (!userDoc) {
    console.error('\n❌ Usuário não encontrado. Copie o UID ou email exato da lista acima e rode novamente.\n');
    process.exit(1);
  }

  const uid  = userDoc.id;
  const data = userDoc.data();
  const nome = data.displayName ?? data.nomeCompleto ?? data.email ?? uid;
  console.log(`✅ Usuário: ${nome} | email: ${data.email} | UID: ${uid}`);

  // Busca todos os time_entries
  console.log('\n🔍 Buscando registros de ponto...');
  const snap = await db.collection('time_entries').where('userId', '==', uid).get();

  if (snap.empty) {
    console.log('ℹ️  Nenhum registro encontrado. Nada a apagar.');
    process.exit(0);
  }

  console.log(`\n📋 ${snap.size} registro(s) encontrado(s):`);
  snap.docs.forEach(d => {
    const r  = d.data();
    const ts = r.timestamp?.toDate?.()?.toLocaleString('pt-BR') ?? 'sem data';
    console.log(`   [${d.id.slice(0,8)}] ${ts}  ${String(r.type ?? '?').padEnd(12)}  ${r.source ?? 'web'}`);
  });

  // Apaga em batch
  console.log(`\n🗑️  Apagando ${snap.size} registro(s)...`);
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();

  console.log(`\n✅ ${snap.size} registro(s) removido(s) com sucesso!`);
  console.log('   Pode testar o fluxo do zero agora.\n');
}

main().catch(err => {
  console.error('\n❌ Erro:', err.message, '\n');
  process.exit(1);
});
