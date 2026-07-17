function formatExcelTime(val) {
  if (typeof val === 'number' && val >= 0 && val < 1) {
    const totalMinutes = Math.round(val * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const period = hours >= 12 ? 'pm' : 'am';
    let h12 = hours % 12;
    if (h12 === 0) h12 = 12;
    return `${h12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
  }
  return String(val);
}

function formatExcelDate(val) {
  if (typeof val === 'number' && val > 40000) {
    // Excel date
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return d.toISOString().split('T')[0];
  }
  return String(val);
}

console.log("Time:", formatExcelTime(0.7083333333333334));
console.log("Time 2:", formatExcelTime(0.3333333333333333));
console.log("Time 3:", formatExcelTime(0.6666666666666666));
console.log("Date:", formatExcelDate(46181));
console.log("Date 2:", formatExcelDate(46206));
