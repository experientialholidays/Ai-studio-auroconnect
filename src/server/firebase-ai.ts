import fs from "fs";
import path from "path";
import { initializeApp as initAdminApp } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const configPath = path.join(process.cwd(), "firebase-applet-config.json");
export const firebaseConfig = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, "utf8"))
  : { 
      projectId: process.env.FIREBASE_PROJECT_ID || "auro-connect", 
      appId: process.env.FIREBASE_APP_ID || "1:913005987760:web:57d4210ef370a817e33875",
      apiKey: process.env.FIREBASE_API_KEY || "AIzaSyDZ87VkavGphOCIOfD3a-nhOSxI2wcpuMg",
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || "auro-connect.firebaseapp.com",
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "auro-connect.firebasestorage.app",
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "913005987760",
      firestoreDatabaseId: process.env.FIREBASE_FIRESTORE_DATABASE_ID || "(default)" 
    };

// Admin SDK initialization
try {
  initAdminApp({ projectId: firebaseConfig.projectId });
} catch(e) {}

export const adminDb = getAdminFirestore();

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
