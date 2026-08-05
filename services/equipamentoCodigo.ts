/**
 * services/equipamentoCodigo.ts
 * Código curto único (fallback digitável) e payload de QR code pra
 * identificar um Ativo Final (ClientAsset) ou Maquinário. Compartilhado
 * entre a geração de etiqueta (Assets.tsx) e a leitura (EquipamentoScanModal.tsx)
 * pra manter os dois lados do mesmo formato.
 */
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName } from '../types';

// Sem 0/O/1/I — evita confundir na hora de digitar um código lido no adesivo.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function gerarCandidato(prefixo: 'AT' | 'MQ'): string {
  let sufixo = '';
  for (let i = 0; i < 6; i++) sufixo += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  return `${prefixo}-${sufixo}`;
}

/** Gera um código único, conferindo colisão na coleção certa antes de devolver. */
export async function gerarCodigoInterno(tipo: 'ativo' | 'maquinario'): Promise<string> {
  const prefixo = tipo === 'ativo' ? 'AT' : 'MQ';
  const colName = tipo === 'ativo' ? CollectionName.ASSETS : CollectionName.MAQUINARIOS;
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const candidato = gerarCandidato(prefixo);
    const snap = await getDocs(query(collection(db, colName), where('codigoInterno', '==', candidato)));
    if (snap.empty) return candidato;
  }
  throw new Error('Não foi possível gerar um código único agora — tente de novo.');
}

export function qrPayload(tipo: 'ativo' | 'maquinario', id: string): string {
  return `MGR-EQUIP:${tipo === 'ativo' ? 'ATIVO' : 'MAQUINARIO'}:${id}`;
}

export function parseQrPayload(texto: string): { tipo: 'ativo' | 'maquinario'; id: string } | null {
  const m = /^MGR-EQUIP:(ATIVO|MAQUINARIO):(.+)$/.exec(texto.trim());
  if (!m) return null;
  return { tipo: m[1] === 'ATIVO' ? 'ativo' : 'maquinario', id: m[2] };
}
