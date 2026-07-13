import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';

const htmlPath = process.argv[2];
const outDir = process.argv[3];
mkdirSync(outDir, { recursive: true });

const html = readFileSync(htmlPath, 'utf8');
const m = html.match(/<script type="__bundler\/manifest">\s*([\s\S]*?)<\/script>/);
if (!m) throw new Error('manifest not found');
const manifest = JSON.parse(m[1]);

const t = html.match(/<script type="__bundler\/template">\s*([\s\S]*?)<\/script>/);
const template = t ? JSON.parse(t[1]) : '';
writeFileSync(join(outDir, 'template.html'), template);

// Map uuid -> src order from the template so modules keep load order
const order = [...template.matchAll(/src="([0-9a-f-]{36})"/g)].map(x => x[1]);

const summary = [];
for (const [uuid, entry] of Object.entries(manifest)) {
  const { mime, compressed, data } = entry;
  let buf = Buffer.from(data, 'base64');
  if (compressed) buf = gunzipSync(buf);
  const idx = order.indexOf(uuid);
  const isText = /javascript|jsx|json|css|html|svg|text/.test(mime);
  const ext = /font|woff/.test(mime) ? 'woff2' : mime.includes('css') ? 'css' : 'js';
  const name = (idx >= 0 ? String(idx).padStart(2, '0') + '-' : 'asset-') + uuid.slice(0, 8) + '.' + ext;
  if (isText) writeFileSync(join(outDir, name), buf);
  summary.push({ name, uuid, mime, bytes: buf.length, inTemplate: idx });
}
summary.sort((a, b) => (a.inTemplate === -1) - (b.inTemplate === -1) || a.inTemplate - b.inTemplate);
console.table(summary);
