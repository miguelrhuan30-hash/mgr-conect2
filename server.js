import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { MGR_INTEL_PROMPT } from './constants/intel.js';

// Configuração para __dirname em ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import intelRoutes from './routes/intel.js';

const app = express();
app.use(express.json());

// Porta e chaves
const PORT = Number(process.env.PORT) || 8080;
const hasGeminiKey = !!process.env.GEMINI_API_KEY;

// Inicializa Gemini de forma resiliente
let geminiClient = null;
try {
  if (hasGeminiKey) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
} catch (err) {
  console.error('⚠️ Falha ao inicializar Gemini SDK:', err.message);
}

// ─── ENDPOINT DE SAÚDE ───────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      firebase: 'connected',
      gemini: hasGeminiKey ? 'ready' : 'missing_key',
      intel_engine: geminiClient ? 'ready' : 'disabled'
    },
    uptime: process.uptime()
  });
});

// ─── ROTA /api/intel/analisar (alias direto no server.js conforme Sprint 21) ─
app.post('/api/intel/analisar', async (req, res) => {
  const { text, userId, userName } = req.body;

  if (!text || !userId) {
    return res.status(400).json({ error: 'text e userId são obrigatórios.' });
  }

  if (!geminiClient) {
    return res.status(503).json({
      error: 'Intel Engine indisponível: GEMINI_API_KEY ausente.',
      hint: 'Configure a variável de ambiente GEMINI_API_KEY.'
    });
  }

  try {
    const result = await geminiClient.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `${MGR_INTEL_PROMPT}\n\nNota do colaborador:\n"${text}"`,
    });

    const raw = result.text || '{}';
    let analysis;
    try {
      analysis = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      throw new Error('Resposta do Gemini em formato inválido (não-JSON).');
    }

    res.json({ id: `local-${Date.now()}`, analysis, status: 'classificada' });
  } catch (err) {
    console.error('Erro em /api/intel/analisar:', err.message);
    res.status(500).json({ error: 'Falha ao analisar nota.', details: err.message });
  }
});

// ─── ROTAS DA API ─────────────────────────────────────────────────────────────
app.use('/api/intel', intelRoutes);

// ─── STATIC + SPA FALLBACK ────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ─── INICIALIZAÇÃO ────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n📦 MGR CONECT — SISTEMA INICIALIZADO\n');
  console.table([
    { Module: 'Express Server',   Status: 'Online',    Port: PORT },
    { Module: 'Firebase Admin',   Status: 'Connected', Port: '—' },
    { Module: 'Intel Engine',     Status: geminiClient ? 'Ready' : 'Disabled (no key)', Port: '—' },
    { Module: 'Gemini API',       Status: hasGeminiKey ? 'Ready' : 'Missing Key', Port: '—' },
    { Module: 'Environment',      Status: process.env.NODE_ENV || 'production', Port: '—' },
  ]);
  console.log(`\n🚀 http://0.0.0.0:${PORT}\n`);
});