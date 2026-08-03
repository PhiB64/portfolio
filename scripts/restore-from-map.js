const fs = require('fs');
const path = require('path');
const chunksDir = path.join(__dirname, '..', '.next', 'dev', 'static', 'chunks');
if (!fs.existsSync(chunksDir)) {
  console.error('chunks dir not found:', chunksDir);
  process.exit(1);
}
const files = fs.readdirSync(chunksDir).filter(f => f.endsWith('.map'));
if (!files.length) {
  console.error('no .map files found in', chunksDir);
  process.exit(2);
}
let found = false;
for (const f of files) {
  const p = path.join(chunksDir, f);
  try {
    const map = JSON.parse(fs.readFileSync(p, 'utf8'));
    const sources = map.sources || [];
    const idx = sources.findIndex(s => s.endsWith('/components/hero-cube.jsx') || s.endsWith('components/hero-cube.jsx'));
    if (idx >= 0) {
      const content = (map.sourcesContent || [])[idx];
      if (content) {
        const outPath = path.join(__dirname, '..', 'components', 'hero-cube.jsx');
        fs.writeFileSync(outPath, content, 'utf8');
        console.log('restored', outPath, 'from', f, 'length', content.length);
        found = true;
        break;
      }
    }
  } catch (err) {
    // ignore parse errors
  }
}
if (!found) {
  console.error('component source not found in any map');
  process.exit(3);
}
