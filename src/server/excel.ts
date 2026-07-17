import { Router } from "express";
import multer from "multer";
import { getAuth } from "firebase-admin/auth";
import { read, utils } from "xlsx";
import { adminDb, verifyAuthToken } from "./firebase-ai.js";

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
    if (decodedToken.email !== "info.experientialholidays@gmail.com") {
      return sendError(403, "Forbidden: Admin access required.");
    }
    if (!req.file) {
      return sendError(400, "No file uploaded");
    }

    sendProgress(15, "Reading uploaded Excel sheet...", `File size: ${req.file.size} bytes`);
    const workbook = read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    sendProgress(25, "Parsing spreadsheet content...", `Sheet name: "${sheetName}"`);
    const rawEvents = utils.sheet_to_json(sheet);
    if (rawEvents.length === 0) {
      return sendError(400, "Excel file is empty");
    }

    sendProgress(35, "Cleaning and validating events...", `Found ${rawEvents.length} raw rows`);
    const eventsToUpload = [];
    const submittedBy = decodedToken.email;
    const submittedAt = new Date().toISOString();

    for (const rawEv of rawEvents) {
      if (!rawEv || typeof rawEv !== "object") continue;
      const cleanRawEv: Record<string, any> = {};
      for (const [k, v] of Object.entries(rawEv)) {
        if (k && v !== void 0 && v !== null) {
          cleanRawEv[k.trim().replace(/\s+/g, " ").toLowerCase()] = v;
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
      
      const processed = {
        title: getVal(["Title", "Event Name", "Name"]),
        category: getVal(["Category", "Type"]),
        scheduleType: getVal(["Schedule Type", "Frequency"]),
        dates: getVal(["Dates", "Date"]),
        days: getVal(["Days", "Day"]),
        times: getVal(["Times", "Time"]),
        venue: getVal(["Venue", "Location"]),
        cost: getVal(["Cost", "Price", "Contribution"]),
        audience: getVal(["Audience", "Key Info"]),
        contact: getVal(["Contact", "Phone"]),
        email: getVal(["Email"]),
        whatsapp: getVal(["WhatsApp"]),
        website: getVal(["Website", "Link"]),
        posterUrl: getVal(["Poster URL", "Image URL"]),
        description: getVal(["Description", "Details", "About"]),
        startDate: getVal(["Start Date"]),
        endDate: getVal(["End Date"]),
        originalHeaders: cleanRawEv,
        submittedBy,
        submittedAt
      };
      eventsToUpload.push(processed);
    }

    if (eventsToUpload.length === 0) {
      return sendError(400, "No valid events with a Title or Name found in the sheet.");
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

export default router;
