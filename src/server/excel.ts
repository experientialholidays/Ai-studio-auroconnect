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
      if (cat.toLowerCase().includes("weekday")) {
        cat = "Weekly Events";
      } else if (cat.toLowerCase().includes("date-specific") || cat.toLowerCase().includes("date specific")) {
        cat = "Date-specific Events";
      } else if (cat.toLowerCase().includes("daily")) {
        cat = "Daily Events";
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
