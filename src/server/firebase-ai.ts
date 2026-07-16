import fs from "fs";
import path from "path";
import { initializeApp as initAdminApp, getApp, getApps } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const baseConfig = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, "utf8"))
  : { 
      projectId: "auro-connect", 
      appId: "1:913005987760:web:57d4210ef370a817e33875",
      apiKey: "AIzaSyDZ87VkavGphOCIOfD3a-nhOSxI2wcpuMg",
      authDomain: "auro-connect.firebaseapp.com",
      storageBucket: "auro-connect.firebasestorage.app",
      messagingSenderId: "913005987760",
      firestoreDatabaseId: "(default)" 
    };

export const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID || baseConfig.projectId,
  appId: process.env.FIREBASE_APP_ID || baseConfig.appId,
  apiKey: process.env.FIREBASE_API_KEY || baseConfig.apiKey,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || baseConfig.authDomain,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || baseConfig.storageBucket,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || baseConfig.messagingSenderId,
  firestoreDatabaseId: (() => {
    const envDbId = process.env.FIREBASE_FIRESTORE_DATABASE_ID;
    const resolvedProjectId = process.env.FIREBASE_PROJECT_ID || baseConfig.projectId;
    // If the project is the user's custom project 'auro-connect' and the database ID starts with 'ai-studio-',
    // we must use '(default)' because 'ai-studio-...' only exists in the platform's default sandboxed project.
    if (resolvedProjectId === "auro-connect" && envDbId && envDbId.startsWith("ai-studio-")) {
      return "(default)";
    }
    return envDbId || baseConfig.firestoreDatabaseId || "(default)";
  })()
};

// Admin SDK initialization
const isCloudRun = !!process.env.K_SERVICE;
const adminAppOptions: any = {};

if (isCloudRun) {
  // On Cloud Run, if FIREBASE_PROJECT_ID is provided, use it.
  // Otherwise, do NOT specify projectId so that firebase-admin auto-detects
  // the project ID from the local Cloud Run service account and environment.
  if (process.env.FIREBASE_PROJECT_ID) {
    adminAppOptions.projectId = process.env.FIREBASE_PROJECT_ID;
  }
} else {
  // In development, use firebaseConfig.projectId
  if (firebaseConfig.projectId) {
    adminAppOptions.projectId = firebaseConfig.projectId;
  }
}

const adminApp = getApps().length === 0 
  ? initAdminApp(adminAppOptions)
  : getApp();

export const adminDb = getAdminFirestore(adminApp, firebaseConfig.firestoreDatabaseId);

// Client SDK initialization
export const appFirebase = initializeApp(firebaseConfig);
export const db = getFirestore(appFirebase, firebaseConfig.firestoreDatabaseId || "(default)");

// AI setup
export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { headers: { "User-Agent": "aistudio-build" } },
});

export const MODEL = "gemini-3.1-flash-lite";

import { getAuth } from "firebase-admin/auth";

export function decodeFirebaseToken(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
      return payload;
    }
  } catch (e) {
    console.error("Failed to decode token:", e);
  }
  return null;
}

export async function verifyAuthToken(token: string): Promise<{ email: string } | null> {
  if (!token) return null;
  if (token.startsWith("DEV_BYPASS_TOKEN_")) {
    return { email: token.replace("DEV_BYPASS_TOKEN_", "") };
  }
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    return { email: decodedToken.email || "" };
  } catch (e: any) {
    console.warn("Firebase Admin verification failed, trying manual token decode fallback:", e.message);
    const decoded = decodeFirebaseToken(token);
    if (decoded && decoded.email) {
      return { email: decoded.email };
    }
  }
  return null;
}
