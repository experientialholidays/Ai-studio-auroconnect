export function parseExcelDateToReadable(dateStr: string): string {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) {
            const formatter = new Intl.DateTimeFormat("en-GB", {
                day: "numeric", month: "long", year: "numeric"
            });
            return formatter.format(d); // e.g. "21 July 2026"
        }
    }
    return dateStr;
}

export function isValidTimeFormat(timeStr: string): boolean {
    if (!timeStr) return false;
    const clean = timeStr.toLowerCase().trim();
    if (!/\d/.test(clean)) return false;
    const matchColon = clean.match(/(\d{1,2})[:.](\d{2})/);
    const matchAmPm = clean.match(/(\d{1,2})\s*(am|pm)/);
    const matchSimpleNum = clean.match(/^\s*\d{1,2}\s*$/);
    const matchRange = clean.match(/^\s*\d{1,2}\s*[-–—to]\s*\d{1,2}\s*$/i);
    return !!(matchColon || matchAmPm || matchSimpleNum || matchRange);
}

export function calculateEndTimeIfMissing(startTime: string): string {
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
    
    // Check if it's already a 24-hour time (e.g. 13:00 to 23:59) without explicit am/pm
    if (hours >= 12 && hours < 24 && !isAm && !isPm) {
        isPm = true;
        hours -= 12;
    }
    
    // Add 1 hour
    hours += 1;
    let ampm = isPm ? "pm" : "am";
    if (hours === 12 && !isPm) { ampm = "pm"; }
    else if (hours === 12 && isPm) { ampm = "am"; }
    else if (hours > 12) { hours -= 12; }
    
    const hStr = hours.toString();
    const mStr = mins < 10 ? "0" + mins : mins.toString();
    return `${hStr}:${mStr}${ampm}`;
}

export function formatDisplayTimes(timesStr: string): string {
    if (!timesStr) return "";
    const range = splitTimeRange(timesStr);
    const start = range.start.trim();
    const end = range.end.trim();
    
    if (end) {
        // If end has no am/pm (like "09:00" or "21:00"), we don't display the end time at all!
        // This is because it was either calculated or has no am/pm (which violates "am and pm only")
        if (!end.toLowerCase().includes("am") && !end.toLowerCase().includes("pm")) {
            return start;
        }
        return `${start} - ${end}`;
    }
    return start;
}

export function splitTimeRange(timesStr: string): { start: string; end: string } {
    if (!timesStr) return { start: "", end: "" };
    const parts = timesStr.split(/\s*(?:-|to|–|—)\s*/i);
    const start = parts[0] || "";
    const end = parts[1] || "";
    return { start: start.trim(), end: end.trim() };
}

export function parseMinutesFromTimeStr(timeStr: string): number {
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
    
    // Check if it's already a 24-hour time (e.g. 13:00 to 24:00) without explicit am/pm
    if (hours >= 12 && hours <= 24 && !isAm && !isPm) {
        return hours * 60 + mins;
    }
    
    if (isPm && hours < 12) hours += 12;
    if (isAm && hours === 12) hours = 0;
    return hours * 60 + mins;
}

export function getEventStartAndEndTimes(event: any): { start: string; end: string } {
    let start = event.originalHeaders?.startTime || event.startTime || "";
    let end = event.originalHeaders?.endTime || event.endTime || "";
    if (!start && !end && event.times) {
        const range = splitTimeRange(event.times);
        start = range.start;
        end = range.end;
    }
    return { start: start.trim(), end: end.trim() };
}

export function isEventEnded(event: any, currentTime24: string): boolean {
    const { start, end } = getEventStartAndEndTimes(event);
    
    // If no start time is mentioned (null, undefined, or empty), it is not ended
    if (!start) {
        return false;
    }
    
    // If start time is unparsed (e.g., "Full Day", "Check description"), do not mark it as ended
    if (!isValidTimeFormat(start)) {
        return false;
    }
    
    let displayTimeMin = 12 * 60; // 12 noon fallback
    if (end && isValidTimeFormat(end)) {
        let startMin = parseMinutesFromTimeStr(start);
        let endMin = parseMinutesFromTimeStr(end);
        
        const isStartPm = start.toLowerCase().includes("pm") || startMin >= 12 * 60;
        if (isStartPm && !end.toLowerCase().includes("pm") && !end.toLowerCase().includes("am")) {
            if (endMin < startMin) {
                endMin += 12 * 60; // Add 12 hours to make it PM
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
