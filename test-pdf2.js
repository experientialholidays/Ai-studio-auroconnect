import _pdfParseModule from "pdf-parse/lib/pdf-parse.js";
const pdfParse = typeof _pdfParseModule === "function" ? _pdfParseModule : _pdfParseModule.default;
import fs from "fs";

async function run() {
  try {
    const buf = fs.readFileSync("dummy.pdf");
    const res = await pdfParse(buf);
    console.log(res.text);
  } catch (e) {
    console.error("ERROR", e);
  }
}
run();
