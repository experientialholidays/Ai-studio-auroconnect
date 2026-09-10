import { collection, getDocs, doc, setDoc, deleteDoc, getDoc } from "firebase/firestore";
import { db, adminDb } from "./firebase-ai.js";

export interface BlockedUserEntry {
  email: string;
  blockedAt: string;
  blockedBy: string;
  reason?: string;
}

export async function getBlockedUsers(): Promise<BlockedUserEntry[]> {
  const list: BlockedUserEntry[] = [];
  try {
    if (adminDb) {
      const snap = await adminDb.collection("blocked_users").get();
      snap.forEach((doc) => {
        const data = doc.data();
        if (data) {
          list.push({
            email: (data.email || doc.id).toLowerCase(),
            blockedAt: data.blockedAt || new Date().toISOString(),
            blockedBy: data.blockedBy || "Admin",
            reason: data.reason || "Blocked by administrator"
          });
        }
      });
      return list;
    }
    const snap = await getDocs(collection(db, "blocked_users"));
    snap.forEach((doc) => {
      const data = doc.data();
      if (data) {
        list.push({
          email: (data.email || doc.id).toLowerCase(),
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
    if (adminDb) {
      const docSnapAdmin = await adminDb.collection("blocked_users").doc(clean).get();
      if (docSnapAdmin.exists) return true;
      const docSnapEnc = await adminDb.collection("blocked_users").doc(encodeURIComponent(clean)).get();
      return docSnapEnc.exists;
    }
    const docSnap = await getDoc(doc(db, "blocked_users", clean));
    if (docSnap.exists()) return true;
    const encSnap = await getDoc(doc(db, "blocked_users", encodeURIComponent(clean)));
    return encSnap.exists();
  } catch (err: any) {
    console.error("Error checking blocked status in Firestore:", err.message || err);
    return false;
  }
}

export async function blockUser(
  emailToBlock: string,
  blockedBy: string = "Admin",
  reason: string = "Blocked by administrator"
): Promise<BlockedUserEntry> {
  const clean = emailToBlock.trim().toLowerCase();
  const entry: BlockedUserEntry = {
    email: clean,
    blockedAt: new Date().toISOString(),
    blockedBy: blockedBy || "Admin",
    reason: reason || "Blocked by administrator"
  };

  try {
    if (adminDb) {
      await adminDb.collection("blocked_users").doc(clean).set(entry);
    } else {
      await setDoc(doc(db, "blocked_users", clean), entry);
    }
  } catch (_e) {
    console.error("Error blocking user in Firestore:", _e);
  }

  return entry;
}

export async function unblockUser(email: string): Promise<boolean> {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  try {
    if (adminDb) {
      await adminDb.collection("blocked_users").doc(clean).delete();
      await adminDb.collection("blocked_users").doc(encodeURIComponent(clean)).delete();
    } else {
      await deleteDoc(doc(db, "blocked_users", clean));
      await deleteDoc(doc(db, "blocked_users", encodeURIComponent(clean)));
    }
    return true;
  } catch (_e) {
    console.error("Error unblocking user in Firestore:", _e);
    return false;
  }
    }
