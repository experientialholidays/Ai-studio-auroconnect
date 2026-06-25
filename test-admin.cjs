const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const config = require('./firebase-applet-config.json');

const app = initializeApp({ projectId: config.projectId });
const db = getFirestore(app, config.firestoreDatabaseId || "(default)");

async function test() {
  try {
    const colRef = db.collection('events');
    const snapshot = await colRef.limit(1).get();
    console.log("Admin SDK Success! Docs count:", snapshot.docs.length);
  } catch (err) {
    console.error("Error:", err.message);
  }
}
test();
