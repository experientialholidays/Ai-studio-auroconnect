import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, getDocs } from 'firebase/firestore';
import { vector } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId || "(default)");

async function test() {
  try {
    const colRef = collection(db, 'events');
    const dummyVector = vector(new Array(768).fill(0.1));
    // Web SDK doesn't have findNearest? Wait. Wait, Web SDK has vector search in 11.x maybe?
    // Let's import findNearest dynamically if it's there.
    const firestore = await import('firebase/firestore');
    
    console.log("Exports:", Object.keys(firestore).filter(k => k.toLowerCase().includes('nearest') || k.toLowerCase().includes('vector')));
    
    if (firestore.findNearest) {
      // It exists!
      const vectorQuery = query(colRef, firestore.findNearest('embeddingVector', dummyVector, {
        limit: 10,
        distanceMeasure: 'COSINE'
      }));
      await getDocs(vectorQuery);
      console.log("Success (Index exists)");
    } else {
      console.log("No findNearest exported by Web SDK");
    }
  } catch (err) {
    console.error("Error Message:", err.message);
  }
  process.exit(0);
}
test();
