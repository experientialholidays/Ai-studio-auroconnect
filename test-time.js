const tz = "Asia/Kolkata";
const options = { timeZone: tz };
const d = new Date();
const timeFormatter24 = new Intl.DateTimeFormat("en-US", {
  timeZone: tz,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});
console.log("time24:", timeFormatter24.format(d));
console.log("date:", new Intl.DateTimeFormat("en-US", {timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"}).format(d));
