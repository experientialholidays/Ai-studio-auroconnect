import { appFirebase, db } from "./src/server/firebase-ai.js";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { getAuth as getClientAuth, signInWithCustomToken } from "firebase/auth";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { parseEventDates, parseEventTimes, parseEventDays } from "./src/server/dateTimeParser.js";
import dotenv from "dotenv";

dotenv.config();

async function runBackfill() {
  console.log("=== Authenticating as Admin for Backfill ===");
  try {
    const adminEmail = "info.experientialholidays@gmail.com";
    const customToken = await getAdminAuth().createCustomToken(adminEmail, { email: adminEmail });
    const clientAuth = getClientAuth(appFirebase);
    await signInWithCustomToken(clientAuth, customToken);
    console.log("Successfully authenticated client SDK as Admin:", clientAuth.currentUser?.email);

    const colRef = collection(db, "events");
    const snapshot = await getDocs(colRef);
    
    console.log(`Found total ${snapshot.size} events in Firestore.`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const docId = docSnap.id;

      // 1. Parse Dates
      const parsedDates = parseEventDates(data.dates, data.startDate, data.endDate);
      
      // 2. Parse Times
      const parsedTimes = parseEventTimes(data.startTime, data.endTime, data.times);

      // 3. Parse Days
      const parsedDays = parseEventDays(data.days);

      // 4. Determine Category if needed
      let cat = data.category || "";
      if (!cat || cat === "N/A") {
        if (parsedDates.startDate || parsedDates.dates) {
          cat = "Date-specific Events";
        } else if (parsedDays) {
          cat = "Weekly Events";
        } else {
          cat = "Daily Events";
        }
      }

      // Check for changes
      const updates: Record<string, any> = {};

      if (parsedDates.startDate !== (data.startDate || "")) {
        updates.startDate = parsedDates.startDate;
      }
      if (parsedDates.endDate !== (data.endDate || "")) {
        updates.endDate = parsedDates.endDate;
      }
      if (parsedDates.dates !== (data.dates || "") && parsedDates.dates) {
        updates.dates = parsedDates.dates;
      }

      if (parsedTimes.startTime !== (data.startTime || "") && parsedTimes.startTime !== "undefined") {
        updates.startTime = parsedTimes.startTime;
      }
      if (parsedTimes.endTime !== (data.endTime || "") && parsedTimes.endTime !== "undefined") {
        updates.endTime = parsedTimes.endTime;
      }
      if (parsedTimes.times !== (data.times || "") && parsedTimes.times && parsedTimes.times !== "undefined") {
        updates.times = parsedTimes.times;
      }

      // Clean up stringified array days
      if (parsedDays !== (data.days || "")) {
        updates.days = parsedDays;
      }

      if (cat !== (data.category || "")) {
        updates.category = cat;
      }

      if (Object.keys(updates).length > 0) {
        console.log(`Updating [${docId}] "${data.title}":`, JSON.stringify(updates));
        const docRef = doc(db, "events", docId);
        await updateDoc(docRef, updates);
        updatedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(`\n=== Backfill Completed Successfully! ===`);
    console.log(`Updated events: ${updatedCount}`);
    console.log(`Skipped (already clean): ${skippedCount}`);

  } catch (err) {
    console.error("Backfill failed:", err);
  }
  process.exit(0);
}

runBackfill();
