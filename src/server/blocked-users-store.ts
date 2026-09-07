import { db, adminDb } from "./firebase-ai.js";
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from "firebase/firestore";

export interface BlockedUserEntry {
  id: string;
  email: string;
  blockedAt: string;
  blockedBy: string;
  reason: string;
}

export async function getBlockedUsers(): Promise<BlockedUserEntry[]> {
  const list: BlockedUserEntry[] = [];
  try {
    const snap = await getDocs(collection(db, "blocked_users"));
    snap.forEach((d) => {
      const data = d.data();
      const email = (data.email || d.id).trim().toLowerCase();
      if (email) {
        list.push({
          id: email,
          email: email,
          blockedAt: data.blockedAt || new Date().toISOString(),
          blockedBy: data.blockedBy || "Admin",
          reason: data.reason || "Blocked by administrator"
        });
      }
    });
  } catch (err: any) {
    console.error("Error fetching blocked users from Firestore:", err.message || err);
  }
  return list;
}

export async function isEmailBlocked(email: string): Promise<boolean> {
  if (!email) return false;
  const clean = email.trim().toLowerCase();

  try {
    const docSnap = await getDoc(doc(db, "blocked_users", clean));
    if (docSnap.exists()) return true;

    const encSnap = await getDoc(doc(db, "blocked_users", encodeURIComponent(clean)));
    if (encSnap.exists()) return true;
  } catch (_err) {
    try {
      const docSnapAdmin = await adminDb.collection("blocked_users").doc(clean).get();
      if (docSnapAdmin.exists) return true;
    } catch (_e) {
      // Ignore
    }
  }

  return false;
}

export async function blockUser(
  email: string,
  blockedBy: string = "Admin",
  reason: string = "Blocked by administrator"
): Promise<BlockedUserEntry> {
  const clean = email.trim().toLowerCase();
  const entry: BlockedUserEntry = {
    id: clean,
    email: clean,
    blockedAt: new Date().toISOString(),
    blockedBy: blockedBy || "Admin",
    reason: reason || "Blocked by administrator"
  };

  try {
    await setDoc(doc(db, "blocked_users", clean), entry);
  } catch (_err) {
    try {
      await adminDb.collection("blocked_users").doc(clean).set(entry);
    } catch (_e) {
      console.error("Error blocking user in Firestore:", _e);
    }
  }

  return entry;
}

export async function unblockUser(email: string): Promise<boolean> {
  if (!email) return false;
  const clean = decodeURIComponent(email).trim().toLowerCase();

  try {
    await deleteDoc(doc(db, "blocked_users", clean));
    await deleteDoc(doc(db, "blocked_users", encodeURIComponent(clean)));
    return true;
  } catch (_err) {
    try {
      await adminDb.collection("blocked_users").doc(clean).delete();
      await adminDb.collection("blocked_users").doc(encodeURIComponent(clean)).delete();
      return true;
    } catch (_e) {
      console.error("Error unblocking user in Firestore:", _e);
      return false;
    }
  }
}




