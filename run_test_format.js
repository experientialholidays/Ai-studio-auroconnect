import { execSync } from "child_process";
const out = execSync("npx tsx test_format2.js").toString();
console.log(out);
