import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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
  const colRef = collection(db, "knowledge");
  const snap = await getDocs(colRef);
  console.log("Total chunks:", snap.size);
  let files = {};
  snap.forEach(doc => {
    const data = doc.data();
    files[data.filename] = (files[data.filename] || 0) + 1;
  });
  console.log("Files:", files);
  process.exit(0);
}
run();
