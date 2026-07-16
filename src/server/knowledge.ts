import { Router } from "express";
import multer from "multer";
import { getAuth } from "firebase-admin/auth";
import mammoth from "mammoth";
import _pdfParseModule from "pdf-parse/lib/pdf-parse.js";
import zlib from "zlib";
import { writeBatch, collection, doc, serverTimestamp } from "firebase/firestore";
import { ai, verifyAuthToken, db } from "./firebase-ai.js";

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
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendProgress = (percent: number, message: string, log: string = "") => {
    console.log(`[Knowledge Upload Progress] ${percent}%: ${message} - ${log}`);
    res.write(JSON.stringify({ type: "progress", percent, message, log }) + "\n");
  };
  const sendSuccess = (message: string, detail: string = "") => {
    console.log(`[Knowledge Upload Success] ${message} - ${detail}`);
    res.write(JSON.stringify({ type: "success", message, detail }) + "\n");
    res.end();
  };
  const sendError = (status: number, message: string) => {
    console.error(`[Knowledge Upload Error] Status ${status}: ${message}`);
    res.write(JSON.stringify({ type: "error", message }) + "\n");
    res.end();
  };

  try {
    const token = req.body.token;
    if (!token) {
      return sendError(401, "No authentication token provided");
    }
    
    sendProgress(5, "Verifying authentication...", "Verifying authorization token");
    const decodedToken = await verifyAuthToken(token);
    if (!decodedToken) {
      return sendError(401, "Invalid authentication token or failed to verify");
    }
    if (decodedToken.email !== "info.experientialholidays@gmail.com") {
      return sendError(403, "Forbidden: Admin access required.");
    }
    if (!req.file) {
      return sendError(400, "No file uploaded");
    }

    const filename = req.file.originalname || "knowledge_doc";
    sendProgress(15, `Extracting text from ${filename}...`, `Detecting file format. Size: ${req.file.size} bytes`);
    
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
      return sendError(400, "Failed to parse document content: " + parseErr.message);
    }

    if (!extractedText || extractedText.trim() === "") {
      return sendError(400, "Could not extract text from document.");
    }

    sendProgress(30, "Splitting document text into chunks...", `Extracted ${extractedText.length} characters of raw text`);
    const chunks = splitIntoChunks(extractedText, 1e3);
    sendProgress(35, `Split complete: ${chunks.length} chunks generated.`, "Starting chunk embedding generation...");

    const embeddedChunks = [];
    const batchSize = 15; // Embedding batch size to stay within token & rate limits
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embedPercent = Math.min(85, 35 + Math.round((i / chunks.length) * 45));
      sendProgress(
        embedPercent, 
        `Generating embeddings (chunks ${i + 1}-${Math.min(chunks.length, i + batchSize)} of ${chunks.length})...`, 
        `Requesting embeddings for batch of ${batch.length} chunks`
      );

      try {
        const embedRes = await ai.models.embedContent({
          model: "gemini-embedding-2-preview",
          contents: batch,
          config: { outputDimensionality: 768 }
        });
        
        const embeddings = embedRes.embeddings;
        if (embeddings && embeddings.length > 0) {
          for (let j = 0; j < batch.length; j++) {
            const vector = embeddings[j]?.values;
            if (vector) {
              embeddedChunks.push({ text: batch[j], embeddingVector: vector });
            }
          }
        }
      } catch (err: any) {
        console.warn(`Batch embedding failed, trying individual fallback for batch starting at index ${i}:`, err);
        // Fallback: individual embedding
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          try {
            const embedRes = await ai.models.embedContent({
              model: "gemini-embedding-2-preview",
              contents: chunk,
              config: { outputDimensionality: 768 }
            });
            const vector = embedRes.embeddings?.[0]?.values;
            if (vector) {
              embeddedChunks.push({ text: chunk, embeddingVector: vector });
            }
          } catch (indivErr: any) {
            console.error(`Individual embedding failed for chunk ${i + j}:`, indivErr);
          }
        }
      }
    }

    if (embeddedChunks.length === 0) {
      return sendError(500, "Failed to generate any embeddings for the document.");
    }

    sendProgress(85, `Writing ${embeddedChunks.length} chunks to knowledge base...`, "Initializing Firestore write batch");
    
    const dbBatchSize = 250;
    let chunkCount = 0;
    const uploadedBy = decodedToken.email;

    for (let i = 0; i < embeddedChunks.length; i += dbBatchSize) {
      const batchChunk = embeddedChunks.slice(i, i + dbBatchSize);
      const writePercent = Math.min(98, 85 + Math.round((i / embeddedChunks.length) * 13));
      sendProgress(
        writePercent,
        `Saving knowledge chunks (${i + 1} to ${Math.min(embeddedChunks.length, i + dbBatchSize)})...`,
        `Committing batch of ${batchChunk.length} chunks to Firestore`
      );

      const batch = writeBatch(db);
      for (const item of batchChunk) {
        const newDocRef = doc(collection(db, "knowledge"));
        batch.set(newDocRef, {
          filename,
          text: item.text,
          embeddingVector: item.embeddingVector,
          uploadedAt: serverTimestamp(),
          uploadedBy,
          chunkIndex: chunkCount
        });
        chunkCount++;
      }
      await batch.commit();
    }

    sendProgress(99, "Finalizing knowledge base ingestion...", "All chunks saved and indexed");
    return sendSuccess(
      `Successfully uploaded and indexed knowledge document: ${filename}`, 
      `Created ${chunkCount} knowledge base entries. Total chars: ${extractedText.length}`
    );

  } catch (e: any) {
    console.error("upload_knowledge error:", e);
    return sendError(500, "Internal server error during upload: " + (e.message || e));
  }
});

export default router;
