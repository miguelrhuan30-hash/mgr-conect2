/**
 * Migração: padronizar nomes de campos nas O.S. (tasks)
 *
 * titulo      → title        (remove titulo após copiar)
 * dataAgendada → startDate   (remove dataAgendada após copiar; null é descartado)
 *
 * Regra: se já existe o campo destino, não sobrescreve — apenas remove o antigo.
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp({ projectId: 'mgr-conect2' });
const db = getFirestore();

async function migrar() {
  const snap = await db.collection('tasks').get();
  console.log(`Total de documentos: ${snap.size}`);

  let precisaMigrar = 0;
  let migrados = 0;
  let erros = 0;
  const batch = db.batch();
  let opsBatch = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const updates = {};
    let temMudanca = false;

    // ── titulo → title ──────────────────────────────────────────────────
    if ('titulo' in data) {
      if (!('title' in data) && data.titulo) {
        updates['title'] = data.titulo;   // copia para title
      }
      updates['titulo'] = FieldValue.delete(); // remove sempre
      temMudanca = true;
    }

    // ── dataAgendada → startDate ─────────────────────────────────────────
    if ('dataAgendada' in data) {
      if (!('startDate' in data) && data.dataAgendada !== null) {
        updates['startDate'] = data.dataAgendada; // copia se não-null
      }
      updates['dataAgendada'] = FieldValue.delete(); // remove sempre
      temMudanca = true;
    }

    if (!temMudanca) continue;

    precisaMigrar++;
    batch.update(docSnap.ref, updates);
    opsBatch++;

    // Firestore limita 500 ops por batch
    if (opsBatch >= 450) {
      try {
        await batch.commit();
        migrados += opsBatch;
        console.log(`  Batch commitado: ${migrados} docs migrados até agora`);
        opsBatch = 0;
      } catch (e) {
        console.error('  Erro no batch:', e.message);
        erros++;
      }
    }
  }

  if (opsBatch > 0) {
    try {
      await batch.commit();
      migrados += opsBatch;
    } catch (e) {
      console.error('  Erro no batch final:', e.message);
      erros++;
    }
  }

  console.log('\n── Resultado ──────────────────────');
  console.log(`  Documentos que precisavam migrar: ${precisaMigrar}`);
  console.log(`  Migrados com sucesso:             ${migrados}`);
  console.log(`  Erros:                            ${erros}`);
  console.log('────────────────────────────────────');
}

migrar().catch(console.error);
