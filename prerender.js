import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { extname } from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.join(__dirname, 'public-site');

const PAGES = [
  'index.html',
  'manutencao-corretiva.html',
  'anti-downtime.html',
  'turnkey-completo.html',
  'retrofit-turnkey.html',
  'solucoes-mgr.html',
  'sobre.html',
  'trabalhe-conosco.html',
];

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.jsx': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};

// Servidor local para servir os arquivos
const server = createServer((req, res) => {
  let filePath = path.join(SITE_DIR, req.url === '/' ? 'index.html' : req.url);
  // Remove query strings
  filePath = filePath.split('?')[0];
  const ext = extname(filePath) || '.html';
  try {
    const content = readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

async function prerender() {
  await new Promise(resolve => server.listen(7788, resolve));
  console.log('Servidor local em http://localhost:7788');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const page of PAGES) {
    const p = await browser.newPage();
    const url = `http://localhost:7788/${page}`;
    console.log(`Renderizando: ${url}`);

    await p.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    // Aguarda React renderizar
    await new Promise(r => setTimeout(r, 2000));

    const html = await p.content();
    const outPath = path.join(SITE_DIR, page);
    fs.writeFileSync(outPath, html, 'utf-8');
    console.log(`  ✓ Salvo: ${page}`);
    await p.close();
  }

  await browser.close();
  server.close();
  console.log('\nPré-renderização concluída!');
}

prerender().catch(err => {
  console.error('Erro:', err);
  server.close();
  process.exit(1);
});
