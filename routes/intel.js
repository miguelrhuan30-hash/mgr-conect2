import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { dbAdmin, admin } from '../firebase-admin.js';
import { MGR_INTEL_PROMPT } from '../constants/intel.js';

const router = express.Router();

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

let gemini = null;
try {
    if (GEMINI_KEY) {
        gemini = new GoogleGenAI({ apiKey: GEMINI_KEY });
        console.log('[Intel] Gemini SDK inicializada com sucesso.');
    } else {
        console.warn('[Intel] GEMINI_API_KEY ausente. SDK não inicializada.');
    }
} catch (error) {
    console.error('[Intel] Erro ao inicializar SDK Gemini:', error.message);
}

// ─── MODELO PADRÃO ────────────────────────────────────────────────────────────
const GEMINI_MODEL = 'gemini-2.0-flash'; // ✅ único ponto de controle

/**
 * @route   POST /api/intel/notas
 * @desc    Analisa nota via Gemini e salva no Firestore
 */
router.post('/notas', async (req, res) => {
    const { text, userId, userName } = req.body;

    if (!text || !userId) {
        return res.status(400).json({ error: 'Texto e ID do usuário são obrigatórios.' });
    }

    if (!gemini) {
        return res.status(503).json({
            error: 'Serviço de Inteligência temporariamente indisponível (SDK não inicializada).'
        });
    }

    try {
        // 1. Chamada ao Gemini — modelo corrigido para gemini-2.0-flash
        const result = await gemini.models.generateContent({
            model: GEMINI_MODEL, // ✅ era 'gemini-1.5-flash' — CORRIGIDO
            contents: { parts: [{ text: `${MGR_INTEL_PROMPT}\n\nNota: ${text}` }] },
            config: { responseMimeType: 'application/json' },
        });

        const raw = result.text || '{}';

        // 2. Parse robusto
        let analysis;
        try {
            const cleaned = raw
                .replace(/^```(?:json)?\s*/i, '')
                .replace(/\s*```$/, '')
                .trim();
            analysis = JSON.parse(cleaned);
        } catch (parseError) {
            console.error('[Intel] Falha no parse JSON. Raw:', raw.slice(0, 300));
            throw new Error('Resposta da IA em formato inválido (não-JSON).');
        }

        // 3. Persistência no Firestore Admin
        const docRef = await dbAdmin.collection('notas_intel').add({
            userId,
            createdBy: userName || 'Usuário',
            text,
            analysis,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            applied: false,
            hub_sync: false,
            type: 'insight'
        });

        res.json({ id: docRef.id, analysis });

    } catch (error) {
        console.error('[Intel/notas] Erro:', error);
        res.status(500).json({
            error: 'Erro no processamento da inteligência',
            details: error.message
        });
    }
});

/**
 * @route   POST /api/intel/apply
 * @desc    Aplica uma sugestão da IA criando o card correspondente no Hub
 */
router.post('/apply', async (req, res) => {
    const { noteId } = req.body;

    if (!noteId) {
        return res.status(400).json({ error: 'O ID da nota é obrigatório.' });
    }

    try {
        const noteRef = dbAdmin.collection('notas_intel').doc(noteId);
        const noteDoc = await noteRef.get();

        if (!noteDoc.exists) {
            return res.status(404).json({ error: 'Nota não encontrada.' });
        }

        const noteData = noteDoc.data();
        const { analysis, text, userId, createdBy } = noteData;

        if (!analysis) {
            return res.status(400).json({ error: 'Esta nota não possui uma análise válida para aplicação.' });
        }

        let collectionName = 'hub_eisenhower';
        const category = (analysis.category || '').toLowerCase();

        if (category.includes('ishikawa')) collectionName = 'hub_ishikawa';
        else if (category.includes('canvas')) collectionName = 'hub_canvas';
        else if (category.includes('roadmap')) collectionName = 'hub_roadmap';
        else if (category.includes('eisenhower')) collectionName = 'hub_eisenhower';

        const hubDocRef = await dbAdmin.collection(collectionName).add({
            content: analysis.suggestion,
            originalNote: text,
            urgency: analysis.urgency,
            userId,
            createdBy,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'pending',
            metadata: analysis
        });

        await noteRef.update({
            applied: true,
            hub_sync: true,
            hub_reference: hubDocRef.id,
            hub_collection: collectionName
        });

        res.json({ success: true, hubId: hubDocRef.id, collection: collectionName });

    } catch (error) {
        console.error('[Intel/apply] Erro:', error);
        res.status(500).json({ error: 'Falha na injeção de dados no Hub.' });
    }
});

/**
 * @route   GET /api/intel/summary
 * @desc    Gera um resumo estratégico semanal das últimas 50 notas
 */
router.get('/summary', async (req, res) => {
    try {
        const snapshot = await dbAdmin.collection('notas_intel')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        const notes = snapshot.docs.map(doc => doc.data().text);

        if (notes.length === 0) {
            return res.json({ summary: 'Ainda não há dados suficientes para um resumo estratégico.' });
        }

        if (!gemini) {
            return res.status(503).json({
                error: 'Serviço de Inteligência temporariamente indisponível (SDK não inicializada).'
            });
        }

        const prompt = `Você é um consultor de estratégia sênior. Responda em Português de forma profissional.

Analise as seguintes ${notes.length} observações operacionais e gere um "Resumo Estratégico Semanal" curto e direto (máx 3 parágrafos).
Identifique padrões de falha, gargalos ou oportunidades de melhoria.

Observações:
- ${notes.join('\n- ')}`;

        const result = await gemini.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
        });

        res.json({ summary: result.text });

    } catch (error) {
        console.error('[Intel/summary] Erro:', error);
        res.status(500).json({ error: 'Falha ao processar resumo estratégico.' });
    }
});

/**
 * @route   GET /api/intel/stats
 * @desc    Busca métricas rápidas do módulo Intel
 */
router.get('/stats', async (req, res) => {
    try {
        const snapshot = await dbAdmin.collection('notas_intel').get();
        const docs = snapshot.docs.map(d => d.data());

        const stats = {
            total: docs.length,
            critical: docs.filter(d => d.analysis?.urgencia === 'critica').length,
            applied: docs.filter(d => d.applied || d.status === 'aplicada').length,
            opportunities: docs.filter(d => d.analysis?.sentimento === 'oportunidade').length,
            setorFoco: (() => {
                const counts = {};
                docs.forEach(d => { const a = d.analysis?.area || 'geral'; counts[a] = (counts[a] || 0) + 1; });
                return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'geral';
            })(),
        };

        res.json(stats);
    } catch (error) {
        console.error('[Intel/stats] Erro:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
    }
});

/**
 * @route   POST /api/intel/gerar-sop
 * @desc    Gera um Manual de Operação Padrão (SOP) em Markdown
 */
router.post('/gerar-sop', async (req, res) => {
    const { processoId, steps = [], requisitos = [] } = req.body;

    if (!processoId) {
        return res.status(400).json({ error: 'processoId é obrigatório.' });
    }
    if (!gemini) {
        return res.status(503).json({ error: 'Motor Gemini indisponível.' });
    }

    const stepsText = steps.length > 0
        ? steps.map((s, i) => `${i + 1}. [${s.tipo?.toUpperCase() || 'PASSO'}] ${s.titulo}${s.descricao ? ': ' + s.descricao : ''}`).join('\n')
        : 'Nenhum passo registado ainda.';

    const reqText = requisitos.length > 0
        ? requisitos.map(r => `- [${r.categoria?.toUpperCase() || 'REQ'}] ${r.titulo}${r.obrigatorio ? ' ⚠️ Obrigatório' : ''}`).join('\n')
        : 'Nenhum requisito registado.';

    const prompt = `Você é um consultor de processos sênior da MGR Soluções em Refrigeração Industrial.
Com base nos seguintes dados de processo, gere um Manual de Operação Padrão (SOP) profissional em português, formatado em Markdown.

PROCESSO: ${processoId}

PASSOS REGISTADOS:
${stepsText}

REQUISITOS:
${reqText}

O SOP deve ter as seguintes seções:
1. **Objetivo** — descrição concisa do processo
2. **Âmbito** — quem executa e quando
3. **Pré-requisitos** — lista dos requisitos obrigatórios
4. **Procedimento Passo-a-Passo** — numerado com detalhes operacionais
5. **Pontos de Atenção** — riscos, avisos e cuidados de segurança
6. **Registo e Rastreabilidade** — como documentar a execução
7. **Histórico de Revisões** — tabela com data e descrição

Retorne APENAS o texto Markdown do SOP, sem comentários adicionais.`;

    try {
        const result = await gemini.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
        });
        res.json({ sop: result.text });
    } catch (error) {
        console.error('[Intel/gerar-sop] Erro:', error);
        res.status(500).json({ error: 'Falha ao gerar SOP via Gemini.' });
    }
});

export default router;
