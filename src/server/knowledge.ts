import { Router } from "express";
import multer from "multer";
import { getAuth } from "firebase-admin/auth";
import mammoth from "mammoth";
import _pdfParseModule from "pdf-parse/lib/pdf-parse.js";
import zlib from "zlib";
import { ai, verifyAuthToken } from "./firebase-ai.js";

const pdfParse = typeof _pdfParseModule === "function" ? _pdfParseModule : (_pdfParseModule as any).default;

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Robust fallback PDF text extractor
function extractTextFallback(buffer: Buffer): string {
  const content = buffer.toString("binary");
  let extractedText = "";
  
  // Find all stream objects
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match;
  
  while ((match = streamRegex.exec(content)) !== null) {
    let streamData = match[1];
    let streamBuffer = Buffer.from(streamData, "binary");
    
    // Try FlateDecode decompress
    let decompressed: Buffer | null = null;
    try {
      decompressed = zlib.unzipSync(streamBuffer);
    } catch (e) {
      try {
        decompressed = zlib.inflateSync(streamBuffer);
      } catch (e2) {
        // Not compressed or failed to decompress
      }
    }
    
    const textToParse = decompressed ? decompressed.toString("utf8") : streamData;
    
    // Extract strings in parentheses (e.g. (Hello World) Tj)
    const textRegex = /\(([^)]+)\)\s*(Tj|TJ|T\*|Td|TD|Do)/g;
    let textMatch;
    while ((textMatch = textRegex.exec(textToParse)) !== null) {
      const cleanText = textMatch[1]
        .replace(/\\([\d]{3})/g, (m, c) => String.fromCharCode(parseInt(c, 8))) // octal escapes
        .replace(/\\(.)/g, "$1"); // standard escapes
      extractedText += cleanText + " ";
    }
    
    // Also extract strings from array-brackets like [(Hel) -5 (lo) -3 (World)] TJ
    const bracketRegex = /\[([^\]]+)\]\s*(TJ)/g;
    let bracketMatch;
    while ((bracketMatch = bracketRegex.exec(textToParse)) !== null) {
      const bracketContent = bracketMatch[1];
      const innerRegex = /\(([^)]+)\)/g;
      let innerMatch;
      while ((innerMatch = innerRegex.exec(bracketContent)) !== null) {
        const cleanText = innerMatch[1]
          .replace(/\\([\d]{3})/g, (m, c) => String.fromCharCode(parseInt(c, 8)))
          .replace(/\\(.)/g, "$1");
        extractedText += cleanText;
      }
      extractedText += " ";
    }
  }
  
  return extractedText.replace(/\s+/g, " ").trim();
}

async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    const pdfData = await pdfParse(buffer);
    if (pdfData && pdfData.text && pdfData.text.trim().length > 0) {
      return pdfData.text;
    }
  } catch (err) {
    console.warn("pdf-parse failed, trying robust fallback parser:", err);
  }
  
  try {
    const fallbackText = extractTextFallback(buffer);
    if (fallbackText.length > 0) {
      return fallbackText;
    }
    throw new Error("No text content could be extracted.");
  } catch (fallbackErr: any) {
    console.error("Fallback PDF parser failed:", fallbackErr);
    throw new Error("Failed to parse PDF document: " + fallbackErr.message);
  }
}

export function splitIntoChunks(text: string, maxChars = 1e3): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = i + maxChars;
    if (end < text.length) {
      let nextSpace = text.indexOf(" ", end);
      let prevSpace = text.lastIndexOf(" ", end);
      if (prevSpace > i) {
        end = prevSpace;
      } else if (nextSpace !== -1 && nextSpace < end + 50) {
        end = nextSpace;
      }
    }
    chunks.push(text.substring(i, end).trim());
    i = end + 1;
  }
  return chunks.filter((c) => c.length > 0);
}

router.post("/api/upload_knowledge", upload.single("file"), async (req, res) => {
  try {
    const token = req.body.token;
    if (!token) {
      return res.status(401).json({ detail: "No authentication token provided" });
    }
    const decodedToken = await verifyAuthToken(token);
    if (!decodedToken) {
      return res.status(401).json({ detail: "Invalid authentication token or failed to verify" });
    }
    if (decodedToken.email !== "info.experientialholidays@gmail.com") {
      return res.status(403).json({ detail: "Forbidden: Admin access required." });
    }
    if (!req.file) {
      return res.status(400).json({ detail: "No file uploaded" });
    }
    const filename = req.file.originalname || "knowledge_doc";
    let extractedText = "";
    try {
      if (filename.toLowerCase().endsWith(".pdf")) {
        extractedText = await parsePDF(req.file.buffer);
      } else if (filename.toLowerCase().endsWith(".docx")) {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        extractedText = result.value;
      } else {
        extractedText = req.file.buffer.toString("utf8");
      }
    } catch (parseErr: any) {
      console.error("Document parse error:", parseErr);
      return res.status(400).json({ detail: "Failed to parse document content: " + parseErr.message });
    }
    if (!extractedText || extractedText.trim() === "") {
      return res.status(400).json({ detail: "Could not extract text from document." });
    }
    const chunks = splitIntoChunks(extractedText, 1e3);
    const embeddedChunks = [];
    for (const chunk of chunks) {
      const embedRes = await ai.models.embedContent({
        model: "gemini-embedding-2-preview",
        contents: chunk,
        config: { outputDimensionality: 768 }
      });
      const vector = embedRes.embeddings?.[0]?.values;
      if (vector) {
        embeddedChunks.push({ text: chunk, embeddingVector: vector });
      }
    }
    return res.json({
      filename,
      fullTextLength: extractedText.length,
      chunks: embeddedChunks
    });
  } catch (e: any) {
    console.error("upload_knowledge error:", e);
    return res.status(500).json({ detail: "Internal server error during upload: " + (e.message || e) });
  }
});

export default router;
