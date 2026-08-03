const fs = require('fs');
const path = require('path');
const projectRoot = path.resolve(__dirname, '..');
const mapPath = path.join(projectRoot, '.next', 'dev', 'static', 'chunks', '_0cyfvjs._.js.map');
if (!fs.existsSync(mapPath)) {
  console.error('map not found', mapPath);
  process.exit(2);
}
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
let found = null;
for (const s of map.sections) {
  if (s.map && s.map.sources) {
    for (const src of s.map.sources) {
      if (src.endsWith('/components/hero-cube.jsx')) {
        found = s;
        break;
      }
    }
  }
  if (found) break;
}
if (!found) { console.error('section not found'); process.exit(3); }
const content = found.map.sourcesContent[0];
fs.writeFileSync(path.join('components','hero-cube.jsx'), content, 'utf8');
console.log('restored components/hero-cube.jsx, length', content.length);
