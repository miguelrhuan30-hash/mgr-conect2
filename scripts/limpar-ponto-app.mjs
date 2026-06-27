/**
 * Script pontual: apaga registros de time_entries feitos pelo campo (field_app)
 * de um usuário específico, para facilitar testes.
 *
 * Uso: node scripts/limpar-ponto-app.mjs <email>
 */
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, query, where,
  getDocs, deleteDoc, doc, getDoc,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            'AIzaSyDgIijdFVs2_ti7rqndRZhKI3QYpkOlwsg',
  authDomain:        'mgrrefrigeracao.com.br',
  projectId:         'mgr-conect2',
  storageBucket:     'mgr-conect2.firebasestorage.app',
  messagingSenderId: '94240285880',
  appId:             '1:94240285880:web:8fad80b8c49c7f7280c04d',
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const EMAIL = process.argv[2] || 'miguelrhuan20@mgr.com';

async function main() {
  console.log(`\n🔍 Buscando usuário com email: ${EMAIL}`);

  // 1. Busca UID pelo email na coleção users
  const usersSnap = await getDocs(
    query(collection(db, 'users'), where('email', '==', EMAIL))
  );

  if (usersSnap.empty) {
    console.error(`❌ Usuário não encontrado: ${EMAIL}`);
    process.exit(1);
  }

  const userDoc   = usersSnap.docs[0];
  const uid       = userDoc.id;
  const nome      = userDoc.data().displayName ?? userDoc.data().nomeCompleto ?? EMAIL;
  console.log(`✅ Usuário: ${nome} (UID: ${uid})`);

  // 2. Busca todos os time_entries deste usuário (sem filtro de data — limpa tudo para teste)
  console.log('\n🔍 Buscando registros de ponto...');
  const entriesSnap = await getDocs(
    query(collection(db, 'time_entries'), where('userId', '==', uid))
  );

  if (entriesSnap.empty) {
    console.log('ℹ️  Nenhum registro encontrado. Nada a apagar.');
    process.exit(0);
  }

  const docs = entriesSnap.docs;
  console.log(`\n📋 Encontrados ${docs.length} registros:`);
  docs.forEach(d => {
    const data = d.data();
    const ts   = data.timestamp?.toDate?.()?.toLocaleString('pt-BR') ?? 'sem data';
    const src  = data.source ?? 'web';
    console.log(`   ${ts} | ${data.type.padEnd(12)} | ${src}`);
  });

  // 3. Confirma e apaga
  console.log(`\n⚠️  Apagando ${docs.length} registro(s) do usuário ${nome}...`);
  let deletados = 0;
  for (const d of docs) {
    await deleteDoc(doc(db, 'time_entries', d.id));
    deletados++;
  }

  console.log(`\n✅ ${deletados} registro(s) apagado(s) com sucesso!`);
  console.log('   O usuário pode testar o fluxo do zero agora.\n');
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
