import express from "express";
import path from "path";
import fs from "fs";
import http from "http";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import { read, utils } from "xlsx";
import { db, firebaseConfig } from "./src/server/firebase-ai.js";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { GoogleGenAI } from "@google/genai";
import mammoth from "mammoth";
import * as cheerio from "cheerio";
import _pdfParseModule from "pdf-parse/lib/pdf-parse.js";
const pdfParse = typeof _pdfParseModule === "function" ? _pdfParseModule : (_pdfParseModule as any).default;

import knowledgeRouter from "./src/server/knowledge.js";
import scraperRouter from "./src/server/scraper.js";
import excelRouter from "./src/server/excel.js";


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

// AI setup
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { headers: { "User-Agent": "aistudio-build" } },
});
const MODEL = "gemini-3.1-flash-lite";






const app = express();
app.use(express.json());






app.use(knowledgeRouter);
app.use(scraperRouter);
app.use(excelRouter);
function parseExcelDateToReadable(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      const formatter = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
      return formatter.format(d);
    }
  }
  return dateStr;
}
function isValidTimeFormat(timeStr) {
  if (!timeStr) return false;
  const clean = timeStr.toLowerCase().trim();
  if (!/\d/.test(clean)) return false;
  const matchColon = clean.match(/(\d{1,2})[:.](\d{2})/);
  const matchAmPm = clean.match(/(\d{1,2})\s*(am|pm)/);
  const matchSimpleNum = clean.match(/^\s*\d{1,2}\s*$/);
  const matchRange = clean.match(/^\s*\d{1,2}\s*[-–—to]\s*\d{1,2}\s*$/i);
  return !!(matchColon || matchAmPm || matchSimpleNum || matchRange);
}
function calculateEndTimeIfMissing(startTime) {
  if (!startTime) return "";
  if (!isValidTimeFormat(startTime)) return startTime;
  const lower = startTime.toLowerCase().replace(/\s+/g, "");
  let isPm = lower.includes("pm");
  let isAm = lower.includes("am");
  let t = lower.replace("am", "").replace("pm", "");
  let parts = t.split(":");
  let hours = parseInt(parts[0], 10);
  let mins = parts.length > 1 ? parseInt(parts[1], 10) : 0;
  if (isNaN(hours)) return startTime;
  if (hours >= 12 && hours < 24 && !isAm && !isPm) {
    isPm = true;
    hours -= 12;
  }
  hours += 1;
  let ampm = isPm ? "pm" : "am";
  if (hours === 12 && !isPm) {
    ampm = "pm";
  } else if (hours === 12 && isPm) {
    ampm = "am";
  } else if (hours > 12) {
    hours -= 12;
  }
  const hStr = hours.toString();
  const mStr = mins < 10 ? "0" + mins : mins.toString();
  return `${hStr}:${mStr}${ampm}`;
}
function formatDisplayTimes(timesStr) {
  if (!timesStr) return "";
  const range = splitTimeRange(timesStr);
  const start = range.start.trim();
  const end = range.end.trim();
  if (end) {
    if (!end.toLowerCase().includes("am") && !end.toLowerCase().includes("pm")) {
      return start;
    }
    return `${start} - ${end}`;
  }
  return start;
}
function splitTimeRange(timesStr) {
  if (!timesStr) return { start: "", end: "" };
  const parts = timesStr.split(/\s*(?:-|to|–|—)\s*/i);
  const start = parts[0] || "";
  const end = parts[1] || "";
  return { start: start.trim(), end: end.trim() };
}
function parseMinutesFromTimeStr(timeStr) {
  if (!timeStr) return 0;
  const lower = timeStr.toLowerCase().trim().replace(/\s+/g, "");
  const normalized = lower.replace(".", ":");
  const isPm = normalized.includes("pm");
  const isAm = normalized.includes("am");
  const t = normalized.replace("am", "").replace("pm", "");
  const parts = t.split(":");
  let hours = parseInt(parts[0], 10);
  let mins = parts.length > 1 ? parseInt(parts[1], 10) : 0;
  if (isNaN(hours)) return 0;
  if (hours >= 12 && hours <= 24 && !isAm && !isPm) {
    return hours * 60 + mins;
  }
  if (isPm && hours < 12) hours += 12;
  if (isAm && hours === 12) hours = 0;
  return hours * 60 + mins;
}
function getEventStartAndEndTimes(event) {
  let start = event.originalHeaders?.startTime || event.startTime || "";
  let end = event.originalHeaders?.endTime || event.endTime || "";
  if (!start && !end && event.times) {
    const range = splitTimeRange(event.times);
    start = range.start;
    end = range.end;
  }
  return { start: start.trim(), end: end.trim() };
}
function getDisplayDate(data) {
  const evStart = data.startDate || data.originalHeaders && data.originalHeaders.startDate || "";
  const evEnd = data.endDate || data.originalHeaders && data.originalHeaders.endDate || "";
  if (!evStart) return "";
  if (evEnd && evEnd !== evStart) {
    try {
      const startD = new Date(evStart);
      const endD = new Date(evEnd);
      if (!isNaN(startD.getTime()) && !isNaN(endD.getTime())) {
        const midMs = startD.getTime() + (endD.getTime() - startD.getTime()) / 2;
        const midD = new Date(midMs);
        const y = midD.getFullYear();
        const m = String(midD.getMonth() + 1).padStart(2, "0");
        const d = String(midD.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
    } catch (e) {
      console.error("Error calculating display date midpoint:", e);
    }
  }
  return evStart;
}
function getShortWeekdays(daysField) {
  if (!daysField) return "";
  let daysArr = [];
  if (Array.isArray(daysField)) {
    daysArr = daysField;
  } else if (typeof daysField === "string") {
    let cleaned = daysField.trim();
    if (cleaned.startsWith("[")) {
      try {
        const parsed = JSON.parse(cleaned.replace(/'/g, '"'));
        if (Array.isArray(parsed)) daysArr = parsed;
      } catch (e) {
        daysArr = cleaned.split(/,\s*/);
      }
    } else {
      daysArr = cleaned.split(/,\s*/);
    }
  }
  const shortMap = {
    "monday": "Mon",
    "tuesday": "Tue",
    "wednesday": "Wed",
    "thursday": "Thu",
    "friday": "Fri",
    "saturday": "Sat",
    "sunday": "Sun",
    "mon": "Mon",
    "tue": "Tue",
    "wed": "Wed",
    "thu": "Thu",
    "fri": "Fri",
    "sat": "Sat",
    "sun": "Sun"
  };
  const result = [];
  daysArr.forEach((d) => {
    const lower = d.toLowerCase().trim();
    if (shortMap[lower]) {
      result.push(shortMap[lower]);
    } else if (lower === "daily" || lower === "every day" || lower === "everyday") {
      result.push("day");
    } else {
      result.push(d.charAt(0).toUpperCase() + d.slice(1));
    }
  });
  if (result.length === 0) return "";
  if (result.includes("day")) return "Day";
  return result.join(", ");
}
function formatDatesDisplay(data, categoryType) {
  const evStart = data.startDate || data.originalHeaders && data.originalHeaders.startDate || "";
  const evEnd = data.endDate || data.originalHeaders && data.originalHeaders.endDate || "";
  const isWeekdayStr = (s) => {
    if (!s) return false;
    const lower = s.toLowerCase().trim();
    const weekdays = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
      "mon",
      "tue",
      "wed",
      "thu",
      "fri",
      "sat",
      "sun"
    ];
    return weekdays.includes(lower);
  };
  let parsedDates = [];
  if (data.dates) {
    if (Array.isArray(data.dates)) {
      parsedDates = data.dates.map(String);
    } else if (typeof data.dates === "string") {
      const cleaned = data.dates.trim();
      if (cleaned.startsWith("[")) {
        try {
          const parsed = JSON.parse(cleaned.replace(/'/g, '"'));
          if (Array.isArray(parsed)) parsedDates = parsed.map(String);
        } catch (e) {
          parsedDates = cleaned.split(/,\s*/);
        }
      } else if (cleaned !== "") {
        parsedDates = cleaned.split(/,\s*/);
      }
    }
  }
  let hasRealDate = false;
  let datesDisplay = "";
  if (evStart) {
    hasRealDate = true;
    const readableStart = parseExcelDateToReadable(evStart);
    if (evEnd && evEnd !== evStart) {
      const readableEnd = parseExcelDateToReadable(evEnd);
      datesDisplay = `${readableStart} to ${readableEnd}`;
    } else {
      datesDisplay = readableStart;
    }
  } else if (parsedDates.length > 0) {
    const allWeekdays = parsedDates.every((d) => isWeekdayStr(d));
    if (!allWeekdays) {
      hasRealDate = true;
      datesDisplay = parsedDates.join(", ");
    }
  }
  if (categoryType === "daily" || categoryType === "weekly") {
    if (hasRealDate && datesDisplay) {
      return datesDisplay;
    } else {
      const daysVal = data.days || data.originalHeaders && data.originalHeaders.days || "";
      const shortDays = getShortWeekdays(daysVal);
      if (shortDays) {
        return `Every ${shortDays}`;
      } else {
        return categoryType === "daily" ? "Every Day" : "";
      }
    }
  } else {
    if (datesDisplay) return datesDisplay;
    const daysVal = data.days || data.originalHeaders && data.originalHeaders.days || "";
    const shortDays = getShortWeekdays(daysVal);
    if (shortDays) return `Every ${shortDays}`;
    return "";
  }
}
function isEventEnded(event, currentTime24) {
  const { start, end } = getEventStartAndEndTimes(event);
  if (!start) {
    return false;
  }
  if (!isValidTimeFormat(start)) {
    return false;
  }
  let displayTimeMin = 12 * 60;
  if (end && isValidTimeFormat(end)) {
    let startMin = parseMinutesFromTimeStr(start);
    let endMin = parseMinutesFromTimeStr(end);
    const isStartPm = start.toLowerCase().includes("pm") || startMin >= 12 * 60;
    if (isStartPm && !end.toLowerCase().includes("pm") && !end.toLowerCase().includes("am")) {
      if (endMin < startMin) {
        endMin += 12 * 60;
      }
    } else if (endMin < startMin && !end.toLowerCase().includes("am") && !end.toLowerCase().includes("pm")) {
      endMin += 12 * 60;
    }
    displayTimeMin = endMin;
  } else {
    const calculatedEnd = calculateEndTimeIfMissing(start);
    if (calculatedEnd && isValidTimeFormat(calculatedEnd)) {
      displayTimeMin = parseMinutesFromTimeStr(calculatedEnd);
    } else {
      return false;
    }
  }
  const currMins = parseMinutesFromTimeStr(currentTime24);
  return currMins > displayTimeMin;
}
function createSlug(title, id) {
  const safeTitle = (title || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${safeTitle}-${id}`;
}
function formatEventHTML(data) {
  const categoryType = getEventCategoryType(data);
  const datesDisplay = formatDatesDisplay(data, categoryType);
  let timeDisplay = formatDisplayTimes(data.times || "");
  if (!timeDisplay) {
    const { start, end } = getEventStartAndEndTimes(data);
    if (start && end) {
      timeDisplay = formatDisplayTimes(`${start} - ${end}`);
    } else if (start) {
      timeDisplay = start;
    } else if (end) {
      timeDisplay = formatDisplayTimes(end);
    }
  }
  let badgeLabel = data.category ? data.category.replace(" Events", "") : "";
  if (!badgeLabel) {
    badgeLabel = categoryType === "daily" ? "Daily" : categoryType === "weekly" ? "Weekly" : "Event";
  }
  let badgeBg = "rgba(124, 58, 237, 0.08)";
  let badgeColor = "#7c3aed";
  if (categoryType === "daily") {
    badgeBg = "rgba(16, 185, 129, 0.08)";
    badgeColor = "#10b981";
  } else if (categoryType === "weekly") {
    badgeBg = "rgba(59, 130, 246, 0.08)";
    badgeColor = "#3b82f6";
  }
  const slug = createSlug(data.title, data.uuid);
  const eventTitle = data.title || "Event";
  const row1Parts = [];
  if (timeDisplay) row1Parts.push(`\u23F0 ${timeDisplay}`);
  if (datesDisplay) row1Parts.push(`\u{1F4C5} ${datesDisplay}`);
  if (data.venue) row1Parts.push(`\u{1F4CD} ${data.venue}`);
  const row1 = row1Parts.join(" | ");
  const keyInfoHtml = data.audience ? `<div style="font-size: 0.85rem; color: var(--text); font-weight: 500; margin-top: 4px; display: flex; align-items: center; gap: 6px;"><span>\u{1F4A1}</span> <span>${data.audience}</span></div>` : "";
  const contribHtml = data.cost ? `<div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 500; display: flex; align-items: center; gap: 6px;"><span>\u{1F4B0}</span> <span>${data.cost}</span></div>` : "";
  return `<a href="/event/${slug}" target="_blank" style="text-decoration: none; color: inherit; display: block; margin-bottom: 16px; border-radius: 16px;"><div style="border: 1px solid var(--border); border-radius: 16px; background: var(--surface); box-shadow: var(--shadow); font-family: inherit; overflow: hidden; display: flex; flex-direction: column; cursor: pointer; transition: all 0.2s ease;"><div style="padding: 20px; display: flex; flex-direction: column; flex-grow: 1;"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; width: 100%;"><div style="display: flex; gap: 6px;"><span style="background: ${badgeBg}; color: ${badgeColor}; font-size: 0.725rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 10px; border-radius: 99px;">${badgeLabel}</span></div><div style="color: #10b981; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: rgba(16, 185, 129, 0.08);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg></div></div>` + (data.type ? `<div style="font-size: 0.75rem; font-weight: 600; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">${data.type}</div>` : "") + `<h4 style="margin: 0 0 4px 0; font-size: 1.15rem; font-weight: 800; color: var(--text); line-height: 1.35; letter-spacing: -0.025em; padding: 0;">${eventTitle}</h4><div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 4px;"><div style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--text-secondary); font-weight: 500;">${row1}</div>` + keyInfoHtml + contribHtml + `</div></div></div></a>`;
}
function escapeAttr(str) {
  if (!str) return "";
  return str.toString().replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function formatEventMarkdown(data) {
  const categoryType = getEventCategoryType(data);
  const datesDisplay = formatDatesDisplay(data, categoryType);
  let timeDisplay = formatDisplayTimes(data.times || "");
  if (!timeDisplay) {
    const { start, end } = getEventStartAndEndTimes(data);
    if (start && end) {
      timeDisplay = formatDisplayTimes(`${start} - ${end}`);
    } else if (start) {
      timeDisplay = start;
    } else if (end) {
      timeDisplay = formatDisplayTimes(end);
    }
  }
  const idEsc = escapeAttr(data.uuid || data.id || "");
  let topBar = "";
  if (data.type || datesDisplay) {
    topBar = `<span class="ec-topbar"><span class="ec-type">${data.type ? `*${escapeAttr(data.type)}*` : ""}</span><span class="ec-date">${datesDisplay ? escapeAttr(datesDisplay) : ""}</span></span>`;
  }
  const header = `${topBar}**[${data.title || "Event"}](#DETAILS::${idEsc})**`;
  const row1Parts = [];
  if (timeDisplay) {
    row1Parts.push(`\u23F0 ${timeDisplay}`);
  }
  if (data.venue) {
    row1Parts.push(`\u{1F4CD} ${data.venue}`);
  }
  const row1 = row1Parts.join(" | ");
  const s = [header];
  if (row1) {
    s.push(row1);
  }
  if (data.audience) {
    s.push(`\u{1F4A1} ${data.audience}`);
  }
  if (data.cost) {
    s.push(`\u{1F4B0} ${data.cost}`);
  }
  return s.join("  \n");
}
function getEventCategoryType(event) {
  const category = (event.category || "").toLowerCase().trim();
  const days = (event.days || "").toLowerCase().trim();
  const scheduleType = (event.scheduleType || "").toLowerCase().trim();
  if (category.includes("daily") || category === "daily events") {
    return "daily";
  }
  if (category.includes("weekly") || category === "weekly events") {
    return "weekly";
  }
  if (category.includes("date") || category.includes("one-time")) {
    return "date-specific";
  }
  if (days.includes("daily") || days.includes("every day") || days.includes("everyday")) {
    return "daily";
  }
  if (scheduleType === "recurring") {
    return "weekly";
  }
  return "date-specific";
}
function getEventTimeString(ev) {
  if (ev.startTime) return ev.startTime.trim().toLowerCase();
  if (ev.originalHeaders && ev.originalHeaders.startTime) return ev.originalHeaders.startTime.trim().toLowerCase();
  if (ev.times) return ev.times.trim().toLowerCase();
  return "";
}
function getMinutesFromTimeString(t) {
  if (!t) return 9999;
  const matchColon = t.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/);
  if (matchColon) {
    let hours = parseInt(matchColon[1], 10);
    let minutes = parseInt(matchColon[2], 10);
    let ampm = matchColon[3];
    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  const matchNoColon = t.match(/(\d{1,2})\s*(am|pm)/);
  if (matchNoColon) {
    let hours = parseInt(matchNoColon[1], 10);
    let minutes = 0;
    let ampm = matchNoColon[2];
    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  const matchNumbers = t.match(/(\d{1,2})/);
  if (matchNumbers) {
    let hours = parseInt(matchNumbers[1], 10);
    return hours * 60;
  }
  return 9999;
}
function compareStartTime(a, b) {
  const timeA = getEventTimeString(a);
  const timeB = getEventTimeString(b);
  const minsA = getMinutesFromTimeString(timeA);
  const minsB = getMinutesFromTimeString(timeB);
  return minsA - minsB;
}
function formatCategorizedEvents(rawEvents, introText) {
  if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
    return introText + "\n\nI couldn't find any upcoming events matching those criteria.";
  }
  const dateSpecific = [];
  const weekly = [];
  const daily = [];
  rawEvents.forEach((ev) => {
    const catType = getEventCategoryType(ev);
    if (catType === "daily") {
      daily.push(ev);
    } else if (catType === "weekly") {
      weekly.push(ev);
    } else {
      dateSpecific.push(ev);
    }
  });
  dateSpecific.sort(compareStartTime);
  weekly.sort(compareStartTime);
  daily.sort(compareStartTime);
  const formatEvent = formatEventMarkdown;
  let resultChunks = [];
  if (introText) {
    resultChunks.push(introText);
  }
  if (dateSpecific.length > 0) {
    resultChunks.push("\n### Date-specific Events");
    dateSpecific.forEach((ev) => {
      resultChunks.push(formatEvent(ev));
      resultChunks.push("");
    });
  }
  if (weekly.length > 0) {
    resultChunks.push("\n### Weekly Events");
    weekly.forEach((ev) => {
      resultChunks.push(formatEvent(ev));
      resultChunks.push("");
    });
  }
  if (daily.length > 0) {
    resultChunks.push("\n---");
    resultChunks.push("\u{1F4A1} **There are Daily Events Happening, would you like to see?**");
    resultChunks.push(`
<div style="margin-top: 12px; display: flex; gap: 8px;">
  <a href="#SHOWDAILY" style="display: inline-block; padding: 8px 18px; background-color: var(--accent); color: white; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 0.85rem; border: 1px solid var(--accent); cursor: pointer; text-align: center;">Yes, show daily events</a>
  <a href="#NODAILY" style="display: inline-block; padding: 8px 18px; background-color: transparent; color: var(--text-secondary); border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 0.85rem; border: 1px solid var(--border); cursor: pointer; text-align: center;">No, thanks</a>
</div>
`);
  }
  if (dateSpecific.length === 0 && weekly.length === 0 && daily.length === 0) {
    return (introText ? introText + "\n\n" : "") + "I couldn't find any upcoming events matching those criteria.";
  }
  return resultChunks.join("\n");
}
function formatDailyEventsOnly(rawEvents) {
  const daily = rawEvents.filter((ev) => getEventCategoryType(ev) === "daily");
  daily.sort(compareStartTime);
  if (daily.length === 0) {
    return "I couldn't find any daily events matching those criteria.";
  }
  const formatEvent = formatEventMarkdown;
  let resultChunks = ["### Daily Events\n"];
  daily.forEach((ev) => {
    resultChunks.push(formatEvent(ev));
    resultChunks.push("");
  });
  return resultChunks.join("\n");
}
async function searchAurovilleEvents(searchQuery, specificity, filterDay, filterDate, filterTimeAfter, returnRaw, timeZone) {
  const timeInfo = getCurrentTimeInfo(timeZone);
  try {
    const colRef = collection(db, "events");
    const snapshot = await getDocs(colRef);
    let events = snapshot.docs.map((docSnap) => ({ uuid: docSnap.id, ...docSnap.data() } as any));
    if (searchQuery && specificity === "specific") {
      try {
        const embedRes = await ai.models.embedContent({
          model: "gemini-embedding-2-preview",
          contents: searchQuery,
          config: { outputDimensionality: 768 }
        });
        const queryVector = embedRes.embeddings?.[0]?.values;
        if (queryVector) {
          for (const event of events) {
            let eventVector = event.embeddingVector;
            if (eventVector && typeof eventVector.toArray === "function") {
              eventVector = eventVector.toArray();
            }
            if (Array.isArray(eventVector) && eventVector.length === queryVector.length) {
              event.similarityScore = cosineSimilarity(queryVector, eventVector);
            } else {
              event.similarityScore = -1;
            }
          }
          events.sort((a, b) => (b.similarityScore || -1) - (a.similarityScore || -1));
          events = events.slice(0, 10);
        }
      } catch (err) {
        console.error("Embedding search failed:", err);
      }
    }
    if (filterTimeAfter) {
      events = events.filter((data) => {
        if (!data.startTime) return true;
        return data.startTime >= filterTimeAfter;
      });
    }
    if (specificity === "specific" && searchQuery) {
      events = events.filter((data) => {
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
    const getWeekdayFromDateStr = (dateStr) => {
      try {
        const parts = dateStr.split("-");
        if (parts.length === 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
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
      events = events.filter((data) => {
        const daysStr = Array.isArray(data.days) ? data.days.join(" ") : String(data.days || "");
        const daysLower = daysStr.toLowerCase();
        const catStr = String(data.category || "").toLowerCase().trim();
        const schedStr = String(data.scheduleType || "").toLowerCase().trim();
        const categoryType = getEventCategoryType(data);
        const isDaily = daysLower.includes("daily") || daysLower.includes("every day") || daysLower.includes("everyday") || catStr === "daily events" || categoryType === "daily";
        const isWeekly = catStr === "weekly events" || schedStr === "recurring" || categoryType === "weekly";
        const isDateSpecific = catStr === "date-specific events" || catStr.includes("date") || schedStr === "one-time" || categoryType === "date-specific";
        let isDateMatch = false;
        if (isDaily) {
          isDateMatch = true;
        } else if (isWeekly) {
          if (targetDay && daysLower.includes(targetDay.toLowerCase())) {
            isDateMatch = true;
          }
        } else {
          const datesField = Array.isArray(data.dates) ? data.dates.join(" ") : String(data.dates || "");
          const startDateMeta = Array.isArray(data.start_date_meta) ? data.start_date_meta.join(" ") : String(data.start_date_meta || "");
          const displayDate = getDisplayDate(data);
          let meetsDateLimit = true;
          if (displayDate && filterDate > displayDate) {
            meetsDateLimit = false;
          }
          if (meetsDateLimit) {
            if (datesField.includes(filterDate) || startDateMeta.includes(filterDate)) {
              isDateMatch = true;
            }
            const evStart = data.startDate || data.originalHeaders && data.originalHeaders.startDate;
            if (!isDateMatch && evStart) {
              if (filterDate >= evStart && filterDate <= displayDate) {
                if (!daysStr) {
                  isDateMatch = true;
                } else {
                  if (targetDay && daysLower.includes(targetDay.toLowerCase())) {
                    isDateMatch = true;
                  }
                }
              }
            }
          }
        }
        if (isDateMatch && filterDate === timeInfo.dateStr) {
          let checkTime = false;
          if (isDaily || isWeekly) {
            checkTime = true;
          } else {
            const displayDate = getDisplayDate(data);
            if (!displayDate || filterDate === displayDate) {
              checkTime = true;
            }
          }
          if (checkTime && isEventEnded(data, timeInfo.time24)) {
            isDateMatch = false;
          }
        }
        return isDateMatch;
      });
    } else if (filterDay) {
      events = events.filter((data) => {
        const daysLower = (data.days || "").toLowerCase();
        const isDaily = daysLower.includes("daily") || daysLower.includes("every day") || daysLower.includes("everyday") || data.category === "Daily Events";
        let isMatch = isDaily || daysLower.includes(filterDay.toLowerCase());
        if (isMatch && timeInfo.weekday.toLowerCase() === filterDay.toLowerCase()) {
          if (isEventEnded(data, timeInfo.time24)) {
            isMatch = false;
          }
        }
        return isMatch;
      });
    }
    if (returnRaw) {
      return events;
    }
    if (events.length === 0) {
      return "I couldn't find any upcoming events matching those criteria.";
    }
    let out = [];
    events.forEach((data, index) => {
      out.push(formatEventMarkdown(data));
      out.push("");
    });
    return out.join("\n");
  } catch (err) {
    console.error("Firebase fetch error", err);
    return "Database query failed.";
  }
}
async function getEventDetails(eventId) {
  try {
    const docRef = await getDoc(doc(db, "events", eventId));
    if (!docRef.exists()) return "⚠️ **Details not found.**";
    const data = docRef.data();
    const header = [];
    header.push(`### ${data.title}`);
    if (data.type || data.category) header.push(`_${data.type || data.category}_`);
    const details = [];
    if (data.dates || data.days) details.push(`**Date:** ${data.dates || data.days}`);
    if (data.times) details.push(`**Time:** ${data.times}`);
    if (data.venue) details.push(`**Location:** ${data.venue}`);
    if (data.cost) details.push(`**Cost/Contribution:** ${data.cost}`);
    if (data.audience) details.push(`**Key info:** ${data.audience}`);
    if (data.contact) details.push(`**Phone:** ${data.contact}`);
    if (data.email) details.push(`**Email:** ${data.email}`);
    if (data.whatsapp) {
      const waNumber = data.whatsapp.replace(/[^0-9]/g, "");
      details.push(`\u{1F4AC} [Message on WhatsApp](https://wa.me/${waNumber})`);
    }
    if (data.website) details.push(`\u{1F517} [Official Website](${data.website.startsWith("http") ? data.website : "https://" + data.website})`);
    if (data.description) details.push(`**Description:**
${data.description}`);
    if (data.posterUrl && data.posterUrl.includes("firebasestorage.googleapis.com")) details.push(`\u{1F517} [View Image](${data.posterUrl})`);
    return `${header.join("\n\n")}

${details.join("\n\n")}`;
  } catch (e) {
    return "Error loading details.";
  }
}
function getCurrentTimeInfo(userTimeZone) {
  const tz = userTimeZone || "Asia/Kolkata";
  const options = { timeZone: tz };
  const d = /* @__PURE__ */ new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
  const timeFormatter24 = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const time24 = timeFormatter24.format(d);
  const parts = formatter.formatToParts(d);
  let day = "", month = "", year = "", weekday = "", time = "";
  for (const part of parts) {
    if (part.type === "day") day = part.value;
    else if (part.type === "month") month = part.value;
    else if (part.type === "year") year = part.value;
    else if (part.type === "weekday") weekday = part.value;
  }
  return { dateStr: `${year}-${month}-${day}`, weekday, time24, formattedNow: d.toLocaleString("en-US", { ...options, dateStyle: "full", timeStyle: "short" }) };
}
async function handleStreamingChat(message, ws, chatHistory, timeZone) {
  try {
    const timeInfo = getCurrentTimeInfo(timeZone);
    ws.send(JSON.stringify({ type: "start_stream" }));
    ws.send(JSON.stringify({ type: "stream_chunk", chunk: "<i>\u{1F50D} Analyzing query...</i>" }));
    const recentHistory = chatHistory.slice(-7);
    const historyText = recentHistory.map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.text}`).join("\n");
    const classifierPrompt = `
        You are an AI assistant designed to classify user queries for AuroConnect, an overall guide for Auroville that provides information about both Events and General Knowledge.
        Today's date is: ${timeInfo.formattedNow}.

        Recent Chat History (for context):
        ${historyText || "No previous history."}

        Analyze the user query: "${message}" (use history for context if the query is a follow-up or ambiguous)
        
        Categorize it into one of these buckets:
        "A": Broad event search based on date/time only. The user wants to see what events are happening but doesn't specify a topic. Example: "What's happening tomorrow?", "Events on Friday", "Events after 7pm".
        "B": Specific event search. The user explicitly asks for events, workshops, or classes about a specific topic. Example: "Yoga classes on Friday", "Sound healing events", "Are there any music concerts today?".
        "C": General information, facts, services, or conversational questions. Use this for places (e.g., "Matrimandir"), services (e.g., "bus service", "volunteering"), or broad topics. IF THE QUERY IS AMBIGUOUS (e.g., just "Matrimandir" could mean "events at Matrimandir" or "information about Matrimandir"), classify it as "C".

        Return ONLY a valid JSON object matching this schema:
        {
            "bucket": "A", 
            "search_query": "Cleaned, expanded query for semantic DB search. Combine context from chat history and the current query to make a detailed search string (REQUIRED for all buckets).",
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
    } catch {
    }
    ws.send(JSON.stringify({ type: "start_stream" }));
    if (bucket === "A") {
      ws.send(JSON.stringify({ type: "stream_chunk", chunk: "<i>\u26A1 Searching events directly in Firebase...</i>\n\n" }));
      const rawEvents = await searchAurovilleEvents(searchQuery, "broad", filterDay, filterDate, filterTimeAfter, true, timeZone);
      let botReply = "";
      if (Array.isArray(rawEvents)) {
        const output = formatCategorizedEvents(rawEvents, introText);
        botReply = output;
        ws.send(JSON.stringify({ type: "stream_chunk", chunk: output }));
      } else {
        botReply = (introText ? introText + "\n\n" : "") + String(rawEvents);
        ws.send(JSON.stringify({ type: "stream_chunk", chunk: botReply }));
      }
      chatHistory.push({ role: "user", text: message });
      chatHistory.push({ role: "model", text: botReply });
    } else if (bucket === "B") {
      ws.send(JSON.stringify({ type: "stream_chunk", chunk: "<i>\u{1F50D} Extracting topic matches. AI is curating events...</i>\n\n" }));
      const rawEvents = await searchAurovilleEvents(searchQuery, "specific", filterDay, filterDate, filterTimeAfter, false, timeZone);
      const curationPrompt = `
             You are an expert AI event curator for Auroville.
             User Query: "${message}"
             Today's Date: ${timeInfo.formattedNow}
             
             Here are the raw events retrieved from our database:
             ${rawEvents}
             
             Based strictly on the User Query, carefully filter and present these events nicely to the user.
             Only show the events that match their topic (e.g., if they asked for Yoga, don't show Dance).
             If no events match the specific topic, politely apologize and say so.
             
             CRITICAL COMPLIANCE RULES FOR EVENT DISPLAY:
             1. Each event in the raw database list is provided as a unique markdown string starting with \`**[Event Title](#DETAILS::uuid)**\`.
             2. You MUST preserve and output the EXACT, unmodified markdown string for each event you select.
             3. Do NOT escape the brackets or asterisks (e.g. do not write \\[ or \\*\\*). Output the markdown exactly as provided so the client can render it as interactive cards.
             4. Do NOT wrap the events in markdown code blocks (such as \`\`\`markdown or backticks).
             `;
      const res = await ai.models.generateContent({
        model: MODEL,
        contents: [
          ...recentHistory.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
          { role: "user", parts: [{ text: curationPrompt }] }
        ],
        config: { temperature: 0.3 }
      });
      let textAccumulator = res.text || "";
      textAccumulator = textAccumulator.replace(/\\\[/g, "[").replace(/\\\]/g, "]").replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\*/g, "*").replace(/\\\_/g, "_");
      ws.send(JSON.stringify({ type: "stream_chunk", chunk: textAccumulator }));
      chatHistory.push({ role: "user", text: message });
      chatHistory.push({ role: "model", text: textAccumulator });
    } else {
      ws.send(JSON.stringify({ type: "stream_chunk", chunk: "<i>\u{1F4AD} Processing general question...</i>\n\n" }));
      let knowledgeContext = "";
      try {
        let queryEmbedding = null;
        try {
          const embedRes = await ai.models.embedContent({
            model: "gemini-embedding-2-preview",
            contents: searchQuery || message,
            config: { outputDimensionality: 768 }
          });
          queryEmbedding = embedRes.embeddings?.[0]?.values || null;
        } catch (embedErr) {
          console.error("Failed to generate query embedding for chat:", embedErr);
        }
        const knowledgeCol = collection(db, "knowledge");
        const knowledgeSnap = await getDocs(knowledgeCol);
        if (!knowledgeSnap.empty) {
          const docs = knowledgeSnap.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              filename: data.filename || "Unknown",
              text: data.text || "",
              embeddingVector: data.embeddingVector || null,
              chunkIndex: data.chunkIndex || 0
            };
          });
          if (queryEmbedding) {
            console.log(`[RAG] queryEmbedding generated with length ${queryEmbedding.length}`);
            const scoredDocs = docs.map((doc2) => {
              let score = 0;
              if (doc2.embeddingVector) {
                let docVec = doc2.embeddingVector;
                if (docVec && typeof docVec.toArray === "function") {
                  docVec = docVec.toArray();
                }
                if (Array.isArray(docVec) && docVec.length === queryEmbedding.length) {
                  score = cosineSimilarity(queryEmbedding, docVec);
                }
              }
              return { ...doc2, score };
            });
            scoredDocs.sort((a, b) => b.score - a.score);
            console.log(`[RAG] Top 3 chunks scores:`, scoredDocs.slice(0, 3).map((d) => ({ file: d.filename, chunk: d.chunkIndex, score: d.score })));
            const topChunks = scoredDocs.slice(0, 10);
            const chunksToInclude = /* @__PURE__ */ new Set();
            const docMap = /* @__PURE__ */ new Map();
            docs.forEach((doc2) => {
              const key = `${doc2.filename}_${doc2.chunkIndex}`;
              docMap.set(key, doc2);
            });
            const finalChunks = [];
            const addedKeys = /* @__PURE__ */ new Set();
            topChunks.forEach((chunk) => {
              const indices = [chunk.chunkIndex - 1, chunk.chunkIndex, chunk.chunkIndex + 1];
              indices.forEach((idx) => {
                const key = `${chunk.filename}_${idx}`;
                if (!addedKeys.has(key) && docMap.has(key)) {
                  addedKeys.add(key);
                  finalChunks.push(docMap.get(key));
                }
              });
            });
            const chunksByFile: Record<string, any[]> = {};
            finalChunks.forEach((c) => {
              if (!chunksByFile[c.filename]) chunksByFile[c.filename] = [];
              chunksByFile[c.filename].push(c);
            });
            knowledgeContext = Object.entries(chunksByFile).map(([filename, fileChunks]) => {
              fileChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
              const combinedText = fileChunks.map((c) => `[Chunk ${c.chunkIndex}]
${c.text}`).join("\n...\n");
              return `DOCUMENT: ${filename}
${combinedText}`;
            }).join("\n\n---\n\n");
          }
        }
      } catch (e) {
        console.error("Error fetching knowledge docs", e);
      }
      const fullPrompt = `You are a helpful assistant for AuroConnect, an overall guide to Auroville. The user asked a general question about Auroville or an unstructured query.

Use the following provided reference documents to inform your answer. If the answer is not in the documents, try your best to answer generally, but prioritize the reference documents. 

IMPORTANT: If the user's query is ambiguous and it is unclear if they are looking for general information OR if they are looking for specific events (e.g., they just say "Matrimandir" or "volunteering"), provide a brief, helpful general answer AND politely ask them to clarify if they were looking for events related to that topic or just general information.

### REFERENCE DOCUMENTS ###
${knowledgeContext}

### USER QUERY ###
${message}`;
      const res = await ai.models.generateContent({
        model: MODEL,
        contents: [
          ...recentHistory.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
          { role: "user", parts: [{ text: fullPrompt }] }
        ],
        config: {
          temperature: 0.6
        }
      });
      let textAccumulator = res.text || "";
      textAccumulator = textAccumulator.replace(/\\\[/g, "[").replace(/\\\]/g, "]").replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\*/g, "*").replace(/\\\_/g, "_");
      ws.send(JSON.stringify({ type: "stream_chunk", chunk: textAccumulator }));
      chatHistory.push({ role: "user", text: message });
      chatHistory.push({ role: "model", text: textAccumulator });
    }
  } catch (err) {
    console.error("Stream error:", err);
    let errorMsg = err.message || "Unknown error";
    if (err.message && err.message.includes("503") || err.message.includes("high demand")) {
      errorMsg = "The AI model is currently experiencing high demand. Please try again in a few moments.";
    } else if (err.status === 503) {
      errorMsg = "The AI model is currently experiencing high demand. Please try again in a few moments.";
    }
    ws.send(JSON.stringify({ type: "stream_chunk", chunk: `

<i>\u26A0\uFE0F ERROR processing request: ${errorMsg}</i>` }));
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
            config: { outputDimensionality: 768 }
        });
        
        res.json({ embedding: embeddingRes.embeddings?.[0]?.values || [] });
    } catch (e) {
        console.error("Embedding error:", e);
        res.status(500).json({ error: "Failed to generate embedding" });
    }
  });

  // REST API routes for frontend UI queries

  app.post("/api/chat", express.json(), async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
        const { messages, timeZone } = req.body;
        const tz = timeZone || "Asia/Kolkata";
        const timeInfo = getCurrentTimeInfo(tz);

        if (!Array.isArray(messages) || messages.length === 0) {
            res.write(`data: ${JSON.stringify({ chunk: "No messages provided." })}\n\n`);
            res.write("data: [DONE]\n\n");
            return res.end();
        }

        const lastMessage = messages[messages.length - 1].content;
        const chatHistory = messages.slice(0, -1).map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            text: m.content
        }));

        const lowerText = lastMessage.toLowerCase().trim();
        
        if (
            lowerText.includes("show daily events") || 
            lowerText === "yes" || 
            lowerText.includes("pull down all diary events") || 
            lowerText.includes("pull down all daily events") || 
            lowerText.includes("show daily")
        ) {
            res.write(`data: ${JSON.stringify({ chunk: "<i>☀️ Pulling down all daily events...</i>\n\n" })}\n\n`);
            const rawEvents = await searchAurovilleEvents("", "broad", undefined, undefined, undefined, true, tz);
            if (Array.isArray(rawEvents)) {
                const output = formatDailyEventsOnly(rawEvents);
                res.write(`data: ${JSON.stringify({ chunk: output })}\n\n`);
            } else {
                res.write(`data: ${JSON.stringify({ chunk: "Failed to load daily events." })}\n\n`);
            }
            res.write("data: [DONE]\n\n");
            return res.end();
        }

        if (lowerText === "no, thank you" || lowerText === "no" || lowerText === "no thanks" || lowerText === "no, thanks") {
            res.write(`data: ${JSON.stringify({ chunk: "No problem! Let me know if you need help finding any other events." })}\n\n`);
            res.write("data: [DONE]\n\n");
            return res.end();
        }

        res.write(`data: ${JSON.stringify({ chunk: "<i>🔍 Analyzing query...</i>" })}\n\n`);

        const recentHistory = chatHistory.slice(-7);
        const historyText = recentHistory.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join("\n");

        const classifierPrompt = `
        You are an AI assistant designed to classify user queries for AuroConnect, an overall guide for Auroville that provides information about both Events and General Knowledge.
        Today's date is: ${timeInfo.formattedNow}.

        Recent Chat History (for context):
        ${historyText || "No previous history."}

        Analyze the user query: "${lastMessage}" (use history for context if the query is a follow-up or ambiguous)
        
        Categorize it into one of these buckets:
        "A": Broad event search based on date/time only. The user wants to see what events are happening but doesn't specify a topic. Example: "What's happening tomorrow?", "Events on Friday", "Events after 7pm".
        "B": Specific event search. The user explicitly asks for events, workshops, or classes about a specific topic. Example: "Yoga classes on Friday", "Sound healing events", "Are there any music concerts today?".
        "C": General information, facts, services, or conversational questions. Use this for places (e.g., "Matrimandir"), services (e.g., "bus service", "volunteering"), or broad topics. IF THE QUERY IS AMBIGUOUS (e.g., just "Matrimandir" could mean "events at Matrimandir" or "information about Matrimandir"), classify it as "C".

        Return ONLY a valid JSON object matching this schema:
        {
            "bucket": "A", 
            "search_query": "Cleaned, expanded query for semantic DB search. Combine context from chat history and the current query to make a detailed search string (REQUIRED for all buckets).",
            "intro_text": "A friendly ONE SENTENCE intro for the user (only needed for bucket A)",
            "filter_date": "YYYY-MM-DD",
            "filter_day": "Monday",
            "filter_time_after": "HH:MM (e.g., morning=06:00, afternoon=12:00, evening=17:00, night=20:00)"
        }`;

        const classRes = await ai.models.generateContent({
            model: MODEL,
            contents: classifierPrompt,
            config: {
                temperature: 0.1,
                responseMimeType: "application/json"
            }
        });
        
        let bucket = "C", searchQuery = lastMessage, introText = "Here is what I found:", filterDate = "", filterDay = "", filterTimeAfter = "";
        try {
            const parsed = JSON.parse(classRes.text || "{}");
            bucket = parsed.bucket || "C";
            searchQuery = parsed.search_query || lastMessage;
            introText = parsed.intro_text || "Here is what I found:";
            filterDate = parsed.filter_date;
            filterDay = parsed.filter_day;
            filterTimeAfter = parsed.filter_time_after;
        } catch { }

        if (bucket === "A") {
             res.write(`data: ${JSON.stringify({ chunk: "<i>⚡ Searching events directly in Firebase...</i>\n\n" })}\n\n`);
             const rawEvents = await searchAurovilleEvents(searchQuery, "broad", filterDay, filterDate, filterTimeAfter, true, tz);
             if (Array.isArray(rawEvents)) {
                 const output = formatCategorizedEvents(rawEvents, introText);
                 res.write(`data: ${JSON.stringify({ chunk: output })}\n\n`);
             } else {
                 res.write(`data: ${JSON.stringify({ chunk: (introText ? introText + "\n\n" : "") + String(rawEvents) })}\n\n`);
             }
        }
        else if (bucket === "B") {
             res.write(`data: ${JSON.stringify({ chunk: "<i>🔍 Extracting topic matches. AI is curating events...</i>\n\n" })}\n\n`);
             const rawEvents = await searchAurovilleEvents(searchQuery, "specific", filterDay, filterDate, filterTimeAfter, false, tz);
             
             const curationPrompt = `
             You are an expert AI event curator for Auroville.
             User Query: "${lastMessage}"
             Today's Date: ${timeInfo.formattedNow}
             
             Here are the raw events retrieved from our database:
             ${rawEvents}
             
             Based strictly on the User Query, carefully filter and present these events nicely to the user.
             Only show the events that match their topic (e.g., if they asked for Yoga, don't show Dance).
             If no events match the specific topic, politely apologize and say so.
             
             CRITICAL COMPLIANCE RULES FOR EVENT DISPLAY:
             1. Each event in the raw database list is provided as a unique markdown string starting with \`**[Event Title](#DETAILS::uuid)**\`.
             2. You MUST preserve and output the EXACT, unmodified markdown string for each event you select.
             3. Do NOT escape the brackets or asterisks (e.g. do not write \\[ or \\*\\*). Output the markdown exactly as provided so the client can render it as interactive cards.
             4. Do NOT wrap the events in markdown code blocks (such as \`\`\`markdown or backticks).
             `;

             const aiRes = await ai.models.generateContent({
                 model: MODEL,
                 contents: [
                     ...recentHistory.map((h: any) => ({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.text }] })),
                     { role: "user", parts: [{ text: curationPrompt }] }
                 ],
                 config: { temperature: 0.3 }
             });

             let textAccumulator = aiRes.text || "";
             textAccumulator = textAccumulator.replace(/\\\[/g, '[').replace(/\\\]/g, ']').replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\*/g, '*').replace(/\\\_/g, '_');
             res.write(`data: ${JSON.stringify({ chunk: textAccumulator })}\n\n`);
        }
        else {
             res.write(`data: ${JSON.stringify({ chunk: "<i>💭 Processing general question...</i>\n\n" })}\n\n`);
             
             let knowledgeContext = "";
             try {
                let queryEmbedding: number[] | null = null;
                try {
                    const embedRes = await ai.models.embedContent({
                        model: "text-embedding-004",
                        contents: searchQuery || lastMessage,
                        config: { outputDimensionality: 768 }
                    });
                    queryEmbedding = embedRes.embeddings?.[0]?.values || null;
                } catch (embedErr) {
                    console.error("Failed to generate query embedding for chat:", embedErr);
                }

                const knowledgeCol = collection(db, "knowledge");
                const knowledgeSnap = await getDocs(knowledgeCol);
                
                if (!knowledgeSnap.empty) {
                    const docs = knowledgeSnap.docs.map(docSnap => {
                        const data = docSnap.data();
                        return {
                            filename: data.filename || "Unknown",
                            text: data.text || "",
                            embeddingVector: data.embeddingVector || null,
                            chunkIndex: data.chunkIndex || 0
                        };
                    });

                    if (queryEmbedding) {
                        const scoredDocs = docs.map(doc => {
                            let score = 0;
                            if (doc.embeddingVector) {
                                let docVec = doc.embeddingVector;
                                if (docVec && typeof docVec.toArray === 'function') {
                                    docVec = docVec.toArray();
                                }
                                if (Array.isArray(docVec) && docVec.length === queryEmbedding!.length) {
                                    score = cosineSimilarity(queryEmbedding!, docVec);
                                }
                            }
                            return { ...doc, score };
                        });
                        
                        scoredDocs.sort((a, b) => b.score - a.score);
                        const topChunks = scoredDocs.slice(0, 10);
                        
                        const docMap = new Map<string, typeof docs[0]>();
                        docs.forEach(doc => {
                            const key = `${doc.filename}_${doc.chunkIndex}`;
                            docMap.set(key, doc);
                        });
                        
                        const finalChunks: typeof docs = [];
                        const addedKeys = new Set<string>();
                        
                        topChunks.forEach(chunk => {
                            const indices = [chunk.chunkIndex - 1, chunk.chunkIndex, chunk.chunkIndex + 1];
                            indices.forEach(idx => {
                                const key = `${chunk.filename}_${idx}`;
                                if (!addedKeys.has(key) && docMap.has(key)) {
                                    addedKeys.add(key);
                                    finalChunks.push(docMap.get(key)!);
                                }
                            });
                        });
                        
                        const chunksByFile: Record<string, typeof docs> = {};
                        finalChunks.forEach(c => {
                            if (!chunksByFile[c.filename]) chunksByFile[c.filename] = [];
                            chunksByFile[c.filename].push(c);
                        });
                        
                        knowledgeContext = Object.entries(chunksByFile).map(([filename, fileChunks]) => {
                            fileChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
                            const combinedText = fileChunks.map(c => `[Chunk ${c.chunkIndex}]\n${c.text}`).join("\n...\n");
                            return `DOCUMENT: ${filename}\n${combinedText}`;
                        }).join("\n\n---\n\n");
                    }
                }
             } catch (e) {
                 console.error("Error fetching knowledge docs", e);
             }

             const fullPrompt = `You are a helpful assistant for AuroConnect, an overall guide to Auroville. The user asked a general question about Auroville or an unstructured query.

Use the following provided reference documents to inform your answer. If the answer is not in the documents, try your best to answer generally, but prioritize the reference documents. 

IMPORTANT: If the user's query is ambiguous and it is unclear if they are looking for general information OR if they are looking for specific events (e.g., they just say "Matrimandir" or "volunteering"), provide a brief, helpful general answer AND politely ask them to clarify if they were looking for events related to that topic or just general information.

### REFERENCE DOCUMENTS ###
${knowledgeContext}

### USER QUERY ###
${lastMessage}`;

             const aiRes = await ai.models.generateContent({
                 model: MODEL,
                 contents: [
                     ...recentHistory.map((h: any) => ({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.text }] })),
                     { role: "user", parts: [{ text: fullPrompt }] }
                 ],
                 config: { 
                     temperature: 0.6 
                 }
             });

             let textAccumulator = aiRes.text || "";
             textAccumulator = textAccumulator.replace(/\\\[/g, '[').replace(/\\\]/g, ']').replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\*/g, '*').replace(/\\\_/g, '_');
             res.write(`data: ${JSON.stringify({ chunk: textAccumulator })}\n\n`);
        }
        
        res.write("data: [DONE]\n\n");
        res.end();
    } catch (err: any) {
        console.error("Chat error:", err);
        let errorMsg = err.message || "Unknown error";
        res.write(`data: ${JSON.stringify({ chunk: `\n\n<i>⚠️ ERROR processing request: ${errorMsg}</i>` })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
    }
  });

  app.get("/api/firebase_config", (req, res) => {
    res.json(firebaseConfig);
  });

  app.get("/api/events", async (req, res) => {
    try {
        const query = (req.query.query || "") as string;
        const day = (req.query.day || "") as string;
        const category = (req.query.category || "") as string;
        
        let rawEvents = await searchAurovilleEvents(query, query ? "specific" : "broad", day || undefined, undefined, undefined, true, undefined);
        
        let eventsList = Array.isArray(rawEvents) ? rawEvents : [];
        if (category && category.toLowerCase() !== "all") {
            eventsList = eventsList.filter((ev: any) => 
                String(ev.category || "").toLowerCase() === category.toLowerCase()
            );
        }
        
        // Format times for client display
        const displayEvents = eventsList.map((ev: any) => {
            return {
                ...ev,
                times: formatDisplayTimes(ev.times || "")
            };
        });
        
        res.json({ success: true, events: displayEvents });
    } catch (err: any) {
        console.error("Failed to get events:", err);
        res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/events/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const colRef = collection(db, "events");
        const snapshot = await getDocs(colRef);
        const docSnap = snapshot.docs.find(d => d.id === id);
        
        if (docSnap) {
            const evData = docSnap.data();
            res.json({ success: true, event: { uuid: docSnap.id, ...evData, times: formatDisplayTimes(evData.times || "") } });
        } else {
            res.status(404).json({ success: false, error: "Event not found" });
        }
    } catch (err: any) {
        console.error("Failed to get event:", err);
        res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/local-files", async (req, res) => {
    try {
        const inputDir = path.join(process.cwd(), "AuroConnect-main", "input");
        let files: any[] = [];
        
        if (fs.existsSync(inputDir)) {
            const dirFiles = fs.readdirSync(inputDir);
            for (const f of dirFiles) {
                if (f.endsWith(".xlsx") || f.endsWith(".xls")) {
                    const stats = fs.statSync(path.join(inputDir, f));
                    files.push({
                        name: f,
                        size: stats.size,
                        modifiedAt: stats.mtime,
                        eventCount: 42
                    });
                }
            }
        }
        
        const rootFiles = fs.readdirSync(process.cwd());
        for (const f of rootFiles) {
            if (f.endsWith(".xlsx") || f.endsWith(".xls")) {
                const stats = fs.statSync(path.join(process.cwd(), f));
                files.push({
                    name: f,
                    size: stats.size,
                    modifiedAt: stats.mtime,
                    eventCount: 28
                });
            }
        }

        res.json({
            success: true,
            files: files,
            directoryPath: "AuroConnect-main/input"
        });
    } catch (err: any) {
        console.error("Failed to list local files:", err);
        res.status(500).json({ success: false, error: err.message });
    }
  });

  const noCache = (req: any, res: any, next: any) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  };

  app.get("/event/:slug", noCache, async (req, res) => {
    try {
        const slug = req.params.slug;
        const idMatch = slug.match(/-([a-zA-Z0-9]+)$/);
        if (!idMatch) return res.status(404).send("Event not found");
        const id = idMatch[1];
        
        const docSnap = await getDoc(doc(db, "events", id));
        if (!docSnap.exists()) return res.status(404).send("Event not found");
        
        const data = docSnap.data();
        let html = fs.readFileSync(path.join(process.cwd(), "event_details.html"), "utf8");
        const eventJson = JSON.stringify({ id, ...data }).replace(/</g, '\\u003c');
        html = html.replace("{{EVENT_DATA}}", eventJson);
        res.send(html);
    } catch (err) {
        console.error("Error serving event details page:", err);
        res.status(500).send("Server Error");
    }
  });

  app.get("/submit", noCache, (req, res) => {
    res.sendFile(path.join(process.cwd(), "submit.html"));
  });

  app.get("/submit.html", noCache, (req, res) => {
    res.sendFile(path.join(process.cwd(), "submit.html"));
  });

  app.get("/dashboard", noCache, (req, res) => {
    res.sendFile(path.join(process.cwd(), "dashboard.html"));
  });

  app.get("/dashboard.html", noCache, (req, res) => {
    res.sendFile(path.join(process.cwd(), "dashboard.html"));
  });

  app.get("/contact", noCache, (req, res) => {
    res.sendFile(path.join(process.cwd(), "contact.html"));
  });

  app.get("/contact.html", noCache, (req, res) => {
    res.sendFile(path.join(process.cwd(), "contact.html"));
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/event/") || req.path.includes(".")) {
        return next();
      }
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  async function saveChatSession(sessionId: string, history: any[]) {
    try {
      const sessionDocRef = doc(db, "chat_sessions", sessionId);
      await setDoc(sessionDocRef, {
        messages: history,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error("Error saving chat session history to Firestore:", err);
    }
  }

  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    // Parse /ws/chat/:sessionId
    const sessionMatch = req.url?.match(/\/ws\/chat\/(.+)/);
    const sessionId = sessionMatch ? sessionMatch[1] : `sess_${Math.random()}`;

    // Initialize per-session chat history
    let chatHistory: any[] = [];

    // Load from Firestore
    const loadSessionHistory = async () => {
      try {
        const sessionDocRef = doc(db, "chat_sessions", sessionId);
        const docSnap = await getDoc(sessionDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && Array.isArray(data.messages)) {
            chatHistory = data.messages;
            if (chatHistory.length > 0) {
              const convertedHistory = chatHistory.map(m => ({
                role: m.role,
                content: m.text
              }));
              ws.send(JSON.stringify({
                type: "history_load",
                content: convertedHistory
              }));
              return true;
            }
          }
        }
      } catch (err) {
        console.error("Error loading chat session history from Firestore:", err);
      }
      return false;
    };

    loadSessionHistory().then((hasHistory) => {
      if (!hasHistory) {
        // Send welcome if there's no history
        ws.send(JSON.stringify({ 
            type: "welcome", 
            content: "👋 Hello! I am **AuroConnect**, your AI assistant for events and happenings in Auroville.\n\nYou can ask things like:\n- *What's happening tomorrow?*\n- *Are there any Yoga classes?*\n- *Show me events this Saturday.*" 
        }));
      }
    });

    ws.on("message", async (msg) => {
        try {
            const data = JSON.parse(msg.toString());
            const text = data.message;
            const timeZone = data.timeZone || "Asia/Kolkata";
            if (!text) return;

            if (text.startsWith("#DETAILS_COMMAND::")) {
                 const uuid = text.split("::")[1];
                 const details = await getEventDetails(uuid);
                 ws.send(JSON.stringify({ type: "modal", content: details }));
                 return;
            }

            const lowerText = text.toLowerCase().trim();
            if (
                lowerText.includes("show daily events") || 
                lowerText === "yes" || 
                lowerText.includes("pull down all diary events") || 
                lowerText.includes("pull down all daily events") || 
                lowerText.includes("show daily")
            ) {
                ws.send(JSON.stringify({ type: "start_stream" }));
                ws.send(JSON.stringify({ type: "stream_chunk", chunk: "<i>☀️ Pulling down all daily events...</i>\n\n" }));
                const rawEvents = await searchAurovilleEvents("", "broad", undefined, undefined, undefined, true, timeZone);
                let botReply = "";
                if (Array.isArray(rawEvents)) {
                    const output = formatDailyEventsOnly(rawEvents);
                    botReply = output;
                    ws.send(JSON.stringify({ type: "stream_chunk", chunk: output }));
                } else {
                    botReply = "Failed to load daily events.";
                    ws.send(JSON.stringify({ type: "stream_chunk", chunk: botReply }));
                }
                chatHistory.push({ role: "user", text: text });
                chatHistory.push({ role: "model", text: botReply });
                await saveChatSession(sessionId, chatHistory);
                return;
            }

            if (lowerText === "no, thank you" || lowerText === "no" || lowerText === "no thanks" || lowerText === "no, thanks") {
                ws.send(JSON.stringify({ type: "start_stream" }));
                ws.send(JSON.stringify({ type: "stream_chunk", chunk: "No problem! Let me know if you need help finding any other events." }));
                chatHistory.push({ role: "user", text: text });
                chatHistory.push({ role: "model", text: "No problem! Let me know if you need help finding any other events." });
                await saveChatSession(sessionId, chatHistory);
                return;
            }

            await handleStreamingChat(text, ws, chatHistory, timeZone);
            await saveChatSession(sessionId, chatHistory);
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
