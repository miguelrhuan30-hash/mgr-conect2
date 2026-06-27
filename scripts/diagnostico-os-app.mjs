/**
 * Diagnóstico: verifica o que está salvo nos documentos de tasks
 * e qual é o UID real do miguelrhuan30.
 * node scripts/diagnostico-os-app.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin');
admin.initializeApp({ projectId: 'mgr-conect2' });
const db = admin.firestore();

async function run() {
  // 1. Achar o UID do miguelrhuan30
  console.log('\n=== USUÁRIO miguelrhuan30 ===');
  const userSnap = await db.collection('users')
    .where('email', '>=', 'miguelrhuan30')
    .where('email', '<=', 'miguelrhuan30')
    .get();

  // Tenta também por displayName
  const userSnap2 = await db.collection('users')
    .where('displayName', '>=', 'miguelrhuan30')
    .where('displayName', '<=', 'miguelrhuan30')
    .get();

  // Tenta username
  const userSnap3 = await db.collection('users')
    .where('username', '==', 'miguelrhuan30')
    .get();

  const found = new Map();
  [...userSnap.docs, ...userSnap2.docs, ...userSnap3.docs].forEach(d => {
    if (!found.has(d.id)) found.set(d.id, d.data());
  });

  if (found.size === 0) {
    console.log('  !! Nenhum usuário encontrado com miguelrhuan30');
    // Listar todos os usuários para ver
    const allUsers = await db.collection('users').limit(20).get();
    console.log('\n  Todos os usuários cadastrados:');
    allUsers.docs.forEach(d => {
      const data = d.data();
      console.log(`  [${d.id}] email=${data.email} | displayName=${data.displayName} | username=${data.username}`);
    });
  } else {
    found.forEach((data, uid) => {
      console.log(`  UID: ${uid}`);
      console.log(`  email: ${data.email}`);
      console.log(`  displayName: ${data.displayName}`);
      console.log(`  username: ${data.username}`);
      console.log(`  role: ${data.role}`);
    });
  }

  // 2. Ver todas as tasks e seus campos relevantes
  console.log('\n=== TODAS AS O.S. (tasks) ===');
  const tasks = await db.collection('tasks').get();
  console.log(`Total: ${tasks.size} documentos\n`);
  tasks.docs.forEach(d => {
    const data = d.data();
    console.log(`[${d.id}]`);
    console.log(`  titulo/title: ${data.titulo || data.title || '(sem título)'}`);
    console.log(`  status: ${data.status}`);
    console.log(`  assignedTo: ${data.assignedTo || '(vazio)'}`);
    console.log(`  assigneeId: ${data.assigneeId || '(vazio)'}`);
    console.log(`  responsavelId: ${data.responsavelId || '(vazio)'}`);
    console.log(`  assignedUsers: ${JSON.stringify(data.assignedUsers || [])}`);
    console.log(`  dataAgendada: ${data.dataAgendada ? data.dataAgendada.toDate().toISOString() : '(sem data)'}`);
    console.log('');
  });
}

run().catch(e => { console.error('Erro:', e); process.exit(1); });
