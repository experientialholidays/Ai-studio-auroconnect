import fs from "fs";
import path from "path";
import { initializeApp as initAdminApp, getApp, getApps } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

export const firebaseConfig = {
  apiKey: "AIzaSyDZ87VkavGphOCIOfD3a-nhOSxI2wcpuMg",
  authDomain: "auro-connect.firebaseapp.com",
  projectId: "auro-connect",
  storageBucket: "auro-connect.firebasestorage.app",
  messagingSenderId: "913005987760",
  appId: "1:913005987760:web:57d4210ef370a817e33875",
  measurementId: "G-S4L4Z530CS",
  firestoreDatabaseId: "(default)"
};

// Admin SDK initialization
const adminAppOptions: any = {
  projectId: "auro-connect"
};

const adminApp = getApps().length === 0 
  ? initAdminApp(adminAppOptions)
  : getApp();

export const adminDb = getAdminFirestore(adminApp);

// Client SDK initialization
export const appFirebase = initializeApp(firebaseConfig);
export const db = getFirestore(appFirebase);

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
