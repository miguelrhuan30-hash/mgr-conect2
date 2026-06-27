/**
 * Migração: checklist → tarefasOS
 *
 * Para cada documento em "tasks":
 *  - Se tem `checklist` e NÃO tem `tarefasOS` (ou tarefasOS vazio):
 *      → converte checklist para tarefasOS e salva
 *  - Remove o campo `checklist` de TODOS os documentos que o tiverem
 *
 * Executar: node scripts/migrar-checklist-para-tarefasOS.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const admin = require('../functions/node_modules/firebase-admin');
admin.initializeApp({ projectId: 'mgr-conect2' });

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

async function migrar() {
  console.log('🔍 Buscando documentos em "tasks"...');
  const snap = await db.collection('tasks').get();
  console.log(`📋 Total de O.S. encontradas: ${snap.size}`);

  let migradas = 0, semChecklist = 0, jaTemTarefasOS = 0, erros = 0;
  const BATCH_SIZE = 400;
  let batch = db.batch();
  let opsNoBatch = 0;

  const flush = async () => {
    if (opsNoBatch === 0) return;
    await batch.commit();
    batch = db.batch();
    opsNoBatch = 0;
  };

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const checklist   = data.checklist   ?? [];
    const tarefasOS   = data.tarefasOS   ?? [];
    const temChecklist = Array.isArray(checklist) && checklist.length > 0;
    const temTarefasOS = Array.isArray(tarefasOS) && tarefasOS.length > 0;

    // Nada a fazer: não tem checklist e já tem tarefasOS (ou ambos vazios sem checklist)
    if (!temChecklist && !data.hasOwnProperty('checklist')) {
      semChecklist++;
      continue;
    }

    const ref = db.collection('tasks').doc(docSnap.id);
    const patch = { checklist: FieldValue.delete() };

    if (temChecklist && !temTarefasOS) {
      // Converte checklist → tarefasOS
      patch.tarefasOS = checklist.map(item => ({
        id:          item.id ?? Math.random().toString(36).slice(2),
        descricao:   item.text ?? item.descricao ?? '(sem descrição)',
        status:      item.completed ? 'concluida' : (item.status ?? 'pendente'),
        iniciadaEm:  item.iniciadaEm  ?? null,
        concluidaEm: item.concluidaEm ?? null,
        fotoSlots:   item.fotoSlots   ?? [],
      }));
      migradas++;
    } else {
      // Já tem tarefasOS (com conteúdo) — só remove checklist duplicado
      jaTemTarefasOS++;
    }

    try {
      batch.update(ref, patch);
      opsNoBatch++;
      if (opsNoBatch >= BATCH_SIZE) await flush();
    } catch (e) {
      console.error(`  ✗ Erro no doc ${docSnap.id}:`, e.message);
      erros++;
    }
  }

  await flush();

  console.log('\n✅ Migração concluída:');
  console.log(`   Convertidas (checklist → tarefasOS): ${migradas}`);
  console.log(`   Já tinham tarefasOS (só removeu checklist): ${jaTemTarefasOS}`);
  console.log(`   Sem checklist (não alteradas): ${semChecklist}`);
  console.log(`   Erros: ${erros}`);
}

migrar().catch(e => { console.error('❌ Falha fatal:', e); process.exit(1); });
