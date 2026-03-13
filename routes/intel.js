import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { dbAdmin, admin } from '../firebase-admin.js';

const router = express.Router();

let anthropic = null;
try {
    if (process.env.ANTHROPIC_API_KEY) {
        anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
    } else {
        console.warn("Módulo Intel: ANTHROPIC_API_KEY ausente. SDK não inicializada.");
    }
} catch (error) {
    console.error("Erro ao inicializar SDK Anthropic:", error);
}

const MGR_INTEL_PROMPT = `
Você é o "Cérebro" do MGR Conect, um assistente de Business Intelligence especializado em gestão operacional e estratégica para empresas de manutenção e serviços.
Sua tarefa é analisar notas registradas por colaboradores e extrair insights acionáveis.

Saída: Você DEVE retornar EXCLUSIVAMENTE um objeto JSON válido com a seguinte estrutura:
{
  "summary": "Resumo conciso (máx 150 caracteres).",
  "suggestion": "Recomendação prática baseada na melhor prática de gestão (Eisenhower, Ishikawa, etc).",
  "urgency": "critical" | "high" | "medium" | "low",
  "sentiment": "positive" | "neutral" | "negative" | "frustrated",
  "category": "Metodologia aplicada (ex: Matriz Eisenhower, 5W2H, Kaizen, etc)"
}

Diretrizes:
- Registros de segurança ou falha crítica = urgency: "critical".
- O campo 'category' deve refletir a lógica de gestão usada para a sugestão.
- Não inclua explicações extras, apenas o JSON.
`;

/**
 * @route   POST /api/intel/notas
 * @desc    Analisa nota via Claude-3 e salva no Firestore
 */
router.post('/notas', async (req, res) => {
    const { text, userId, userName } = req.body;

    if (!text || !userId) {
        return res.status(400).json({ error: 'Texto e ID do usuário são obrigatórios.' });
    }

    if (!anthropic) {
        return res.status(503).json({ 
            error: 'Serviço de Inteligência temporariamente indisponível (SDK não inicializada).' 
        });
    }

    try {
        // 1. Chamada ao Claude-3-5-Sonnet
        const message = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20240620",
            max_tokens: 1000,
            system: MGR_INTEL_PROMPT,
            messages: [{ role: "user", content: text }],
        });

        // 2. Parse da resposta
        let analysis;
        try {
            const content = message.content[0].text;
            analysis = JSON.parse(content);
        } catch (parseError) {
            console.error("Erro ao fazer parse do JSON do Claude:", message.content[0].text);
            throw new Error("Resposta da IA em formato inválido.");
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
        console.error("Erro no processamento Intel:", error);
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

        // Mapeamento de Coleção baseado na Categoria/Metodologia
        let collectionName = 'hub_eisenhower'; // Default
        const category = (analysis.category || '').toLowerCase();

        if (category.includes('ishikawa')) collectionName = 'hub_ishikawa';
        else if (category.includes('canvas')) collectionName = 'hub_canvas';
        else if (category.includes('roadmap')) collectionName = 'hub_roadmap';
        else if (category.includes('eisenhower')) collectionName = 'hub_eisenhower';

        // Criar o documento no Hub
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

        // Atualizar a nota original
        await noteRef.update({
            applied: true,
            hub_sync: true,
            hub_reference: hubDocRef.id,
            hub_collection: collectionName
        });

        res.json({ 
            success: true, 
            hubId: hubDocRef.id, 
            collection: collectionName 
        });

    } catch (error) {
        console.error("Erro ao aplicar sugestão:", error);
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
            return res.json({ summary: "Ainda não há dados suficientes para um resumo estratégico." });
        }

        if (!anthropic) {
            return res.status(503).json({ 
                error: 'Serviço de Inteligência temporariamente indisponível (SDK não inicializada).' 
            });
        }

        const prompt = `
            Analise as seguintes ${notes.length} observações operacionais e gere um "Resumo Estratégico Semanal" curto e direto (máx 3 parágrafos).
            Identifique padrões de falha, gargalos ou oportunidades de melhoria.
            
            Observações:
            ${notes.join('\n- ')}
        `;

        const message = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20240620",
            max_tokens: 1000,
            system: "Você é um consultor de estratégia sênior. Responda em Português de forma profissional.",
            messages: [{ role: "user", content: prompt }],
        });

        res.json({ summary: message.content[0].text });

    } catch (error) {
        console.error("Erro ao gerar resumo estratégico:", error);
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
            critical: docs.filter(d => d.analysis?.urgency === 'critical').length,
            applied: docs.filter(d => d.applied).length,
            opportunities: docs.filter(d => d.analysis?.sentiment === 'positive').length
        };

        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
    }
});

/**
 * @route   GET /api/intel/config
 */

export default router;
