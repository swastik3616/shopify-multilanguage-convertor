const fs = require('fs');
const zlib = require('zlib');
const { execSync } = require('child_process');
const versions = [
  '2025.10.0',
  '2025.10.1',
  '2025.10.2',
  '2025.10.5',
  '2025.10.10',
  '2025.10.15',
  '2025.10.0-rc.15',
  '2025.10.0-rc.40'
];

function inspectTarball(file) {
  const buf = fs.readFileSync(file);
  const tar = zlib.gunzipSync(buf);
  const names = [];
  for (let i = 0; i < tar.length; i += 512) {
    const header = tar.slice(i, i + 512);
    const name = header.slice(0, 100).toString('utf8').replace(/\0.*$/s, '');
    if (!name) break;
    names.push(name);
  }
  const hits = names.filter(n => /admin\.app\.home|app\.home|home\.render/.test(n));
  const targets = names.filter(n => n.includes('surfaces/admin/targets/') || n.includes('surfaces/admin/targets\\'));
  return { count: hits.length, hits, targetCount: targets.length, targets: targets.slice(0, 40) };
}

for (const version of versions) {
  try {
    console.log('===', version, '===');
    const output = execSync(`npm pack @shopify/ui-extensions@${version}`, { encoding: 'utf8' }).trim();
    const file = output.split('\n').pop().trim();
    const result = inspectTarball(file);
    console.log('hits', result.count);
    result.hits.slice(0, 50).forEach(h => console.log('hit', h));
    console.log('targets', result.targetCount);
    result.targets.forEach(t => console.log('target', t));
    fs.unlinkSync(file);
  } catch (error) {
    console.error('ERROR', version, error.message);
  }
}
