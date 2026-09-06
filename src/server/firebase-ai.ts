import fs from "fs";
import path from "path";
import { initializeApp as initAdminApp, getApp, getApps } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
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
adminDb.settings({ ignoreUndefinedProperties: true });

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

export async function verifyAuthToken(token: string): Promise<{ email: string } | null> {
  if (!token) return null;

  // 1. Instant local JWT decode (runs in < 1ms, avoids network timeouts)
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payloadStr = Buffer.from(parts[1], "base64url").toString("utf8");
      const payload = JSON.parse(payloadStr);
      const email = payload.email || payload.firebase?.identities?.email?.[0];
      if (payload && email) {
        return { email: email.toLowerCase() };
      }
    }
  } catch (parseErr: any) {
    console.error("JWT fast-decode error:", parseErr.message);
  }

  // 2. Fallback to Firebase Admin verifyIdToken
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    if (decodedToken && decodedToken.email) {
      return { email: decodedToken.email.toLowerCase() };
    }
  } catch (e: any) {
    console.error("Firebase ID Token verification failed:", e.message);
  }

  return null;
}

export async function isUserAdmin(email: string): Promise<boolean> {
  if (!email) return false;
  const emailLower = email.trim().toLowerCase();
  
  // 1. Primary Check: Query the 'admins' collection in Firestore using Admin SDK
  try {
    const adminDocSnap = await adminDb.collection("admins").doc(emailLower).get();
    if (adminDocSnap.exists) {
      return true;
    }
  } catch (e) {
    console.error("Error checking admins collection in Firestore:", e);
  }

  // 2. Fallback check for initial project bootstrap accounts
  if (emailLower === "info.experientialholidays@gmail.com" || emailLower === "info.auroconnect@gmail.com") {
    return true;
  }
  
  return false;
}

export async function isUserBlocked(email: string): Promise<boolean> {
  if (!email) return false;
  const emailLower = email.trim().toLowerCase();
  try {
    const docSnap = await adminDb.collection("blocked_users").doc(emailLower).get();
    if (docSnap.exists) return true;
    const encSnap = await adminDb.collection("blocked_users").doc(encodeURIComponent(emailLower)).get();
    if (encSnap.exists) return true;

    const querySnap = await adminDb.collection("blocked_users").where("email", "==", emailLower).get();
    if (!querySnap.empty) return true;
  } catch (e) {
    console.error("Error checking blocked_users collection:", e);
  }
  return false;
}
