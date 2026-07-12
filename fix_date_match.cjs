const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex3 = /\}[\s]*return isDateMatch;\n[\s]*\}\);/g;

code = code.replace(regex3, `}
                if (isDateMatch && filterDate === timeInfo.dateStr) {
                    if (isEventEnded(data, timeInfo.time24)) {
                        isDateMatch = false; // Exclude events that have already ended today
                    }
                }
                return isDateMatch;
      });`);

fs.writeFileSync('server.ts', code);
