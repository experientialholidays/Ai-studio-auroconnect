const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Use regex to replace formatEvent
const regex1 = /const formatEvent = \(data: any\) => \{[\s\S]*?return s\.join\("  \\n"\);\n    \};/g;

code = code.replace(regex1, 'const formatEvent = formatEventHTML;');

fs.writeFileSync('server.ts', code);
