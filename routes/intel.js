import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { dbAdmin, admin } from '../firebase-admin.js';

const router = express.Router();

let gemini = null;
try {
    if (process.env.GEMINI_API_KEY) {
        gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } else {
        console.warn("Módulo Intel: GEMINI_API_KEY ausente. SDK não inicializada.");
    }
} catch (error) {
    console.error("Erro ao inicializar SDK Gemini:", error);
}

const MGR_INTEL_PROMPT = `Você é o analista estratégico da MGR Soluções em Refrigeração Industrial.
Empresa: 10 anos de mercado, refrigeração industrial, câmaras frigoríficas (walk-in coolers).
Setores: Comercial (Giovanni), Técnico, Administrativo, Compras, Gestão (Miguel - sócio).
Processos mapeados: Atendimento Comercial, Execução de Projetos, Compra de Materiais, Manutenção Preventiva, Handoff Comercial→Adm.
Ferramentas de gestão disponíveis: Matriz Eisenhower, Espinha de Peixe (Ishikawa), Business Model Canvas, Processos BPMN, Roadmap de execução.

Analise a nota e retorne APENAS um JSON válido (sem markdown, sem explicações extras) com esta estrutura:
{
  "tipo": "acao"|"fraqueza"|"oportunidade"|"processo"|"meta"|"alerta",
  "destino": "eisenhower"|"ishikawa"|"canvas"|"bpmn"|"roadmap",
  "area": "comercial"|"financeiro"|"operacional"|"rh"|"processos"|"geral",
  "sentimento": "alerta"|"oportunidade"|"neutra",
  "urgencia": "critica"|"alta"|"media"|"baixa",
  "resumo": "Uma frase de até 80 caracteres explicando o impacto",
  "acao_sugerida": "Ação concreta em até 90 caracteres",
  "tags": ["max 3 palavras-chave"],
  "eisenhower": {
    "quadrante": "do"|"plan"|"dele"|"elim",
    "titulo": "Título do item para a matriz (max 60 chars)",
    "responsavel": "Nome ou setor responsável",
    "prazo": "Prazo estimado"
  },
  "ishikawa": {
    "categoria": "Pessoas"|"Processos"|"Comunicação"|"Ferramentas"|"Gestão"|"Cultura",
    "causa": "Descrição da causa (max 70 chars)"
  },
  "canvas": {
    "celula": "parceiros"|"atividades"|"recursos"|"proposta"|"relacionamento"|"canais"|"clientes"|"custos"|"receitas",
    "conteudo": "Conteúdo a adicionar na célula (max 80 chars)"
  },
  "bpmn": {
    "processo": "atendimento-comercial"|"execucao-projetos"|"compra-materiais"|"manutencao-preventiva"|"handoff-comercial"|"novo",
    "task": "Nome da tarefa/etapa a adicionar (max 50 chars)",
    "novo_processo": "Nome do novo processo (se tipo=novo)"
  },
  "roadmap": {
    "fase": 1|2|3,
    "titulo": "Título da etapa do roadmap (max 60 chars)",
    "responsavel": "Responsável",
    "prazo": "Prazo estimado"
  }
}

Regras de roteamento:
- fraqueza / problema / risco → destino: "ishikawa"
- oportunidade / vantagem → destino: "canvas"
- acao / tarefa / melhoria urgente → destino: "eisenhower"
- fluxo / etapa / subprocesso → destino: "bpmn"
- objetivo / meta / prazo longo → destino: "roadmap"

Preencha TODOS os campos de TODOS os destinos. Não inclua explicações extras, apenas o JSON.`;


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
        // 1. Chamada ao Gemini 2.0 Flash
        const result = await gemini.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: `${MGR_INTEL_PROMPT}\n\nNota do usuário:\n${text}`,
        });

        const raw = result.text || '{}';

        // 2. Parse da resposta
        let analysis;
        try {
            analysis = JSON.parse(raw.replace(/```json|```/g, '').trim());
        } catch (parseError) {
            console.error("Erro ao fazer parse do JSON do Gemini:", raw);
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
            model: 'gemini-2.0-flash',
            contents: prompt,
        });

        res.json({ summary: result.text });

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
        res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
    }
});

/**
 * @route   GET /api/intel/config
 */

export default router;
