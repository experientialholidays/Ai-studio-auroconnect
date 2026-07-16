const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const config = require('./firebase-applet-config.json');

const app = initializeApp({ projectId: config.projectId });
const db = getFirestore(app, config.firestoreDatabaseId || "(default)");

async function test() {
  try {
    const colRef = db.collection('events');
    const dummyVector = FieldValue.vector(new Array(768).fill(0.1));
    const vectorQuery = colRef.findNearest('embeddingVector', dummyVector, {
      limit: 10,
      distanceMeasure: 'COSINE'
    });
    
    await vectorQuery.get();
    console.log("Success (Index exists)");
  } catch (err) {
    console.error("Error Message:");
    console.error(err.message);
  }
}
test();
