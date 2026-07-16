const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");

const config = {
  projectId: "gen-lang-client-0039539258",
  appId: "1:615927626963:web:af7cd31a3a9859919fe826",
  apiKey: "AIzaSyBE_i3Y6SXSfmFfZ_ptMclJT0GySmA0dlM",
  authDomain: "gen-lang-client-0039539258.firebaseapp.com",
  storageBucket: "gen-lang-client-0039539258.firebasestorage.app",
  messagingSenderId: "615927626963",
  firestoreDatabaseId: "ai-studio-64cdf999-24b6-49a7-bf7c-8606ad4d20d4"
};

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId || "(default)");

getDocs(collection(db, "events")).then(snap => {
  snap.forEach(doc => {
    const d = doc.data();
    if (d.title && d.title.includes("Listen to Your Heart")) {
      console.log("Found event:", JSON.stringify(d, null, 2));
    }
  });
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
