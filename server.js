import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuração para __dirname em ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Pega a porta do Cloud Run
const PORT = process.env.PORT || 8080;

// 1. IMPORTANTE: Serve APENAS os arquivos estáticos da pasta 'dist'
// Isso garante que o navegador pegue o JS compilado, não o source .tsx
app.use(express.static(path.join(__dirname, 'dist')));

// 2. Rota Coringa: Qualquer coisa que não seja arquivo estático, 
// manda o index.html da pasta DIST (e não da raiz)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});