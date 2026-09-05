import { Router } from "express";
import { getAuth } from "firebase-admin/auth";
import * as cheerio from "cheerio";
import { FieldValue } from "firebase-admin/firestore";
import { ai, verifyAuthToken, adminDb, isUserAdmin } from "./firebase-ai.js";
import { splitIntoChunks } from "./knowledge.js";

const router = Router();

const IGNORED_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".pdf", ".zip", ".tar", ".gz",
  ".mp3", ".mp4", ".wav", ".avi", ".mov", ".ppt", ".pptx", ".doc", ".docx",
  ".xls", ".xlsx", ".json", ".xml", ".css", ".js", ".webp"
];

function isHtmlFriendly(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const pathname = parsed.pathname.toLowerCase();
    for (const ext of IGNORED_EXTENSIONS) {
      if (pathname.endsWith(ext)) return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

function extractSameSiteLinks(html: string, currentUrl: string, baseHost: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];
  $("a").each((_, elem) => {
    let href = $(elem).attr("href");
    if (!href) return;
    href = href.trim();
    if (
      !href || 
      href.startsWith("#") || 
      href.startsWith("javascript:") || 
      href.startsWith("mailto:") || 
      href.startsWith("tel:")
    ) {
      return;
    }
    try {
      const resolved = new URL(href, currentUrl);
      if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return;
      
      const resolvedHost = resolved.hostname.replace(/^www\./, "");
      if (resolvedHost === baseHost) {
        resolved.hash = ""; // Strip fragment
        let cleanUrl = resolved.toString();
        if (cleanUrl.endsWith("/")) {
          cleanUrl = cleanUrl.slice(0, -1);
        }
        links.push(cleanUrl);
      }
    } catch (e) {
      // Ignore invalid URLs
    }
  });
  return Array.from(new Set(links));
}

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
    const { token, url, deep } = req.body;
    if (!token) return sendError(401, "No authentication token provided");
    if (!url) return sendError(400, "No URL provided");
    
    sendProgress(5, "Verifying authentication...", "Verifying authorization token");
    const decodedToken = await verifyAuthToken(token);
    if (!decodedToken) {
      return sendError(401, "Invalid authentication token or failed to verify");
    }
    const userEmail = decodedToken.email ? decodedToken.email.toLowerCase() : "";
    const isAdmin = await isUserAdmin(userEmail);
    if (!isAdmin) {
      return sendError(403, "Forbidden: Admin access required.");
    }

    let normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = "https://" + normalizedUrl;
    }

    let baseHost = "";
    try {
      baseHost = new URL(normalizedUrl).hostname.replace(/^www\./, "");
    } catch (err) {
      return sendError(400, "Invalid URL format.");
    }

    const isDeep = deep === true;
    const maxPages = isDeep ? 15 : 1;

    const visited = new Set<string>();
    const queue: string[] = [normalizedUrl];
    const allExtracted: { sourceUrl: string; text: string }[] = [];

    sendProgress(10, `Starting crawl of ${normalizedUrl}...`, isDeep ? "Deep crawl enabled. Finding same-site subpages..." : "Single-page mode.");

    while (queue.length > 0 && visited.size < maxPages) {
      const currentUrl = queue.shift()!;
      const normCheck = currentUrl.endsWith("/") ? currentUrl.slice(0, -1) : currentUrl;
      
      if (visited.has(normCheck)) continue;
      visited.add(normCheck);

      const pageNum = visited.size;
      const progressPercent = Math.min(35, 10 + Math.round((pageNum / maxPages) * 25));
      sendProgress(
        progressPercent,
        `Crawling page ${pageNum} of ${maxPages}...`,
        `Scraping content from: ${currentUrl}`
      );

      try {
        const fetchResponse = await fetch(currentUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AuroConnectCrawler/1.0"
          },
          signal: AbortSignal.timeout(8000)
        });

        if (!fetchResponse.ok) {
          console.warn(`Failed to fetch ${currentUrl}: ${fetchResponse.statusText}`);
          continue;
        }

        const contentType = fetchResponse.headers.get("content-type") || "";
        if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
          console.log(`Skipping non-HTML resource: ${currentUrl} (${contentType})`);
          continue;
        }

        const html = await fetchResponse.text();
        const $ = cheerio.load(html);
        
        $("script, style, nav, footer, header, iframe, noscript").remove();
        const extractedText = $("body").text().replace(/\s+/g, " ").trim();
        
        if (extractedText) {
          allExtracted.push({ sourceUrl: currentUrl, text: extractedText });
          console.log(`Successfully scraped: ${currentUrl} (${extractedText.length} chars)`);
        }

        if (isDeep && visited.size < maxPages) {
          const foundLinks = extractSameSiteLinks(html, currentUrl, baseHost);
          let newLinksCount = 0;
          for (const link of foundLinks) {
            const lCheck = link.endsWith("/") ? link.slice(0, -1) : link;
            if (!visited.has(lCheck) && !queue.includes(link) && isHtmlFriendly(link)) {
              queue.push(link);
              newLinksCount++;
            }
          }
        }
      } catch (err: any) {
        console.error(`Error crawling ${currentUrl}:`, err);
      }

      await new Promise(r => setTimeout(r, 150));
    }

    if (allExtracted.length === 0) {
      return sendError(400, "Could not extract any visible text from the specified URL or subpages.");
    }

    const totalLength = allExtracted.reduce((acc, curr) => acc + curr.text.length, 0);
    sendProgress(40, "Splitting text into chunks...", `Extracted a total of ${totalLength} characters across ${allExtracted.length} pages.`);

    const chunks: string[] = [];
    for (const page of allExtracted) {
      const pageChunks = splitIntoChunks(page.text, 1000);
      const prefixed = pageChunks.map(c => `[Source Page: ${page.sourceUrl}] ${c}`);
      chunks.push(...prefixed);
    }

    sendProgress(45, `Split complete: ${chunks.length} total chunks generated across all crawled pages.`, "Starting chunk embedding generation...");

    const embeddedChunks = [];
    const batchSize = 15;
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embedPercent = Math.min(85, 45 + Math.round((i / chunks.length) * 40));
      sendProgress(
        embedPercent, 
        `Generating embeddings (chunks ${i + 1}-${Math.min(chunks.length, i + batchSize)} of ${chunks.length})...`, 
        `Requesting embeddings for batch of ${batch.length} chunks`
      );

      try {
        const batchPromises = batch.map(chunk => 
          ai.models.embedContent({
            model: "gemini-embedding-2",
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
        console.warn(`Batch embedding failed for scraper URL chunk, trying individual fallback:`, err);
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          try {
            await new Promise(r => setTimeout(r, 200)); // Sleep 200ms
            const embedRes = await ai.models.embedContent({
              model: "gemini-embedding-2",
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

    sendProgress(85, `Writing ${embeddedChunks.length} chunks to knowledge base...`, "Sending chunks to browser for client-side insertion");
    const uploadedBy = decodedToken.email;
    res.write(JSON.stringify({
      type: "knowledge_chunks",
      filename: normalizedUrl, // We keep the base URL so it groups nicely in the admin table
      uploadedBy,
      chunks: embeddedChunks
    }) + "\n");
    res.end();

  } catch (e: any) {
    console.error("add_url_knowledge error:", e);
    return sendError(500, "Internal server error during URL processing: " + (e.message || e));
  }
});

export default router;
