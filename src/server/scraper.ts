import { Router } from "express";
import { getAuth } from "firebase-admin/auth";
import * as cheerio from "cheerio";
import { FieldValue } from "firebase-admin/firestore";
import { ai, verifyAuthToken, adminDb } from "./firebase-ai.js";
import { splitIntoChunks } from "./knowledge.js";

const router = Router();

router.post("/api/add_url_knowledge", async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendProgress = (percent: number, message: string, log: string = "") => {
    console.log(`[Web Scraping Progress] ${percent}%: ${message} - ${log}`);
    res.write(JSON.stringify({ type: "progress", percent, message, log }) + "\n");
  };
  const sendSuccess = (message: string, detail: string = "") => {
    console.log(`[Web Scraping Success] ${message} - ${detail}`);
    res.write(JSON.stringify({ type: "success", message, detail }) + "\n");
    res.end();
  };
  const sendError = (status: number, message: string) => {
    console.error(`[Web Scraping Error] Status ${status}: ${message}`);
    res.write(JSON.stringify({ type: "error", message }) + "\n");
    res.end();
  };

  try {
    const { token, url } = req.body;
    if (!token) return sendError(401, "No authentication token provided");
    if (!url) return sendError(400, "No URL provided");
    
    sendProgress(5, "Verifying authentication...", "Verifying authorization token");
    const decodedToken = await verifyAuthToken(token);
    if (!decodedToken) {
      return sendError(401, "Invalid authentication token or failed to verify");
    }
    if (decodedToken.email !== "info.experientialholidays@gmail.com") {
      return sendError(403, "Forbidden: Admin access required.");
    }

    sendProgress(15, `Fetching webpage content...`, `Requesting URL: ${url}`);
    const fetchResponse = await fetch(url);
    if (!fetchResponse.ok) {
      return sendError(400, `Failed to fetch URL: ${fetchResponse.statusText}`);
    }
    
    sendProgress(25, "Extracting text content...", "Parsing HTML response");
    const html = await fetchResponse.text();
    const $ = cheerio.load(html);
    $("script, style, nav, footer, header").remove();
    const extractedText = $("body").text().replace(/\s+/g, " ").trim();
    if (!extractedText) {
      return sendError(400, "Could not extract any visible text from URL.");
    }

    sendProgress(35, "Splitting text into chunks...", `Extracted ${extractedText.length} characters of webpage text`);
    const chunks = splitIntoChunks(extractedText, 1000);
    sendProgress(40, `Split complete: ${chunks.length} chunks generated.`, "Starting chunk embedding generation...");

    const embeddedChunks = [];
    const batchSize = 15;
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embedPercent = Math.min(85, 40 + Math.round((i / chunks.length) * 45));
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
        console.warn(`Batch embedding failed for scraper URL chunk, trying individual fallback:`, err);
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
            console.error(`Scraper individual embedding failed for chunk ${i + j}:`, indivErr);
          }
        }
      }
    }

    if (embeddedChunks.length === 0) {
      return sendError(500, "Failed to generate any embeddings for the webpage content.");
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

      const batch = adminDb.batch();
      for (const item of batchChunk) {
        const newDocRef = adminDb.collection("knowledge").doc();
        batch.set(newDocRef, {
          filename: url,
          text: item.text,
          embeddingVector: item.embeddingVector,
          uploadedAt: FieldValue.serverTimestamp(),
          uploadedBy,
          chunkIndex: chunkCount
        });
        chunkCount++;
      }
      await batch.commit();
    }

    sendProgress(99, "Finalizing webpage knowledge ingestion...", "All chunks saved and indexed");
    return sendSuccess(`Successfully scraped and indexed webpage: ${url}`, `Created ${chunkCount} knowledge base entries. Total chars: ${extractedText.length}`);

  } catch (e: any) {
    console.error("add_url_knowledge error:", e);
    return sendError(500, "Internal server error during URL processing: " + (e.message || e));
  }
});

export default router;
