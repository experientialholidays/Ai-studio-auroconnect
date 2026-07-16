import { isEventEnded, getEventStartAndEndTimes, calculateEndTimeIfMissing, parseMinutesFromTimeStr } from "./format_helpers";

const testEvent = {
  title: "Cinema Paradiso: Listen to Your Heart",
  times: "8:00pm - 09:00", // Wait, let's test if it has no end time or - 09:00
  days: "Saturday",
  dates: "2026-07-11"
};

const testEventNoEnd = {
  title: "Cinema Paradiso: Listen to Your Heart (No End Time)",
  times: "8:00pm",
  days: "Saturday",
  dates: "2026-07-11"
};

const currentTime = "19:31"; // 7:31pm, which is the current time in Kolkata when PDT is 07:01am

console.log("For 8:00pm - 09:00:");
const range1 = getEventStartAndEndTimes(testEvent);
console.log("Times extracted:", range1);
console.log("Calculated end if missing:", calculateEndTimeIfMissing(range1.start));
console.log("startMin:", parseMinutesFromTimeStr(range1.start));
console.log("endMin:", parseMinutesFromTimeStr(range1.end));
console.log("isEnded:", isEventEnded(testEvent, currentTime));

console.log("\nFor 8:00pm (no end time):");
const range2 = getEventStartAndEndTimes(testEventNoEnd);
console.log("Times extracted:", range2);
console.log("Calculated end if missing:", calculateEndTimeIfMissing(range2.start));
console.log("isEnded:", isEventEnded(testEventNoEnd, currentTime));
