// Gera og-image-mgr.jpg usando Puppeteer (render HTML → screenshot)
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    background: #0D3B5E;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    font-family: 'Inter', Arial, sans-serif;
    position: relative;
  }
  .bg-stripe {
    position: absolute; inset: 0;
    background: repeating-linear-gradient(
      135deg,
      transparent 0 40px,
      rgba(27,94,138,0.15) 40px 80px
    );
  }
  .accent {
    position: absolute; bottom: 0; left: 0; right: 0;
    height: 6px; background: #E8611A;
  }
  .content {
    position: relative; z-index: 1;
    display: flex; flex-direction: column;
    align-items: center; gap: 24px;
  }
  .logo-area {
    display: flex; align-items: center; gap: 16px;
  }
  .logo-box {
    width: 72px; height: 72px;
    background: #E8611A;
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-size: 32px; font-weight: 900; color: #fff;
    letter-spacing: -1px;
  }
  .logo-text {
    display: flex; flex-direction: column;
  }
  .logo-name {
    font-size: 42px; font-weight: 800; color: #fff;
    letter-spacing: -1px; line-height: 1;
  }
  .logo-desc {
    font-size: 14px; font-weight: 400;
    color: rgba(255,255,255,0.6);
    letter-spacing: 2px; text-transform: uppercase;
    margin-top: 4px;
  }
  .divider {
    width: 60px; height: 2px; background: #E8611A;
  }
  .tagline {
    font-size: 22px; font-weight: 500;
    color: rgba(255,255,255,0.85);
    text-align: center; max-width: 700px;
    line-height: 1.4;
  }
  .badges {
    display: flex; gap: 16px; margin-top: 8px;
  }
  .badge {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 20px; padding: 6px 16px;
    font-size: 13px; color: rgba(255,255,255,0.7);
    letter-spacing: 0.3px;
  }
</style>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap" rel="stylesheet">
</head>
<body>
  <div class="bg-stripe"></div>
  <div class="accent"></div>
  <div class="content">
    <div class="logo-area">
      <div class="logo-box">M</div>
      <div class="logo-text">
        <span class="logo-name">MGR</span>
        <span class="logo-desc">Refrigeração Industrial</span>
      </div>
    </div>
    <div class="divider"></div>
    <div class="tagline">Engenharia de Frio Industrial · Do projeto à operação contínua</div>
    <div class="badges">
      <span class="badge">+20 anos</span>
      <span class="badge">Zero Downtime</span>
      <span class="badge">SLA Contratual</span>
      <span class="badge">Indaiatuba/SP</span>
    </div>
  </div>
</body>
</html>`;

async function generateOG() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500)); // aguarda fonte carregar

  const outPath = path.join(__dirname, 'public-site', 'assets', 'og-image-mgr.jpg');
  await page.screenshot({ path: outPath, type: 'jpeg', quality: 92 });

  await browser.close();
  console.log('OG Image gerada:', outPath);
}

generateOG().catch(err => { console.error(err); process.exit(1); });
