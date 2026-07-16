import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query, where } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId || "(default)");

async function test() {
  try {
    const colRef = collection(db, 'events');
    const snapshot = await getDocs(colRef);
    const doc = snapshot.docs.find(d => d.data().embeddingVector);
    if (!doc) {
      console.log("No docs with embeddingVector found");
      process.exit(0);
    }
    const data = doc.data();
    console.log("Vector type:", typeof data.embeddingVector);
    console.log("Vector keys:", Object.keys(data.embeddingVector));
    if (data.embeddingVector.toArray) {
      console.log("toArray works! length:", data.embeddingVector.toArray().length);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
  process.exit(0);
}
test();
