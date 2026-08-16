/**
 * Robust Date & Time Parser for Excel Uploads and Database Synchronization
 */

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11
};

/**
 * Helper to convert Excel numeric date serials or strings to ISO YYYY-MM-DD
 */
export function parseSingleDate(val: any): string | null {
  if (val === undefined || val === null) return null;

  // 1. Excel serial number check (e.g. 46248)
  const num = Number(val);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }

  const str = String(val).trim();
  if (!str) return null;

  // 2. Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // 3. DD/MM/YYYY or DD-MM-YYYY or MM/DD/YYYY
  const slashMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) {
    let p1 = parseInt(slashMatch[1], 10);
    let p2 = parseInt(slashMatch[2], 10);
    let yr = parseInt(slashMatch[3], 10);
    let day = p1;
    let month = p2;
    if (p1 <= 12 && p2 > 12) {
      month = p1;
      day = p2;
    }
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${yr}-${mm}-${dd}`;
  }

  // 4. English textual date: e.g. "20 August 2026", "20th Aug 2026", "August 20 2026"
  // NOTE: replace ordinal suffixes ONLY when attached to numbers! e.g. "20th" -> "20"
  const cleanStr = str.replace(/(\d+)(st|nd|rd|th)/gi, "$1").replace(/,/g, " ").replace(/\s+/g, " ").trim();
  
  // Pattern: Day Month Year (e.g. "20 August 2026" or "20 Aug 2026")
  const dmyMatch = cleanStr.match(/^(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}))$/i);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const monthStr = dmyMatch[2].toLowerCase();
    const year = parseInt(dmyMatch[3], 10);
    if (MONTH_MAP[monthStr] !== undefined) {
      const mIdx = MONTH_MAP[monthStr];
      const mm = String(mIdx + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      return `${year}-${mm}-${dd}`;
    }
  }

  // Pattern: Day Month (without year) e.g. "20 August" -> default to 2026
  const dmNoYearMatch = cleanStr.match(/^(\d{1,2})\s+([a-zA-Z]+)$/i);
  if (dmNoYearMatch) {
    const day = parseInt(dmNoYearMatch[1], 10);
    const monthStr = dmNoYearMatch[2].toLowerCase();
    if (MONTH_MAP[monthStr] !== undefined) {
      const mIdx = MONTH_MAP[monthStr];
      const mm = String(mIdx + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      return `2026-${mm}-${dd}`;
    }
  }

  // Pattern: Month Day Year (e.g. "August 20 2026")
  const mdyMatch = cleanStr.match(/^([a-zA-Z]+)\s+(\d{1,2})(?:\s+(\d{4}))?$/i);
  if (mdyMatch) {
    const monthStr = mdyMatch[1].toLowerCase();
    const day = parseInt(mdyMatch[2], 10);
    const year = mdyMatch[3] ? parseInt(mdyMatch[3], 10) : 2026;
    if (MONTH_MAP[monthStr] !== undefined) {
      const mIdx = MONTH_MAP[monthStr];
      const mm = String(mIdx + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      return `${year}-${mm}-${dd}`;
    }
  }

  return null;
}

/**
 * Parse raw date inputs (dates, startDate, endDate) into structured dates, startDate, endDate
 */
export function parseEventDates(rawDates: any, rawStartDate: any, rawEndDate: any) {
  let startDate = parseSingleDate(rawStartDate) || "";
  let endDate = parseSingleDate(rawEndDate) || "";
  let datesStr = String(rawDates || "").trim();

  // If explicit startDate & endDate are valid, return them
  if (startDate && endDate) {
    if (!datesStr) {
      datesStr = startDate === endDate ? startDate : `${startDate} to ${endDate}`;
    }
    return { startDate, endDate, dates: datesStr };
  }

  if (startDate && !endDate) {
    endDate = startDate;
    if (!datesStr) datesStr = startDate;
    return { startDate, endDate, dates: datesStr };
  }

  if (!startDate && endDate) {
    startDate = endDate;
    if (!datesStr) datesStr = endDate;
    return { startDate, endDate, dates: datesStr };
  }

  // No explicit startDate/endDate provided, parse datesStr
  if (!datesStr || datesStr === "N/A" || datesStr === "undefined") {
    return { startDate: "", endDate: "", dates: "" };
  }

  // 1. Month Year range like "July 2026 to October 2026" or "July - October 2026"
  const monthRangeMatch = datesStr.match(/^([a-zA-Z]+)(?:\s+(\d{4}))?\s+(?:to|\-|–|—)\s+([a-zA-Z]+)\s+(\d{4})$/i);
  if (monthRangeMatch) {
    const startMStr = monthRangeMatch[1].toLowerCase();
    const startYear = monthRangeMatch[2] ? parseInt(monthRangeMatch[2], 10) : parseInt(monthRangeMatch[4], 10);
    const endMStr = monthRangeMatch[3].toLowerCase();
    const endYear = parseInt(monthRangeMatch[4], 10);

    if (MONTH_MAP[startMStr] !== undefined && MONTH_MAP[endMStr] !== undefined) {
      const sMIdx = MONTH_MAP[startMStr];
      const eMIdx = MONTH_MAP[endMStr];
      const sMm = String(sMIdx + 1).padStart(2, '0');
      const startIso = `${startYear}-${sMm}-01`;

      const lastDayNum = new Date(endYear, eMIdx + 1, 0).getDate();
      const eMm = String(eMIdx + 1).padStart(2, '0');
      const eDd = String(lastDayNum).padStart(2, '0');
      const endIso = `${endYear}-${eMm}-${eDd}`;

      return { startDate: startIso, endDate: endIso, dates: datesStr };
    }
  }

  // 2. Comma separated days list like "14, 22 August 2026" or "14 and 22 August 2026"
  const multiDayListMatch = datesStr.match(/^(\d{1,2})(?:\s*,\s*|\s+and\s+)(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}))?$/i);
  if (multiDayListMatch) {
    const day1 = parseInt(multiDayListMatch[1], 10);
    const day2 = parseInt(multiDayListMatch[2], 10);
    const monthStr = multiDayListMatch[3].toLowerCase();
    const year = multiDayListMatch[4] ? parseInt(multiDayListMatch[4], 10) : 2026;
    if (MONTH_MAP[monthStr] !== undefined) {
      const mIdx = MONTH_MAP[monthStr];
      const mm = String(mIdx + 1).padStart(2, '0');
      const startIso = `${year}-${mm}-${String(Math.min(day1, day2)).padStart(2, '0')}`;
      const endIso = `${year}-${mm}-${String(Math.max(day1, day2)).padStart(2, '0')}`;
      return { startDate: startIso, endDate: endIso, dates: datesStr };
    }
  }

  // 3. Range like "20 August 2026 to 23 August 2026" or "20 Aug - 23 Aug 2026" or "20 to 23 August 2026"
  const rangeSplitter = /\s+(?:to|until|through|\-|–|—)\s+/i;
  if (rangeSplitter.test(datesStr)) {
    const parts = datesStr.split(rangeSplitter).map(p => p.trim());
    if (parts.length === 2) {
      let startP = parseSingleDate(parts[0]);
      let endP = parseSingleDate(parts[1]);

      // Handle "20 to 23 August 2026" where first part is just day number "20"
      if (!startP && /^\d{1,2}$/.test(parts[0])) {
        const monthYearMatch = parts[1].match(/([a-zA-Z]+)\s+(\d{4})/);
        if (monthYearMatch) {
          startP = parseSingleDate(`${parts[0]} ${monthYearMatch[1]} ${monthYearMatch[2]}`);
        }
      }

      if (startP && endP) {
        return { startDate: startP, endDate: endP, dates: datesStr };
      }
      if (startP) {
        return { startDate: startP, endDate: endP || startP, dates: datesStr };
      }
      if (endP) {
        return { startDate: startP || endP, endDate: endP, dates: datesStr };
      }
    }
  }

  // 4. Single text date "15 August 2026"
  const singleAttempt = parseSingleDate(datesStr);
  if (singleAttempt) {
    return { startDate: singleAttempt, endDate: singleAttempt, dates: datesStr };
  }

  return { startDate: "", endDate: "", dates: datesStr };
}

/**
 * Robust Time Parser
 * Input can be Excel numeric fraction (e.g. 0.375), 24h string ("17:00"), 12h string ("5:30PM"), or combined range ("5:30PM—7:00PM")
 */
export function parseSingleTime(val: any): string | null {
  if (val === undefined || val === null) return null;

  const str = String(val).trim();
  if (!str || str === "undefined" || str === "N/A" || str === "None" || str === "null") return null;

  // 1. Numeric serial time in Excel (0 < val < 1)
  if (typeof val === 'number') {
    if (val > 0 && val < 1) {
      const totalMinutes = Math.round(val * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const period = hours >= 12 ? 'PM' : 'AM';
      let h12 = hours % 12;
      if (h12 === 0) h12 = 12;
      return `${h12}:${minutes.toString().padStart(2, '0')} ${period}`;
    }
  } else if (typeof val === 'string') {
    const num = Number(str);
    if (!isNaN(num) && num > 0 && num < 1 && /^\d*(?:\.\d+)?$/.test(str)) {
      const totalMinutes = Math.round(num * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const period = hours >= 12 ? 'PM' : 'AM';
      let h12 = hours % 12;
      if (h12 === 0) h12 = 12;
      return `${h12}:${minutes.toString().padStart(2, '0')} ${period}`;
    }
  }

  if (/[a-zA-Z]{3,}/.test(str) && !/am|pm/i.test(str)) {
    return str;
  }

  // 2. Format string with AM/PM e.g. "5:30PM", "9:00 AM", "9 am"
  const ampmMatch = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    let minutes = ampmMatch[2] ? ampmMatch[2] : "00";
    let period = ampmMatch[3].toUpperCase();
    if (hours > 12) {
      hours = hours % 12;
    }
    if (hours === 0) hours = 12;
    return `${hours}:${minutes} ${period}`;
  }

  // 3. 24-hour style string e.g. "17:00", "09:30", "10:15"
  const h24Match = str.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    let hours = parseInt(h24Match[1], 10);
    let minutes = h24Match[2];
    let period = 'AM';

    if (hours >= 12) {
      period = 'PM';
      if (hours > 12) hours -= 12;
    } else if (hours === 0) {
      hours = 12;
      period = 'AM';
    } else if (hours < 7) {
      period = 'PM';
    }

    return `${hours}:${minutes} ${period}`;
  }

  // 4. Bare hour string e.g. "6", "3"
  const bareMatch = str.match(/^(\d{1,2})$/);
  if (bareMatch) {
    let hours = parseInt(bareMatch[1], 10);
    let period = (hours >= 12 || hours < 7) ? 'PM' : 'AM';
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
    return `${hours}:00 ${period}`;
  }

  return str;
}

function formatTimeToken(match: RegExpMatchArray): string {
  let hours = parseInt(match[1], 10);
  let mins = match[2] ? match[2] : "00";
  let period = match[3] ? match[3].toLowerCase() : "";

  if (!period) {
    if (hours >= 12 || hours < 7) {
      period = "pm";
      if (hours > 12) hours -= 12;
    } else {
      period = "am";
      if (hours === 0) hours = 12;
    }
  } else {
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
  }

  return `${hours}:${mins} ${period.toUpperCase()}`;
}

function resolveTwoTimeMatches(m1: RegExpMatchArray, m2: RegExpMatchArray) {
  let t1Hours = parseInt(m1[1], 10);
  let t1Mins = m1[2] ? m1[2] : "00";
  let t1Period = m1[3] ? m1[3].toLowerCase() : "";

  let t2Hours = parseInt(m2[1], 10);
  let t2Mins = m2[2] ? m2[2] : "00";
  let t2Period = m2[3] ? m2[3].toLowerCase() : "";

  if (!t1Period && t2Period) {
    if (t2Period === "pm") {
      if (t1Hours <= t2Hours || t1Hours === 12) {
        t1Period = "pm";
      } else {
        t1Period = "am";
      }
    } else {
      t1Period = "am";
    }
  } else if (!t1Period && !t2Period) {
    t1Period = (t1Hours >= 12 || t1Hours < 7) ? "pm" : "am";
    t2Period = (t2Hours >= 12 || t2Hours < 7) ? "pm" : "am";
  }

  if (!t2Period) {
    t2Period = (t2Hours >= 12 || t1Period === "pm") ? "pm" : "am";
  }

  let displayT1Hours = t1Hours;
  if (displayT1Hours > 12) displayT1Hours -= 12;
  if (displayT1Hours === 0) displayT1Hours = 12;
  const strT1 = `${displayT1Hours}:${t1Mins} ${t1Period.toUpperCase()}`;

  let displayT2Hours = t2Hours;
  if (displayT2Hours > 12) displayT2Hours -= 12;
  if (displayT2Hours === 0) displayT2Hours = 12;
  const strT2 = `${displayT2Hours}:${t2Mins} ${t2Period.toUpperCase()}`;

  return { strT1, strT2 };
}

/**
 * Robust Time Parser
 * Implements strict rules:
 * Rule 1: 1 time -> format as H:MM AM/PM
 * Rule 2: 2 times with no extra words -> format both as H:MM AM/PM with smart PM propagation
 * Rule 3: 2 times with extra words OR >2 times -> preserve EXACT Excel text as-is, extract startTime/endTime for calculations
 */
export function parseEventTimes(rawStartTime: any, rawEndTime: any, rawTimes: any) {
  let startTime = parseSingleTime(rawStartTime) || "";
  let endTime = parseSingleTime(rawEndTime) || "";
  let timesStr = String(rawTimes || "").trim();

  if (startTime === "undefined") startTime = "";
  if (endTime === "undefined") endTime = "";
  if (timesStr === "undefined") timesStr = "";

  if (!timesStr) {
    if (startTime && endTime && startTime !== endTime) {
      timesStr = `${startTime} - ${endTime}`;
    } else if (startTime) {
      timesStr = startTime;
    } else if (endTime) {
      timesStr = endTime;
    }
  }

  if (!timesStr) {
    return { startTime, endTime, times: "" };
  }

  // Extract all time tokens e.g. "9:15am", "4:30pm", "2", "5:00 pm", "14:30"
  const timeTokenRegex = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/gi;
  const matches = Array.from(timesStr.matchAll(timeTokenRegex));

  // Check if there are extra non-separator words (words other than am, pm, to, till, until)
  let stripped = timesStr.replace(timeTokenRegex, "");
  stripped = stripped.replace(/\s*(?:\-|–|—|to|till|until|&|\/|;|,|:|\.)\s*/gi, " ").trim();
  const hasExtraWords = /[a-zA-Z]{2,}/.test(stripped.replace(/\b(am|pm)\b/gi, ""));

  // RULE 3: Extra words present OR more than 2 time tokens present OR multiple semicolon sessions
  const isMultipleSessions = timesStr.includes(";");
  if (hasExtraWords || matches.length > 2 || isMultipleSessions) {
    let calcStart = startTime;
    let calcEnd = endTime;

    if (!calcStart && matches.length > 0) {
      if (matches.length >= 2 && !isMultipleSessions) {
        const { strT1, strT2 } = resolveTwoTimeMatches(matches[0], matches[matches.length - 1]);
        calcStart = strT1;
        if (!calcEnd) calcEnd = strT2;
      } else {
        calcStart = formatTimeToken(matches[0]);
      }
    }

    // Default structured end time for multiple or complex timing sessions to 5:00 PM as per specification
    if (!calcEnd || isMultipleSessions) {
      calcEnd = "5:00 PM";
    }

    return {
      startTime: calcStart,
      endTime: calcEnd,
      times: timesStr // EXACT text as in Excel, no change!
    };
  }

  // RULE 1: Exactly 1 time token
  if (matches.length === 1) {
    const formatted = formatTimeToken(matches[0]);
    return {
      startTime: startTime || formatted,
      endTime: endTime || "",
      times: formatted
    };
  }

  // RULE 2: Exactly 2 time tokens with NO extra words
  if (matches.length === 2) {
    const { strT1, strT2 } = resolveTwoTimeMatches(matches[0], matches[1]);

    return {
      startTime: strT1,
      endTime: strT2,
      times: `${strT1} to ${strT2}`
    };
  }

  return { startTime, endTime, times: timesStr };
}

/**
 * Days / Weekdays Parser
 * Cleans stringified JSON arrays like '["Monday", "Tuesday"]' into clean format
 */
export function parseEventDays(rawDays: any): string {
  if (rawDays === undefined || rawDays === null) return "";
  
  if (Array.isArray(rawDays)) {
    return rawDays.join(", ");
  }

  const str = String(rawDays).trim();
  if (!str || str === "undefined") return "";

  if (str.startsWith("[") && str.endsWith("]")) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed.join(", ");
      }
    } catch {
      const matches = str.match(/"([^"]+)"/g);
      if (matches) {
        return matches.map(m => m.replace(/"/g, '')).join(", ");
      }
    }
  }

  return str;
}
