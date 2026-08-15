/**
 * Client-Side Date & Time Parser & Auto-Repair Tool for Firestore Events
 */

const MONTH_MAP_CLIENT = {
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

function parseSingleDateClient(val) {
  if (val === undefined || val === null) return null;

  const num = Number(val);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }

  const str = String(val).trim();
  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

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

  const cleanStr = str.replace(/(\d+)(st|nd|rd|th)/gi, "$1").replace(/,/g, " ").replace(/\s+/g, " ").trim();

  const dmyMatch = cleanStr.match(/^(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}))$/i);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const monthStr = dmyMatch[2].toLowerCase();
    const year = parseInt(dmyMatch[3], 10);
    if (MONTH_MAP_CLIENT[monthStr] !== undefined) {
      const mIdx = MONTH_MAP_CLIENT[monthStr];
      const mm = String(mIdx + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      return `${year}-${mm}-${dd}`;
    }
  }

  const dmNoYearMatch = cleanStr.match(/^(\d{1,2})\s+([a-zA-Z]+)$/i);
  if (dmNoYearMatch) {
    const day = parseInt(dmNoYearMatch[1], 10);
    const monthStr = dmNoYearMatch[2].toLowerCase();
    if (MONTH_MAP_CLIENT[monthStr] !== undefined) {
      const mIdx = MONTH_MAP_CLIENT[monthStr];
      const mm = String(mIdx + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      return `2026-${mm}-${dd}`;
    }
  }

  const mdyMatch = cleanStr.match(/^([a-zA-Z]+)\s+(\d{1,2})(?:\s+(\d{4}))?$/i);
  if (mdyMatch) {
    const monthStr = mdyMatch[1].toLowerCase();
    const day = parseInt(mdyMatch[2], 10);
    const year = mdyMatch[3] ? parseInt(mdyMatch[3], 10) : 2026;
    if (MONTH_MAP_CLIENT[monthStr] !== undefined) {
      const mIdx = MONTH_MAP_CLIENT[monthStr];
      const mm = String(mIdx + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      return `${year}-${mm}-${dd}`;
    }
  }

  return null;
}

function parseEventDatesClient(rawDates, rawStartDate, rawEndDate) {
  let startDate = parseSingleDateClient(rawStartDate) || "";
  let endDate = parseSingleDateClient(rawEndDate) || "";
  let datesStr = String(rawDates || "").trim();

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

  if (!datesStr || datesStr === "N/A" || datesStr === "undefined") {
    return { startDate: "", endDate: "", dates: "" };
  }

  const monthRangeMatch = datesStr.match(/^([a-zA-Z]+)(?:\s+(\d{4}))?\s+(?:to|\-|–|—)\s+([a-zA-Z]+)\s+(\d{4})$/i);
  if (monthRangeMatch) {
    const startMStr = monthRangeMatch[1].toLowerCase();
    const startYear = monthRangeMatch[2] ? parseInt(monthRangeMatch[2], 10) : parseInt(monthRangeMatch[4], 10);
    const endMStr = monthRangeMatch[3].toLowerCase();
    const endYear = parseInt(monthRangeMatch[4], 10);

    if (MONTH_MAP_CLIENT[startMStr] !== undefined && MONTH_MAP_CLIENT[endMStr] !== undefined) {
      const sMIdx = MONTH_MAP_CLIENT[startMStr];
      const eMIdx = MONTH_MAP_CLIENT[endMStr];
      const sMm = String(sMIdx + 1).padStart(2, '0');
      const startIso = `${startYear}-${sMm}-01`;

      const lastDayNum = new Date(endYear, eMIdx + 1, 0).getDate();
      const eMm = String(eMIdx + 1).padStart(2, '0');
      const eDd = String(lastDayNum).padStart(2, '0');
      const endIso = `${endYear}-${eMm}-${eDd}`;

      return { startDate: startIso, endDate: endIso, dates: datesStr };
    }
  }

  const multiDayListMatch = datesStr.match(/^(\d{1,2})(?:\s*,\s*|\s+and\s+)(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}))?$/i);
  if (multiDayListMatch) {
    const day1 = parseInt(multiDayListMatch[1], 10);
    const day2 = parseInt(multiDayListMatch[2], 10);
    const monthStr = multiDayListMatch[3].toLowerCase();
    const year = multiDayListMatch[4] ? parseInt(multiDayListMatch[4], 10) : 2026;
    if (MONTH_MAP_CLIENT[monthStr] !== undefined) {
      const mIdx = MONTH_MAP_CLIENT[monthStr];
      const mm = String(mIdx + 1).padStart(2, '0');
      const startIso = `${year}-${mm}-${String(Math.min(day1, day2)).padStart(2, '0')}`;
      const endIso = `${year}-${mm}-${String(Math.max(day1, day2)).padStart(2, '0')}`;
      return { startDate: startIso, endDate: endIso, dates: datesStr };
    }
  }

  const rangeSplitter = /\s+(?:to|until|through|\-|–|—)\s+/i;
  if (rangeSplitter.test(datesStr)) {
    const parts = datesStr.split(rangeSplitter).map(p => p.trim());
    if (parts.length === 2) {
      let startP = parseSingleDateClient(parts[0]);
      let endP = parseSingleDateClient(parts[1]);

      if (!startP && /^\d{1,2}$/.test(parts[0])) {
        const monthYearMatch = parts[1].match(/([a-zA-Z]+)\s+(\d{4})/);
        if (monthYearMatch) {
          startP = parseSingleDateClient(`${parts[0]} ${monthYearMatch[1]} ${monthYearMatch[2]}`);
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

  const singleAttempt = parseSingleDateClient(datesStr);
  if (singleAttempt) {
    return { startDate: singleAttempt, endDate: singleAttempt, dates: datesStr };
  }

  return { startDate: "", endDate: "", dates: datesStr };
}

function parseSingleTimeClient(val) {
  if (val === undefined || val === null) return null;

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

function parseEventTimesClient(rawStartTime, rawEndTime, rawTimes) {
  let startTime = parseSingleTimeClient(rawStartTime) || "";
  let endTime = parseSingleTimeClient(rawEndTime) || "";
  let timesStr = String(rawTimes || "").trim();

  if (startTime === "undefined") startTime = "";
  if (endTime === "undefined") endTime = "";
  if (timesStr === "undefined") timesStr = "";

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

  if (timesStr) {
    const rangeSplitter = /\s*(?:\-|–|—|to)\s*/i;
    const parts = timesStr.split(rangeSplitter).map(p => p.trim()).filter(Boolean);
    if (parts.length === 2) {
      const p1 = parseSingleTimeClient(parts[0]);
      const p2 = parseSingleTimeClient(parts[1]);
      if (p1 && p2) {
        startTime = p1;
        endTime = p2;
        timesStr = `${startTime} - ${endTime}`;
      } else if (p1) {
        startTime = p1;
      }
    } else if (parts.length === 1) {
      const p1 = parseSingleTimeClient(parts[0]);
      if (p1) {
        startTime = p1;
        timesStr = startTime;
      }
    }
  }

  return { startTime, endTime, times: timesStr };
}

function parseEventDaysClient(rawDays) {
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

window.parseEventDatesClient = parseEventDatesClient;
window.parseEventTimesClient = parseEventTimesClient;
window.parseEventDaysClient = parseEventDaysClient;
