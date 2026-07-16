import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
   projectId: process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0039539258",
   appId: process.env.FIREBASE_APP_ID || "1:615927626963:web:af7cd31a3a9859919fe826",
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBE_i3Y6SXSfmFfZ_ptMclJT0GySmA0dlM",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "gen-lang-client-0039539258.firebaseapp.com",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "gen-lang-client-0039539258.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "615927626963",
  firestoreDatabaseId: process.env.FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-64cdf999-24b6-49a7-bf7c-8606ad4d20d4"
 };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");

async function run() {
  const colRef = collection(db, "events");
  const snap = await getDocs(colRef);
  let events = snap.docs.map(doc => doc.data());
  let targetEvents = events.filter(e => e.originalHeaders && e.originalHeaders.startDate);
  console.log(targetEvents.slice(0, 5).map(e => ({
     title: e.title,
     startDate: e.startDate,
     endDate: e.endDate,
     dates: e.dates,
     days: e.days,
     originalHeaders: e.originalHeaders
  })));
}
run();
