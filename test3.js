import _pdfParseModule from "pdf-parse/lib/pdf-parse.js";
const pdfParse = typeof _pdfParseModule === "function" ? _pdfParseModule : _pdfParseModule.default;
console.log(typeof pdfParse);
