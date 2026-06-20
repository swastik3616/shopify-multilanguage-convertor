const fs = require('fs');
const zlib = require('zlib');
const file = process.argv[2];
if (!file) { console.error('Usage: node inspect_single_tgz.js <file.tgz>'); process.exit(2); }
if (!fs.existsSync(file)) { console.error('File not found', file); process.exit(1); }
try {
  const buf = fs.readFileSync(file);
  const tar = zlib.gunzipSync(buf);
  const names = [];
  for (let i = 0; i < tar.length; i += 512) {
    const header = tar.slice(i, i + 512);
    const name = header.slice(0, 100).toString('utf8').replace(/\0.*$/s, '');
    if (!name) break;
    names.push(name);
  }
  console.log('entries', names.length);
  const hits = names.filter(n => /admin\.app\.home|app\.home|home\.render/.test(n));
  console.log('hits', hits.length);
  hits.forEach(h => console.log(h));  console.log('\n--- showing targets dir entries ---');
  const targets = names.filter(n => n.includes('surfaces/admin/targets/'));
  console.log('targets count', targets.length);
  targets.slice(0,200).forEach(t => console.log(t));} catch (e) {
  console.error('error', e && e.message);
  process.exit(1);
}
