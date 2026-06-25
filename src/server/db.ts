import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { AuroEvent } from "../types.js";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config();

// Vector DB Simulation
let eventsCache: AuroEvent[] = [];
let embeddingsCache: Map<string, number[]> = new Map();
let lastFolderStateKey = "";

function getFolderStateKey(): string {
  try {
    const inputDir = path.join(process.cwd(), "AuroConnect-main", "input");
    if (!fs.existsSync(inputDir)) return "";
    const files = fs.readdirSync(inputDir);
    let stateString = "";
    files.sort();
    files.forEach((file) => {
      if (!file.endsWith(".xlsx")) return;
      const filePath = path.join(inputDir, file);
      const stat = fs.statSync(filePath);
      stateString += `${file}:${stat.size}:${stat.mtimeMs}|`;
    });
    return stateString;
  } catch (e) {
    return "";
  }
}

// Helper to convert Excel numeric date to YYYY-MM-DD
function parseExcelDate(val: any): string {
  if (typeof val === "number") {
    try {
      // Excel serial date to JS Date
      const date = new Date((val - 25569) * 86400 * 1000);
      return date.toISOString().split("T")[0];
    } catch (e) {
      return String(val);
    }
  }
  return String(val || "").trim();
}

// Convert telephone string to clean number for WhatsApp link
export function cleanPhoneNumber(phone: string): string {
  if (!phone) return "";
  return phone.replace(/[^0-9]/g, "");
}

// Centralized parsing logic for a single worksheet (used for local and drive files)
function parseWorksheetRows(rows: any[], filename: string, appendTo: AuroEvent[]) {
  rows.forEach((row) => {
    const title = (row["Event Name"] || "").trim();
    if (!title) return;

    // Extract and combine contact details
    const contactPerson = row["Contact Person/Unit"] || "";
    const contactPhone = row["Contact Phone/WhatsApp"] || "";
    const contactEmail = row["Contact Email"] || "";
    
    let contact = "";
    if (contactPerson && contactPerson !== "N/A") contact += contactPerson;
    if (contactPhone && contactPhone !== "N/A") {
      if (contact) contact += ` (${contactPhone})`;
      else contact = String(contactPhone);
    }

    // WhatsApp parsing
    let whatsapp = "";
    if (contactPhone && contactPhone !== "N/A") {
      whatsapp = cleanPhoneNumber(String(contactPhone));
    }

    // Category resolution matching original logic
    let rawCategory = (row["Category"] || row["Type of event"] || "").toLowerCase();
    let category: AuroEvent["category"] = "Daily Events";
    const datesVal = row["Dates"] ? parseExcelDate(row["Dates"]) : "";
    const daysVal = String(row["Days"] || "").trim().toLowerCase();

    if (rawCategory.includes("date") || (datesVal && !datesVal.includes("Mondays") && datesVal !== "N/A")) {
      category = "Date-specific Events";
    } else if (rawCategory.includes("week") || (daysVal && daysVal !== "n/a" && daysVal !== "none" && daysVal !== "[]")) {
      category = "Weekly Events";
    } else if (rawCategory.includes("daily") || rawCategory.includes("appoint") || rawCategory.includes("everyday")) {
      category = "Daily Events";
    } else {
      // Fallback guess
      if (datesVal && datesVal !== "N/A" && datesVal !== "none") {
        category = "Date-specific Events";
      } else if (daysVal && daysVal !== "none" && daysVal !== "[]") {
        category = "Weekly Events";
      }
    }

    // Generate consistent UUID from fingerprint
    const fingerprint = `${title}|${datesVal || daysVal}|${row["Times"] || ""}`;
    const id = crypto.createHash("md5").update(fingerprint).digest("hex");

    const event: AuroEvent = {
      id,
      title,
      type: row["Type of event"] || "Event",
      days: String(row["Days"] || "N/A"),
      dates: datesVal || "N/A",
      times: String(row["Times"] || "N/A"),
      venue: row["Venue"] || "Auroville",
      category,
      description: row["Description"] || "",
      contact: contact || undefined,
      whatsapp: whatsapp || undefined,
      email: contactEmail !== "N/A" ? contactEmail : undefined,
      website: row["Website/Link"] !== "N/A" ? row["Website/Link"] : undefined,
      cost: row["Cost/Contribution"] !== "N/A" ? row["Cost/Contribution"] : undefined,
      audience: row["Target Audience/Prerequisites"] !== "N/A" ? row["Target Audience/Prerequisites"] : undefined,
      pageNo: row["Page No."] ? Number(row["Page No."]) : undefined,
      posterUrl: row["poster url"] || undefined,
      source: filename
    };

    appendTo.push(event);
  });
}

// Load and normalize all events from Local Excel files
export function loadAllEvents(): AuroEvent[] {
  const currentStateKey = getFolderStateKey();
  
  if (eventsCache.length > 0 && currentStateKey === lastFolderStateKey) {
    return eventsCache;
  }

  const inputDir = path.join(process.cwd(), "AuroConnect-main", "input");
  if (!fs.existsSync(inputDir)) {
    console.error("❌ Input directory not found at:", inputDir);
    return [];
  }

  const files = fs.readdirSync(inputDir);
  const events: AuroEvent[] = [];

  files.forEach((file) => {
    if (!file.endsWith(".xlsx")) return;
    const filePath = path.join(inputDir, file);

    try {
      const buf = fs.readFileSync(filePath);
      const workbook = XLSX.read(buf, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);
      
      parseWorksheetRows(rows, file, events);
    } catch (err: any) {
      console.error(`❌ Error parsing file ${file}:`, err.message);
    }
  });

  eventsCache = events;
  lastFolderStateKey = currentStateKey;
  console.log(`✅ Loaded ${events.length} structured events from Excel inputs (Folder Key: ${currentStateKey}).`);
  
  // Kick off dynamic vector index construction in background (non-blocking)
  buildVectorIndex();
  
  return events;
}

// Load events from a Google Drive Folder via API Key (for public folders) on backend
export async function syncDriveFolderEvents(accessToken: string, folderId: string): Promise<AuroEvent[]> {
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth });

    // Ensure we get only Excel/Spreadsheet files
    const res = await drive.files.list({
      q: `'${folderId}' in parents and (mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.google-apps.spreadsheet') and trashed=false`,
      fields: 'files(id, name, mimeType)',
    });

    const files = res.data.files || [];
    console.log(`📂 Found ${files.length} spreadsheet(s) in Drive Folder ${folderId}`);
    
    if (files.length === 0) return eventsCache;
    
    const events: AuroEvent[] = [];
    
    for (const file of files) {
      if (!file.id) continue;
      
      try {
        let buffer: Buffer;
        if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
          // Export Google Sheet as XLSX
          try {
            const exportRes = await drive.files.export(
              { fileId: file.id, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
              { responseType: 'arraybuffer' }
            );
            buffer = Buffer.from(exportRes.data as ArrayBuffer);
          } catch (e: any) {
            console.warn(`Could not export Sheet ${file.name}. Skipping...`);
            continue;
          }
        } else {
          // Download raw XLSX file
          const downloadRes = await drive.files.get(
            { fileId: file.id, alt: 'media' },
            { responseType: 'arraybuffer' }
          );
          buffer = Buffer.from(downloadRes.data as ArrayBuffer);
        }

        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);
        
        parseWorksheetRows(rows, file.name || 'Drive File', events);
      } catch (fileErr: any) {
        console.error(`❌ Failed processing Drive file ${file.name}:`, fileErr.message);
      }
    }
    
    // Only replace cache and re-index if we actually extracted records
    if (events.length > 0) {
      eventsCache = events;
      embeddingsCache.clear(); // Invalidate vectors so they rebuild
      console.log(`✅ Loaded ${events.length} events from Google Drive.`);
      buildVectorIndex();
    }
    
    return eventsCache;
  } catch (err: any) {
    console.error("❌ Google Drive sync failed:", err.message);
    throw err;
  }
}

// Background Task: Simplified to a lightweight logger since we now use powerful local token-based ranking for this database size
export async function buildVectorIndex() {
  console.log("⚡ Optimized Local Search Index is active. Embedding API calls bypassed for maximum reliability and speed.");
}

// HYBRID SEARCH: Exact Metadata Filtering + Smart Token-Based Multi-Field Ranking (Extremely Fast & Robust)
export async function hybridSearch(
  query: string,
  filterDay?: string,
  filterDate?: string,
  categoryFilter?: string
): Promise<AuroEvent[]> {
  const allEvents = loadAllEvents();

  // STEP 1: Metadata Filtering (Like exact database filters)
  let preFiltered = allEvents.filter((event) => {
    if (filterDay) {
      if (!event.days.toLowerCase().includes(filterDay.toLowerCase().trim())) return false;
    }
    if (filterDate) {
      if (event.dates && !event.dates.includes(filterDate.trim())) {
        try {
          const dateObj = new Date(filterDate.trim());
          const weekday = dateObj.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
          if (!event.days.toLowerCase().includes(weekday)) return false;
        } catch {
          return false;
        }
      }
    }
    if (categoryFilter && event.category !== categoryFilter) return false;
    return true;
  });

  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return preFiltered;

  // STEP 2: Rank remaining items using high-quality token-match & containment scoring
  const stopWords = new Set(["and", "the", "for", "with", "from", "you", "our", "your", "are", "this", "that", "in", "at", "of", "to", "on"]);
  const queryTokens = lowerQuery.split(/\s+/).filter(tok => tok.length > 1 && !stopWords.has(tok));

  const scored = preFiltered.map((event) => {
    let score = 0;
    const titleLower = event.title.toLowerCase();
    const typeLower = event.type.toLowerCase();
    const descLower = event.description.toLowerCase();
    const venueLower = event.venue.toLowerCase();

    // 1. Exact match on full query title (extremely high weight)
    if (titleLower === lowerQuery) {
      score += 100;
    } else if (titleLower.includes(lowerQuery)) {
      score += 40;
    }

    // 2. Exact match in Type or Venue
    if (typeLower === lowerQuery || venueLower === lowerQuery) {
      score += 30;
    } else if (typeLower.includes(lowerQuery) || venueLower.includes(lowerQuery)) {
      score += 15;
    }

    // 3. Keyword matches (token-based check for robust multi-word queries)
    if (queryTokens.length > 0) {
      let matchedTokensCount = 0;
      queryTokens.forEach((token) => {
        let tMatched = false;
        if (titleLower.includes(token)) {
          score += 10;
          tMatched = true;
        }
        if (typeLower.includes(token)) {
          score += 5;
          tMatched = true;
        }
        if (venueLower.includes(token)) {
          score += 5;
          tMatched = true;
        }
        if (descLower.includes(token)) {
          score += 2;
          tMatched = true;
        }
        if (tMatched) {
          matchedTokensCount++;
        }
      });

      // Bonus score if multiple query terms are successfully found together (combining filters like "hatha yoga")
      if (matchedTokensCount > 1) {
        score += (matchedTokensCount * 15);
      }
    }

    return { event, score };
  });

  // Filter out completely unmatched results (score is 0) and sort from highest to lowest score
  const matches = scored.filter(item => item.score > 0);
  
  if (matches.length > 0) {
    return matches.sort((a, b) => b.score - a.score).map(item => item.event);
  }

  // Fallback to basic containment filter if no structured tokens scored
  return preFiltered.filter((event) => {
    const combinedText = `${event.title} ${event.type} ${event.venue} ${event.description} ${event.category}`.toLowerCase();
    return combinedText.includes(lowerQuery);
  });
}
