import { Router } from "express";
import multer from "multer";
import { getAuth } from "firebase-admin/auth";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { FieldValue } from "firebase-admin/firestore";
import { ai, verifyAuthToken, adminDb } from "./firebase-ai.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    const data = new Uint8Array(buffer);
    const pdfDocument = await pdfjsLib.getDocument({ data }).promise;
    const numPages = pdfDocument.numPages;
    let fullText = "";
    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((item: any) => item.str);
      fullText += strings.join(" ") + "\n";
    }
    if (fullText.trim().length > 0) {
      return fullText;
    }
    throw new Error("No text content could be extracted.");
  } catch (err: any) {
    console.error("PDF parser failed:", err);
    throw new Error("Failed to parse PDF document: " + err.message);
  }
}

export function splitIntoChunks(text: string, maxChars = 2000): string[] {
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
    const chunks = splitIntoChunks(extractedText, 2000);
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
        const batchPromises = batch.map(chunk => 
          ai.models.embedContent({
            model: "gemini-embedding-2-preview",
            contents: chunk,
            config: { outputDimensionality: 768 }
          })
        );
        
        const results = await Promise.all(batchPromises);
        await new Promise(r => setTimeout(r, 1000)); // Sleep 1 second to avoid rate limits
        
        for (let j = 0; j < batch.length; j++) {
          const vector = results[j]?.embeddings?.[0]?.values;
          if (vector) {
            embeddedChunks.push({ text: batch[j], embeddingVector: vector });
          }
        }
      } catch (err: any) {
        console.warn(`Batch embedding failed, trying individual fallback for batch starting at index ${i}:`, err);
        // Fallback: individual embedding
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          try {
            await new Promise(r => setTimeout(r, 200)); // Sleep 200ms
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

    sendProgress(85, `Writing ${embeddedChunks.length} chunks to knowledge base...`, "Sending chunks to browser for client-side insertion");
    const uploadedBy = decodedToken.email;
    res.write(JSON.stringify({
      type: "knowledge_chunks",
      filename,
      uploadedBy,
      chunks: embeddedChunks
    }) + "\n");
    res.end();

  } catch (e: any) {
    console.error("upload_knowledge error:", e);
    return sendError(500, "Internal server error during upload: " + (e.message || e));
  }
});

export default router;
