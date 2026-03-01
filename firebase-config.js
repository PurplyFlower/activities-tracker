// firebase-config.js
// 1) Create a Firebase project
// 2) Enable Authentication: Email/Password
// 3) Create Firestore database
// 4) Add a Web App and paste its config below

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// TODO: paste your Firebase web app config here:
const firebaseConfig = {
  apiKey: "AIzaSyD9_L1PJhAoGTuuKqa-B52JL0POgULk4Sc",
  authDomain: "activities-tracker-24cfb.firebaseapp.com",
  projectId: "activities-tracker-24cfb",
  storageBucket: "activities-tracker-24cfb.firebasestorage.app",
  messagingSenderId: "287314551868",
  appId: "1:287314551868:web:3af2a236f4601630724f39"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
