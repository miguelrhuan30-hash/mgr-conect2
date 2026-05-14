import sharp from 'sharp';
import { readdir, stat } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, '..', 'public-site', 'assets');

const files = await readdir(assetsDir);
let converted = 0;
let skipped = 0;

for (const file of files) {
  // Skip OG image (social crawlers may not support WebP) and already-converted
  if (file.startsWith('og-image') || file.endsWith('.webp')) { skipped++; continue; }
  if (!file.match(/\.(png|jpg|jpeg)$/i)) { skipped++; continue; }

  const input = path.join(assetsDir, file);
  const outputName = file.replace(/\.(png|jpg|jpeg)$/i, '.webp');
  const output = path.join(assetsDir, outputName);

  // Skip if already exists and is newer
  try {
    const [inStat, outStat] = await Promise.all([stat(input), stat(output)]);
    if (outStat.mtimeMs >= inStat.mtimeMs) { console.log(`⏭  ${outputName} (já existe)`); skipped++; continue; }
  } catch (_) { /* output doesn't exist yet */ }

  await sharp(input).webp({ quality: 85, effort: 4 }).toFile(output);
  const [inStat, outStat] = await Promise.all([stat(input), stat(output)]);
  const saving = Math.round((1 - outStat.size / inStat.size) * 100);
  console.log(`✓ ${file} → ${outputName}  (${saving}% menor)`);
  converted++;
}

console.log(`\nPronto: ${converted} convertidas, ${skipped} puladas.`);
