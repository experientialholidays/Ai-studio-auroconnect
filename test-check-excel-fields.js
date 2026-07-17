import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query, orderBy } from "firebase/firestore";

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

async function run() {
  const colRef = collection(db, "events");
  const q = query(colRef, limit(20));
  const snap = await getDocs(q);
  snap.forEach(doc => {
    const data = doc.data();
    const h = data.originalHeaders || {};
    console.log("ID:", doc.id);
    console.log("type of event:", h['type of event']);
    console.log("category:", h['category']);
    console.log("days:", h['days']);
    console.log("start date:", h['start date']);
    console.log("start time:", h['start time']);
    console.log("----------------------");
  });
  process.exit(0);
}
run();
