import { Router } from "express";
import multer from "multer";
import { getAuth } from "firebase-admin/auth";
import { read, utils } from "xlsx";
import { getStorage } from "firebase-admin/storage";
import crypto from "crypto";
import { db, adminDb, verifyAuthToken, ai, isUserAdmin, isUserBlocked } from "./firebase-ai.js";
import { parseEventDates, parseEventTimes, parseEventDays } from "./dateTimeParser.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

async function uploadPosterToStorage(base64Data: string, contentType: string, title: string, userEmail: string): Promise<string | null> {
  try {
    const buffer = Buffer.from(base64Data, "base64");
    const randomId = Math.random().toString(36).substring(2, 10);
    const cleanTitle = (title || "poster").toLowerCase().replace(/[^a-z0-9]/g, "_").substring(0, 30);
    const fileName = `${Date.now()}_${cleanTitle}_${randomId}.jpg`;
    
    const bucket = getStorage().bucket("auro-connect.firebasestorage.app");
    const fileRef = bucket.file(`event-media/${fileName}`);
    const token = crypto.randomUUID();

    await fileRef.save(buffer, {
      metadata: {
        contentType: contentType || "image/jpeg",
        metadata: {
          uploadedBy: userEmail,
          firebaseStorageDownloadTokens: token
        }
      }
    });

    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileRef.name)}?alt=media&token=${token}`;
    return downloadUrl;
  } catch (err: any) {
    console.error(`Failed server-side poster upload for "${title}":`, err.message || err);
    return null;
  }
}

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
    const userIsBlocked = await isUserBlocked(userEmail);
    if (userIsBlocked) {
      return sendError(403, "Forbidden: Your account has been blocked from submitting events.");
    }
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
      const num = Number(val);
      if (!isNaN(num) && num > 40000 && num < 60000) {
        const d = new Date(Math.round((num - 25569) * 86400 * 1000));
        return d.toISOString().split('T')[0];
      }
      return String(val || "").trim();
    };

    const formatExcelDatesField = (val: any): string => {
      if (val === undefined || val === null) return "";
      
      const formatSingle = (v: any) => {
        const num = Number(v);
        if (!isNaN(num) && num > 40000 && num < 60000) {
          const d = new Date(Math.round((num - 25569) * 86400 * 1000));
          return d.toISOString().split('T')[0];
        }
        return String(v).trim();
      };

      const str = String(val).trim();
      if (str.includes(" to ")) {
        return str.split(" to ").map(formatSingle).join(" to ");
      }
      if (str.includes("-") && !str.includes("/") && str.split("-").length === 2) {
        const parts = str.split("-");
        if (parts.every(p => !isNaN(Number(p.trim())) && Number(p.trim()) > 40000)) {
          return parts.map(formatSingle).join(" to ");
        }
      }
      return formatSingle(val);
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
      
      // Parse Date fields
      const parsedDateObj = parseEventDates(
        getRawVal(["Dates", "Date"]),
        getRawVal(["Start Date"]),
        getRawVal(["End Date"])
      );

      // Parse Time fields
      const parsedTimeObj = parseEventTimes(
        getRawVal(["Start Time", "StartTime"]),
        getRawVal(["End Time", "EndTime"]),
        getRawVal(["Time", "Times", "Timings", "Timing", "Event Time", "Start Time"])
      );

      // Parse Days field
      const parsedDays = parseEventDays(getRawVal(["Days", "Day"]));

      // Determine category intelligently
      let cat = getVal(["Category"]);
      const catLower = cat.toLowerCase().trim();
      if (catLower.includes("date-specific") || catLower.includes("date specific") || catLower.includes("one-time")) {
        cat = "Date-specific Events";
      } else if (catLower.includes("weekday-based") || catLower.includes("weekday based") || catLower.includes("weekday") || catLower.includes("weekly")) {
        cat = "Weekly Events";
      } else if (catLower.includes("daily")) {
        cat = "Daily Events";
      } else {
        // Resolve based on dates/days presence if category column is empty or doesn't match
        if (parsedDateObj.startDate || parsedDateObj.dates) {
          cat = "Date-specific Events";
        } else if (parsedDays) {
          cat = "Weekly Events";
        } else {
          cat = "Daily Events";
        }
      }
      
      let sType = "one-time";
      const catLowerChecked = (cat || "").toLowerCase();
      if (catLowerChecked.includes("date-specific") || catLowerChecked.includes("date specific") || catLowerChecked.includes("one-time")) {
        sType = "one-time";
      } else if (catLowerChecked.includes("daily") || catLowerChecked.includes("weekly") || catLowerChecked.includes("weekday")) {
        sType = "recurring";
      } else {
        sType = "one-time";
      }

      const processed: Record<string, any> = {
        title: getVal(["Event Name", "Title", "Name"]),
        type: getVal(["Type of event", "Type"]),
        category: cat || "Weekly Events",
        scheduleType: sType,
        dates: parsedDateObj.dates || "",
        days: parsedDays || "",
        times: parsedTimeObj.times || "",
        startTime: parsedTimeObj.startTime || "",
        endTime: parsedTimeObj.endTime || "",
        venue: getVal(["Venue", "Location"]),
        cost: getVal(["Cost/Contribution", "Cost", "Price", "Contribution"]),
        audience: getVal(["Target Audience/Prerequisites", "Target Audience", "Audience", "Key Info"]),
        contactPerson: getVal(["Contact Person/Unit", "Contact Person"]),
        whatsapp: getVal(["Contact Phone/WhatsApp", "Contact Phone", "WhatsApp", "Phone"]),
        email: getVal(["Contact Email", "Email Id", "Email"]),
        website: getVal(["Website/Link", "Website", "Link"]),
        posterUrl: getVal(["poster url", "Poster URL", "Image URL"]),
        description: getVal(["Description", "Details", "About"]),
        startDate: parsedDateObj.startDate || "",
        endDate: parsedDateObj.endDate || "",
        excelFilename: excelSource,
        originalHeaders: originalRawEv,
        submittedBy: submittedBy || "",
        submittedAt: submittedAt || new Date().toISOString()
      };

      // Clean undefined keys recursively
      const cleanUndefined = (obj: any): any => {
        if (obj === null || typeof obj !== "object") return obj;
        if (Array.isArray(obj)) return obj.map(cleanUndefined);
        const cleanObj: Record<string, any> = {};
        for (const [k, v] of Object.entries(obj)) {
          if (v !== undefined) {
            cleanObj[k] = (typeof v === "object" && v !== null) ? cleanUndefined(v) : v;
          }
        }
        return cleanObj;
      };

      eventsToUpload.push(cleanUndefined(processed));
    }

    if (eventsToUpload.length === 0) {
      return sendError(400, "No valid events with a Title or Name found in the sheet.");
    }

    // Process all events in streamed batches of 5 with pacing delay
    const totalEvents = eventsToUpload.length;
    const batchSize = 5;
    
    console.log(`Starting paced streamed processing of ${totalEvents} events in batches of ${batchSize}...`);
    
    for (let i = 0; i < totalEvents; i += batchSize) {
      const batch = eventsToUpload.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(totalEvents / batchSize);
      const percent = Math.min(95, 36 + Math.round((i / totalEvents) * 59));
      
      sendProgress(
        percent, 
        `Processing batch ${batchNum} of ${totalBatches} (${Math.min(totalEvents, i + batchSize)} of ${totalEvents} events)...`, 
        `Downloading posters and generating embeddings for batch ${batchNum}`
      );
      
      // 1. Process Google Drive poster URLs for this batch of 5
      const driveEvents = batch.filter(event => 
        event.posterUrl && (event.posterUrl.includes("drive.google.com") || event.posterUrl.includes("docs.google.com"))
      );
      
      if (driveEvents.length > 0) {
        console.log(`[Batch ${batchNum}] Found ${driveEvents.length} events with Google Drive poster URLs. Fetching files...`);
        await Promise.all(driveEvents.map(async (event) => {
          try {
            const driveResult = await fetchDriveFileAsBase64(event.posterUrl);
            if (driveResult) {
              event.base64Poster = driveResult;
            }
          } catch (driveErr: any) {
            console.error(`Failed downloading drive poster in batch for ${event.title}:`, driveErr.message || driveErr);
          }
        }));
      }
      
      // 2. Generate search embeddings for this batch of 5 with pacing and up to 2 retries
      const embedWithRetry = async (text: string, eventIndex: number, maxRetries = 2): Promise<number[] | null> => {
        let attempts = 0;
        while (attempts <= maxRetries) {
          try {
            const embedRes = await ai.models.embedContent({
              model: "gemini-embedding-2",
              contents: text || "event",
              config: { outputDimensionality: 768 }
            });
            const vector = embedRes.embeddings?.[0]?.values;
            if (vector && Array.isArray(vector)) {
              return vector;
            }
            return null;
          } catch (err: any) {
            attempts++;
            if (attempts <= maxRetries) {
              console.warn(`Embedding failed for event ${eventIndex} (attempt ${attempts}/${maxRetries + 1}). Retrying in 1.5s... Error: ${err.message || err}`);
              await new Promise(r => setTimeout(r, 1500));
            } else {
              console.error(`Embedding permanently failed for event ${eventIndex} after ${maxRetries} retries:`, err.message || err);
            }
          }
        }
        return null;
      };

      for (let j = 0; j < batch.length; j++) {
        const event = batch[j];
        const textToEmbed = `${event.title || ''} ${event.description || ''} ${event.category || ''} ${event.type || ''} ${event.venue || ''} ${event.days || ''} ${event.cost || ''} ${event.audience || ''} ${event.contactPerson || ''} ${event.whatsapp || ''} ${event.email || ''}`.replace(/\s+/g, " ").trim();
        
        const vector = await embedWithRetry(textToEmbed, i + j, 2);
        if (vector) {
          event.embeddingVector = vector;
        }
        // Small 200ms delay between individual items to prevent burst limits
        await new Promise(r => setTimeout(r, 200));
      }
      
      // 3. Save this batch directly to Firestore and upload drive posters to Storage on the server using Admin SDK
      const firestoreBatch = adminDb.batch();
      
      for (const ev of batch) {
        if (ev.base64Poster && ev.base64Poster.data) {
          try {
            const downloadUrl = await uploadPosterToStorage(
              ev.base64Poster.data,
              ev.base64Poster.contentType,
              ev.title,
              userEmail
            );
            if (downloadUrl) {
              ev.posterUrl = downloadUrl;
              console.log(`[Server Storage] Poster uploaded for "${ev.title}" -> ${downloadUrl}`);
            }
          } catch (uploadErr: any) {
            console.error(`[Server Storage Error] Failed to upload poster for "${ev.title}":`, uploadErr.message || uploadErr);
          }
        }
        delete ev.base64Poster; // Ensure we never store massive base64 in Firestore!
        
        // Save as plain array of numbers for fast in-memory cosine similarity checks
        
        const newDocRef = adminDb.collection("events").doc();
        firestoreBatch.set(newDocRef, ev);
      }
      
      console.log(`[Server Firestore] Saving batch ${batchNum} of ${totalBatches} directly to database...`);
      await firestoreBatch.commit();
      
      // Send progress to client to update the UI progress bar and log console
      sendProgress(
        percent,
        `Saved batch ${batchNum} of ${totalBatches} directly to database.`,
        `Committed ${Math.min(totalEvents, i + batchSize)} of ${totalEvents} events to Firestore.`
      );
      
      // Sleep for 2 seconds before processing the next batch of 5
      await new Promise(r => setTimeout(r, 2000));
    }

    sendSuccess(`Successfully processed and saved all ${totalEvents} events!`, "All batches saved to database successfully.");

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
