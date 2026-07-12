import { execSync } from "child_process";
const out = execSync("npx tsx test_db2.js").toString();
console.log(out);
