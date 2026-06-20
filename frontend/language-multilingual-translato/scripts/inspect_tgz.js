const fs = require('fs');
const zlib = require('zlib');

function listTgz(file) {
  const buf = fs.readFileSync(file);
  const tar = zlib.gunzipSync(buf);
  const names = [];
  for (let i = 0; i < tar.length; i += 512) {
    const header = tar.slice(i, i + 512);
    const name = header.slice(0, 100).toString('utf8').replace(/\0.*$/s, '');
    if (!name) break;
    names.push(name);
  }
  return names;
}

function find(file, pattern) {
  try {
    const names = listTgz(file);
    console.log('===', file, 'entries:', names.length);
    const hits = names.filter(n => pattern.test(n));
    hits.slice(0,200).forEach(h => console.log(h));
    if (hits.length === 0) console.log('No matches');
  } catch (e) {
    console.error('Error reading', file, e && e.message);
  }
}

const files = ['shopify-ui-extensions-2026.1.4.tgz','shopify-ui-extensions-2026.4.3.tgz'];
const pattern = /admin\.app\.home|app\.home|home\.render/;
files.forEach(f => find(f, pattern));
