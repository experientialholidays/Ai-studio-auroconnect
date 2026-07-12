const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
    'let datesField = data.dates;\n    if (data.startDate) {',
    'let datesField = data.dates;\n    if (Array.isArray(datesField)) datesField = datesField.length > 0 ? datesField.join(", ") : "";\n    if (data.startDate) {'
);

fs.writeFileSync('server.ts', code);
