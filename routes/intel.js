import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { dbAdmin, admin } from '../firebase-admin.js';

const router = express.Router();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
 * @route   GET /api/intel/config

export default router;
