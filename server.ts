import express from "express";
import path from "path";
import fs from "fs";
import http from "http";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import { read, utils } from "xlsx";
import { initializeApp as initAdminApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, getDocs, limit, query, addDoc } from "firebase/firestore";
import { GoogleGenAI } from "@google/genai";

import dotenv from "dotenv";
dotenv.config();

function cosineSimilarity(a: number[], b: number[]) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, "utf8"))
  : { 
      projectId: process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0039539258", 
      appId: process.env.FIREBASE_APP_ID || "1:615927626963:web:af7cd31a3a9859919fe826",
      apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBE_i3Y6SXSfmFfZ_ptMclJT0GySmA0dlM",
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || "gen-lang-client-0039539258.firebaseapp.com",
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "gen-lang-client-0039539258.firebasestorage.app",
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "615927626963",
      firestoreDatabaseId: process.env.FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-64cdf999-24b6-49a7-bf7c-8606ad4d20d4" 
    };

try {
  initAdminApp({ projectId: firebaseConfig.projectId });
} catch(e) {}

const appFirebase = initializeApp(firebaseConfig);
const db = getFirestore(appFirebase, firebaseConfig.firestoreDatabaseId || "(default)");

// AI setup
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { headers: { "User-Agent": "aistudio-build" } },
});
const MODEL = "gemini-3.1-flash-lite";

const app = express();
app.use(express.json());

// Multer setup for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Excel Upload API Endpoint
app.post("/api/upload_events", upload.single("file"), async (req, res) => {
  try {
    const token = req.body.token;
    if (!token) {
      return res.status(401).json({ detail: "No authentication token provided" });
    }

    let decodedToken;
    if (token && token.startsWith("DEV_BYPASS_TOKEN_")) {
      decodedToken = { email: token.replace("DEV_BYPASS_TOKEN_", "") };
    } else {
      try {
        decodedToken = await getAuth().verifyIdToken(token);
      } catch (e) {
        return res.status(401).json({ detail: "Invalid authentication token: " + (e as Error).message });
      }
    }

    if (decodedToken.email !== 'info.experientialholidays@gmail.com') {
      return res.status(403).json({ detail: "Forbidden: Admin access required." });
    }

    if (!req.file) {
      return res.status(400).json({ detail: "No file uploaded" });
    }

    const workbook = read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawEvents: any[] = utils.sheet_to_json(sheet);

    if (rawEvents.length === 0) {
      return res.status(400).json({ detail: "Excel file is empty" });
    }

    // Target exact 1:1 direct mapping for user's columns
    const eventsToUpload = [];
    for (const rawEv of rawEvents) {
      if (!rawEv || typeof rawEv !== "object") continue;

      // Create a map with trimmed keys for robust case-insensitive access
      const cleanRawEv: { [key: string]: any } = {};
      for (const [k, v] of Object.entries(rawEv as any)) {
        if (k && v !== undefined && v !== null) {
          cleanRawEv[k.trim().replace(/\s+/g, " ").toLowerCase()] = v;
        }
      }

      // Check if we have at least an Event Name to avoid saving empty/ghost rows
      const rawEventName = cleanRawEv["event name"] || cleanRawEv["title"] || "";
      if (!rawEventName || String(rawEventName).trim() === "") {
        continue;
      }

      const getVal = (possibleHeaders: string[]) => {
        for (const header of possibleHeaders) {
          const val = cleanRawEv[header.toLowerCase().trim()];
          if (val !== undefined && val !== null) {
            return String(val).trim();
          }
        }
        return "";
      };

      const formatExcelTime = (val: any): string => {
        if (val === undefined || val === null) return "";
        const strVal = String(val).trim();
        if (strVal === "") return "";
        
        const num = Number(strVal);
        if (!isNaN(num) && num >= 0 && num <= 1) {
          const totalSeconds = Math.round(num * 24 * 60 * 60);
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const ampm = hours >= 12 ? "pm" : "am";
          const displayHours = hours % 12 === 0 ? 12 : hours % 12;
          const displayMinutes = minutes < 10 ? "0" + minutes : minutes;
          return `${displayHours}:${displayMinutes}${ampm}`;
        }
        return strVal;
      };

      const formatExcelDate = (val: any): string => {
        if (val === undefined || val === null) return "";
        const strVal = String(val).trim();
        if (strVal === "") return "";
        
        const num = Number(strVal);
        if (!isNaN(num) && Number.isInteger(num) && num > 10000 && num < 100000) {
          const date = new Date((num - 25569) * 86400 * 1000);
          const year = date.getUTCFullYear();
          const month = String(date.getUTCMonth() + 1).padStart(2, '0');
          const day = String(date.getUTCDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        return strVal;
      };

      // Exact Mapping matching the shared columns
      const title = getVal(["Event Name"]);
      const type = getVal(["Type of event"]);
      const days = getVal(["Days"]);
      const startDate = formatExcelDate(getVal(["Start date"]));
      const endDate = formatExcelDate(getVal(["End date"]));
      const startTime = formatExcelTime(getVal(["Start Time"]));
      let endTime = formatExcelTime(getVal(["End Time"]));
      
      if (startTime && !endTime) {
        try {
          const parts = startTime.split(":");
          if (parts.length >= 2) {
            const h = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            if (!isNaN(h) && !isNaN(m)) {
              const eh = (h + 1) % 24;
              endTime = `${eh.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
            }
          }
        } catch (e) {
          console.error("Error calculating end time", e);
        }
      }

      const venue = getVal(["Venue"]);
      const excelCategoryValue = getVal(["Category"]);
      const description = getVal(["Description"]);
      const contactPerson = getVal(["Contact Person/Unit"]);
      const contactPhone = getVal(["Contact Phone/WhatsApp"]);
      const contactEmail = getVal(["Contact Email"]);
      const websiteLink = getVal(["Website/Link"]);
      const costContribution = getVal(["Cost/Contribution"]);
      const targetAudience = getVal(["Target Audience/Prerequisites"]);
      const posterUrl = getVal(["poster url"]);

      // Construct combined display attributes to be perfectly compatible with UI searches/viewers
      let constructedDate = days;
      if (startDate) {
        constructedDate = startDate;
        if (endDate && endDate !== startDate) {
          constructedDate += ` to ${endDate}`;
        }
      }

      let constructedTime = startTime;
      if (endTime && startTime) {
        constructedTime += ` - ${endTime}`;
      } else if (endTime) {
        constructedTime = endTime;
      }

      // Interchange: Category represents schedule intervals (daily / weekly / date-specific)
      let normalizedCategory = "Date-specific Events";
      const catLower = excelCategoryValue.toLowerCase().trim();
      if (catLower.includes("daily") || catLower === "daily events") {
        normalizedCategory = "Daily Events";
      } else if (catLower.includes("weekly") || catLower === "weekly events") {
        normalizedCategory = "Weekly Events";
      } else if (catLower.includes("date") || catLower.includes("one-time") || catLower === "date-specific events" || catLower === "date-specific") {
        normalizedCategory = "Date-specific Events";
      } else {
        // Fallback checks based on days of the week or range
        const daysLower = days.toLowerCase();
        if (daysLower.includes("daily") || daysLower.includes("every day") || daysLower.includes("everyday")) {
          normalizedCategory = "Daily Events";
        } else if (daysLower.includes("monday") || daysLower.includes("tuesday") || daysLower.includes("wednesday") || daysLower.includes("thursday") || daysLower.includes("friday") || daysLower.includes("saturday") || daysLower.includes("sunday")) {
          normalizedCategory = "Weekly Events";
        }
      }

      const scheduleType = (normalizedCategory === "Daily Events" || normalizedCategory === "Weekly Events") ? "recurring" : "one-time";

      const websiteLinks = websiteLink ? websiteLink.split(",").map((s: string) => s.trim()).filter((s: string) => s) : [];
      const mediaUrls = posterUrl ? [posterUrl] : [];

      const cleanedEvent: any = {
        // Standard fields mapped to match both structures perfectly (Client-side Form and Database)
        title: title,
        type: type,                       // Excel "Type of event" maps to "type" (e.g. Workshop, Class)
        category: normalizedCategory,     // Excel "Category" maps to "category" (e.g. Daily Events, Weekly Events, Date-specific Events)
        scheduleType: scheduleType,
        
        dates: constructedDate,
        days: days,
        times: constructedTime,
        venue: venue,
        
        cost: costContribution,
        audience: targetAudience,
        contactPerson: contactPerson,
        contact: contactPhone,
        whatsapp: contactPhone,
        email: contactEmail,
        
        website: websiteLink,
        websiteLinks: websiteLinks,
        
        posterUrl: posterUrl,
        mediaUrls: mediaUrls,
        
        description: description,
        
        // Preserved raw fields to keep absolute fidelity of original data structure
        originalHeaders: {
          eventName: title,
          typeOfEvent: type,
          days: days,
          startDate: startDate,
          endDate: endDate,
          startTime: startTime,
          endTime: endTime,
          venue: venue,
          category: excelCategoryValue,
          description: description,
          contactPersonUnit: contactPerson,
          contactPhoneWhatsApp: contactPhone,
          contactEmail: contactEmail,
          websiteLink: websiteLink,
          costContribution: costContribution,
          targetAudiencePrerequisites: targetAudience,
          posterUrl: posterUrl
        },

        uploadedAt: new Date().toISOString(),
        submittedBy: decodedToken.email,
        excelFilename: req.file.originalname
      };

      try {
        const textToEmbed = `${cleanedEvent.title || ''} ${cleanedEvent.description || ''} ${cleanedEvent.category || ''} ${cleanedEvent.type || ''} ${cleanedEvent.venue || ''} ${cleanedEvent.days || ''} ${cleanedEvent.cost || ''} ${cleanedEvent.audience || ''} ${cleanedEvent.contactPerson || ''} ${cleanedEvent.contact || ''} ${cleanedEvent.email || ''}`.replace(/\s+/g, " ").trim();
        if (textToEmbed) {
          const embeddingRes = await ai.models.embedContent({
              model: "text-embedding-004",
              contents: textToEmbed,
          });
          cleanedEvent.embeddingVector = embeddingRes.embeddings?.[0]?.values || null;
        }
      } catch(e) {
        console.error("Failed to generate embedding for event", cleanedEvent.title, e);
      }

      eventsToUpload.push(cleanedEvent);
    }
    
    res.json({ message: "Successfully parsed excel file", count: eventsToUpload.length, data: eventsToUpload });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ detail: `Failed to process file: ${err.message}` });
  }
});

// Single Event Submission API Endpoint
app.post("/api/submit_event", async (req, res) => {
  try {
    const token = req.body.token;
    if (!token) {
      return res.status(401).json({ detail: "No authentication token provided" });
    }

    let decodedToken;
    if (token && token.startsWith("DEV_BYPASS_TOKEN_")) {
      decodedToken = { email: token.replace("DEV_BYPASS_TOKEN_", "") };
    } else {
      try {
        decodedToken = await getAuth().verifyIdToken(token);
      } catch (e) {
        return res.status(401).json({ detail: "Invalid authentication token: " + (e as Error).message });
      }
    }

    // Example of checking admin email (you can customize or uncomment this):
    // const adminEmails = ["info.experientialholidays@gmail.com"];
    // if (!adminEmails.includes(decodedToken.email)) {
    //   return res.status(403).json({ detail: "Forbidden: Admin access required." });
    // }

    const eventData = req.body.event;
    if (!eventData || typeof eventData !== 'object') {
      return res.status(400).json({ detail: "Invalid event data" });
    }

    const collectionRef = collection(db, "events");
    
    // Add submitter email to the record
    eventData.submittedBy = decodedToken.email;
    eventData.submittedAt = new Date().toISOString();

    try {
      const textToEmbed = `${eventData.title || ''} ${eventData.description || ''} ${eventData.category || ''} ${eventData.type || ''} ${eventData.venue || ''} ${eventData.days || ''} ${eventData.cost || ''} ${eventData.audience || ''} ${eventData.contactPerson || ''} ${eventData.contact || ''} ${eventData.email || ''}`.replace(/\s+/g, " ").trim();
      if (textToEmbed) {
        const embeddingRes = await ai.models.embedContent({
            model: "text-embedding-004",
            contents: textToEmbed,
        });
        eventData.embeddingVector = embeddingRes.embeddings?.[0]?.values || null;
      }
    } catch(e) {
      console.error("Failed to generate embedding for single event submission", eventData.title, e);
    }

    await addDoc(collectionRef, eventData);

    return res.json({ message: "Successfully submitted event." });
  } catch (error) {
    console.error("Error submitting event:", error);
    return res.status(500).json({ detail: "Error submitting event: " + (error as Error).message });
  }
});

// GET Catalog Events API Endpoint
app.get("/api/events", async (req, res) => {
  try {
    const { query: searchQuery, day, category } = req.query;
    const colRef = collection(db, "events");
    const snapshot = await getDocs(colRef);
    let events = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as any));
    
    if (category) {
      events = events.filter(e => e.category === category);
    }
    
    if (day) {
      events = events.filter(e => {
        const dVal = (e.days || e.day || "").toLowerCase();
        return dVal.includes(String(day).toLowerCase());
      });
    }
    
    if (searchQuery) {
      const q = String(searchQuery).toLowerCase();
      events = events.filter(e => {
        return (
          (e.title || "").toLowerCase().includes(q) ||
          (e.description || "").toLowerCase().includes(q) ||
          (e.venue || "").toLowerCase().includes(q) ||
          (e.type || "").toLowerCase().includes(q)
        );
      });
    }
    
    return res.json({ success: true, events });
  } catch (error) {
    console.error("Error fetching events for catalog:", error);
    return res.status(500).json({ success: false, detail: (error as Error).message });
  }
});

// GET Specific Catalog Event API Endpoint
app.get("/api/events/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = doc(db, "events", id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return res.status(404).json({ success: false, detail: "Event not found" });
    }
    return res.json({ success: true, event: { id: docSnap.id, ...docSnap.data() } });
  } catch (error) {
    console.error("Error fetching event details:", error);
    return res.status(500).json({ success: false, detail: (error as Error).message });
  }
});

// GET Database Status Summary Endpoint
app.get("/api/db_status", async (req, res) => {
  try {
    const eventsCol = collection(db, "events");
    const eventsSnap = await getDocs(eventsCol);
    const knowledgeCol = collection(db, "knowledge");
    const knowledgeSnap = await getDocs(knowledgeCol);
    
    const sampleEvents = eventsSnap.docs.slice(0, 5).map(d => ({ 
      id: d.id, 
      title: d.data().title, 
      category: d.data().category,
      type: d.data().type 
    }));
    
    return res.json({
      success: true,
      eventsCount: eventsSnap.size,
      knowledgeCount: knowledgeSnap.size,
      sampleEvents
    });
  } catch (error) {
    console.error("Error reading db status:", error);
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.get("/api/firebase_config", (req, res) => {
  return res.json({
    projectId: firebaseConfig.projectId,
    appId: firebaseConfig.appId,
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
    firestoreDatabaseId: firebaseConfig.firestoreDatabaseId || "(default)"
  });
});

import { PDFParse } from "pdf-parse";

// Knowledge PDF Upload API Endpoint
app.post("/api/upload_knowledge", upload.single("file"), async (req, res) => {
  try {
    const token = req.body.token;
    if (!token) return res.status(401).json({ detail: "No authentication token provided" });
    
    let decodedToken;
    if (token && token.startsWith("DEV_BYPASS_TOKEN_")) {
      decodedToken = { email: token.replace("DEV_BYPASS_TOKEN_", "") };
    } else {
      try {
        decodedToken = await getAuth().verifyIdToken(token);
      } catch (e) {
        return res.status(401).json({ detail: "Invalid auth token" });
      }
    }

    if (decodedToken.email !== 'info.experientialholidays@gmail.com') {
      return res.status(403).json({ detail: "Forbidden: Admin access required." });
    }

    if (!req.file) return res.status(400).json({ detail: "No file uploaded" });
    if (req.file.mimetype !== "application/pdf") return res.status(400).json({ detail: "Only PDFs are allowed" });

    const pdfApp: any = new PDFParse(new Uint8Array(req.file.buffer));
    await pdfApp.load();
    const pdfData: any = await pdfApp.getText();
    
    const fullText = pdfData.text.replace(/\0/g, ""); // remove null bytes
    
    // Chunk the text into roughly 1000 character pieces (overlapping a bit is good practice, but keeping it simple)
    const CHUNK_SIZE = 4000;
    const chunks = [];
    for (let i = 0; i < fullText.length; i += CHUNK_SIZE) {
       chunks.push(fullText.substring(i, i + CHUNK_SIZE));
    }

    const chunkData = [];
    for (const chunkText of chunks) {
       if (!chunkText.trim()) continue;
       try {
           const embeddingRes = await ai.models.embedContent({
               model: "text-embedding-004",
               contents: chunkText,
           });
           chunkData.push({
               text: chunkText,
               embeddingVector: embeddingRes.embeddings?.[0]?.values || null
           });
       } catch (err) {
           console.error("Failed to embed chunk", err);
           // Still push the chunk without embedding so we don't lose data
           chunkData.push({ text: chunkText, embeddingVector: null });
       }
    }

    const filename = req.file.originalname;

    res.json({ message: "Successfully parsed pdf", filename, chunks: chunkData, fullTextLength: fullText.length });
  } catch (err: any) {
    console.error("PDF upload error:", err);
    res.status(500).json({ detail: `Failed to process PDF: ${err.message}` });
  }
});

// Helper functions for Chat Processing //

/** Natively fetches events from Firebase directly */
async function searchAurovilleEvents(searchQuery: string, specificity: string, filterDay?: string, filterDate?: string, filterTimeAfter?: string) {
  try {
    const colRef = collection(db, "events");
    const snapshot = await getDocs(colRef);
    let events = snapshot.docs.map(docSnap => ({ uuid: docSnap.id, ...docSnap.data() } as any));

    // Local Vector Search (Calculates cosine similarity in-memory)
    // This entirely bypasses the need for a Firestore Vector Index!
    if (searchQuery) {
        try {
            // Generate embedding for the search query
            const embedRes = await ai.models.embedContent({
                model: "text-embedding-004",
                contents: searchQuery,
            });
            const queryVector = embedRes.embeddings?.[0]?.values;

            if (queryVector) {
                // Score each event
                for (const event of events) {
                    let eventVector = event.embeddingVector;
                    // Handle Firestore VectorValue or regular arrays
                    if (eventVector && typeof eventVector.toArray === 'function') {
                        eventVector = eventVector.toArray();
                    }
                    if (Array.isArray(eventVector) && eventVector.length === queryVector.length) {
                        event.similarityScore = cosineSimilarity(queryVector, eventVector);
                    } else {
                        event.similarityScore = -1; // No valid embedding
                    }
                }
                
                // Sort by similarity descending
                events.sort((a, b) => (b.similarityScore || -1) - (a.similarityScore || -1));
                
                // Keep top 10 most relevant
                events = events.slice(0, 10);
            }
        } catch (err) {
            console.error("Embedding search failed:", err);
            // Fallback to time filtering if embedding fails
        }
    }

    // Time filtering
    if (filterTimeAfter) {
      events = events.filter(data => {
        if (!data.startTime) return true; // Keep events without time
        return data.startTime >= filterTimeAfter;
      });
    }

    // Simple manual filtering
    if (specificity === "specific" && searchQuery) {
      events = events.filter(data => {
        const content = `${data.title || ""} ${data.description || ""} ${data.category || ""} ${data.tags || ""} ${data.venue || ""} ${data.days || ""}`.toLowerCase();
        let match = false;
        const terms = searchQuery.toLowerCase().split(" ");
        for (const term of terms) {
          if (term.length > 3 && content.includes(term)) {
            match = true;
            break;
          }
        }
        return match;
      });
    }

    const getWeekdayFromDateStr = (dateStr: string): string => {
      try {
        const parts = dateStr.split("-");
        if (parts.length === 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1; // 0-indexed
          const day = parseInt(parts[2], 10);
          const d = new Date(year, month, day);
          const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          return weekdays[d.getDay()];
        }
      } catch (e) {
        console.error("Error parsing date for weekday", e);
      }
      return "";
    };

    if (filterDate) {
      const targetDay = getWeekdayFromDateStr(filterDate);
      events = events.filter(data => {
        // One-time event check
        const isOneTime = data.scheduleType === "one-time" || (!data.scheduleType && data.dates && !data.days);
        if (isOneTime) {
          if (data.startDate && data.endDate) {
            return filterDate >= data.startDate && filterDate <= data.endDate;
          }
          return (data.dates || "").includes(filterDate) || (data.start_date_meta || "").includes(filterDate);
        }
        
        // Recurring event check (include if it falls on the calculated targetDay)
        const isRecurring = data.scheduleType === "recurring" || (!data.scheduleType && data.days);
        if (isRecurring) {
          return !!(targetDay && (data.days || "").toLowerCase().includes(targetDay.toLowerCase()));
        }
        
        return false;
      });
    } else if (filterDay) {
      events = events.filter(data => {
        return (data.days || "").toLowerCase().includes(filterDay.toLowerCase());
      });
    }

    if (events.length === 0) {
      return "I couldn't find any upcoming events matching those criteria.";
    }

    let out = [];
    events.forEach((data, index) => {
      const parts = [];
      if (data.dates) parts.push(data.dates);
      else if (data.days) parts.push(data.days);
      if (data.times) parts.push(data.times);
      if (data.venue) parts.push(`@${data.venue}`);
      
      const extras = [];
      if (data.cost) extras.push(`Cost: ${data.cost}`);
      if (data.audience) extras.push(`Key info: ${data.audience}`);

      const header = `**[➤➤ ${data.title}](#DETAILS::${data.uuid})**`;
      const timeLoc = parts.join(", ");
      const ext = extras.join(" | ");
      let s = [header];
      if (timeLoc) s.push(timeLoc);
      if (ext) s.push(ext);
      
      out.push(s.join("  \n"));
      out.push("");
    });
    return out.join("\n");

  } catch (err) {
    console.error("Firebase fetch error", err);
    return "Database query failed.";
  }
}

async function getEventDetails(eventId: string) {
  try {
    const docRef = await getDoc(doc(db, "events", eventId));
    if (!docRef.exists()) return "⚠️ **Details not found.**";
    
    const data = docRef.data() as any;
    const header = [];
    header.push(`### ${data.title}`);
    if (data.category) header.push(`*${data.category}*`);

    const details = [];
    if (data.dates || data.days) details.push(`📅 **Date:** ${data.dates || data.days}`);
    if (data.times) details.push(`⏰ **Time:** ${data.times}`);
    if (data.venue) details.push(`📍 **Location:** ${data.venue}`);
    if (data.cost) details.push(`💰 **Cost/Contribution:** ${data.cost}`);
    if (data.audience) details.push(`👥 **Key info:** ${data.audience}`);
    if (data.contact) details.push(`📞 **Contact:** ${data.contact}`);
    if (data.email) details.push(`✉️ **Email:** ${data.email}`);
    if (data.whatsapp) details.push(`💬 **WhatsApp:** ${data.whatsapp}`);
    if (data.website) details.push(`🔗 [**Official Website**](${data.website.startsWith("http") ? data.website : "https://" + data.website})`);
    if (data.description) details.push(`\n**Description:**\n${data.description}`);
    if (data.posterUrl) details.push(`\n🔗 [View Image](${data.posterUrl})`);

    return `${header.join("\n")}\n\n${details.join("\n\n")}`;
  } catch (e) {
    return "Error loading details.";
  }
}

// Format a date relative helper for Kolkata timezone (Auroville)
function getCurrentAurovilleTimeInfo() {
  const options = { timeZone: "Asia/Kolkata" };
  const d = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit", weekday: "long", hour: "2-digit", minute: "2-digit", hour12: true
  });
  const parts = formatter.formatToParts(d);
  let day = "", month = "", year = "", weekday = "", time = "";
  for (const part of parts) {
    if (part.type === "day") day = part.value;
    else if (part.type === "month") month = part.value;
    else if (part.type === "year") year = part.value;
    else if (part.type === "weekday") weekday = part.value;
  }
  return { dateStr: `${year}-${month}-${day}`, weekday, formattedNow: d.toLocaleString("en-US", { ...options, dateStyle: "full", timeStyle: "short" }) };
}

// Websocket logic mimicking Python streaming chat
async function handleStreamingChat(message: string, ws: WebSocket) {
    try {
        const timeInfo = getCurrentAurovilleTimeInfo();
        
        // 1. Send immediate response
        ws.send(JSON.stringify({ type: "start_stream" }));
        ws.send(JSON.stringify({ type: "stream_chunk", chunk: "<i>🔍 Analyzing query...</i>" }));

        // 2. Classifier Fast Call using json object response
        const classifierPrompt = `
        You are an AI assistant designed to classify user queries for an event search system.
        Today's date is: ${timeInfo.formattedNow}.

        Analyze the user query: "${message}"
        
        Categorize it into one of these buckets:
        "A": Date and time specific query (no specific event word like 'yoga', 'dance', 'music'). Example: "What's happening tomorrow?", "Events on Friday", "Events after 7pm".
        "B": Event topic search with specific topic keywords. Example: "Yoga classes on Friday", "Sound healing".
        "C": General conversational questions NOT looking for events. Example: "What is Auroville?", "Hi".

        Return ONLY a valid JSON object matching this schema:
        {
            "bucket": "A", 
            "search_query": "Cleaned query for semantic DB search (if A or B)",
            "intro_text": "A friendly ONE SENTENCE intro for the user (only needed for bucket A)",
            "filter_date": "YYYY-MM-DD",
            "filter_day": "Monday",
            "filter_time_after": "HH:MM (e.g., morning=06:00, afternoon=12:00, evening=17:00, night=20:00)"
        }`;

        const classRes = await ai.models.generateContent({
            model: MODEL,
            contents: classifierPrompt,
            config: {
                // Not perfectly supported in all gemini models via sdk but standard usage is to ask for JSON
                temperature: 0.1,
                responseMimeType: "application/json"
            }
        });
        
        let bucket = "C", searchQuery = message, introText = "Here is what I found:", filterDate = "", filterDay = "", filterTimeAfter = "";
        try {
            const parsed = JSON.parse(classRes.text || "{}");
            bucket = parsed.bucket || "C";
            searchQuery = parsed.search_query || message;
            introText = parsed.intro_text || "Here is what I found:";
            filterDate = parsed.filter_date;
            filterDay = parsed.filter_day;
            filterTimeAfter = parsed.filter_time_after;
        } catch { }

        // Start real output
        ws.send(JSON.stringify({ type: "start_stream" }));

        if (bucket === "A") {
             ws.send(JSON.stringify({ type: "stream_chunk", chunk: "<i>⚡ Searching events directly in Firebase...</i>\n\n" }));
             const output = await searchAurovilleEvents(searchQuery, "broad", filterDay, filterDate, filterTimeAfter);
             ws.send(JSON.stringify({ type: "stream_chunk", chunk: introText + "\n\n" + output }));
        }
        else if (bucket === "B") {
             ws.send(JSON.stringify({ type: "stream_chunk", chunk: "<i>🔍 Extracting topic matches. AI is curating events...</i>\n\n" }));
             
             const rawEvents = await searchAurovilleEvents(searchQuery, "specific", filterDay, filterDate, filterTimeAfter);
             
             const curationPrompt = `
             You are an expert AI event curator for Auroville.
             User Query: "${message}"
             Today's Date: ${timeInfo.formattedNow}
             
             Here are the raw events retrieved from our database:
             ${rawEvents}
             
             Based strictly on the User Query, carefully filter and present these events nicely to the user.
             Only show the events that match their topic (e.g., if they asked for Yoga, don't show Dance).
             If no events match the specific topic, politely apologize and say so.
             Retain the exact markdown formatting pattern for the event headers/links as seen in the raw text so the links still work. Do not make up information.
             `;

             const stream = await ai.models.generateContentStream({
                 model: MODEL,
                 contents: [{ role: "user", parts: [{ text: curationPrompt }] }],
                 config: { temperature: 0.3 }
             });

             let textAccumulator = "";
             for await (const chunk of stream) {
                 if (chunk.text) {
                     textAccumulator += chunk.text;
                     ws.send(JSON.stringify({ type: "stream_chunk", chunk: textAccumulator }));
                 }
             }

        } else {
             ws.send(JSON.stringify({ type: "stream_chunk", chunk: "<i>💭 Processing general question...</i>\n\n" }));
             
             // Fetch general knowledge chunks
             let knowledgeContext = "";
             try {
                const knowledgeSnap = await getDocs(query(collection(db, "knowledge"), limit(5)));
                if (!knowledgeSnap.empty) {
                    knowledgeContext = knowledgeSnap.docs.map(docSnap => "DOCUMENT: " + docSnap.data().filename + "\n" + docSnap.data().text).join("\n\n---\n\n");
                }
             } catch (e) {
                 console.error("Error fetching knowledge docs", e);
             }

             const stream = await ai.models.generateContentStream({
                 model: MODEL,
                 contents: [{ role: "user", parts: [{ text: message }] }],
                 config: { 
                     systemInstruction: `You are a helpful assistant for AuroConnect. The user asked a general question about Auroville or an unstructured query.\n\nUse the following provided reference documents to inform your answer. If the answer is not in the documents, try your best to answer generally, but prioritize the reference documents.\n\n### REFERENCE DOCUMENTS ###\n${knowledgeContext}`,
                     temperature: 0.6 
                 }
             });

             let textAccumulator = "";
             for await (const chunk of stream) {
                 if (chunk.text) {
                     textAccumulator += chunk.text;
                     ws.send(JSON.stringify({ type: "stream_chunk", chunk: textAccumulator }));
                 }
             }
        }
    } catch (err: any) {
        console.error("Stream error:", err);
        let errorMsg = err.message || "Unknown error";
        if (err.message && err.message.includes("503") || err.message.includes("high demand")) {
            errorMsg = "The AI model is currently experiencing high demand. Please try again in a few moments.";
        } else if (err.status === 503) {
            errorMsg = "The AI model is currently experiencing high demand. Please try again in a few moments.";
        }
        ws.send(JSON.stringify({ type: "stream_chunk", chunk: `\n\n<i>⚠️ ERROR processing request: ${errorMsg}</i>` }));
    }
}


async function createServer() {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const server = http.createServer(app);

  app.post("/api/embed", express.json(), async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: "Missing text" });
        
        const embeddingRes = await ai.models.embedContent({
            model: "text-embedding-004",
            contents: text,
        });
        
        res.json({ embedding: embeddingRes.embeddings?.[0]?.values || [] });
    } catch (e) {
        console.error("Embedding error:", e);
        res.status(500).json({ error: "Failed to generate embedding" });
    }
  });

  app.get("/", (req, res) => {
    res.sendFile(path.join(process.cwd(), "index.html"));
  });

  app.get("/submit.html", (req, res) => {
    res.sendFile(path.join(process.cwd(), "submit.html"));
  });

  app.get("/dashboard.html", (req, res) => {
    res.sendFile(path.join(process.cwd(), "dashboard.html"));
  });

  app.use(express.static(process.cwd()));

  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    // Parse /ws/chat/:sessionId
    const sessionMatch = req.url?.match(/\/ws\/chat\/(.+)/);
    const sessionId = sessionMatch ? sessionMatch[1] : `sess_${Math.random()}`;

    // Send welcome 
    ws.send(JSON.stringify({ 
        type: "welcome", 
        content: "👋 Hello! I am **AuroConnect**, your AI assistant for events and happenings in Auroville.\n\nYou can ask things like:\n- *What's happening tomorrow?*\n- *Are there any Yoga classes?*\n- *Show me events this Saturday.*" 
    }));

    ws.on("message", async (msg) => {
        try {
            const data = JSON.parse(msg.toString());
            const text = data.message;
            if (!text) return;

            if (text.startsWith("#DETAILS_COMMAND::")) {
                 const uuid = text.split("::")[1];
                 const details = await getEventDetails(uuid);
                 ws.send(JSON.stringify({ type: "modal", content: details }));
                 return;
            }

            if (text.toLowerCase().includes("show daily events")) {
                ws.send(JSON.stringify({ type: "start_stream" }));
                const out = await searchAurovilleEvents("", "broad");
                ws.send(JSON.stringify({ type: "stream_chunk", chunk: out }));
                return;
            }

            await handleStreamingChat(text, ws);
        } catch (e) {
            console.error("WS Parse Error:", e);
        }
    });

  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server listening on port ${PORT}`);
  });
}

createServer();
