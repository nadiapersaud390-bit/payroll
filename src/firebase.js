import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDnyxAjuambKegUkyMc-yWHEdMMRgdgsVU",
  authDomain: "payroll-fd56f.firebaseapp.com",
  projectId: "payroll-fd56f",
  storageBucket: "payroll-fd56f.firebasestorage.app",
  messagingSenderId: "191190737335",
  appId: "1:191190737335:web:5ad07a94330b47ff024832",
  measurementId: "G-BNYCJ00ZZL",
  // Replace with the exact URL shown in Firebase Console > Realtime Database.
  databaseURL: "https://payroll-fd56f-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
