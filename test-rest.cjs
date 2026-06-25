const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

async function test() {
  const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId || '(default)'}/documents:runQuery`;
  
  const values = new Array(768).fill({ doubleValue: 0.1 });
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'events' }],
      findNearest: {
        vectorField: { fieldPath: 'embeddingVector' },
        queryVector: {
          value: { listValue: { values } }
        },
        distanceMeasure: 'COSINE',
        limit: 10
      }
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
}
test();
