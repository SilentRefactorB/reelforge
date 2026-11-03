// Anonymous auth + /presence/<uid>: each visitor writes its own node on arrival
// and removes it on disconnect (onDisconnect). Counts children for "connected now".
import { firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

export function initPresence(onCount, onError) {
  signInAnonymously(auth).catch((error) => {
    if (onError) onError(error);
  });

  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    const myRef = ref(db, "presence/" + user.uid);
    set(myRef, true).catch((error) => {
      if (onError) onError(error);
    });
    onDisconnect(myRef).remove();
  });

  const presenceRef = ref(db, "presence");
  onValue(
    presenceRef,
    (snapshot) => {
      const val = snapshot.val();
      onCount(val ? Object.keys(val).length : 0);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}
