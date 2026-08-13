import { Router } from "express";
import multer from "multer";
import { getAuth } from "firebase-admin/auth";
import { read, utils } from "xlsx";
import { adminDb, verifyAuthToken, ai, isUserAdmin } from "./firebase-ai.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/api/upload_events", upload.single("file"), async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendProgress = (percent: number, message: string, log: string = "") => {
    console.log(`[Excel Upload Progress] ${percent}%: ${message} - ${log}`);
    res.write(JSON.stringify({ type: "progress", percent, message, log }) + "\n");
  };
  const sendSuccess = (message: string, detail: string = "") => {
    console.log(`[Excel Upload Success] ${message} - ${detail}`);
    res.write(JSON.stringify({ type: "success", message, detail }) + "\n");
    res.end();
  };
  const sendError = (status: number, message: string) => {
    console.error(`[Excel Upload Error] Status ${status}: ${message}`);
    res.write(JSON.stringify({ type: "error", message }) + "\n");
    res.end();
  };

  try {
    const token = req.body.token;
    if (!token) {
      return sendError(401, "No authentication token provided");
    }
    
    sendProgress(5, "Verifying authentication...", "Decoding and verifying token");
    const decodedToken = await verifyAuthToken(token);
    if (!decodedToken) {
      return sendError(401, "Invalid authentication token or failed to verify");
    }
    const userEmail = decodedToken.email ? decodedToken.email.toLowerCase() : "";
    const isAdmin = await isUserAdmin(userEmail);
    if (!isAdmin) {
      return sendError(403, "Forbidden: Admin access required.");
    }
    if (!req.file) {
      return sendError(400, "No file uploaded");
    }

    sendProgress(15, "Reading uploaded Excel sheet...", `File size: ${req.file.size} bytes`);
    const workbook = read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const excelSource = req.file.originalname || "Unknown Excel";
    
    sendProgress(25, "Parsing spreadsheet content...", `Sheet name: "${sheetName}"`);
    const rawEvents = utils.sheet_to_json(sheet);
    if (rawEvents.length === 0) {
      return sendError(400, "Excel file is empty");
    }

    sendProgress(35, "Cleaning and validating events...", `Found ${rawEvents.length} raw rows`);
    const eventsToUpload = [];
    const submittedBy = decodedToken.email;
    const submittedAt = new Date().toISOString();

    const formatExcelTime = (val: any) => {
      if (typeof val === 'number' && val >= 0 && val < 1) {
        const totalMinutes = Math.round(val * 24 * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const period = hours >= 12 ? 'pm' : 'am';
        let h12 = hours % 12;
        if (h12 === 0) h12 = 12;
        return `${h12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
      }
      return String(val || "").trim();
    };

    const formatExcelDate = (val: any) => {
      if (typeof val === 'number' && val > 40000) {
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        return d.toISOString().split('T')[0];
      }
      return String(val || "").trim();
    };

    for (const rawEv of rawEvents) {
      if (!rawEv || typeof rawEv !== "object") continue;
      const cleanRawEv: Record<string, any> = {};
      const originalRawEv: Record<string, any> = {};
      for (const [k, v] of Object.entries(rawEv)) {
        if (k && v !== void 0 && v !== null) {
          const cleanKey = k.trim().replace(/\s+/g, " ").toLowerCase();
          cleanRawEv[cleanKey] = v;
          originalRawEv[cleanKey] = v;
        }
      }
      const rawEventName = cleanRawEv["event name"] || cleanRawEv["title"] || "";
      if (!rawEventName || String(rawEventName).trim() === "") {
        continue;
      }
      const getVal = (possibleHeaders: string[]) => {
        for (const header of possibleHeaders) {
          const val = cleanRawEv[header.toLowerCase().trim()];
          if (val !== void 0 && val !== null) {
            return String(val).trim();
          }
        }
        return "";
      };

      const getRawVal = (possibleHeaders: string[]) => {
        for (const header of possibleHeaders) {
          const val = cleanRawEv[header.toLowerCase().trim()];
          if (val !== void 0 && val !== null) {
            return val;
          }
        }
        return null;
      };
      
      let cat = getVal(["Category"]);
      const datesField = getVal(["Dates", "Date"]);
      const startDateField = formatExcelDate(getRawVal(["Start Date"]));

      if (cat.toLowerCase().includes("weekday") || cat.toLowerCase().includes("weekly")) {
        cat = "Weekly Events";
      } else if (cat.toLowerCase().includes("date-specific") || cat.toLowerCase().includes("date specific") || cat.toLowerCase().includes("one-time")) {
        cat = "Date-specific Events";
      } else if (cat.toLowerCase().includes("daily")) {
        cat = "Daily Events";
      } else {
        // Resolve based on dates/days presence if category column is empty or doesn't match
        if ((datesField && datesField !== "" && datesField !== "N/A") || (startDateField && startDateField !== "" && startDateField !== "N/A")) {
          cat = "Date-specific Events";
        } else {
          cat = "Weekly Events";
        }
      }

      const startTime = formatExcelTime(getRawVal(["Start Time", "Time", "Times"]));
      const endTime = formatExcelTime(getRawVal(["End Time"]));
      let timesStr = startTime;
      if (endTime && endTime !== startTime) {
        timesStr += ` - ${endTime}`;
      }
      
      const processed = {
        title: getVal(["Event Name", "Title", "Name"]),
        type: getVal(["Type of event", "Type"]),
        category: cat || "Weekly Events",
        dates: getVal(["Dates", "Date"]),
        days: getVal(["Days", "Day"]),
        times: timesStr,
        venue: getVal(["Venue", "Location"]),
        cost: getVal(["Cost/Contribution", "Cost", "Price", "Contribution"]),
        audience: getVal(["Target Audience/Prerequisites", "Target Audience", "Audience", "Key Info"]),
        contactPerson: getVal(["Contact Person/Unit", "Contact Person"]),
        whatsapp: getVal(["Contact Phone/WhatsApp", "Contact Phone", "WhatsApp", "Phone"]),
        email: getVal(["Contact Email", "Email Id", "Email"]),
        website: getVal(["Website/Link", "Website", "Link"]),
        posterUrl: getVal(["poster url", "Poster URL", "Image URL"]),
        description: getVal(["Description", "Details", "About"]),
        startDate: formatExcelDate(getRawVal(["Start Date"])),
        endDate: formatExcelDate(getRawVal(["End Date"])),
        excelFilename: excelSource,
        originalHeaders: originalRawEv,
        submittedBy,
        submittedAt
      };
      eventsToUpload.push(processed);
    }

    // Process Google Drive poster URLs if present and convert to binary buffer proxy format
    sendProgress(36, "Checking and fetching Google Drive posters...", "Scanning events for Drive poster links");
    const driveEvents = eventsToUpload.filter(event => 
      event.posterUrl && (event.posterUrl.includes("drive.google.com") || event.posterUrl.includes("docs.google.com"))
    );

    if (driveEvents.length > 0) {
      console.log(`Found ${driveEvents.length} events with Google Drive poster URLs. Fetching files...`);
      const chunkArray = <T>(array: T[], size: number): T[][] => {
        const chunks = [];
        for (let idx = 0; idx < array.length; idx += size) {
          chunks.push(array.slice(idx, idx + size));
        }
        return chunks;
      };
      
      const driveBatches = chunkArray(driveEvents, 5);
      for (let idx = 0; idx < driveBatches.length; idx++) {
        const batch = driveBatches[idx];
        const percent = Math.min(39, 36 + Math.round((idx / driveBatches.length) * 3));
        sendProgress(
          percent, 
          `Downloading Drive posters (batch ${idx + 1} of ${driveBatches.length})...`, 
          `Downloading posters for: ${batch.map(e => `"${e.title}"`).join(", ")}`
        );
        
        await Promise.all(batch.map(async (event) => {
          const driveResult = await fetchDriveFileAsBase64(event.posterUrl);
          if (driveResult) {
            event.base64Poster = driveResult;
          }
        }));
      }
    }

    if (eventsToUpload.length === 0) {
      return sendError(400, "No valid events with a Title or Name found in the sheet.");
    }

    // Generate search embeddings for the events in batches to support semantic vector search
    sendProgress(40, "Generating search embeddings for events...", `Generating embeddings for ${eventsToUpload.length} events`);
    
    const batchSize = 10; // Batch size for embeddings
    for (let i = 0; i < eventsToUpload.length; i += batchSize) {
      const batch = eventsToUpload.slice(i, i + batchSize);
      const embedPercent = Math.min(48, 40 + Math.round((i / eventsToUpload.length) * 8));
      sendProgress(
        embedPercent,
        `Generating search embeddings (events ${i + 1}-${Math.min(eventsToUpload.length, i + batchSize)} of ${eventsToUpload.length})...`,
        `Requesting embeddings for batch of ${batch.length} events`
      );
      
      try {
        const batchPromises = batch.map(event => {
          const textToEmbed = `${event.title || ''} ${event.description || ''} ${event.category || ''} ${event.type || ''} ${event.venue || ''} ${event.days || ''} ${event.cost || ''} ${event.audience || ''} ${event.contactPerson || ''} ${event.whatsapp || ''} ${event.email || ''}`.replace(/\s+/g, " ").trim();
          return ai.models.embedContent({
            model: "gemini-embedding-2-preview",
            contents: textToEmbed || "event",
            config: { outputDimensionality: 768 }
          });
        });
        
        const results = await Promise.all(batchPromises);
        await new Promise(r => setTimeout(r, 500)); // Brief sleep to avoid rapid rate limit hits
        
        for (let j = 0; j < batch.length; j++) {
          const vector = results[j]?.embeddings?.[0]?.values;
          if (vector && Array.isArray(vector)) {
            batch[j].embeddingVector = vector;
          }
        }
      } catch (err: any) {
        console.warn(`Batch event embedding failed, trying individual fallback for batch starting at index ${i}:`, err);
        // Fallback: individual embedding
        for (let j = 0; j < batch.length; j++) {
          const event = batch[j];
          try {
            await new Promise(r => setTimeout(r, 100)); // Sleep 100ms
            const textToEmbed = `${event.title || ''} ${event.description || ''} ${event.category || ''} ${event.type || ''} ${event.venue || ''} ${event.days || ''} ${event.cost || ''} ${event.audience || ''} ${event.contactPerson || ''} ${event.whatsapp || ''} ${event.email || ''}`.replace(/\s+/g, " ").trim();
            const embedRes = await ai.models.embedContent({
              model: "gemini-embedding-2-preview",
              contents: textToEmbed || "event",
              config: { outputDimensionality: 768 }
            });
            const vector = embedRes.embeddings?.[0]?.values;
            if (vector && Array.isArray(vector)) {
              event.embeddingVector = vector;
            }
          } catch (indivErr: any) {
            console.error(`Individual event embedding failed for event ${i + j}:`, indivErr);
          }
        }
      }
    }

    sendProgress(50, `Ready to save ${eventsToUpload.length} events...`, "Sending events to browser for client-side insertion");
    
    res.write(JSON.stringify({ 
      type: "chunks", 
      events: eventsToUpload 
    }) + "\n");
    res.end();

  } catch (e: any) {
    console.error("upload_events error:", e);
    return sendError(500, "Failed to process upload: " + (e.message || e));
  }
});

export const extractDriveId = (url: string): string | null => {
  if (!url) return null;
  const match = url.match(/(?:id=|\/d\/|file\/d\/|open\?id=)([a-zA-Z0-9_-]{25,50})/);
  return match ? match[1] : null;
};

export const fetchDriveFileAsBase64 = async (driveUrl: string): Promise<{ data: string; contentType: string } | null> => {
  const fileId = extractDriveId(driveUrl);
  if (!fileId) return null;
  
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  try {
    const res = await fetch(downloadUrl);
    if (!res.ok) {
      console.warn(`Drive download failed with status ${res.status} for ${driveUrl}`);
      return null;
    }
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Safety check: if Google Drive restricted page or empty file is returned as HTML
    if (contentType.includes("text/html") || buffer.toString("utf8", 0, 100).trim().startsWith("<!DOCTYPE")) {
      console.warn(`Drive link returned HTML instead of raw file (restricted access or expired): ${driveUrl}`);
      return null;
    }

    return {
      data: buffer.toString("base64"),
      contentType: contentType
    };
  } catch (err) {
    console.warn(`Error downloading Drive file ${driveUrl}:`, err);
    return null;
  }
};

router.post("/api/proxy_drive_poster", async (req, res) => {
  try {
    const { url, token } = req.body;
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const decodedToken = await verifyAuthToken(token);
    const userEmail = decodedToken && decodedToken.email ? decodedToken.email.toLowerCase() : "";
    const isAdmin = await isUserAdmin(userEmail);
    if (!decodedToken || !isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    const result = await fetchDriveFileAsBase64(url);
    if (!result) {
      return res.status(404).json({ error: "Failed to fetch file from Google Drive. Ensure the link is public." });
    }

    return res.json(result);
  } catch (err: any) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: err.message || err });
  }
});

export default router;
