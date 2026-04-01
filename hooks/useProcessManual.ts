/**
 * hooks/useProcessManual.ts
 * Sprint 26 — CRUD e injeção de passos/requisitos em processos BPMN.
 *
 * updateProcessManual(processoId, step) — append de um novo passo
 * addRequirement(processoId, req)       — append de um requisito
 * generateSOP(processoId)               — chama /api/intel/gerar-sop
 */
import { useState, useCallback } from 'react';
import {
    collection, addDoc, serverTimestamp, query, where,
    orderBy, onSnapshot, doc, updateDoc, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
    CollectionName, ManualStep, ProcessRequirement,
    BpmnProcessoId
} from '../types';

export const useProcessManual = () => {
    const { currentUser, userProfile } = useAuth();
    const [generatingSop, setGeneratingSop] = useState(false);
    const [sopError, setSopError] = useState<string | null>(null);

    // ── Append a manual step to a process ───────────────────────────────
    const updateProcessManual = useCallback(async (
        processoId: BpmnProcessoId | string,
        stepContent: {
            titulo: string;
            descricao?: string;
            tipo?: ManualStep['tipo'];
            ordem?: number;
            intelNoteId?: string;
        }
    ): Promise<string> => {
        if (!currentUser || !userProfile) throw new Error('Não autenticado.');

        const newStep: Omit<ManualStep, 'id'> = {
            processoId,
            ordem:        stepContent.ordem ?? Date.now(),
            titulo:       stepContent.titulo.slice(0, 200),
            descricao:    stepContent.descricao,
            tipo:         stepContent.tipo ?? 'procedure',
            origin:       stepContent.intelNoteId ? 'intel_module' : 'manual',
            intelNoteId:  stepContent.intelNoteId,
            createdBy:    currentUser.uid,
            createdByName: userProfile.displayName,
            createdAt:    serverTimestamp() as Timestamp,
        };

        const ref = await addDoc(collection(db, CollectionName.MANUAL_STEPS), newStep);
        return ref.id;
    }, [currentUser, userProfile]);

    // ── Append a requirement ─────────────────────────────────────────────
    const addRequirement = useCallback(async (
        processoId: BpmnProcessoId | string,
        req: {
            titulo: string;
            categoria?: ProcessRequirement['categoria'];
            obrigatorio?: boolean;
            intelNoteId?: string;
        }
    ): Promise<string> => {
        if (!currentUser || !userProfile) throw new Error('Não autenticado.');

        const newReq: Omit<ProcessRequirement, 'id'> = {
            processoId,
            titulo:       req.titulo.slice(0, 200),
            categoria:    req.categoria ?? 'tecnico',
            obrigatorio:  req.obrigatorio ?? true,
            origin:       req.intelNoteId ? 'intel_module' : 'manual',
            intelNoteId:  req.intelNoteId,
            createdBy:    currentUser.uid,
            createdByName: userProfile.displayName,
            createdAt:    serverTimestamp() as Timestamp,
        };

        const ref = await addDoc(collection(db, CollectionName.REQUIREMENTS), newReq);
        return ref.id;
    }, [currentUser, userProfile]);

    // ── Generate SOP via backend Gemini route ────────────────────────────
    const generateSOP = useCallback(async (
        processoId: string,
        steps: ManualStep[],
        requisitos: ProcessRequirement[]
    ): Promise<string> => {
        if (generatingSop) return '';
        setGeneratingSop(true);
        setSopError(null);

        try {
            const res = await fetch('/api/intel/gerar-sop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ processoId, steps, requisitos }),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            return data.sop || '';
        } catch (err: any) {
            const msg = err?.message || 'Erro ao gerar SOP';
            setSopError(msg);
            throw err;
        } finally {
            setGeneratingSop(false);
        }
    }, [generatingSop]);

    // ── Subscribe to steps for a process ────────────────────────────────
    const subscribeSteps = (
        processoId: string,
        onData: (steps: ManualStep[]) => void
    ) => {
        const q = query(
            collection(db, CollectionName.MANUAL_STEPS),
            where('processoId', '==', processoId),
            orderBy('ordem', 'asc')
        );
        return onSnapshot(q, snap => {
            onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as ManualStep)));
        });
    };

    // ── Subscribe to requirements for a process ──────────────────────────
    const subscribeRequirements = (
        processoId: string,
        onData: (reqs: ProcessRequirement[]) => void
    ) => {
        const q = query(
            collection(db, CollectionName.REQUIREMENTS),
            where('processoId', '==', processoId),
            orderBy('createdAt', 'asc')
        );
        return onSnapshot(q, snap => {
            onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProcessRequirement)));
        });
    };

    return {
        updateProcessManual,
        addRequirement,
        generateSOP,
        subscribeSteps,
        subscribeRequirements,
        generatingSop,
        sopError,
    };
};
