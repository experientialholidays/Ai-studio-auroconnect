import { Router } from "express";
import { getAuth } from "firebase-admin/auth";
import * as cheerio from "cheerio";
import { ai, verifyAuthToken } from "./firebase-ai.js";
import { splitIntoChunks } from "./knowledge.js";

const router = Router();

router.post("/api/add_url_knowledge", async (req, res) => {
  try {
    const { token, url } = req.body;
    if (!token) return res.status(401).json({ detail: "No authentication token provided" });
    if (!url) return res.status(400).json({ detail: "No URL provided" });
    const decodedToken = await verifyAuthToken(token);
    if (!decodedToken) {
      return res.status(401).json({ detail: "Invalid authentication token or failed to verify" });
    }
    if (decodedToken.email !== "info.experientialholidays@gmail.com") {
      return res.status(403).json({ detail: "Forbidden: Admin access required." });
    }
    const fetchResponse = await fetch(url);
    if (!fetchResponse.ok) {
      return res.status(400).json({ detail: `Failed to fetch URL: ${fetchResponse.statusText}` });
    }
    const html = await fetchResponse.text();
    const $ = cheerio.load(html);
    $("script, style, nav, footer, header").remove();
    const extractedText = $("body").text().replace(/\s+/g, " ").trim();
    if (!extractedText) {
      return res.status(400).json({ detail: "Could not extract text from URL." });
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
      filename: url,
      fullTextLength: extractedText.length,
      chunks: embeddedChunks
    });
  } catch (e: any) {
    console.error("add_url_knowledge error:", e);
    return res.status(500).json({ detail: "Internal server error during URL processing: " + (e.message || e) });
  }
});

export default router;
