function getEventStartAndEndTimes(event) {
  let times = event.times;
  if (!times && event.originalHeaders) times = event.originalHeaders.times;
  if (!times) return { start: "", end: "" };
  let parts = String(times).split("-");
  if (parts.length === 2) {
    return { start: parts[0].trim(), end: parts[1].trim() };
  }
  return { start: times.trim(), end: "" };
}

function isValidTimeFormat(timeStr) {
  return /^\d{1,2}:\d{2}\s*(am|pm)?$/i.test(timeStr);
}

function parseMinutesFromTimeStr(timeStr) {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3] ? match[3].toLowerCase() : "";
  if (period === "pm" && hours < 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function isEventEnded(event, currentTime24) {
  const { start, end } = getEventStartAndEndTimes(event);
  if (!start) return false;
  if (!isValidTimeFormat(start)) return false;
  let displayTimeMin = 12 * 60;
  if (end && isValidTimeFormat(end)) {
    let startMin = parseMinutesFromTimeStr(start);
    let endMin = parseMinutesFromTimeStr(end);
    const isStartPm = start.toLowerCase().includes("pm") || startMin >= 12 * 60;
    if (isStartPm && !end.toLowerCase().includes("pm") && !end.toLowerCase().includes("am")) {
      if (endMin < startMin) endMin += 12 * 60;
    } else if (endMin < startMin && !end.toLowerCase().includes("am") && !end.toLowerCase().includes("pm")) {
      endMin += 12 * 60;
    }
    displayTimeMin = endMin;
  } else {
    displayTimeMin = parseMinutesFromTimeStr(start) + 60;
  }
  
  const currentParts = currentTime24.split(":");
  if(currentParts.length !== 2) return false;
  const currentMin = parseInt(currentParts[0], 10) * 60 + parseInt(currentParts[1], 10);
  console.log({start, end, displayTimeMin, currentMin, ended: currentMin > displayTimeMin});
  return currentMin > displayTimeMin;
}

console.log(isEventEnded({times: "05:00 pm - 06:00 pm"}, "13:30")); // 1:30 PM (810 mins), event ends at 18:00 (1080 mins). Ended: false
console.log(isEventEnded({times: "5:00 pm - 6:00 pm"}, "13:30"));
console.log(isEventEnded({times: "5:00 - 6:00"}, "13:30"));
console.log(isEventEnded({times: "14:00 - 15:00"}, "13:30"));
console.log(isEventEnded({times: "Morning"}, "13:30"));

