import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuração para __dirname em ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import intelRoutes from './routes/intel.js';

const app = express();
app.use(express.json()); // Suporte a JSON no body

// Pega a porta do Cloud Run
const PORT = Number(process.env.PORT) || 8080;

// Rotas da API
console.log("🚀 Verificando chaves de API...");
const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

if (!hasAnthropicKey) {
  console.warn("⚠️ AVISO: ANTHROPIC_API_KEY não detectada. O módulo Intel funcionará em modo limitado.");
} else {
  console.log("✅ ANTHROPIC_API_KEY detectada.");
}

// Endpoint de Saúde
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            firebase: 'connected', // Se chegou aqui, o admin inicializou
            anthropic: hasAnthropicKey ? 'ready' : 'missing_key'
        },
        uptime: process.uptime()
    });
});

app.use('/api/intel', intelRoutes);

// 1. IMPORTANTE: Serve APENAS os arquivos estáticos da pasta 'dist'
// Isso garante que o navegador pegue o JS compilado, não o source .tsx
app.use(express.static(path.join(__dirname, 'dist')));

// 2. Rota Coringa: Qualquer coisa que não seja arquivo estático, 
// manda o index.html da pasta DIST (e não da raiz)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n📦 MGR CONECT SERVICES INITIALIZED`);
  console.table([
    { Module: 'Express Server', Status: 'Online', Port: PORT },
    { Module: 'Firebase Admin', Status: 'Connected' },
    { Module: 'Intel API (Claude)', Status: hasAnthropicKey ? 'Enabled' : 'Disabled' },
    { Module: 'Environment', Status: process.env.NODE_ENV || 'production' }
  ]);
  console.log(`🚀 Servidor rodando em http://0.0.0.0:${PORT}\n`);
});