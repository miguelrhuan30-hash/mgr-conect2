/**
 * Script auxiliar: busca o UID do Firebase Auth pelo displayName ou email
 * para identificar o userId correto do anderson.roger no Firestore.
 *
 * Execução: node scripts/find-user-uid.mjs
 */

import { initializeApp, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'mgr-conect2';

let app;
try { app = getApp(); } catch { app = initializeApp({ projectId: PROJECT_ID }); }
const db = getFirestore(app);

async function main() {
  console.log('\n🔍 Buscando colaboradores na coleção "users"...\n');

  const snap = await db.collection('users')
    .where('role', '==', 'technician')
    .get();

  if (snap.empty) {
    console.log('Nenhum técnico encontrado. Buscando todos os usuários...');
    const all = await db.collection('users').get();
    all.forEach(d => {
      const u = d.data();
      console.log(`  UID: ${d.id} | Nome: ${u.displayName || '?'} | Email: ${u.email || '?'} | Role: ${u.role || '?'}`);
    });
    return;
  }

  console.log('Técnicos encontrados:\n');
  snap.forEach(d => {
    const u = d.data();
    console.log(`  UID  : ${d.id}`);
    console.log(`  Nome : ${u.displayName || '?'}`);
    console.log(`  Email: ${u.email || '?'}`);
    console.log(`  Role : ${u.role || '?'}`);
    console.log('  ─────────────────────────────────────────');
  });

  // Procurar especificamente por "anderson"
  console.log('\n🔍 Buscando especificamente por "anderson" no displayName...\n');
  const allUsers = await db.collection('users').get();
  allUsers.forEach(d => {
    const u = d.data();
    const name = (u.displayName || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    if (name.includes('anderson') || email.includes('anderson')) {
      console.log(`  ✅ ENCONTRADO!`);
      console.log(`  UID  : ${d.id}`);
      console.log(`  Nome : ${u.displayName || '?'}`);
      console.log(`  Email: ${u.email || '?'}`);
      console.log(`  Role : ${u.role || '?'}`);
    }
  });

  // Também buscar time_entries recentes para inferir o userId
  console.log('\n🔍 Buscando time_entries manuais recentes (isManual=true) para identificar o userId...\n');
  const entries = await db.collection('time_entries')
    .where('isManual', '==', true)
    .orderBy('timestamp', 'desc')
    .limit(30)
    .get();

  const userIds = new Set();
  entries.forEach(d => userIds.add(d.data().userId));

  console.log('userIds distintos nos últimos 30 registros manuais:');
  for (const uid of userIds) {
    // Buscar nome do usuário
    try {
      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists) {
        const u = userDoc.data();
        console.log(`  ${uid} → ${u.displayName || '?'} (${u.email || '?'}) [${u.role || '?'}]`);
      } else {
        console.log(`  ${uid} → (usuário não encontrado na coleção users)`);
      }
    } catch {
      console.log(`  ${uid} → (erro ao buscar)`);
    }
  }
}

main().catch(err => {
  console.error('❌ ERRO:', err.message);
  process.exit(1);
});
