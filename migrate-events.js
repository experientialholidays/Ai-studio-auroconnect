import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDZ87VkavGphOCIOfD3a-nhOSxI2wcpuMg",
  authDomain: "auro-connect.firebaseapp.com",
  projectId: "auro-connect",
  storageBucket: "auro-connect.firebasestorage.app",
  messagingSenderId: "913005987760",
  appId: "1:913005987760:web:57d4210ef370a817e33875",
  measurementId: "G-S4L4Z530CS"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const formatExcelTime = (val) => {
  if (typeof val === 'number' && val >= 0 && val < 1) {
    const totalMinutes = Math.round(val * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const period = hours >= 12 ? 'pm' : 'am';
    let h12 = hours % 12;
    if (h12 === 0) h12 = 12;
    return `${h12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
  }
  return String(val || "").trim();
};

const formatExcelDate = (val) => {
  if (typeof val === 'number' && val > 40000) {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return d.toISOString().split('T')[0];
  }
  return String(val || "").trim();
};

async function run() {
  const colRef = collection(db, "events");
  const snap = await getDocs(colRef);
  let updatedCount = 0;
  
  const updates = [];
  snap.forEach(docSnap => {
    const data = docSnap.data();
    if (!data.originalHeaders) return;
    
    const cleanRawEv = data.originalHeaders;
    
    const getVal = (possibleHeaders) => {
      for (const header of possibleHeaders) {
        const val = cleanRawEv[header.toLowerCase().trim()];
        if (val !== void 0 && val !== null) {
          return String(val).trim();
        }
      }
      return "";
    };

    const getRawVal = (possibleHeaders) => {
      for (const header of possibleHeaders) {
        const val = cleanRawEv[header.toLowerCase().trim()];
        if (val !== void 0 && val !== null) {
          return val;
        }
      }
      return null;
    };
    
    let cat = getVal(["Category"]);
    if (cat.toLowerCase().includes("weekday")) {
      cat = "Weekly Events";
    } else if (cat.toLowerCase().includes("date-specific") || cat.toLowerCase().includes("date specific")) {
      cat = "Date-specific Events";
    } else if (cat.toLowerCase().includes("daily")) {
      cat = "Daily Events";
    }

    const startTime = formatExcelTime(getRawVal(["Start Time", "Time", "Times"]));
    const endTime = formatExcelTime(getRawVal(["End Time"]));
    let timesStr = startTime;
    if (endTime && endTime !== startTime) {
      timesStr += ` - ${endTime}`;
    }
    
    const updatesObj = {
      title: getVal(["Event Name", "Title", "Name"]) || data.title,
      type: getVal(["Type of event", "Type"]),
      category: cat || "Weekly Events",
      dates: getVal(["Dates", "Date"]) || data.dates || "",
      days: getVal(["Days", "Day"]) || data.days || "",
      times: timesStr || data.times || "",
      venue: getVal(["Venue", "Location"]) || data.venue || "",
      cost: getVal(["Cost/Contribution", "Cost", "Price", "Contribution"]) || data.cost || "",
      audience: getVal(["Target Audience/Prerequisites", "Target Audience", "Audience", "Key Info"]) || data.audience || "",
      contactPerson: getVal(["Contact Person/Unit", "Contact Person"]) || data.contactPerson || "",
      whatsapp: getVal(["Contact Phone/WhatsApp", "Contact Phone", "WhatsApp", "Phone"]) || data.whatsapp || "",
      email: getVal(["Contact Email", "Email Id", "Email"]) || data.email || "",
      website: getVal(["Website/Link", "Website", "Link"]) || data.website || "",
      posterUrl: getVal(["poster url", "Poster URL", "Image URL"]) || data.posterUrl || "",
      description: getVal(["Description", "Details", "About"]) || data.description || "",
      startDate: formatExcelDate(getRawVal(["Start Date"])) || data.startDate || "",
      endDate: formatExcelDate(getRawVal(["End Date"])) || data.endDate || ""
    };
    
    updates.push({ id: docSnap.id, updatesObj });
  });

  for(const u of updates) {
    const docRef = doc(db, "events", u.id);
    await updateDoc(docRef, u.updatesObj);
    updatedCount++;
  }
  
  console.log("Updated", updatedCount, "events based on their originalHeaders.");
  process.exit(0);
}

run().catch(console.error);
