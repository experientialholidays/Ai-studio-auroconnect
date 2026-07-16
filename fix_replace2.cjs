const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex2 = /let out = \[\];\n    events\.forEach\(\(data, index\) => \{[\s\S]*?out\.push\(""\);\n    \}\);\n    return out\.join\("\\n"\);/g;

code = code.replace(regex2, `let out = [];
    events.forEach((data, index) => {
        out.push(formatEventHTML(data));
        out.push("");
    });
    return out.join("\\n");`);

fs.writeFileSync('server.ts', code);
