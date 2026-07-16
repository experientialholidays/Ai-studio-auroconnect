const fs = require('fs');
const map = JSON.parse(fs.readFileSync('dist/server.cjs.map', 'utf8'));
const idx = map.sources.indexOf('server.ts');
if (idx !== -1) {
    fs.writeFileSync('server.ts', map.sourcesContent[idx]);
    console.log('Recovered server.ts successfully!');
} else {
    console.log('server.ts not found in source map!');
}
