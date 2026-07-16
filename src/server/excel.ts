import { Router } from "express";
import multer from "multer";
import { getAuth } from "firebase-admin/auth";
import { read, utils } from "xlsx";
import { collection, addDoc } from "firebase/firestore";
import { db, verifyAuthToken } from "./firebase-ai.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/api/upload_events", upload.single("file"), async (req, res) => {
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
    const workbook = read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawEvents = utils.sheet_to_json(sheet);
    if (rawEvents.length === 0) {
      return res.status(400).json({ detail: "Excel file is empty" });
    }
    const eventsToUpload = [];
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
        originalHeaders: cleanRawEv
      };
      eventsToUpload.push(processed);
    }
    let count = 0;
    for (const ev of eventsToUpload) {
      await addDoc(collection(db, "events"), ev);
      count++;
    }
    return res.json({ detail: `Successfully uploaded ${count} events` });
  } catch (e: any) {
    console.error("upload_events error:", e);
    return res.status(500).json({ detail: "Failed to process upload: " + (e.message || e) });
  }
});

export default router;
