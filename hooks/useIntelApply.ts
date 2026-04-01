/**
 * hooks/useIntelApply.ts
 * Sprint 23 + Sprint 25 — Roteamento de insights Intel para o Hub.
 *
 * handleApplyInsight(note, destino) — rota o destino primário da nota
 * applyAcaoHub(note, acao, index)   — rota um item específico do array acoes_hub[]
 */
import { useCallback, useState } from 'react';
import { doc, addDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CollectionName, IntelNote, IntelDestino, AcaoHub } from '../types';

// Urgência → Priority de Task
const URGENCIA_TO_PRIORITY: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
    critica: 'critical',
    alta:    'high',
    media:   'medium',
    baixa:   'low',
};

export const useIntelApply = () => {
    const { currentUser, userProfile } = useAuth();
    const [applying, setApplying] = useState<Record<string, boolean>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    // ── Audit trail comum ────────────────────────────────────────────────
    const audit = (noteId: string, noteText: string) => ({
        origin: 'intel_module' as const,
        intelNoteId: noteId,
        intelOriginText: noteText.slice(0, 200),
        appliedBy: currentUser?.uid || 'unknown',
        appliedByName: userProfile?.displayName || 'Usuário',
        appliedAt: serverTimestamp(),
    });

    // ── Router genérico por destino ──────────────────────────────────────
    const routeToHub = async (
        destino: IntelDestino,
        payload: Record<string, any>,
        noteId: string,
        noteText: string
    ): Promise<string> => {
        const a = audit(noteId, noteText);

        if (destino === 'eisenhower') {
            const ref = await addDoc(collection(db, CollectionName.TASKS), {
                title:                payload.titulo || payload.conteudo?.slice(0, 60) || 'Tarefa Intel',
                description:          `${noteText}\n\n💡 ${payload.acao_sugerida || payload.conteudo || ''}`,
                status:               'pending',
                priority:             URGENCIA_TO_PRIORITY[payload.urgencia] || 'medium',
                assignedTo:           payload.responsavel || '',
                assigneeName:         payload.responsavel || '',
                checklist:            [],
                tags:                 payload.tags || [],
                eisenhowerQuadrante:  payload.quadrante || 'plan',
                dueDate:              payload.prazo || null,
                notes:                `Via Intel MGR · ${new Date().toLocaleDateString('pt-BR')} · ${payload.resumo || payload.contexto || ''}`,
                createdAt:            serverTimestamp(),
                ...a,
            });
            return ref.id;
        }

        if (destino === 'ishikawa') {
            const ref = await addDoc(collection(db, CollectionName.ISHIKAWA), {
                categoria:  payload.categoria || 'Processos',
                causa:      payload.conteudo || payload.causa || '',
                descricao:  noteText,
                efeito:     payload.resumo || payload.conteudo || '',
                area:       payload.area || 'geral',
                urgencia:   payload.urgencia || 'media',
                tags:       payload.tags || [],
                contexto:   payload.contexto || '',
                createdAt:  serverTimestamp(),
                ...a,
            });
            return ref.id;
        }

        if (destino === 'canvas') {
            const ref = await addDoc(collection(db, CollectionName.CANVAS), {
                celula:    payload.celula || 'proposta',
                conteudo:  payload.conteudo || payload.resumo || '',
                contexto:  noteText,
                tags:      payload.tags || [],
                createdAt: serverTimestamp(),
                ...a,
            });
            return ref.id;
        }

        if (destino === 'bpmn') {
            const ref = await addDoc(collection(db, CollectionName.TASKS), {
                title:        `[BPMN] ${payload.conteudo?.slice(0, 55) || payload.task || ''}`,
                description:  `Processo: ${payload.processo || 'novo'}\n${noteText}`,
                status:       'pending',
                priority:     URGENCIA_TO_PRIORITY[payload.urgencia] || 'medium',
                bpmn_processo: payload.processo || 'novo',
                bpmn_task:    payload.conteudo || payload.task || '',
                checklist:    [],
                createdAt:    serverTimestamp(),
                ...a,
            });
            return ref.id;
        }

        if (destino === 'roadmap') {
            const ref = await addDoc(collection(db, CollectionName.ROADMAP), {
                fase:        payload.fase || 1,
                titulo:      payload.conteudo || payload.titulo || '',
                descricao:   noteText,
                responsavel: payload.responsavel || '',
                prazo:       payload.prazo || 'A definir',
                status:      'pendente',
                urgencia:    payload.urgencia || 'media',
                area:        payload.area || 'geral',
                tags:        payload.tags || [],
                contexto:    payload.contexto || '',
                createdAt:   serverTimestamp(),
                ...a,
            });
            return ref.id;
        }

        throw new Error(`Destino desconhecido: ${destino}`);
    };

    // ── 1. Aplicar destino PRIMÁRIO da nota ──────────────────────────────
    const handleApplyInsight = useCallback(async (
        note: IntelNote,
        destino: IntelDestino
    ): Promise<void> => {
        if (!currentUser || !note.analysis) return;
        if (note.hub_sync?.[destino]) return; // já aplicado

        const key = `${note.id}-${destino}`;
        setApplying(prev => ({ ...prev, [key]: true }));
        setErrors(prev => { const e = {...prev}; delete e[key]; return e; });

        try {
            const a = note.analysis;
            const payload = {
                ...a[destino],
                urgencia:     a.urgencia,
                tags:         a.tags,
                area:         a.area,
                resumo:       a.resumo,
                acao_sugerida: a.acao_sugerida,
            };
            const docId = await routeToHub(destino, payload, note.id, note.text);

            await updateDoc(doc(db, CollectionName.NOTAS_INTEL, note.id), {
                status:          'aplicada',
                applied:         true,
                [`hub_sync.${destino}`]: docId,
                appliedAt:       serverTimestamp(),
                appliedBy:       currentUser.uid,
            });
        } catch (err: any) {
            console.error(`[IntelApply] Erro ao aplicar em ${destino}:`, err);
            setErrors(prev => ({ ...prev, [key]: err?.message || 'Erro desconhecido' }));
            throw err;
        } finally {
            setApplying(prev => ({ ...prev, [key]: false }));
        }
    }, [currentUser, userProfile]);

    // ── 2. Aplicar item individual de acoes_hub[] ────────────────────────
    const applyAcaoHub = useCallback(async (
        note: IntelNote,
        acao: AcaoHub,
        index: number
    ): Promise<void> => {
        if (!currentUser) return;
        if (acao.applied || acao.hub_doc_id) return; // idempotência

        const key = `${note.id}-acao-${index}`;
        setApplying(prev => ({ ...prev, [key]: true }));
        setErrors(prev => { const e = {...prev}; delete e[key]; return e; });

        try {
            const docId = await routeToHub(
                acao.ferramenta,
                {
                    conteudo:  acao.conteudo,
                    urgencia:  acao.urgencia,
                    contexto:  acao.contexto,
                    // campos específicos por ferramenta (Gemini preenche)
                    categoria: 'Processos',  // fallback para Ishikawa
                    celula:    'proposta',   // fallback para Canvas
                    quadrante: 'plan',       // fallback para Eisenhower
                    processo:  'novo',       // fallback para BPMN
                    fase:      1,            // fallback para Roadmap
                },
                note.id,
                note.text
            );

            // Atualiza a nota: marca o item como aplicado e registra o doc ID
            const currentAcoes = note.analysis?.acoes_hub || [];
            const updatedAcoes = currentAcoes.map((a, i) =>
                i === index ? { ...a, applied: true, hub_doc_id: docId } : a
            );

            await updateDoc(doc(db, CollectionName.NOTAS_INTEL, note.id), {
                'analysis.acoes_hub': updatedAcoes,
                appliedAt:   serverTimestamp(),
                appliedBy:   currentUser.uid,
            });
        } catch (err: any) {
            console.error(`[IntelApply] Erro ao aplicar acao_hub[${index}]:`, err);
            setErrors(prev => ({ ...prev, [key]: err?.message || 'Erro desconhecido' }));
            throw err;
        } finally {
            setApplying(prev => ({ ...prev, [key]: false }));
        }
    }, [currentUser, userProfile]);

    const isApplying = (key: string) => !!applying[key];
    const getError  = (key: string) => errors[key] || null;

    return { handleApplyInsight, applyAcaoHub, isApplying, getError };
};
