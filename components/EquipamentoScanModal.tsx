/**
 * components/EquipamentoScanModal.tsx
 * Modal compartilhado pra identificar um equipamento (Ativo Final ou
 * Maquinário) lendo o QR do adesivo ou digitando o código curto impresso
 * junto. Usado em 3 frentes: técnico marcando qual equipamento recebeu a
 * evidência (app de campo e navegador), cliente indicando o equipamento ao
 * abrir um chamado no Portal, e consulta de histórico in loco (staff/campo).
 *
 * Resolve sempre pro mesmo formato — { tipo, id, nome, clientId, clientName,
 * ativosVinculados? } — e devolve via onResolve. Não decide o que fazer com
 * o resultado; isso fica por conta de quem abre o modal.
 */
import React, { useEffect, useRef, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '../firebase';
import { CollectionName } from '../types';
import { parseQrPayload } from '../services/equipamentoCodigo';
import { QrCode, Keyboard, X, Loader2, AlertTriangle, Camera } from 'lucide-react';

export interface EquipamentoResolvido {
  tipo: 'ativo' | 'maquinario';
  id: string;
  nome: string;
  clientId: string;
  clientName?: string;
  /** Se tipo==='ativo': maquinários vinculados a ele. Se tipo==='maquinario': os ativos que ele atende. */
  ativosVinculados?: { id: string; nome: string }[];
}

interface Props {
  /** Fluxo do Portal do Cliente — trava a busca por código digitado (e valida o QR lido) a esse clientId. */
  escopoClientId?: string;
  /** Fluxo de chamado do cliente — só aceita Ativo Final, nunca Maquinário. */
  apenasAtivoFinal?: boolean;
  titulo?: string;
  onResolve: (equip: EquipamentoResolvido) => void;
  onClose: () => void;
}

const READER_ID = 'equipamento-scan-reader';

export default function EquipamentoScanModal({ escopoClientId, apenasAtivoFinal, titulo, onResolve, onClose }: Props) {
  const [aba, setAba] = useState<'qr' | 'codigo'>('qr');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [resolvendo, setResolvendo] = useState(false);
  const [cameraErro, setCameraErro] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const travaRef = useRef(false); // evita processar o mesmo frame/lote de vezes enquanto resolve

  const buscarVinculados = async (tipo: 'ativo' | 'maquinario', id: string, data: any) => {
    try {
      if (tipo === 'maquinario') {
        const ids: string[] = data.ativosFinaisAtendidos || [];
        const resolvidos = await Promise.all(ids.map(async aid => {
          const s = await getDoc(doc(db, CollectionName.ASSETS, aid));
          return s.exists() ? { id: aid, nome: (s.data() as any).nome as string } : null;
        }));
        return resolvidos.filter((v): v is { id: string; nome: string } => v !== null);
      }
      const snap = await getDocs(query(
        collection(db, CollectionName.MAQUINARIOS),
        where('clientId', '==', data.clientId),
        where('ativosFinaisAtendidos', 'array-contains', id),
      ));
      return snap.docs.map(d => ({ id: d.id, nome: (d.data() as any).nome as string }));
    } catch {
      return undefined;
    }
  };

  /** Retorna true se resolveu com sucesso (chamou onResolve) — só então a
   *  trava de leitura contínua do QR deve permanecer ativa. */
  const resolverDoc = async (tipo: 'ativo' | 'maquinario', id: string, data: any): Promise<boolean> => {
    if (escopoClientId && data.clientId !== escopoClientId) {
      setErro('Esse equipamento não pertence ao seu cadastro.');
      return false;
    }
    if (apenasAtivoFinal && tipo === 'maquinario') {
      setErro('Aponte pro QR/código do equipamento principal, não de uma peça específica.');
      return false;
    }
    setResolvendo(true);
    try {
      const ativosVinculados = await buscarVinculados(tipo, id, data);
      onResolve({ tipo, id, nome: data.nome, clientId: data.clientId, clientName: data.clientName, ativosVinculados });
      return true;
    } finally {
      setResolvendo(false);
    }
  };

  const handleScan = async (decodedText: string) => {
    if (travaRef.current) return;
    travaRef.current = true;
    setErro('');
    const parsed = parseQrPayload(decodedText);
    if (!parsed) {
      setErro('QR code não reconhecido — não parece ser um equipamento MGR.');
      travaRef.current = false;
      return;
    }
    const colName = parsed.tipo === 'ativo' ? CollectionName.ASSETS : CollectionName.MAQUINARIOS;
    try {
      const snap = await getDoc(doc(db, colName, parsed.id));
      if (!snap.exists()) {
        setErro('Equipamento não encontrado (pode ter sido excluído).');
        travaRef.current = false;
        return;
      }
      const ok = await resolverDoc(parsed.tipo, parsed.id, snap.data());
      if (!ok) travaRef.current = false;
    } catch {
      setErro('Erro ao consultar o equipamento.');
      travaRef.current = false;
    }
  };

  const buscarPorCodigo = async () => {
    const codigoNorm = codigo.trim().toUpperCase();
    if (!codigoNorm) return;
    setErro('');
    setResolvendo(true);
    try {
      const tiposParaTentar: Array<{ tipo: 'ativo' | 'maquinario'; col: string }> = [
        { tipo: 'ativo', col: CollectionName.ASSETS },
        ...(apenasAtivoFinal ? [] : [{ tipo: 'maquinario' as const, col: CollectionName.MAQUINARIOS }]),
      ];
      for (const { tipo, col } of tiposParaTentar) {
        const q = escopoClientId
          ? query(collection(db, col), where('clientId', '==', escopoClientId), where('codigoInterno', '==', codigoNorm))
          : query(collection(db, col), where('codigoInterno', '==', codigoNorm));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0];
          await resolverDoc(tipo, d.id, d.data());
          return;
        }
      }
      setErro('Código não encontrado.');
    } catch {
      setErro('Erro ao buscar o código.');
    } finally {
      setResolvendo(false);
    }
  };

  useEffect(() => {
    if (aba !== 'qr') return;
    setCameraErro(false);
    const scanner = new Html5Qrcode(READER_ID);
    scannerRef.current = scanner;
    let cancelado = false;

    Html5Qrcode.getCameras()
      .then(cams => {
        if (cancelado || cams.length === 0) { setCameraErro(true); return; }
        const cameraId = cams.find(c => /back|tras|rear|environment/i.test(c.label))?.id || cams[cams.length - 1].id;
        return scanner.start(
          cameraId,
          { fps: 10, qrbox: 230 },
          decodedText => { handleScan(decodedText); },
          () => { /* ruído de leitura por frame — normal, ignora */ },
        );
      })
      .catch(() => setCameraErro(true));

    return () => {
      cancelado = true;
      scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between bg-gray-50">
          <h2 className="text-base font-bold text-gray-900">{titulo || 'Identificar equipamento'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="flex gap-1 p-1 mx-5 mt-4 bg-gray-100 rounded-xl">
          <button onClick={() => setAba('qr')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${aba === 'qr' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}>
            <QrCode className="w-3.5 h-3.5" /> Ler QR Code
          </button>
          <button onClick={() => setAba('codigo')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${aba === 'codigo' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}>
            <Keyboard className="w-3.5 h-3.5" /> Digitar Código
          </button>
        </div>

        <div className="p-5 space-y-3">
          {aba === 'qr' ? (
            cameraErro ? (
              <div className="text-center py-8 text-gray-400">
                <Camera className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Não foi possível acessar a câmera.</p>
                <p className="text-xs mt-1">Confira a permissão de câmera, ou use "Digitar Código".</p>
              </div>
            ) : (
              <div id={READER_ID} className="rounded-xl overflow-hidden bg-black min-h-[240px]" />
            )
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Código do equipamento</label>
                <input value={codigo} onChange={e => setCodigo(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && buscarPorCodigo()}
                  placeholder="Ex: AT-K3F9M2" autoComplete="off"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm bg-white uppercase" />
              </div>
              <button onClick={buscarPorCodigo} disabled={resolvendo || !codigo.trim()}
                className="w-full py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                {resolvendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Keyboard className="w-4 h-4" />}
                Buscar
              </button>
            </div>
          )}

          {resolvendo && aba === 'qr' && (
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Identificando...
            </div>
          )}

          {erro && (
            <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {erro}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
