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

  // 1. Numeric serial time in Excel (0 <= val < 1)
  const num = Number(val);
  if (!isNaN(num) && num >= 0 && num < 1) {
    const totalMinutes = Math.round(num * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const period = hours >= 12 ? 'pm' : 'am';
    let h12 = hours % 12;
    if (h12 === 0) h12 = 12;
    return `${h12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  const str = String(val).trim();
  if (!str || str === "undefined" || str === "N/A") return null;

  if (/[a-zA-Z]{3,}/.test(str) && !/am|pm/i.test(str)) {
    return str;
  }

  // 2. Format string with AM/PM e.g. "5:30PM", "9:00 AM", "9 am"
  const ampmMatch = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    let minutes = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    let period = ampmMatch[3].toLowerCase();
    if (hours > 12) {
      hours = hours % 12;
    }
    if (hours === 0) hours = 12;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  // 3. 24-hour style string e.g. "17:00", "09:30", "10:15"
  const h24Match = str.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    let hours = parseInt(h24Match[1], 10);
    let minutes = parseInt(h24Match[2], 10);
    let period = 'am';

    if (hours >= 12) {
      period = 'pm';
      if (hours > 12) hours -= 12;
    } else if (hours === 0) {
      hours = 12;
      period = 'am';
    } else if (hours < 7) {
      period = 'pm';
    }

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  return str;
}

/**
 * Parse times fields (startTime, endTime, times) into clean individual startTime, endTime, times
 */
export function parseEventTimes(rawStartTime: any, rawEndTime: any, rawTimes: any) {
  let startTime = parseSingleTime(rawStartTime) || "";
  let endTime = parseSingleTime(rawEndTime) || "";
  let timesStr = String(rawTimes || "").trim();

  if (startTime === "undefined") startTime = "";
  if (endTime === "undefined") endTime = "";
  if (timesStr === "undefined") timesStr = "";

  // If explicit startTime and endTime are provided
  if (startTime && endTime && startTime !== endTime) {
    if (!timesStr) {
      timesStr = `${startTime} - ${endTime}`;
    }
    return { startTime, endTime, times: timesStr };
  }

  if (startTime && !endTime) {
    if (!timesStr) timesStr = startTime;
    return { startTime, endTime: "", times: timesStr };
  }

  // If only rawTimes is provided (e.g. "05:00 pm - 06:00 pm" or "5:30PM—7:00PM" or "09:30 - 17:00")
  if (timesStr) {
    const rangeSplitter = /\s*(?:\-|–|—|to)\s*/i;
    const parts = timesStr.split(rangeSplitter).map(p => p.trim()).filter(Boolean);
    if (parts.length === 2) {
      const p1 = parseSingleTime(parts[0]);
      const p2 = parseSingleTime(parts[1]);
      if (p1 && p2) {
        startTime = p1;
        endTime = p2;
        timesStr = `${startTime} - ${endTime}`;
      } else if (p1) {
        startTime = p1;
      }
    } else if (parts.length === 1) {
      const p1 = parseSingleTime(parts[0]);
      if (p1) {
        startTime = p1;
        timesStr = startTime;
      }
    }
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
